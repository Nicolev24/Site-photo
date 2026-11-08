// Page client de l'espace galeries. Ne réutilise pas js/render.js /
// js/sections-renderer.js (pensés pour le modèle de "sections" du CMS) :
// cette page affiche un contenu dynamique venant du Worker, pas de
// content/pages/*.json. Le menu et le pied de page sont reconstruits ici
// à partir des mêmes fichiers (content/navigation.json,
// content/appearance.json), en lecture seule — rien n'est modifié dans
// les fichiers ou scripts existants du CMS.

const API_BASE = "https://galerie-api.nicoleveugle.workers.dev";
const LAST_GALLERY_KEY = "galerie-last-token";
// Shootings ouverts « en client » (mot de passe tapé) sur ce navigateur : [{ cle, token, name }].
// L'espace client n'affiche que ceux-là. Un invité n'y laisse aucune trace.
const CLIENTS_KEY = "galerie-clients";

function lireClients() {
  try {
    const liste = JSON.parse(localStorage.getItem(CLIENTS_KEY) || "[]");
    return Array.isArray(liste) ? liste.filter((e) => e && typeof e.cle === "string" && typeof e.token === "string") : [];
  } catch {
    return [];
  }
}

function ecrireClients(liste) {
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(liste));
  } catch {
    // stockage indisponible (navigation privée…) : l'accès marche, mais ne sera pas retrouvé plus tard
  }
}

const idDeCle = (cle) => String(cle).split(".")[0];

function memoriserClient(cle, token, name) {
  const autres = lireClients().filter((e) => idDeCle(e.cle) !== idDeCle(cle));
  ecrireClients([{ cle, token, name: name || "" }, ...autres]);
}

function oublierClient(cle) {
  ecrireClients(lireClients().filter((e) => e.cle !== cle));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ---------- Menu / pied de page (lecture seule) ----------

function buildNav(navigation) {
  const navList = document.getElementById("nav-links");
  navList.innerHTML = navigation.nav_links
    .map((link) => `<li><a href="../${link.href}">${escapeHtml(link.label)}</a></li>`)
    .join("");
  const cta = document.getElementById("header-cta");
  if (navigation.cta_button) {
    cta.href = `../${navigation.cta_button.href}`;
    cta.textContent = navigation.cta_button.label;
  }
}

async function buildFooter(navigation) {
  const footerLinks = document.getElementById("footer-links");
  let html = navigation.footer_links.map((l) => `<li><a href="../${l.href}">${escapeHtml(l.label)}</a></li>`).join("");
  try {
    const res = await fetch("../content/contact.json", { cache: "no-cache" });
    if (res.ok) {
      const contact = await res.json();
      if (contact.instagram_url) {
        html += `<li><a href="${escapeHtml(contact.instagram_url)}" target="_blank" rel="noopener">${escapeHtml(contact.instagram_handle || "Instagram")}</a></li>`;
      }
    }
  } catch {
    // silencieux : le pied de page reste utilisable sans ce lien
  }
  (navigation.footer_legal_links || []).forEach((l) => {
    html += `<li><a href="../${l.href}">${escapeHtml(l.label)}</a></li>`;
  });
  footerLinks.innerHTML = html;

  const copy = document.getElementById("footer-copy");
  copy.innerHTML = `© ${new Date().getFullYear()} ${escapeHtml(navigation.copyright_text || "")}`;
}

function applyAppearance(appearance) {
  const root = document.documentElement;
  if (appearance.accent_color) root.style.setProperty("--couleur-accent", appearance.accent_color);
  if (appearance.accent_color_dark) root.style.setProperty("--couleur-accent-fonce", appearance.accent_color_dark);
  document.querySelectorAll(".js-logo").forEach((el) => {
    if (appearance.logo_image) {
      el.innerHTML = `<img src="../${appearance.logo_image}" alt="${escapeHtml(appearance.logo_text || "")}" style="height:28px;display:block" />`;
    } else {
      el.textContent = appearance.logo_text || "";
    }
  });
}

// ---------- Galerie ----------

function photoUrl(token, filename, variant, download) {
  let url = `${API_BASE}/api/gallery/${encodeURIComponent(token)}/photo/${encodeURIComponent(filename)}?variant=${variant}`;
  if (download) url += "&download=1";
  return url;
}

let allPhotos = [];
let currentPhotos = [];
let currentIndex = -1;
let currentToken = null;
let cleClient = null; // clé « client » (mot de passe tapé), absente pour un invité
let peutFavoris = true; // faux pour un invité sur une galerie protégée

// ---------- Favoris (le cœur sur chaque photo) ----------

let favoris = new Set();
let filtreFavoris = false;
let minuterieFavoris = null;

function estFavori(filename) {
  return favoris.has(filename);
}

function basculerFavori(filename) {
  if (!peutFavoris) return; // l'invité n'a pas les cœurs : la sélection est celle du client
  if (favoris.has(filename)) favoris.delete(filename);
  else favoris.add(filename);
  document.querySelectorAll(`[data-favori="${CSS.escape(filename)}"]`).forEach((el) => {
    el.classList.toggle("actif", favoris.has(filename));
    el.setAttribute("aria-pressed", String(favoris.has(filename)));
  });
  majBarreFavoris();
  if (filtreFavoris && !favoris.has(filename)) renderGrid();
  // On enregistre un peu après le dernier clic.
  clearTimeout(minuterieFavoris);
  afficherEtatFavoris("Enregistrement…");
  minuterieFavoris = setTimeout(enregistrerFavoris, 700);
}

async function enregistrerFavoris() {
  try {
    const res = await fetch(`${API_BASE}/api/gallery/${encodeURIComponent(currentToken)}/favoris`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cleClient ? { "X-Cle-Client": cleClient } : {}) },
      body: JSON.stringify({ photos: [...favoris] }),
    });
    if (!res.ok) throw new Error();
    afficherEtatFavoris("Vos favoris sont enregistrés ✓");
  } catch {
    afficherEtatFavoris("Pas de connexion : vos favoris seront enregistrés au prochain clic.");
  }
}

function afficherEtatFavoris(texte) {
  const el = document.getElementById("favoris-etat");
  if (el) el.textContent = texte;
}

function majBarreFavoris() {
  const barre = document.getElementById("favoris-barre");
  if (!barre) return;
  barre.hidden = allPhotos.length === 0;
  const notes = document.getElementById("galerie-notes");
  if (notes) notes.hidden = barre.hidden;
  document.getElementById("filtre-tout").classList.toggle("actif", !filtreFavoris);
  document.getElementById("filtre-favoris").classList.toggle("actif", filtreFavoris);
  document.getElementById("favoris-compte").textContent = String(favoris.size);
  majBoutonToutTelecharger();
}

function changerFiltre(seulementFavoris) {
  filtreFavoris = seulementFavoris;
  selection.clear();
  majBarreFavoris();
  renderGrid();
}

const coeur = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>`;

async function fetchGallery(token, cle) {
  try {
    const res = await fetch(`${API_BASE}/api/gallery/${encodeURIComponent(token)}`, {
      headers: cle ? { "X-Cle-Client": cle } : {},
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function afficherGalerie(token, gallery, cle) {
  quitterChoix();
  currentToken = token;
  cleClient = cle || null;
  peutFavoris = gallery.peutFavoris !== false;
  document.documentElement.classList.toggle("sans-coeurs", !peutFavoris);
  const aide = document.getElementById("favoris-aide");
  if (aide && !peutFavoris) {
    aide.textContent = "Vous consultez cette galerie en tant qu'invité : vous pouvez voir et télécharger toutes les photos. Pour la retrouver plus tard, gardez le lien reçu.";
  }
  allPhotos = gallery.photos || [];
  currentPhotos = allPhotos;
  favoris = new Set(peutFavoris ? gallery.favoris || [] : []);
  majBarreFavoris();
  if (!gallery.protegee) {
    // Galerie sans mot de passe (ancien fonctionnement) : le navigateur s'en souvient comme avant.
    try {
      localStorage.setItem(LAST_GALLERY_KEY, token);
    } catch {}
  }
  if (gallery.client && cle) {
    memoriserClient(cle, token, gallery.name);
    ["couverture-retour", "lien-mes-shootings"].forEach((id) => (document.getElementById(id).hidden = false));
  }
  document.getElementById("gallery-heading").textContent = gallery.name;
  document.getElementById("gallery-subheading").textContent = gallery.title || "";
  afficherMot(gallery);
  afficherCouverture(gallery);
  renderGrid();
}

// ---------- Accès : « client » (mot de passe) ou « invité » (lien seul) ----------

async function fetchAccueil(token) {
  try {
    const res = await fetch(`${API_BASE}/api/gallery/${encodeURIComponent(token)}/accueil`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function poserImageCouverture(token, filename) {
  document.getElementById("couverture-flou").src = photoUrl(token, filename, "thumb");
  const nette = document.getElementById("couverture-nette");
  const chargement = new Image();
  chargement.onload = () => {
    nette.src = chargement.src;
    nette.classList.add("est-chargee");
  };
  chargement.src = photoUrl(token, filename, "original");
}

let choixToken = null;

// L'écran de choix reprend la couverture : nom du shooting sur la photo, deux boutons.
function afficherChoix(token, accueil) {
  choixToken = token;
  const racine = document.documentElement;
  racine.classList.add("acces-en-cours", "sur-couverture");
  document.getElementById("couverture-nom").textContent = accueil.name || "Vos photos";
  document.getElementById("couverture-titre").textContent = accueil.title || "";
  document.getElementById("couverture-compte").textContent = "";
  document.getElementById("couverture-voir").hidden = true;
  if (accueil.couverture) poserImageCouverture(token, accueil.couverture);
  document.getElementById("acces-choix").hidden = false;
  document.getElementById("acces-aide").hidden = false;
  document.getElementById("acces-form").hidden = true;
  document.getElementById("couverture-acces").hidden = false;
  document.getElementById("galerie-couverture").hidden = false;
}

function quitterChoix() {
  document.documentElement.classList.remove("acces-en-cours");
  document.getElementById("couverture-acces").hidden = true;
  document.getElementById("couverture-voir").hidden = false;
  document.getElementById("galerie-couverture").hidden = true; // afficherCouverture la remontre s'il y a des photos
  document.documentElement.classList.remove("sur-couverture");
}

document.getElementById("acces-invite").addEventListener("click", async () => {
  const token = choixToken;
  const gallery = await fetchGallery(token, null);
  if (!gallery) {
    quitterChoix();
    showEmptyState();
    return;
  }
  afficherGalerie(token, gallery, null);
});

document.getElementById("acces-client").addEventListener("click", () => {
  document.getElementById("acces-choix").hidden = true;
  document.getElementById("acces-aide").hidden = true;
  document.getElementById("acces-form").hidden = false;
  document.getElementById("acces-erreur").hidden = true;
  document.getElementById("acces-mdp").focus();
});

document.getElementById("acces-retour").addEventListener("click", () => {
  document.getElementById("acces-form").hidden = true;
  document.getElementById("acces-choix").hidden = false;
  document.getElementById("acces-aide").hidden = false;
});

document.getElementById("acces-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const champ = document.getElementById("acces-mdp");
  const erreur = document.getElementById("acces-erreur");
  const bouton = document.getElementById("acces-entrer");
  const motdepasse = champ.value.trim();
  if (!motdepasse) return;
  erreur.hidden = true;
  bouton.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/gallery/${encodeURIComponent(choixToken)}/client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motdepasse }),
    });
    const corps = await res.json().catch(() => ({}));
    if (!res.ok) {
      erreur.textContent = res.status === 429 ? "Trop d'essais. Patientez quelques minutes, puis réessayez." : "Mot de passe incorrect. Vérifiez l'e-mail reçu.";
      erreur.hidden = false;
      champ.select();
      return;
    }
    const gallery = await fetchGallery(choixToken, corps.cle);
    if (!gallery) throw new Error();
    afficherGalerie(choixToken, gallery, corps.cle);
  } catch {
    erreur.textContent = "Connexion impossible pour le moment. Réessayez dans un instant.";
    erreur.hidden = false;
  } finally {
    bouton.disabled = false;
  }
});

// Ouverture par le lien : déjà client sur ce navigateur → on entre directement ;
// sinon écran de choix (si la galerie a un mot de passe) ; sinon comme avant.
async function ouvrirAvecLien(token) {
  const connu = lireClients().find((e) => e.token === token);
  if (connu) {
    const gallery = await fetchGallery(token, connu.cle);
    if (gallery && gallery.client) return afficherGalerie(token, gallery, connu.cle);
    if (gallery) oublierClient(connu.cle); // mot de passe changé depuis : il faudra le retaper
  }
  const accueil = await fetchAccueil(token);
  if (accueil && accueil.protegee) return afficherChoix(token, accueil);
  const gallery = await fetchGallery(token, null);
  if (!gallery) {
    if (localStorage.getItem(LAST_GALLERY_KEY) === token) localStorage.removeItem(LAST_GALLERY_KEY);
    return showEmptyState();
  }
  afficherGalerie(token, gallery, null);
}

// ---------- Espace client : la liste des shootings ouverts en client ----------

async function afficherEspace() {
  document.documentElement.classList.add("espace-actif");
  document.getElementById("espace-liste").hidden = false;
  const cartes = document.getElementById("espace-cartes");
  cartes.innerHTML = `<p class="espace-chargement">Chargement…</p>`;

  let galeries = [];
  const entrees = lireClients();
  if (entrees.length) {
    try {
      const res = await fetch(`${API_BASE}/api/espace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cles: entrees.map((e) => e.cle) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      galeries = data.galeries || [];
      ecrireClients(galeries.map((g) => ({ cle: g.cle, token: g.token, name: g.name })));
    } catch {
      // Hors connexion : on affiche ce que ce navigateur connaît, sans photo de couverture.
      galeries = entrees.map((e) => ({ cle: e.cle, token: e.token, name: e.name, title: "", photoCount: null, couverture: null }));
    }
  }

  // Ancien fonctionnement : une galerie sans mot de passe ouverte sur ce navigateur.
  const ancien = localStorage.getItem(LAST_GALLERY_KEY);
  if (ancien && !galeries.some((g) => g.token === ancien)) {
    const accueil = await fetchAccueil(ancien);
    if (accueil && !accueil.protegee) {
      galeries.push({ token: ancien, name: accueil.name, title: accueil.title, photoCount: null, couverture: accueil.couverture });
    }
  }

  cartes.innerHTML = "";
  document.getElementById("espace-vide").hidden = galeries.length > 0;
  document.getElementById("espace-note").hidden = galeries.length === 0;
  document.getElementById("espace-intro").hidden = galeries.length === 0;
  galeries.forEach((g) => {
    const lien = document.createElement("a");
    lien.className = "espace-carte";
    lien.href = `?g=${encodeURIComponent(g.token)}`;
    const nb = g.photoCount ? `${g.photoCount} photo${g.photoCount > 1 ? "s" : ""}` : "";
    lien.innerHTML = `
      <span class="espace-photo">${g.couverture ? `<img src="${photoUrl(g.token, g.couverture, "thumb")}" alt="" loading="lazy" decoding="async" />` : ""}</span>
      <span class="espace-texte">
        <strong class="espace-nom">${escapeHtml(g.name)}</strong>
        ${g.title ? `<span class="espace-titre">${escapeHtml(g.title)}</span>` : ""}
        <span class="espace-pied"><span>${escapeHtml(nb)}</span><span class="espace-ouvrir">Ouvrir →</span></span>
      </span>`;
    const img = lien.querySelector("img");
    if (img) {
      const charge = () => img.classList.add("charge");
      if (img.complete && img.naturalWidth) charge();
      else img.addEventListener("load", charge, { once: true });
    }
    cartes.appendChild(lien);
  });
}

// Couverture plein écran : la première photo, avec le nom de la galerie. La
// version légère s'affiche tout de suite, la photo nette la remplace en fondu.
function afficherCouverture(gallery) {
  const couverture = document.getElementById("galerie-couverture");
  const premiere = allPhotos[0];
  if (!couverture || !premiere) return;
  document.getElementById("couverture-nom").textContent = gallery.name || "Vos photos";
  document.getElementById("couverture-titre").textContent = gallery.title || "";
  document.getElementById("couverture-compte").textContent = `${allPhotos.length} photo${allPhotos.length > 1 ? "s" : ""}`;
  poserImageCouverture(currentToken, premiere.filename);
  couverture.hidden = false;
  // La barre d'outils flottante reste cachée tant que la couverture occupe l'écran.
  document.documentElement.classList.add("sur-couverture");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([e]) => document.documentElement.classList.toggle("sur-couverture", e.intersectionRatio > 0.55),
      { threshold: [0, 0.3, 0.55, 0.8, 1] }
    ).observe(couverture);
  } else {
    document.documentElement.classList.remove("sur-couverture");
  }
  const entete = document.querySelector(".page-header");
  if (entete) entete.hidden = true;
  document.getElementById("couverture-voir").addEventListener("click", (e) => {
    e.preventDefault();
    const mot = document.getElementById("galerie-mot");
    const cible = (mot && !mot.hidden ? mot : null) || document.getElementById("gallery-grid");
    cible.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
}

// Un mot personnel de Nicolas, sous la couverture (facultatif, écrit dans l'admin).
function afficherMot(gallery) {
  const mot = document.getElementById("galerie-mot");
  const texte = (gallery.message || "").trim();
  if (!mot || !texte) return;
  // Typographie française : espace insécable avant « ! ? : ; » pour que la ponctuation ne passe jamais seule à la ligne.
  document.getElementById("mot-texte").textContent = texte.replace(/ ([!?:;»])/g, "\u00a0$1").replace(/(«) /g, "$1\u00a0");
  mot.hidden = false;
}

function showEmptyState() {
  document.getElementById("gallery-empty-state").hidden = false;
}


function renderGrid() {
  const grid = document.getElementById("gallery-grid");
  grid.innerHTML = "";

  currentPhotos = filtreFavoris ? allPhotos.filter((p) => favoris.has(p.filename)) : allPhotos;

  if (!allPhotos.length) {
    grid.innerHTML = `<p class="lead">Vos photos arrivent bientôt — repassez un peu plus tard.</p>`;
    return;
  }
  if (!currentPhotos.length) {
    grid.innerHTML = `<p class="lead">Pas encore de favoris : touchez le cœur sur les photos que vous préférez.</p>`;
    return;
  }

  // Mise en page « maçonnerie » : les photos gardent leurs proportions et se répartissent
  // en colonnes, de gauche à droite (la 1re en haut à gauche, la 2e à côté, etc.).
  const n = nbColonnes();
  colonnesAffichees = n;
  const colonnes = Array.from({ length: n }, () => {
    const c = document.createElement("div");
    c.className = "g-col";
    grid.appendChild(c);
    return c;
  });
  currentPhotos.forEach((photo, index) => {
    const tile = document.createElement("div");
    tile.className = `galerie-client-tile${selection.has(photo.filename) ? " est-selectionnee" : ""}`;
    tile.dataset.photo = photo.filename;
    const actif = estFavori(photo.filename);
    tile.innerHTML = `
      <img src="${photoUrl(currentToken, photo.filename, "thumb")}" alt="" loading="lazy" decoding="async" />
      <button type="button" class="tile-coche" aria-pressed="${selection.has(photo.filename)}" title="Sélectionner cette photo">${coche}</button>
      <button type="button" class="tile-favori${actif ? " actif" : ""}" data-favori="${escapeHtml(photo.filename)}" aria-pressed="${actif}" title="Ajouter à mes favoris">${coeur}</button>
      <button type="button" class="tile-download" title="Télécharger cette photo" aria-label="Télécharger cette photo">${fleche}</button>
    `;
    const img = tile.querySelector("img");
    const charge = () => tile.classList.add("charge");
    if (img.complete && img.naturalWidth) charge();
    else img.addEventListener("load", charge, { once: true });
    img.addEventListener("click", () => {
      if (modeSelection) basculerSelection(photo.filename);
      else openLightbox(index);
    });
    tile.querySelector(".tile-coche").addEventListener("click", () => basculerSelection(photo.filename));
    tile.querySelector(".tile-favori").addEventListener("click", () => basculerFavori(photo.filename));
    tile.querySelector(".tile-download").addEventListener("click", () => telechargerPhotos([photo]));
    colonnes[index % n].appendChild(tile);
  });
}

let colonnesAffichees = 0;
function nbColonnes() {
  const w = window.innerWidth;
  return w >= 1100 ? 4 : w >= 760 ? 3 : 2;
}
let minuterieRedim = null;
window.addEventListener("resize", () => {
  clearTimeout(minuterieRedim);
  minuterieRedim = setTimeout(() => {
    if (allPhotos.length && nbColonnes() !== colonnesAffichees) renderGrid();
  }, 200);
});

// ---------- Visionneuse plein écran ----------

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxDownload = document.getElementById("lightbox-download");

function openLightbox(index) {
  currentIndex = index;
  updateLightbox();
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  montrerAstuceDoubleTouche();
}

function montrerAstuceDoubleTouche() {
  const astuce = document.getElementById("lightbox-astuce");
  if (!astuce || !peutFavoris) return;
  try {
    if (localStorage.getItem("galerie-astuce-cœur")) return;
    localStorage.setItem("galerie-astuce-cœur", "1");
  } catch {
    return;
  }
  astuce.hidden = false;
  setTimeout(() => (astuce.hidden = true), 4200);
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
}

const lightboxFavori = document.getElementById("lightbox-favori");

function updateLightbox() {
  const photo = currentPhotos[currentIndex];
  lightboxImg.src = photoUrl(currentToken, photo.filename, "original");
  document.getElementById("lightbox-compteur").textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
  preparerEnAvance(photo);
  lightboxFavori.dataset.favori = photo.filename;
  lightboxFavori.classList.toggle("actif", estFavori(photo.filename));
  lightboxFavori.setAttribute("aria-pressed", String(estFavori(photo.filename)));
}

// Double-touche (ou double-clic) sur la photo : elle rejoint les favoris, avec un petit cœur.
let dernierClicPhoto = 0;
lightboxImg.addEventListener("click", () => {
  const maintenant = Date.now();
  const double = maintenant - dernierClicPhoto < 330;
  dernierClicPhoto = double ? 0 : maintenant;
  if (!double) return;
  const photo = currentPhotos[currentIndex];
  if (!photo || !peutFavoris) return;
  if (!estFavori(photo.filename)) basculerFavori(photo.filename);
  const pop = document.createElement("span");
  pop.className = "lightbox-coeur-pop";
  pop.innerHTML = coeur;
  lightbox.appendChild(pop);
  setTimeout(() => pop.remove(), 900);
  lightboxFavori.classList.add("actif");
  lightboxFavori.setAttribute("aria-pressed", "true");
});

lightboxDownload.addEventListener("click", () => {
  const photo = currentPhotos[currentIndex];
  if (photo) telechargerPhotos([photo]);
});

lightboxFavori.innerHTML = `${coeur}<span>Favori</span>`;
lightboxFavori.addEventListener("click", () => {
  const photo = currentPhotos[currentIndex];
  if (!photo) return;
  basculerFavori(photo.filename);
  // En mode « Mes favoris », la photo retirée disparaît de la liste.
  if (filtreFavoris && !estFavori(photo.filename)) {
    if (!currentPhotos.length) closeLightbox();
    else {
      currentIndex = Math.min(currentIndex, currentPhotos.length - 1);
      updateLightbox();
    }
  }
});
document.getElementById("filtre-tout").addEventListener("click", () => changerFiltre(false));
document.getElementById("filtre-favoris").addEventListener("click", () => changerFiltre(true));

function showPrev() {
  currentIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length;
  updateLightbox();
}

function showNext() {
  currentIndex = (currentIndex + 1) % currentPhotos.length;
  updateLightbox();
}

document.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
document.querySelector(".lightbox-prev").addEventListener("click", showPrev);
document.querySelector(".lightbox-next").addEventListener("click", showNext);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panneau.hidden) return fermerPanneau();
  if (e.key === "Escape" && modeSelection && lightbox.hidden) return quitterSelection();
  if (lightbox.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if ((e.key === "f" || e.key === "F") && peutFavoris) lightboxFavori.click();
  if (e.key === "ArrowLeft") showPrev();
  if (e.key === "ArrowRight") showNext();
});

// Balayage tactile (iPhone) pour naviguer dans la visionneuse
let touchStartX = null;
lightbox.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
});
lightbox.addEventListener("touchend", (e) => {
  if (touchStartX == null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) {
    if (dx > 0) showPrev();
    else showNext();
  }
  touchStartX = null;
});

// ---------- Sélection de plusieurs photos ----------

let modeSelection = false;
const selection = new Set();

const coche = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const fleche = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>`;

function entrerSelection() {
  modeSelection = true;
  document.body.classList.add("galerie-en-selection");
  document.getElementById("barre-selection").hidden = false;
  majSelection();
}

function quitterSelection() {
  modeSelection = false;
  selection.clear();
  document.body.classList.remove("galerie-en-selection");
  document.getElementById("barre-selection").hidden = true;
  document.querySelectorAll(".galerie-client-tile.est-selectionnee").forEach((t) => t.classList.remove("est-selectionnee"));
}

function basculerSelection(filename) {
  if (!modeSelection) entrerSelection();
  if (selection.has(filename)) selection.delete(filename);
  else selection.add(filename);
  majSelection();
}

function majSelection() {
  document.querySelectorAll(".galerie-client-tile").forEach((tile) => {
    const choisie = selection.has(tile.dataset.photo);
    tile.classList.toggle("est-selectionnee", choisie);
    tile.querySelector(".tile-coche").setAttribute("aria-pressed", String(choisie));
  });
  const n = selection.size;
  document.getElementById("selection-compte").textContent =
    n === 0 ? "Touchez les photos à télécharger" : `${n} photo${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""}`;
  document.getElementById("selection-telecharger").disabled = n === 0;
  const toutes = currentPhotos.length > 0 && currentPhotos.every((p) => selection.has(p.filename));
  document.getElementById("selection-tout").textContent = toutes ? "Tout désélectionner" : "Tout sélectionner";
}

function majBoutonToutTelecharger() {
  const bouton = document.getElementById("btn-tout-telecharger");
  const n = filtreFavoris ? allPhotos.filter((p) => favoris.has(p.filename)).length : allPhotos.length;
  bouton.textContent = filtreFavoris ? `Télécharger mes favoris (${n})` : `Tout télécharger (${n})`;
  bouton.disabled = n === 0;
  bouton.setAttribute("aria-label", bouton.textContent);
  bouton.title = bouton.textContent;
}

document.getElementById("btn-selection").addEventListener("click", () => (modeSelection ? quitterSelection() : entrerSelection()));
document.getElementById("btn-tout-telecharger").addEventListener("click", () => telechargerPhotos(currentPhotos.slice()));
document.getElementById("selection-annuler").addEventListener("click", quitterSelection);
document.getElementById("selection-tout").addEventListener("click", () => {
  const toutes = currentPhotos.every((p) => selection.has(p.filename));
  currentPhotos.forEach((p) => (toutes ? selection.delete(p.filename) : selection.add(p.filename)));
  majSelection();
});
document.getElementById("selection-telecharger").addEventListener("click", () => {
  const choisies = allPhotos.filter((p) => selection.has(p.filename));
  if (choisies.length) telechargerPhotos(choisies);
});

// ---------- Téléchargement (sans quitter la page) ----------
//
// Les photos sont récupérées en arrière-plan puis enregistrées, selon
// l'appareil :
// - iPhone / iPad : par la feuille de partage d'Apple, qui propose
//   « Enregistrer les images » dans Photos (par lots, pour ne pas saturer
//   la mémoire du téléphone) ;
// - ordinateur avec Chrome ou Edge : directement dans un dossier choisi
//   une fois (plusieurs photos) ;
// - Android : au choix, dans la galerie du téléphone (album
//   « Téléchargement », et la fenêtre dit où le trouver) ou par le menu
//   Partager (Google Photos, WhatsApp…) ;
// - les autres (Firefox, Safari sur Mac) : les fichiers arrivent un par un
//   dans le dossier Téléchargements.

const EST_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const EST_ANDROID = /Android/i.test(navigator.userAgent);

// Samsung range ses téléchargements dans Galerie › Albums › Téléchargement ;
// on le détecte pour donner le bon chemin. Chrome ne donne plus le modèle
// du téléphone dans son identifiant, d'où la seconde vérification.
let EST_SAMSUNG = /SamsungBrowser|SM-[A-Z0-9]/i.test(navigator.userAgent);
if (EST_ANDROID && !EST_SAMSUNG && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
  navigator.userAgentData
    .getHighEntropyValues(["model"])
    .then((v) => {
      if (/^SM-/i.test(v.model || "")) EST_SAMSUNG = true;
    })
    .catch(() => {});
}
const LOT_MAX_PHOTOS = 10;
const LOT_MAX_OCTETS = 150 * 1024 * 1024;
const TELECHARGEMENTS_SIMULTANES = 3;

function peutPartagerDesFichiers() {
  try {
    return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(["x"])], "test.jpg", { type: "image/jpeg" })] }));
  } catch {
    return false;
  }
}

const MODE_PARTAGE = EST_IOS && peutPartagerDesFichiers();

const panneau = document.getElementById("panneau-telechargement");
const ptMessage = document.getElementById("pt-message");
const ptProgression = document.getElementById("pt-progression");
const ptLots = document.getElementById("pt-lots");
const ptAide = document.getElementById("pt-aide");
const ptFermer = document.getElementById("pt-fermer");
let travailEnCours = null;

// Photo affichée dans la visionneuse sur iPhone : on la prépare tout de
// suite, pour que « Télécharger » ouvre directement la feuille de partage.
const prets = new Map();

async function chargerFichier(photo, signal) {
  const res = await fetch(photoUrl(currentToken, photo.filename, "original"), { signal });
  if (!res.ok) throw new Error(`Photo indisponible (${photo.filename})`);
  const blob = await res.blob();
  return new File([blob], photo.filename, { type: blob.type || "image/jpeg" });
}

function preparerEnAvance(photo) {
  if (!MODE_PARTAGE || prets.has(photo.filename)) return;
  const promesse = chargerFichier(photo).catch(() => null);
  prets.set(photo.filename, { fichier: null, promesse });
  promesse.then((fichier) => {
    if (fichier) prets.set(photo.filename, { fichier, promesse });
    else prets.delete(photo.filename);
  });
  // On ne garde en mémoire que les dernières photos vues.
  while (prets.size > 3) prets.delete(prets.keys().next().value);
}

function enregistrerFichierSurOrdinateur(fichier) {
  const url = URL.createObjectURL(fichier);
  const a = document.createElement("a");
  a.href = url;
  a.download = fichier.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- Avis Google ----------
// Après un téléchargement de plusieurs photos (le moment où le client est
// le plus content), on l'invite à laisser un avis. Le lien se règle dans
// l'admin (page Contact) ; sans lien, rien ne s'affiche.
let lienAvis = null;
const ptAvis = document.getElementById("pt-avis");

fetch("../content/contact.json", { cache: "no-cache" })
  .then((r) => r.json())
  .then((contact) => {
    if (!/^https:\/\//.test(contact.avis_google_url || "")) return;
    lienAvis = contact.avis_google_url;
    ptAvis.querySelector("a").href = lienAvis;
    const lienPage = document.getElementById("lien-avis");
    lienPage.href = lienAvis;
    lienPage.hidden = false;
  })
  .catch(() => {});

function proposerAvis(n) {
  if (lienAvis && n > 1) ptAvis.hidden = false;
}

function ouvrirPanneau(titre) {
  ptAvis.hidden = true;
  document.getElementById("pt-titre").textContent = titre;
  ptMessage.textContent = "";
  ptAide.textContent = "";
  ptAide.hidden = true;
  ptLots.innerHTML = "";
  ptProgression.style.width = "0%";
  ptProgression.parentElement.hidden = false;
  ptFermer.textContent = "Fermer";
  panneau.hidden = false;
}

function fermerPanneau() {
  if (travailEnCours) travailEnCours.abort();
  travailEnCours = null;
  panneau.hidden = true;
  ptLots.innerHTML = "";
}

ptFermer.addEventListener("click", fermerPanneau);
panneau.addEventListener("click", (e) => {
  if (e.target === panneau) fermerPanneau();
});

function progression(faites, total) {
  ptProgression.style.width = `${Math.round((100 * faites) / total)}%`;
  ptMessage.textContent = `Préparation des photos : ${faites} sur ${total}`;
}

// Récupère les photos (quelques-unes à la fois) et passe chaque fichier
// prêt à `recevoir`, dans l'ordre d'arrivée.
async function recupererPhotos(photos, signal, recevoir) {
  let suivante = 0;
  let faites = 0;
  progression(0, photos.length);
  async function ouvrier() {
    while (suivante < photos.length) {
      const photo = photos[suivante++];
      const fichier = await chargerFichier(photo, signal);
      await recevoir(fichier);
      faites++;
      progression(faites, photos.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(TELECHARGEMENTS_SIMULTANES, photos.length) }, ouvrier));
}

function telechargerPhotos(photos) {
  if (!photos.length) return;
  if (MODE_PARTAGE) return partagerPhotos(photos, TEXTES_IPHONE);
  if (EST_ANDROID) return choisirSurAndroid(photos);
  if (photos.length > 1 && typeof window.showDirectoryPicker === "function") return enregistrerDansUnDossier(photos);
  return telechargerUneParUne(photos);
}

// Textes de la feuille de partage selon l'appareil.
const TEXTES_IPHONE = {
  titre: (n) => (n > 1 ? `Enregistrer ${n} photos` : "Enregistrer la photo"),
  boutonUnique: (n) => (n > 1 ? `Enregistrer ${n} photos dans mes photos` : "Enregistrer dans mes photos"),
  boutonLot: (debut, fin) => `Enregistrer les photos ${debut} à ${fin}`,
  fait: "✓ Enregistré",
  consigne: (plusieursLots, n) =>
    plusieursLots
      ? "Touchez chaque bouton, puis « Enregistrer les images » : vos photos arrivent dans l'app Photos."
      : `Touchez le bouton, puis « Enregistrer ${n > 1 ? "les images" : "l'image"} » : ${n > 1 ? "vos photos arrivent" : "votre photo arrive"} dans l'app Photos.`,
};

const TEXTES_ANDROID = {
  titre: (n) => (n > 1 ? `Envoyer ${n} photos` : "Envoyer la photo"),
  boutonUnique: (n) => (n > 1 ? `Envoyer les ${n} photos` : "Envoyer la photo"),
  boutonLot: (debut, fin) => `Envoyer les photos ${debut} à ${fin}`,
  fait: "✓ Envoyé",
  consigne: (plusieursLots) =>
    `Touchez ${plusieursLots ? "chaque bouton" : "le bouton"}, puis choisissez Google Photos (« Importer dans Photos »), WhatsApp ou une autre application.`,
};

// Feuille de partage du téléphone : « Enregistrer les images » sur iPhone,
// Google Photos / WhatsApp… sur Android.
function partagerPhotos(photos, textes) {
  // Photo déjà prête (visionneuse) : la feuille de partage s'ouvre tout de
  // suite, sans fenêtre intermédiaire.
  if (photos.length === 1) {
    const pret = prets.get(photos[0].filename);
    if (pret && pret.fichier) {
      navigator.share({ files: [pret.fichier] }).catch(() => {});
      return;
    }
  }

  ouvrirPanneau(textes.titre(photos.length));
  const controle = new AbortController();
  travailEnCours = controle;
  const lots = [];
  let lot = null;

  const nouveauBouton = (l) => {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "btn btn-primary pt-lot";
    bouton.disabled = true;
    bouton.textContent = "Préparation…";
    bouton.addEventListener("click", () => {
      navigator
        .share({ files: l.fichiers })
        .then(() => {
          bouton.textContent = textes.fait;
          bouton.classList.add("est-fait");
          proposerAvis(photos.length);
        })
        .catch(() => {});
    });
    ptLots.appendChild(bouton);
    l.bouton = bouton;
  };

  const libelle = (l) => {
    const n = l.fichiers.length;
    // Un seul lot pour tout : un seul bouton.
    if (n === photos.length) return textes.boutonUnique(n);
    return textes.boutonLot(l.debut, l.debut + n - 1);
  };

  const terminerLot = (l) => {
    if (!l || !l.fichiers.length) return;
    l.bouton.disabled = false;
    l.bouton.textContent = libelle(l);
  };

  let compteur = 0;
  recupererPhotos(photos, controle.signal, (fichier) => {
    if (!lot || lot.fichiers.length >= LOT_MAX_PHOTOS || lot.octets + fichier.size > LOT_MAX_OCTETS) {
      terminerLot(lot);
      lot = { fichiers: [], octets: 0, debut: compteur + 1 };
      lots.push(lot);
      nouveauBouton(lot);
    }
    lot.fichiers.push(fichier);
    lot.octets += fichier.size;
    compteur++;
  })
    .then(() => {
      terminerLot(lot);
      ptMessage.textContent = textes.consigne(lots.length > 1, photos.length);
    })
    .catch((err) => {
      if (controle.signal.aborted) return;
      ptMessage.textContent = `Le téléchargement s'est interrompu : ${err.message}. Vérifiez votre connexion et réessayez.`;
    })
    .finally(() => {
      if (travailEnCours === controle) travailEnCours = null;
    });
}

// Android : il n'existe pas d'« Enregistrer dans la galerie » accessible à
// un site. Les photos téléchargées arrivent quand même dans la galerie, dans
// l'album des téléchargements : une fenêtre explique, étape par étape, comment
// le trouver. Elle reste accessible ensuite par « Où sont mes photos ? ».
const ICONES_GUIDE = {
  appli: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="9" cy="9" r="1.6"/><path d="M5 18l5-5 3 3 2-2 4 4"/></svg>',
  onglet: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M5 17h14"/><circle cx="9" cy="19.5" r="0.6"/><circle cx="12" cy="19.5" r="1.3" class="plein"/><circle cx="15" cy="19.5" r="0.6"/></svg>',
  dossier: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9.5 13.5L12 16l2.5-2.5"/></svg>',
};

function etapesGuideAndroid() {
  return EST_SAMSUNG
    ? [
        ["appli", "Ouvrez l'application <strong>Galerie</strong> de votre téléphone."],
        ["onglet", "En bas de l'écran, touchez <strong>Albums</strong>."],
        ["dossier", "Ouvrez l'album <strong>Téléchargement</strong> : vos photos y sont, les plus récentes en premier."],
      ]
    : [
        ["appli", "Ouvrez l'application <strong>Google Photos</strong> (ou <strong>Galerie</strong>)."],
        ["onglet", "En bas de l'écran, touchez <strong>Collections</strong> (sur certains téléphones : <strong>Bibliothèque</strong> ou <strong>Albums</strong>)."],
        ["dossier", "Ouvrez le dossier <strong>Download</strong> (ou <strong>Téléchargements</strong>) : vos photos y sont, les plus récentes en premier."],
      ];
}

function afficherGuideAndroid(n) {
  ouvrirPanneau(n ? "C'est fait !" : "Retrouver vos photos");
  ptProgression.parentElement.hidden = true;
  const vos = n > 1 ? `Vos ${n} photos sont` : "Votre photo est";
  ptMessage.textContent = n
    ? `${vos} sur votre téléphone. Pour ${n > 1 ? "les" : "la"} retrouver :`
    : "Les photos téléchargées depuis cette page sont dans la galerie de votre téléphone. Pour les retrouver :";
  const liste = document.createElement("ol");
  liste.className = "pt-etapes";
  etapesGuideAndroid().forEach(([icone, texte], i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="pt-etape-num">${i + 1}</span><span class="pt-etape-icone">${ICONES_GUIDE[icone]}</span><span class="pt-etape-texte">${texte}</span>`;
    liste.appendChild(li);
  });
  ptLots.appendChild(liste);
  ptFermer.textContent = "J'ai compris";
  ptFermer.focus();
}

const boutonOuPhotos = document.getElementById("btn-ou-photos");
if (EST_ANDROID) {
  boutonOuPhotos.hidden = false;
  boutonOuPhotos.addEventListener("click", () => afficherGuideAndroid(0));
}

function choisirSurAndroid(photos) {
  const n = photos.length;
  ouvrirPanneau(n > 1 ? `Télécharger ${n} photos` : "Télécharger la photo");
  ptMessage.textContent = EST_SAMSUNG
    ? `${n > 1 ? "Les photos seront enregistrées" : "La photo sera enregistrée"} dans votre Galerie, album « Téléchargement ».`
    : `${n > 1 ? "Les photos seront enregistrées" : "La photo sera enregistrée"} dans la galerie de votre téléphone, album « Download » (ou « Téléchargements »).`;
  ptProgression.parentElement.hidden = true;

  const galerie = document.createElement("button");
  galerie.type = "button";
  galerie.className = "btn btn-primary pt-lot";
  galerie.textContent = "Enregistrer dans ma galerie";
  galerie.addEventListener("click", () => telechargerUneParUne(photos, { android: true }));
  ptLots.appendChild(galerie);

  if (peutPartagerDesFichiers()) {
    const envoyer = document.createElement("button");
    envoyer.type = "button";
    envoyer.className = "galerie-action pt-lot";
    envoyer.textContent = "Envoyer vers Google Photos, WhatsApp…";
    envoyer.addEventListener("click", () => partagerPhotos(photos, TEXTES_ANDROID));
    ptLots.appendChild(envoyer);
  }
}

// Chrome / Edge sur ordinateur : toutes les photos dans un dossier choisi.
async function enregistrerDansUnDossier(photos) {
  let dossier;
  try {
    dossier = await window.showDirectoryPicker({ id: "photos-galerie", mode: "readwrite", startIn: "downloads" });
  } catch (err) {
    if (err && err.name === "AbortError") return; // choix du dossier annulé
    return telechargerUneParUne(photos);
  }
  ouvrirPanneau(`Téléchargement de ${photos.length} photos`);
  const controle = new AbortController();
  travailEnCours = controle;
  try {
    await recupererPhotos(photos, controle.signal, async (fichier) => {
      const poignee = await dossier.getFileHandle(fichier.name, { create: true });
      const flux = await poignee.createWritable();
      await flux.write(fichier);
      await flux.close();
    });
    ptMessage.textContent = `${photos.length} photos enregistrées dans le dossier « ${dossier.name} ».`;
    proposerAvis(photos.length);
  } catch (err) {
    if (!controle.signal.aborted) ptMessage.textContent = `Le téléchargement s'est interrompu : ${err.message}. Vérifiez votre connexion et réessayez.`;
  } finally {
    if (travailEnCours === controle) travailEnCours = null;
  }
}

// Les autres navigateurs : les photos arrivent une par une dans
// Téléchargements.
async function telechargerUneParUne(photos, options = {}) {
  const plusieurs = photos.length > 1;
  ouvrirPanneau(plusieurs ? `Téléchargement de ${photos.length} photos` : "Téléchargement de la photo");
  if (options.android && plusieurs) {
    ptAide.textContent = "Si votre téléphone demande d'autoriser plusieurs téléchargements, appuyez sur « Autoriser ».";
    ptAide.hidden = false;
  }
  const controle = new AbortController();
  travailEnCours = controle;
  try {
    await recupererPhotos(photos, controle.signal, async (fichier) => {
      enregistrerFichierSurOrdinateur(fichier);
      // Petite pause : certains navigateurs ignorent les téléchargements trop rapprochés.
      await new Promise((r) => setTimeout(r, 250));
    });
    if (options.android) {
      afficherGuideAndroid(photos.length);
      return proposerAvis(photos.length);
    }
    proposerAvis(photos.length);
    ptMessage.textContent = plusieurs
      ? `${photos.length} photos téléchargées dans votre dossier Téléchargements. Si votre navigateur a demandé l'autorisation de télécharger plusieurs fichiers, acceptez-la.`
      : "Photo téléchargée dans votre dossier Téléchargements.";
    if (!plusieurs) setTimeout(() => panneau.hidden || fermerPanneau(), 1800);
  } catch (err) {
    if (!controle.signal.aborted) ptMessage.textContent = `Le téléchargement s'est interrompu : ${err.message}. Vérifiez votre connexion et réessayez.`;
  } finally {
    if (travailEnCours === controle) travailEnCours = null;
  }
}

// ---------- Démarrage ----------

async function init() {
  const [navigation, appearance] = await Promise.all([
    fetch("../content/navigation.json", { cache: "no-cache" }).then((r) => r.json()),
    fetch("../content/appearance.json", { cache: "no-cache" }).then((r) => r.json()),
  ]);
  applyAppearance(appearance);
  buildNav(navigation);
  await buildFooter(navigation);

  const token = new URLSearchParams(window.location.search).get("g");
  // Sans lien (clic sur « Espace client » dans le menu) : la liste des shootings,
  // jamais une galerie ouverte d'office.
  if (!token) return afficherEspace();
  await ouvrirAvecLien(token);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Erreur de chargement de l'espace client", err));
});
