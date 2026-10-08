// Lit le brouillon posé par le bouton « Prévisualiser » de l'admin dans
// localStorage et le rend avec le même moteur que le site public
// (js/sections-renderer.js), pour un aperçu fidèle avant publication.

const DRAFT_KEY = "site-photo-admin-preview";

function renderNav(navigation) {
  const navList = document.getElementById("nav-links");
  if (navList) {
    navList.innerHTML = (navigation.nav_links || [])
      .map((l) => `<li><a href="../${l.href}" onclick="return false">${l.label}</a></li>`)
      .join("");
  }
  const cta = document.getElementById("header-cta");
  if (cta && navigation.cta_button) {
    cta.textContent = navigation.cta_button.label || "";
  }
}

function renderFooter(navigation) {
  const footerLinks = document.getElementById("footer-links");
  if (footerLinks) {
    footerLinks.innerHTML = (navigation.footer_links || [])
      .map((l) => `<li><a href="../${l.href}" onclick="return false">${l.label}</a></li>`)
      .join("");
  }
  const copy = document.getElementById("footer-copy");
  if (copy) copy.textContent = `© ${new Date().getFullYear()} ${navigation.copyright_text || ""}`;
}

function applyAppearance(appearance) {
  if (!appearance) return;
  const root = document.documentElement;
  if (appearance.accent_color) root.style.setProperty("--couleur-accent", appearance.accent_color);
  if (appearance.accent_color_dark) root.style.setProperty("--couleur-accent-fonce", appearance.accent_color_dark);
  document.querySelectorAll(".js-logo").forEach((el) => {
    el.textContent = appearance.logo_text || "Nicolas Leveugle";
  });
}

function init() {
  const raw = localStorage.getItem(DRAFT_KEY);
  const root = document.getElementById("sections-root");
  if (!raw) {
    root.innerHTML = `<div class="container" style="padding:80px 0"><p>Aucun brouillon à prévisualiser. Retourne dans l'admin et clique sur « Prévisualiser ».</p></div>`;
    return;
  }

  const draft = JSON.parse(raw);
  applyAppearance(draft.appearance);
  renderNav(draft.navigation || { nav_links: [], footer_links: [] });
  renderFooter(draft.navigation || { footer_links: [] });
  if (draft.page?.seo?.title) document.title = `Aperçu — ${draft.page.seo.title}`;
  renderSections(root, draft.page.sections, "../");
}

init();
