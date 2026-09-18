// Charge le contenu depuis les fichiers content/*.json (édités via /admin) et
// construit le DOM correspondant. Un seul fichier partagé par les 4 pages :
// chaque fonction ne fait rien si ses éléments cibles ne sont pas présents.

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Impossible de charger ${path} (${res.status})`);
  return res.json();
}

function setInstagramLinks(instagramUrl, instagramHandle) {
  document.querySelectorAll(".js-instagram-link").forEach((el) => {
    el.href = instagramUrl;
    if (el.dataset.showHandle === "true") el.textContent = instagramHandle;
  });
}

function setMailtoLinks(email) {
  document.querySelectorAll(".js-mailto-link").forEach((el) => {
    el.href = `mailto:${email}`;
    if (el.dataset.showEmail === "true") el.textContent = email;
  });
}

async function renderHomeHero() {
  const heroImg = document.getElementById("hero-img");
  if (!heroImg) return;

  const settings = await fetchJson("content/settings.json");
  const hero = settings.hero;

  heroImg.src = hero.image;
  heroImg.alt = hero.alt;
  document.getElementById("hero-eyebrow").textContent = hero.eyebrow;
  document.getElementById("hero-title").innerHTML =
    `${escapeHtml(hero.title_line1)}<br>${escapeHtml(hero.title_line2)}`;
  document.getElementById("hero-subtitle").textContent = hero.subtitle;

  const approach = settings.approach;
  document.getElementById("approach-img").src = approach.image;
  document.getElementById("approach-img").alt = approach.alt;
  document.getElementById("approach-eyebrow").textContent = approach.eyebrow;
  document.getElementById("approach-title").textContent = approach.title;
  document.getElementById("approach-text").textContent = approach.text;

  const teaserGrid = document.getElementById("teaser-grid");
  if (teaserGrid) {
    teaserGrid.innerHTML = "";
    settings.teasers.forEach((teaser) => {
      const a = document.createElement("a");
      a.className = "teaser-card";
      a.href = `portfolio.html#${teaser.category}`;

      const img = document.createElement("img");
      img.src = teaser.image;
      img.alt = teaser.alt;

      const label = document.createElement("span");
      label.className = "teaser-label";
      label.textContent = teaser.label;

      a.appendChild(img);
      a.appendChild(label);
      teaserGrid.appendChild(a);
    });
  }
}

async function renderPortfolioGallery() {
  const gallery = document.querySelector(".gallery");
  if (!gallery) return;

  const data = await fetchJson("content/portfolio.json");
  gallery.innerHTML = "";

  data.items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "gallery-item";
    div.dataset.category = item.category;

    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.alt;

    div.appendChild(img);
    gallery.appendChild(div);
  });

  if (typeof window.initPortfolioFilters === "function") {
    window.initPortfolioFilters();
  }
}

async function renderServices() {
  const grid = document.querySelector(".pricing-grid");
  if (!grid) return;

  const data = await fetchJson("content/services.json");
  grid.innerHTML = "";

  data.plans.forEach((plan) => {
    const card = document.createElement("div");
    card.className = plan.highlight ? "price-card highlight" : "price-card";

    let html = "";
    if (plan.badge) {
      html += `<span class="badge">${escapeHtml(plan.badge)}</span>`;
    }
    html += `<h3>${escapeHtml(plan.title)}</h3>`;
    html += `<div class="price-tag">${escapeHtml(plan.price)}`;
    if (plan.price_suffix) html += `<span> ${escapeHtml(plan.price_suffix)}</span>`;
    html += `</div>`;
    html += "<ul>";
    plan.features.forEach((feature) => {
      html += `<li>${escapeHtml(feature)}</li>`;
    });
    html += "</ul>";
    const btnClass = plan.highlight ? "btn btn-primary" : "btn btn-outline";
    html += `<a href="contact.html" class="${btnClass}">${escapeHtml(plan.cta_label)}</a>`;

    card.innerHTML = html;
    grid.appendChild(card);
  });

  const noteEl = document.getElementById("services-note-text");
  if (noteEl) noteEl.textContent = data.note;
}

async function renderContact() {
  const list = document.querySelector(".contact-info-list");
  const contact = await fetchJson("content/contact.json");

  setMailtoLinks(contact.email);
  setInstagramLinks(contact.instagram_url, contact.instagram_handle);

  if (list) {
    list.innerHTML = `
      <li>Email<br><a href="mailto:${escapeHtml(contact.email)}" class="js-mailto-link" data-show-email="true">${escapeHtml(contact.email)}</a></li>
      <li>Instagram<br><a href="${escapeHtml(contact.instagram_url)}" target="_blank" rel="noopener" class="js-instagram-link" data-show-handle="true">${escapeHtml(contact.instagram_handle)}</a></li>
      <li>Zone d'intervention<br>${escapeHtml(contact.zone)}</li>
      <li>Délai de réponse<br>${escapeHtml(contact.response_delay)}</li>
    `;
  }

  const form = document.getElementById("contact-form");
  if (form) form.action = `mailto:${contact.email}`;
}

async function renderFooterLinks() {
  // Sur les pages sans bloc contact dédié (accueil, portfolio, services),
  // seul le lien Instagram du footer doit être mis à jour.
  if (document.querySelector(".contact-info-list")) return; // déjà géré par renderContact
  try {
    const contact = await fetchJson("content/contact.json");
    setInstagramLinks(contact.instagram_url, contact.instagram_handle);
  } catch (e) {
    // silencieux : le lien garde sa valeur par défaut dans le HTML si le fetch échoue
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderHomeHero().catch(console.error);
  renderPortfolioGallery().catch(console.error);
  renderServices().catch(console.error);
  renderContact().catch(console.error);
  renderFooterLinks().catch(console.error);
});
