// Page client de l'espace galeries. Ne réutilise pas js/render.js /
// js/sections-renderer.js (pensés pour le modèle de "sections" du CMS) :
// cette page affiche un contenu dynamique venant du Worker, pas de
// content/pages/*.json. Le menu et le pied de page sont reconstruits ici
// à partir des mêmes fichiers (content/navigation.json,
// content/appearance.json), en lecture seule — rien n'est modifié dans
// les fichiers ou scripts existants du CMS.

const API_BASE = "https://galerie-api.nicoleveugle.workers.dev";

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

let currentPhotos = [];
let currentIndex = -1;
let currentToken = null;

async function loadGallery(token) {
  try {
    const res = await fetch(`${API_BASE}/api/gallery/${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error("Galerie introuvable");
    const gallery = await res.json();
    currentToken = token;
    currentPhotos = gallery.photos || [];
    document.getElementById("gallery-heading").textContent = gallery.name;
    document.getElementById("gallery-subheading").textContent = gallery.title || "";
    renderGrid();
  } catch {
    showEmptyState();
  }
}

function showEmptyState() {
  document.getElementById("gallery-empty-state").hidden = false;
}

function renderGrid() {
  const grid = document.getElementById("gallery-grid");
  grid.innerHTML = "";

  if (!currentPhotos.length) {
    grid.innerHTML = `<p class="lead">Vos photos arrivent bientôt — repassez un peu plus tard.</p>`;
    return;
  }

  currentPhotos.forEach((photo, index) => {
    const tile = document.createElement("div");
    tile.className = "galerie-client-tile";
    tile.innerHTML = `
      <img src="${photoUrl(currentToken, photo.filename, "thumb")}" alt="" loading="lazy" decoding="async" />
      <a class="tile-download" href="${photoUrl(currentToken, photo.filename, "original", true)}" download title="Télécharger">⬇</a>
    `;
    tile.querySelector("img").addEventListener("click", () => openLightbox(index));
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

function updateLightbox() {
  const photo = currentPhotos[currentIndex];
  lightboxImg.src = photoUrl(currentToken, photo.filename, "original");
  lightboxDownload.href = photoUrl(currentToken, photo.filename, "original", true);
}

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

  const token = new URLSearchParams(window.location.search).get("g");
  if (token) {
    await loadGallery(token);
  } else {
    showEmptyState();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Erreur de chargement de l'espace client", err));
});
