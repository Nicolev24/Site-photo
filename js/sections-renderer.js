// Moteur de rendu générique : transforme un tableau de "sections" (issu de
// content/pages/<slug>.json, ou d'un brouillon non enregistré dans l'admin)
// en DOM. Utilisé à la fois par le site public (js/render.js) et par
// l'aperçu de l'admin (admin/preview.html) — même fonctions, donc aperçu
// toujours fidèle au rendu réel.
//
// `basePath` vaut "" sur les pages à la racine du site, "../" depuis /admin/.

const CATEGORIES = [
  { value: "portraits", label: "Portraits" },
  { value: "couples", label: "Couples" },
  { value: "entreprises", label: "Entreprises & commerces" },
  { value: "evenements", label: "Événements" },
];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function resolveHref(href, basePath) {
  if (!href) return "#";
  if (/^([a-z]+:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("#")) {
    return href;
  }
  return basePath + href;
}

function resolveSrc(src, basePath) {
  if (!src) return "";
  if (/^([a-z]+:)?\/\//i.test(src)) return src;
  return basePath + src;
}

async function fetchJson(basePath, path) {
  const res = await fetch(basePath + path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Impossible de charger ${path} (${res.status})`);
  return res.json();
}

function el(tag, attrs = {}, html) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v == null) return;
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  });
  if (html != null) node.innerHTML = html;
  return node;
}

// ---------- Constructeurs par type de section ----------

function buildHero(data, basePath) {
  const section = el("section", { class: "hero" });
  const img = el("img", {
    src: resolveSrc(data.image, basePath),
    alt: data.alt || "",
    fetchpriority: "high",
  });
  section.appendChild(img);

  const content = el(
    "div",
    { class: "container hero-content" },
    `
    <span class="eyebrow" style="color:#f1ebe1">${escapeHtml(data.eyebrow)}</span>
    <h1>${escapeHtml(data.title_line1)}<br>${escapeHtml(data.title_line2)}</h1>
    <p>${escapeHtml(data.subtitle)}</p>
    <div class="hero-actions">
      <a href="${resolveHref(data.button_href, basePath)}" class="btn btn-primary">${escapeHtml(data.button_label)}</a>
    </div>
  `
  );
  section.appendChild(content);
  return section;
}

function buildTexteImage(data, basePath) {
  const section = el("section", {});
  const imgSide = data.image_side === "gauche" ? "gauche" : "droite";
  const textHtml = `
    <div style="order:${imgSide === "gauche" ? 2 : 1}">
      <span class="eyebrow">${escapeHtml(data.eyebrow)}</span>
      <h2>${escapeHtml(data.title)}</h2>
      <p class="lead">${escapeHtml(data.text)}</p>
      ${data.button_label ? `<a href="${resolveHref(data.button_href, basePath)}" class="btn-secondary">${escapeHtml(data.button_label)}</a>` : ""}
    </div>
  `;
  const container = el("div", { class: "container two-col" }, textHtml);
  const img = el("img", {
    src: resolveSrc(data.image, basePath),
    alt: data.alt || "",
    loading: "lazy",
    decoding: "async",
    style: `order:${imgSide === "gauche" ? 1 : 2}`,
  });
  container.appendChild(img);
  section.appendChild(container);
  return section;
}

function buildTexte(data) {
  const section = el("section", { class: "page-header" });
  section.appendChild(
    el(
      "div",
      { class: "container" },
      `
      <span class="eyebrow">${escapeHtml(data.eyebrow)}</span>
      <h1>${escapeHtml(data.title)}</h1>
      <p class="lead">${escapeHtml(data.text)}</p>
    `
    )
  );
  return section;
}

function buildGalerieCategories(data, basePath) {
  const section = el("section", { class: "section-alt" });
  const container = el(
    "div",
    { class: "container" },
    `
    <span class="eyebrow">${escapeHtml(data.eyebrow)}</span>
    <h2>${escapeHtml(data.title)}</h2>
    <p class="lead">${escapeHtml(data.text)}</p>
  `
  );
  const grid = el("div", { class: "grid-4" });
  (data.teasers || []).forEach((teaser) => {
    const a = el("a", {
      class: "teaser-card",
      href: resolveHref(`portfolio.html#${teaser.category}`, basePath),
    });
    const img = el("img", {
      src: resolveSrc(teaser.image, basePath),
      alt: teaser.alt || "",
      loading: "lazy",
      decoding: "async",
    });
    const label = el("span", { class: "teaser-label" }, escapeHtml(teaser.label));
    a.appendChild(img);
    a.appendChild(label);
    grid.appendChild(a);
  });
  container.appendChild(grid);
  section.appendChild(container);
  return section;
}

async function buildPortfolioGalerie(data, basePath) {
  const section = el("section", { style: "padding-top:0" });
  const container = el("div", { class: "container" });
  const filters = el(
    "div",
    { class: "filters" },
    `
    <button class="filter-btn active" data-filter="all">Tous</button>
    ${CATEGORIES.map((c) => `<button class="filter-btn" data-filter="${c.value}">${escapeHtml(c.label)}</button>`).join("")}
  `
  );
  const gallery = el("div", { class: "gallery" });

  try {
    const portfolio = await fetchJson(basePath, "content/portfolio.json");
    portfolio.items.forEach((item) => {
      const div = el("div", { class: "gallery-item", "data-category": item.category });
      div.appendChild(
        el("img", {
          src: resolveSrc(item.image, basePath),
          alt: item.alt || "",
          loading: "lazy",
          decoding: "async",
        })
      );
      gallery.appendChild(div);
    });
  } catch (e) {
    console.error(e);
  }

  container.appendChild(filters);
  container.appendChild(gallery);
  section.appendChild(container);

  requestAnimationFrame(() => {
    if (typeof window.initPortfolioFilters === "function") window.initPortfolioFilters();
  });

  return section;
}

function buildTarifs(data, basePath) {
  const section = el("section", { style: "padding-top:24px" });
  const container = el("div", { class: "container" });
  const grid = el("div", { class: "pricing-grid" });

  (data.plans || []).forEach((plan) => {
    const card = el("div", { class: plan.highlight ? "price-card highlight" : "price-card" });
    let html = "";
    if (plan.badge) html += `<span class="badge">${escapeHtml(plan.badge)}</span>`;
    html += `<h3>${escapeHtml(plan.title)}</h3>`;
    html += `<div class="price-tag">${escapeHtml(plan.price)}`;
    if (plan.price_suffix) html += `<span> ${escapeHtml(plan.price_suffix)}</span>`;
    html += `</div><ul>`;
    (plan.features || []).forEach((f) => (html += `<li>${escapeHtml(f)}</li>`));
    html += `</ul>`;
    const btnClass = plan.highlight ? "btn btn-primary" : "btn-secondary";
    html += `<a href="${resolveHref("contact.html", basePath)}" class="${btnClass}">${escapeHtml(plan.cta_label)}</a>`;
    card.innerHTML = html;
    grid.appendChild(card);
  });

  container.appendChild(grid);
  if (data.note) {
    container.appendChild(
      el("div", { class: "note-box" }, `<p style="margin:0">${escapeHtml(data.note)}</p>`)
    );
  }
  section.appendChild(container);
  return section;
}

function buildCta(data, basePath) {
  return el(
    "div",
    { class: "cta-band" },
    `
    <h2>${escapeHtml(data.title)}</h2>
    <p>${escapeHtml(data.text)}</p>
    <a href="${resolveHref(data.button_href, basePath)}" class="btn btn-primary">${escapeHtml(data.button_label)}</a>
  `
  );
}

async function buildContact(data, basePath) {
  const section = el("section", { style: "padding-top:24px" });
  const container = el("div", { class: "container contact-grid" });

  const left = el("div", {}, `<h3>${escapeHtml(data.coordonnees_title)}</h3>`);
  const list = el("ul", { class: "contact-info-list" });
  left.appendChild(list);

  const right = el(
    "div",
    {},
    `
    <h3>${escapeHtml(data.formulaire_title)}</h3>
  `
  );
  const form = el("form", { id: "contact-form", method: "post", enctype: "text/plain" });
  form.innerHTML = `
    <div>
      <label for="name">Nom</label>
      <input type="text" id="name" name="Nom" required />
    </div>
    <div>
      <label for="email">Email</label>
      <input type="email" id="email" name="Email" required />
    </div>
    <div>
      <label for="type">Type de séance</label>
      <select id="type" name="Type de séance">
        <option>Formule découverte</option>
        <option>Formule complète</option>
        <option>Sur devis</option>
        <option>Autre</option>
      </select>
    </div>
    <div>
      <label for="message">Message</label>
      <textarea id="message" name="Message" required placeholder="Dites-m'en un peu plus sur votre projet, la date envisagée, le lieu..."></textarea>
    </div>
    <div class="consent-row">
      <input type="checkbox" id="consent" name="Consentement" required />
      <label for="consent">J'accepte que mes données soient utilisées pour me répondre, conformément à la <a href="${resolveHref("confidentialite.html", basePath)}">politique de confidentialité</a>.</label>
    </div>
    <button type="submit" class="btn btn-primary">Envoyer</button>
    <p class="form-note">En envoyant ce formulaire, votre client mail s'ouvre avec le message pré-rempli.</p>
  `;
  right.appendChild(form);

  try {
    const contact = await fetchJson(basePath, "content/contact.json");
    list.innerHTML = `
      <li>Email<br><a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></li>
      <li>Instagram<br><a href="${escapeHtml(contact.instagram_url)}" target="_blank" rel="noopener">${escapeHtml(contact.instagram_handle)}</a></li>
      <li>Zone d'intervention<br>${escapeHtml(contact.zone)}</li>
      <li>Délai de réponse<br>${escapeHtml(contact.response_delay)}</li>
    `;
    form.action = `mailto:${contact.email}`;
  } catch (e) {
    console.error(e);
  }

  container.appendChild(left);
  container.appendChild(right);
  section.appendChild(container);
  return section;
}

function buildTexteJuridique(data) {
  const section = el("section", { style: "padding-top:0" });
  const container = el("div", { class: "container legal-content" });
  (data.blocks || []).forEach((block) => {
    if (block.type === "heading") {
      container.appendChild(el("h2", {}, escapeHtml(block.text)));
    } else if (block.type === "liste") {
      const ul = el("ul", {});
      (block.items || []).forEach((item) => ul.appendChild(el("li", {}, escapeHtml(item))));
      container.appendChild(ul);
    } else {
      container.appendChild(el("p", {}, escapeHtml(block.text)));
    }
  });
  section.appendChild(container);
  return section;
}

const SECTION_BUILDERS = {
  hero: buildHero,
  texte_image: buildTexteImage,
  texte: buildTexte,
  galerie_categories: buildGalerieCategories,
  portfolio_galerie: buildPortfolioGalerie,
  tarifs: buildTarifs,
  cta: buildCta,
  contact: buildContact,
  texte_juridique: buildTexteJuridique,
};

// Met en évidence toute note du type "[À COMPLÉTER]" ou
// "[À VALIDER : ...]" dans le texte déjà rendu (jamais dans du HTML
// interprété : on ne fait que déplacer des nœuds texte existants vers un
// <mark>, donc aucun risque d'injection même si le contenu vient de
// content/pages/*.json).
function highlightPlaceholders(root) {
  const PATTERN = /\[À [^\]]*\]/g;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);
  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue;
    const matches = text.match(PATTERN);
    if (!matches) return;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    text.replace(PATTERN, (match, offset) => {
      if (offset > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
      const mark = document.createElement("mark");
      mark.className = "placeholder-a-completer";
      mark.textContent = match;
      frag.appendChild(mark);
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    textNode.parentNode.replaceChild(frag, textNode);
  });
}

async function renderSections(container, sections, basePath = "") {
  container.innerHTML = "";
  for (const section of sections || []) {
    const builder = SECTION_BUILDERS[section.type];
    if (!builder) continue;
    try {
      const node = await builder(section.data || {}, basePath);
      if (node) container.appendChild(node);
    } catch (err) {
      console.error(`Erreur de rendu pour la section "${section.type}"`, err);
    }
  }
  highlightPlaceholders(container);

  if (typeof window.initScrollReveal === "function") window.initScrollReveal();
}

window.renderSections = renderSections;
window.SECTION_BUILDERS = SECTION_BUILDERS;
