// Orchestrateur : détecte la page courante, charge navigation/apparence/
// contenu depuis content/*.json, construit le header/footer, puis délègue
// le rendu des sections au moteur partagé js/sections-renderer.js.

function currentSlug() {
  const file = window.location.pathname.split("/").pop();
  if (!file || file === "") return "index";
  return file.replace(/\.html$/, "");
}

function isSameHref(href, slug) {
  return href.replace(/\.html$/, "") === slug;
}

function applyAppearance(appearance) {
  const root = document.documentElement;
  if (appearance.accent_color) root.style.setProperty("--couleur-accent", appearance.accent_color);
  if (appearance.accent_color_dark) root.style.setProperty("--couleur-accent-fonce", appearance.accent_color_dark);

  document.querySelectorAll(".js-logo").forEach((el) => {
    if (appearance.logo_image) {
      el.innerHTML = `<img src="${appearance.logo_image}" alt="${appearance.logo_text || ""}" style="height:28px;display:block" />`;
    } else {
      el.textContent = appearance.logo_text || "";
    }
  });

  if (appearance.favicon_image) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = appearance.favicon_image;
  }
}

function buildNav(navigation, slug) {
  const navList = document.getElementById("nav-links");
  if (navList) {
    navList.innerHTML = navigation.nav_links
      .map((link) => {
        const current = isSameHref(link.href, slug) ? ' aria-current="page"' : "";
        return `<li><a href="${link.href}"${current}>${link.label}</a></li>`;
      })
      .join("");
  }

  const cta = document.getElementById("header-cta");
  if (cta && navigation.cta_button) {
    cta.href = navigation.cta_button.href;
    cta.textContent = navigation.cta_button.label;
    if (isSameHref(navigation.cta_button.href, slug)) cta.setAttribute("aria-current", "page");
  }
}

async function buildFooter(navigation) {
  const footerLinks = document.getElementById("footer-links");
  if (!footerLinks) return;

  let html = navigation.footer_links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join("");

  try {
    const contact = await fetchContactForFooter();
    if (contact) {
      html += `<li><a href="${contact.instagram_url}" target="_blank" rel="noopener">${contact.instagram_handle || "Instagram"}</a></li>`;
    }
  } catch (e) {
    // silencieux : le footer reste utilisable sans ce lien
  }

  (navigation.footer_legal_links || []).forEach((l) => {
    html += `<li><a href="${l.href}">${l.label}</a></li>`;
  });

  footerLinks.innerHTML = html;

  const copy = document.getElementById("footer-copy");
  if (copy) {
    copy.innerHTML = `© <span id="year"></span> ${navigation.copyright_text}`;
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  }
}

async function fetchContactForFooter() {
  const res = await fetch("content/contact.json", { cache: "no-cache" });
  if (!res.ok) return null;
  return res.json();
}

function applySeo(seo) {
  if (!seo) return;
  if (seo.title) document.title = seo.title;
  if (seo.description) {
    let meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", seo.description);
  }
}

async function init() {
  const slug = currentSlug();

  const [navigation, appearance, page] = await Promise.all([
    fetch("content/navigation.json", { cache: "no-cache" }).then((r) => r.json()),
    fetch("content/appearance.json", { cache: "no-cache" }).then((r) => r.json()),
    fetch(`content/pages/${slug}.json`, { cache: "no-cache" }).then((r) => r.json()),
  ]);

  applyAppearance(appearance);
  buildNav(navigation, slug);
  buildFooter(navigation);
  applySeo(page.seo);

  const root = document.getElementById("sections-root");
  if (root) await renderSections(root, page.sections, "");
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Erreur de chargement de la page", err));
});
