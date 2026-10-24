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
      ${data.secondary_label ? `<a href="${resolveHref(data.secondary_href, basePath)}" style="margin-left:18px;font-size:0.9rem">${escapeHtml(data.secondary_label)}</a>` : ""}
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
  const section = el("section", { style: "padding:8px 0 64px" });
  const container = el("div", { class: "container" });
  const grid = el("div", { class: "pricing-grid" });

  (data.plans || []).forEach((plan) => {
    const card = el("div", { class: plan.highlight ? "price-card highlight" : "price-card" });
    let html = `<div class="price-card-head"><h3>${escapeHtml(plan.title)}</h3>`;
    if (plan.badge) html += `<span class="badge">${escapeHtml(plan.badge)}</span>`;
    html += `</div>`;
    html += `<div class="price-tag">${escapeHtml(plan.price)}`;
    if (plan.price_suffix) html += `<span> ${escapeHtml(plan.price_suffix)}</span>`;
    html += `</div>`;
    html += `<p class="price-card-sub">${escapeHtml(plan.subtitle || "")}</p><ul>`;
    (plan.features || []).forEach((f) => (html += `<li>${escapeHtml(f)}</li>`));
    html += `</ul>`;
    const btnClass = plan.highlight ? "btn btn-primary" : "btn btn-contour";
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
    <div class="cta-band-inner">
      <div>
        <h2>${escapeHtml(data.title)}</h2>
        <p>${escapeHtml(data.text)}</p>
      </div>
      <a href="${resolveHref(data.button_href, basePath)}" class="btn btn-primary">${escapeHtml(data.button_label)}</a>
    </div>
  `
  );
}

// ---------- Accueil : l'appareil photo ----------
//
// Deux choix (particulier / commerce). Survoler un choix change l'image sur
// l'écran de l'appareil ; cliquer déclenche (obturateur, flash, l'écran
// s'agrandit jusqu'à remplir la page) puis ouvre le lien du choix — par
// défaut la page tarifs sur le bon onglet. Sans JavaScript, ou si le
// visiteur a demandé moins d'animations, ce sont de simples liens.

const ICONE_CHEVRON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONE_SON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path class="onde" d="M16.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path class="muet" d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

function buildAppareil(data, basePath) {
  const choix = (data.choices || []).slice(0, 2);
  const [part, com] = [choix[0] || {}, choix[1] || {}];

  const calque = (c, cls) => `
    <div class="appareil-calque ${cls}">
      <img src="${resolveSrc(c.image, basePath)}" alt="" style="object-position:${escapeHtml(c.position || "50% 50%")}" ${cls === "particulier" ? 'fetchpriority="high"' : 'loading="lazy"'} />
    </div>`;

  const option = (c, mode) => `
    <a class="appareil-option${mode === "particulier" ? " est-actif" : ""}" href="${resolveHref(c.href, basePath)}" data-mode="${mode}">
      <span>
        <span class="appareil-option-titre">${escapeHtml(c.label)}</span>
        <span class="appareil-option-desc">${escapeHtml(c.desc)}</span>
      </span>
      ${ICONE_CHEVRON}
    </a>`;

  const section = el(
    "section",
    { class: "appareil" },
    `
    <div class="appareil-grid">
      <div class="appareil-intro">
        <span class="eyebrow appareil-entree">${escapeHtml(data.eyebrow)}</span>
        <h1 class="appareil-entree d2">${escapeHtml(data.title_line1)}<br>${escapeHtml(data.title_line2)}</h1>
        <p class="appareil-sous-titre appareil-entree d3">${escapeHtml(data.subtitle)}</p>
      </div>

      <div class="appareil-choix appareil-entree d4">
        <p class="appareil-invite">${escapeHtml(data.prompt)}</p>
        <div class="appareil-options">
          ${option(part, "particulier")}
          ${option(com, "commerce")}
        </div>
        <div class="appareil-bas">
          ${data.link_label ? `<a class="btn-secondary" href="${resolveHref(data.link_href, basePath)}">${escapeHtml(data.link_label)}</a>` : "<span></span>"}
          <button type="button" class="appareil-son" aria-pressed="false" aria-label="Activer le son du déclencheur" title="Activer le son du déclencheur">${ICONE_SON}</button>
        </div>
      </div>

      <div class="appareil-scene" aria-hidden="true">
        <div class="appareil-cadre">
          <div class="appareil-echelle">
            <div class="appareil-boitier">
              <div class="appareil-coque">
                <div class="appareil-viseur"></div>
                <div class="appareil-corps"></div>
                <div class="appareil-molette">
                  <div class="appareil-molette-crantee"></div>
                  <div class="appareil-molette-face"></div>
                  <span class="appareil-molette-repere part">PART.</span>
                  <span class="appareil-molette-repere com">COM.</span>
                </div>
                <div class="appareil-rosace"><span>OK</span></div>
                <div class="appareil-touches"><span>MENU</span><span>INFO</span></div>
                <div class="appareil-anneau"></div>
              </div>
              <button type="button" class="appareil-declencheur" tabindex="-1"></button>
              <div class="appareil-ecran">
                <div class="appareil-ecran-int">
                  ${calque(part, "particulier")}
                  ${calque(com, "commerce")}
                  <div class="appareil-ui">
                    <span class="tiers t1"></span><span class="tiers t2"></span><span class="tiers t3"></span><span class="tiers t4"></span>
                    <span class="appareil-af"></span>
                    <span class="appareil-infos"><span class="appareil-infos-mode">${escapeHtml(part.label || "")}</span><span>f/2.8 · 1/250</span></span>
                  </div>
                  <div class="appareil-noir"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="appareil-flash"></div>
  `
  );

  initAppareil(section, { particulier: part, commerce: com });
  return section;
}

function initAppareil(section, choix) {
  if (section.closest && section.closest(".admin-live-editor")) return;

  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = section.querySelector(".appareil-scene");
  const cadre = section.querySelector(".appareil-cadre");
  const boitier = section.querySelector(".appareil-boitier");
  const ecran = section.querySelector(".appareil-ecran");
  const infosMode = section.querySelector(".appareil-infos-mode");
  const options = Array.from(section.querySelectorAll(".appareil-option"));
  const boutonSon = section.querySelector(".appareil-son");
  const declencheur = section.querySelector(".appareil-declencheur");
  let mode = "particulier";
  let enCours = false;
  let sonActif = false;
  let minuteurs = [];
  let audio = null;

  const ajusterEchelle = () => {
    const largeur = scene.clientWidth;
    if (!largeur) return;
    cadre.style.setProperty("--echelle", Math.min(1, largeur / 680).toFixed(4));
  };
  ajusterEchelle();
  if (window.ResizeObserver) new ResizeObserver(ajusterEchelle).observe(scene);
  else window.addEventListener("resize", ajusterEchelle);

  const choisir = (m) => {
    if (enCours || m === mode) return;
    mode = m;
    section.classList.toggle("est-commerce", m === "commerce");
    options.forEach((o) => o.classList.toggle("est-actif", o.dataset.mode === m));
    infosMode.textContent = (choix[m] && choix[m].label) || "";
  };

  const reinitialiser = () => {
    minuteurs.forEach(clearTimeout);
    minuteurs = [];
    enCours = false;
    section.classList.remove("en-cours", "phase-appui", "phase-obturation", "phase-flash", "phase-zoom");
    document.documentElement.style.overflow = "";
  };

  const cliquetis = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audio = audio || new Ctx();
      const salve = (debut, duree, gain, freq) => {
        const n = Math.floor(audio.sampleRate * duree);
        const tampon = audio.createBuffer(1, n, audio.sampleRate);
        const d = tampon.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
        const src = audio.createBufferSource();
        src.buffer = tampon;
        const filtre = audio.createBiquadFilter();
        filtre.type = "bandpass";
        filtre.frequency.value = freq;
        const g = audio.createGain();
        g.gain.value = gain;
        src.connect(filtre);
        filtre.connect(g);
        g.connect(audio.destination);
        src.start(audio.currentTime + debut);
      };
      salve(0, 0.045, 0.8, 2600);
      salve(0.085, 0.06, 0.5, 1800);
    } catch (e) {
      // le son reste un bonus : silence si le navigateur refuse
    }
  };

  // Facteur d'agrandissement pour que l'écran recouvre toute la fenêtre.
  const echelleZoom = () => {
    const r = ecran.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const sx = (2 * Math.max(cx, vw - cx)) / r.width;
    const sy = (2 * Math.max(cy, vh - cy)) / r.height;
    return (Math.max(sx, sy) * 1.04).toFixed(3);
  };

  const declencher = (m, href) => {
    if (enCours) return;
    choisir(m);
    if (reduit) {
      window.location.href = href;
      return;
    }
    enCours = true;
    if (sonActif) cliquetis();
    boitier.style.setProperty("--tilt-x", "0deg");
    boitier.style.setProperty("--tilt-y", "0deg");
    section.classList.add("en-cours", "phase-appui");
    const etape = (ms, fn) => minuteurs.push(setTimeout(fn, ms));
    etape(80, () => section.classList.replace("phase-appui", "phase-obturation"));
    etape(150, () => section.classList.replace("phase-obturation", "phase-flash"));
    etape(190, () => {
      ecran.style.setProperty("--zoom-ecran", echelleZoom());
      document.documentElement.style.overflow = "hidden";
      section.classList.remove("phase-flash");
      section.classList.add("phase-zoom");
    });
    etape(820, () => {
      window.location.href = href;
    });
  };

  options.forEach((o) => {
    o.addEventListener("mouseenter", () => choisir(o.dataset.mode));
    o.addEventListener("focus", () => choisir(o.dataset.mode));
    o.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      declencher(o.dataset.mode, o.href);
    });
  });

  declencheur.addEventListener("click", () => {
    const o = options.find((x) => x.dataset.mode === mode);
    if (o) declencher(mode, o.href);
  });

  boutonSon.addEventListener("click", () => {
    sonActif = !sonActif;
    boutonSon.setAttribute("aria-pressed", sonActif ? "true" : "false");
    const label = sonActif ? "Couper le son du déclencheur" : "Activer le son du déclencheur";
    boutonSon.setAttribute("aria-label", label);
    boutonSon.title = label;
  });

  if (!reduit && window.matchMedia("(hover: hover)").matches) {
    let image = null;
    section.addEventListener("mousemove", (e) => {
      if (enCours || image) return;
      const r = section.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      image = requestAnimationFrame(() => {
        image = null;
        boitier.style.setProperty("--tilt-x", `${(-y * 5).toFixed(2)}deg`);
        boitier.style.setProperty("--tilt-y", `${(x * 7).toFixed(2)}deg`);
      });
    });
    section.addEventListener("mouseleave", () => {
      boitier.style.setProperty("--tilt-x", "0deg");
      boitier.style.setProperty("--tilt-y", "0deg");
    });
  }

  // Retour arrière depuis la page tarifs : le navigateur peut restaurer la
  // page telle qu'on l'a quittée (écran agrandi) — on remet l'appareil.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) reinitialiser();
  });
}

// ---------- Accueil : bloc contact ----------

async function buildContactBref(data, basePath) {
  const section = el("section", { class: "contact-bref" });
  const container = el(
    "div",
    { class: "container contact-bref-grid" },
    `
    <div>
      <span class="eyebrow">${escapeHtml(data.eyebrow)}</span>
      <h2>${escapeHtml(data.title)}</h2>
      <p>${escapeHtml(data.text)}</p>
      <a href="${resolveHref(data.button_href, basePath)}" class="btn btn-primary">${escapeHtml(data.button_label)}</a>
    </div>
  `
  );
  const dl = el("dl", {});
  container.appendChild(dl);
  section.appendChild(container);

  try {
    const contact = await fetchJson(basePath, "content/contact.json");
    dl.innerHTML = `
      <dt>Email</dt><dd><a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></dd>
      <dt>Instagram</dt><dd><a href="${escapeHtml(contact.instagram_url)}" target="_blank" rel="noopener">${escapeHtml(contact.instagram_handle)}</a></dd>
      <dt>Zone</dt><dd>${escapeHtml(contact.zone)}</dd>
    `;
  } catch (e) {
    console.error(e);
  }
  return section;
}

// ---------- Page tarifs : bandeau + onglets ----------
//
// Les sections de la page qui portent un champ "tab" (ex. "commerces") ne
// s'affichent que lorsque cet onglet est actif. L'onglet de départ vient de
// l'adresse (services.html#commerces), sinon c'est le premier.

function buildOngletsTarifs(data, basePath) {
  const onglets = data.tabs || [];
  const section = el(
    "section",
    { class: "onglets-tarifs" },
    `
    <div class="onglets-bandeau">
      ${onglets
        .map(
          (t, i) =>
            `<img src="${resolveSrc(t.image, basePath)}" alt="${escapeHtml(t.alt || "")}" data-onglet-image="${escapeHtml(t.id)}" style="object-position:${escapeHtml(t.position || "50% 50%")};opacity:${i === 0 ? 1 : 0}" ${i === 0 ? 'fetchpriority="high"' : ""} />`
        )
        .join("")}
    </div>
    <div class="container onglets-entete">
      <span class="eyebrow">${escapeHtml(data.eyebrow)}</span>
      <h1>${escapeHtml(data.title)}</h1>
      <p class="onglets-intro">${escapeHtml((onglets[0] && onglets[0].text) || "")}</p>
      <div class="onglets-boutons" role="tablist" aria-label="Type de client">
        ${onglets
          .map(
            (t, i) =>
              `<button type="button" role="tab" class="onglet-btn" data-onglet-btn="${escapeHtml(t.id)}" aria-selected="${i === 0 ? "true" : "false"}">${escapeHtml(t.label)}</button>`
          )
          .join("")}
      </div>
    </div>
  `
  );
  section._onglets = onglets;
  return section;
}

function initOngletsTarifs(container) {
  const entete = container.querySelector(".onglets-tarifs");
  if (!entete || !entete._onglets || !entete._onglets.length) return;
  const onglets = entete._onglets;
  const intro = entete.querySelector(".onglets-intro");
  const sections = Array.from(container.querySelectorAll("[data-onglet]"));

  const activer = (id, majAdresse) => {
    const t = onglets.find((o) => o.id === id) || onglets[0];
    entete.querySelectorAll("[data-onglet-btn]").forEach((b) => b.setAttribute("aria-selected", b.dataset.ongletBtn === t.id ? "true" : "false"));
    entete.querySelectorAll("[data-onglet-image]").forEach((img) => (img.style.opacity = img.dataset.ongletImage === t.id ? "1" : "0"));
    intro.textContent = t.text || "";
    sections.forEach((s) => (s.hidden = s.dataset.onglet !== t.id));
    if (majAdresse && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", `#${t.id}`);
    }
  };

  entete.querySelectorAll("[data-onglet-btn]").forEach((b) => b.addEventListener("click", () => activer(b.dataset.ongletBtn, true)));

  const depuisAdresse = window.location.hash.slice(1);
  const correspondance = onglets.find((o) => o.id === depuisAdresse || o.id.replace(/s$/, "") === depuisAdresse.replace(/s$/, ""));
  activer(correspondance ? correspondance.id : onglets[0].id, false);
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
  appareil: buildAppareil,
  contact_bref: buildContactBref,
  onglets_tarifs: buildOngletsTarifs,
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
      if (node) {
        if (section.id) node.id = section.id;
        if (section.tab) node.dataset.onglet = section.tab;
        container.appendChild(node);
      }
    } catch (err) {
      console.error(`Erreur de rendu pour la section "${section.type}"`, err);
    }
  }
  highlightPlaceholders(container);
  initOngletsTarifs(container);

  if (typeof window.initScrollReveal === "function") window.initScrollReveal();
}

window.renderSections = renderSections;
window.SECTION_BUILDERS = SECTION_BUILDERS;
