// Page client de l'espace galeries. Ne réutilise pas js/render.js /
// js/sections-renderer.js (pensés pour le modèle de "sections" du CMS) :
// cette page affiche un contenu dynamique venant du Worker, pas de
// content/pages/*.json. Le menu et le pied de page sont reconstruits ici
// à partir des mêmes fichiers (content/navigation.json,
// content/appearance.json), en lecture seule — rien n'est modifié dans
// les fichiers ou scripts existants du CMS.

const API_BASE = "https://galerie-api.nicoleveugle.workers.dev";
const LAST_GALLERY_KEY = "galerie-last-token";

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

// ---------- Favoris (le cœur sur chaque photo) ----------

let favoris = new Set();
let filtreFavoris = false;
let minuterieFavoris = null;

function estFavori(filename) {
  return favoris.has(filename);
}

function basculerFavori(filename) {
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
      headers: { "Content-Type": "application/json" },
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

async function loadGallery(token) {
  try {
    const res = await fetch(`${API_BASE}/api/gallery/${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error("Galerie introuvable");
    const gallery = await res.json();
    currentToken = token;
    allPhotos = gallery.photos || [];
    currentPhotos = allPhotos;
    favoris = new Set(gallery.favoris || []);
    majBarreFavoris();
    localStorage.setItem(LAST_GALLERY_KEY, token);
    document.getElementById("gallery-heading").textContent = gallery.name;
    document.getElementById("gallery-subheading").textContent = gallery.title || "";
    document.getElementById("forget-gallery-btn").hidden = false;
    renderGrid();
  } catch {
    // Jeton mémorisé périmé (galerie supprimée depuis) : on l'oublie pour
    // ne pas re-rediriger dessus indéfiniment.
    if (localStorage.getItem(LAST_GALLERY_KEY) === token) {
      localStorage.removeItem(LAST_GALLERY_KEY);
    }
    showEmptyState();
  }
}

function showEmptyState() {
  document.getElementById("gallery-empty-state").hidden = false;
}

document.getElementById("forget-gallery-btn").addEventListener("click", () => {
  localStorage.removeItem(LAST_GALLERY_KEY);
  window.location.href = window.location.pathname;
});

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
    tile.querySelector("img").addEventListener("click", () => {
      if (modeSelection) basculerSelection(photo.filename);
      else openLightbox(index);
    });
    tile.querySelector(".tile-coche").addEventListener("click", () => basculerSelection(photo.filename));
    tile.querySelector(".tile-favori").addEventListener("click", () => basculerFavori(photo.filename));
    tile.querySelector(".tile-download").addEventListener("click", () => telechargerPhotos([photo]));
    grid.appendChild(tile);
  });
}

// ---------- Visionneuse plein écran ----------

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxDownload = document.getElementById("lightbox-download");

function openLightbox(index) {
  currentIndex = index;
  updateLightbox();
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
}

const lightboxFavori = document.getElementById("lightbox-favori");

function updateLightbox() {
  const photo = currentPhotos[currentIndex];
  lightboxImg.src = photoUrl(currentToken, photo.filename, "original");
  preparerEnAvance(photo);
  lightboxFavori.dataset.favori = photo.filename;
  lightboxFavori.classList.toggle("actif", estFavori(photo.filename));
  lightboxFavori.setAttribute("aria-pressed", String(estFavori(photo.filename)));
}

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
  if (e.key === "f" || e.key === "F") lightboxFavori.click();
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
// - les autres (Firefox, Safari sur Mac, Android) : les fichiers arrivent
//   un par un dans le dossier Téléchargements.

const EST_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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

function ouvrirPanneau(titre) {
  document.getElementById("pt-titre").textContent = titre;
  ptMessage.textContent = "";
  ptLots.innerHTML = "";
  ptProgression.style.width = "0%";
  panneau.hidden = false;
}

function fermerPanneau() {
  if (travailEnCours) travailEnCours.abort();
  travailEnCours = null;
  panneau.hidden = true;
  ptLots.innerHTML = "";
}

document.getElementById("pt-fermer").addEventListener("click", fermerPanneau);
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
  if (MODE_PARTAGE) return enregistrerDansPhotos(photos);
  if (photos.length > 1 && typeof window.showDirectoryPicker === "function") return enregistrerDansUnDossier(photos);
  return telechargerUneParUne(photos);
}

// iPhone / iPad : feuille de partage → « Enregistrer les images ».
function enregistrerDansPhotos(photos) {
  // Photo déjà prête (visionneuse) : la feuille de partage s'ouvre tout de
  // suite, sans fenêtre intermédiaire.
  if (photos.length === 1) {
    const pret = prets.get(photos[0].filename);
    if (pret && pret.fichier) {
      navigator.share({ files: [pret.fichier] }).catch(() => {});
      return;
    }
  }

  ouvrirPanneau(photos.length > 1 ? `Enregistrer ${photos.length} photos` : "Enregistrer la photo");
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
          bouton.textContent = "✓ Enregistré";
          bouton.classList.add("est-fait");
        })
        .catch(() => {});
    });
    ptLots.appendChild(bouton);
    l.bouton = bouton;
  };

  const libelle = (l) => {
    const n = l.fichiers.length;
    if (photos.length === 1) return "Enregistrer dans mes photos";
    // Un seul lot pour tout : un seul bouton « Enregistrer N photos ».
    if (n === photos.length) return `Enregistrer ${n} photos dans mes photos`;
    return `Enregistrer les photos ${l.debut} à ${l.debut + n - 1}`;
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
      ptMessage.textContent =
        lots.length > 1
          ? `Touchez chaque bouton, puis « Enregistrer les images » : vos photos arrivent dans l'app Photos.`
          : `Touchez le bouton, puis « Enregistrer ${photos.length > 1 ? "les images" : "l'image"} » : ${photos.length > 1 ? "vos photos arrivent" : "votre photo arrive"} dans l'app Photos.`;
    })
    .catch((err) => {
      if (controle.signal.aborted) return;
      ptMessage.textContent = `Le téléchargement s'est interrompu : ${err.message}. Vérifiez votre connexion et réessayez.`;
    })
    .finally(() => {
      if (travailEnCours === controle) travailEnCours = null;
    });
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
  } catch (err) {
    if (!controle.signal.aborted) ptMessage.textContent = `Le téléchargement s'est interrompu : ${err.message}. Vérifiez votre connexion et réessayez.`;
  } finally {
    if (travailEnCours === controle) travailEnCours = null;
  }
}

// Les autres navigateurs : les photos arrivent une par une dans
// Téléchargements.
async function telechargerUneParUne(photos) {
  const plusieurs = photos.length > 1;
  ouvrirPanneau(plusieurs ? `Téléchargement de ${photos.length} photos` : "Téléchargement de la photo");
  const controle = new AbortController();
  travailEnCours = controle;
  try {
    await recupererPhotos(photos, controle.signal, async (fichier) => {
      enregistrerFichierSurOrdinateur(fichier);
      // Petite pause : certains navigateurs ignorent les téléchargements trop rapprochés.
      await new Promise((r) => setTimeout(r, 250));
    });
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

  let token = new URLSearchParams(window.location.search).get("g");

  // Pas de jeton dans l'URL (ex : clic sur "Espace client" dans le menu) :
  // si ce navigateur a déjà ouvert une galerie, on y retourne directement.
  if (!token) {
    const remembered = localStorage.getItem(LAST_GALLERY_KEY);
    if (remembered) {
      window.location.replace(`${window.location.pathname}?g=${encodeURIComponent(remembered)}`);
      return; // la page se recharge avec le jeton dans l'URL
    }
  }

  if (token) {
    await loadGallery(token);
  } else {
    showEmptyState();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Erreur de chargement de l'espace client", err));
});
