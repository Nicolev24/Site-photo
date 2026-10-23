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
}

function changerFiltre(seulementFavoris) {
  filtreFavoris = seulementFavoris;
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
    tile.className = "galerie-client-tile";
    const actif = estFavori(photo.filename);
    tile.innerHTML = `
      <img src="${photoUrl(currentToken, photo.filename, "thumb")}" alt="" loading="lazy" decoding="async" />
      <button type="button" class="tile-favori${actif ? " actif" : ""}" data-favori="${escapeHtml(photo.filename)}" aria-pressed="${actif}" title="Ajouter à mes favoris">${coeur}</button>
      <a class="tile-download" href="${photoUrl(currentToken, photo.filename, "original", true)}" download title="Télécharger">⬇</a>
    `;
    tile.querySelector("img").addEventListener("click", () => openLightbox(index));
    tile.querySelector(".tile-favori").addEventListener("click", () => basculerFavori(photo.filename));
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
  lightboxDownload.href = photoUrl(currentToken, photo.filename, "original", true);
  lightboxFavori.dataset.favori = photo.filename;
  lightboxFavori.classList.toggle("actif", estFavori(photo.filename));
  lightboxFavori.setAttribute("aria-pressed", String(estFavori(photo.filename)));
}

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
