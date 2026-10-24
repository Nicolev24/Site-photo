// Moteur de rendu générique : transforme un tableau de "sections" (issu de
// content/pages/<slug>.json, ou d'un brouillon non enregistré dans l'admin)
// en DOM. Utilisé à la fois par le site public (js/render.js) et par
// l'aperçu de l'admin (admin/preview.html) — même fonctions, donc aperçu
// toujours fidèle au rendu réel.
//
// `basePath` vaut "" sur les pages à la racine du site, "../" depuis /admin/.

// Chaque catégorie du portfolio appartient à un univers (js/univers.js).
const CATEGORIES = [
  { value: "portraits", label: "Portraits", univers: "particuliers" },
  { value: "couples", label: "Couples", univers: "particuliers" },
  { value: "entreprises", label: "Entreprises & commerces", univers: "commerces" },
  { value: "evenements", label: "Événements", univers: "particuliers" },
];

// Univers affiché (« particuliers » ou « commerces »), ou null quand
// js/univers.js n'est pas chargé : tout s'affiche alors.
function universCourant() {
  return window.Univers ? window.Univers.courant() : null;
}

function estDeLUnivers(univers) {
  const u = universCourant();
  return !u || !univers || univers === u;
}

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

// Chaque fichier n'est chargé qu'une fois par visite : passer d'une page à
// l'autre (ou d'un univers à l'autre) est alors immédiat.
const CACHE_JSON = new Map();

function fetchJson(basePath, path) {
  const cle = basePath + path;
  if (!CACHE_JSON.has(cle)) {
    const promesse = fetch(cle, { cache: "no-cache" }).then((res) => {
      if (!res.ok) throw new Error(`Impossible de charger ${path} (${res.status})`);
      return res.json();
    });
    promesse.catch(() => CACHE_JSON.delete(cle));
    CACHE_JSON.set(cle, promesse);
  }
  return CACHE_JSON.get(cle);
}

// Versions allégées des photos (images/tailles/, listées dans
// content/images.json par outils/optimiser-images.mjs). Le navigateur choisit
// la plus petite qui reste nette sur son écran ; l'original fait partie du
// choix, donc un grand écran ou un écran Retina garde la qualité maximale.
let TAILLES_IMAGES = null;

async function chargerTaillesImages(basePath) {
  if (TAILLES_IMAGES) return;
  try {
    TAILLES_IMAGES = (await fetchJson(basePath, "content/images.json")).images || {};
  } catch {
    TAILLES_IMAGES = {};
  }
}

// Attributs srcset/sizes pour une photo du site, ou {} si elle n'a pas
// (encore) de versions allégées — l'original est alors utilisé seul.
function attributsTailles(src, basePath, sizes) {
  const info = TAILLES_IMAGES && TAILLES_IMAGES[src];
  if (!info || !info.tailles || !info.tailles.length) return {};
  const sansExt = src.slice("images/".length).replace(/\.[^.]+$/, "");
  const candidats = info.tailles.map((w) => `${basePath}images/tailles/${sansExt}-${w}.webp ${w}w`);
  candidats.push(`${resolveSrc(src, basePath)} ${info.l}w`);
  return { srcset: candidats.join(", "), sizes };
}

function attributsTaillesHtml(src, basePath, sizes) {
  const a = attributsTailles(src, basePath, sizes);
  return a.srcset ? ` srcset="${escapeHtml(a.srcset)}" sizes="${escapeHtml(a.sizes)}"` : "";
}

const TAILLES_PLEINE_LARGEUR = "100vw";

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
    ...attributsTailles(data.image, basePath, TAILLES_PLEINE_LARGEUR),
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
    ...attributsTailles(data.image, basePath, "(max-width: 860px) 100vw, 560px"),
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
      ...attributsTailles(teaser.image, basePath, "(max-width: 860px) 50vw, 280px"),
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
  const categories = CATEGORIES.filter((c) => estDeLUnivers(c.univers));
  const filters = el(
    "div",
    { class: "filters" },
    `
    <button class="filter-btn active" data-filter="all">Tous</button>
    ${categories.map((c) => `<button class="filter-btn" data-filter="${c.value}">${escapeHtml(c.label)}</button>`).join("")}
  `
  );
  // Une seule catégorie dans cet univers : pas besoin de filtres.
  if (categories.length < 2) filters.hidden = true;
  const gallery = el("div", { class: "gallery" });

  try {
    const portfolio = await fetchJson(basePath, "content/portfolio.json");
    const valeurs = new Set(categories.map((c) => c.value));
    portfolio.items.filter((item) => valeurs.has(item.category)).forEach((item) => {
      const div = el("div", { class: "gallery-item", "data-category": item.category });
      div.appendChild(
        el("img", {
          src: resolveSrc(item.image, basePath),
          ...attributsTailles(item.image, basePath, "(max-width: 520px) 100vw, (max-width: 860px) 50vw, 380px"),
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
    // La page contact lit ?formule=… pour présélectionner la formule choisie.
    const lien = `${resolveHref("contact.html", basePath)}?formule=${encodeURIComponent(plan.title || "")}`;
    html += `<a href="${escapeHtml(lien)}" class="${btnClass}">${escapeHtml(plan.cta_label)}</a>`;
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
// l'écran de l'appareil ; cliquer déclenche (mise au point, obturateur)
// puis la photo de l'écran s'envole jusqu'à sa place sur la page tarifs du
// bon univers (transition gérée par js/render.js). Sans JavaScript, ou si
// le visiteur a demandé moins d'animations, ce sont de simples liens.

const ICONE_CHEVRON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONE_SON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path class="onde" d="M16.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path class="muet" d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

function buildAppareil(data, basePath) {
  const choix = (data.choices || []).slice(0, 2);
  const [part, com] = [choix[0] || {}, choix[1] || {}];
  const modeInitial = window.Univers ? window.Univers.mode() : "particulier";
  const actif = modeInitial === "commerce" ? com : part;

  // La photo visible porte la classe photo-univers (nom de transition).
  const calque = (c, cls) => `
    <div class="appareil-calque ${cls}${cls === modeInitial ? " photo-univers" : ""}">
      <img src="${resolveSrc(c.image, basePath)}"${attributsTaillesHtml(c.image, basePath, "(max-width: 900px) 90vw, 560px")} alt="" style="object-position:${escapeHtml(c.position || "50% 50%")}" ${cls === modeInitial ? 'fetchpriority="high"' : ""} decoding="async" />
    </div>`;

  const option = (c, mode) => `
    <a class="appareil-option${mode === modeInitial ? " est-actif" : ""}" href="${resolveHref(c.href, basePath)}" data-mode="${mode}">
      <span>
        <span class="appareil-option-titre">${escapeHtml(c.label)}</span>
        <span class="appareil-option-desc">${escapeHtml(c.desc)}</span>
      </span>
      ${ICONE_CHEVRON}
    </a>`;

  const section = el(
    "section",
    { class: `appareil${modeInitial === "commerce" ? " est-commerce" : ""}` },
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
                    <span class="appareil-infos"><span class="appareil-infos-mode">${escapeHtml(actif.label || "")}</span><span>f/2.8 · 1/250</span></span>
                  </div>
                  <div class="appareil-obturateur"></div>
                  <div class="appareil-eclair"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
  );

  initAppareil(section, { particulier: part, commerce: com }, modeInitial);
  return section;
}

function initAppareil(section, choix, modeInitial) {
  if (section.closest && section.closest(".admin-live-editor")) return;

  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = section.querySelector(".appareil-scene");
  const cadre = section.querySelector(".appareil-cadre");
  const boitier = section.querySelector(".appareil-boitier");
  const infosMode = section.querySelector(".appareil-infos-mode");
  const calques = Array.from(section.querySelectorAll(".appareil-calque"));
  const options = Array.from(section.querySelectorAll(".appareil-option"));
  const boutonSon = section.querySelector(".appareil-son");
  const declencheur = section.querySelector(".appareil-declencheur");
  let mode = modeInitial || "particulier";
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
    calques.forEach((c) => c.classList.toggle("photo-univers", c.classList.contains(m)));
    infosMode.textContent = (choix[m] && choix[m].label) || "";
  };

  const reinitialiser = () => {
    minuteurs.forEach(clearTimeout);
    minuteurs = [];
    enCours = false;
    section.classList.remove("en-cours", "phase-appui", "phase-obturation", "phase-depart");
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

  const ouvrir = (href) => {
    if (typeof window.naviguerVers === "function") window.naviguerVers(href, { transition: "appareil" });
    else window.location.href = href;
  };

  // Mise au point (le cadre AF se resserre), obturateur (deux rideaux qui
  // se croisent), petit éclair sur l'écran… puis la photo part vers la page.
  const declencher = (m, href) => {
    if (enCours) return;
    choisir(m);
    if (window.Univers) window.Univers.definir(window.Univers.depuisMode(m));
    if (reduit) {
      ouvrir(href);
      return;
    }
    enCours = true;
    if (sonActif) cliquetis();
    boitier.classList.add("sans-inclinaison");
    boitier.style.setProperty("--tilt-x", "0deg");
    boitier.style.setProperty("--tilt-y", "0deg");
    section.classList.add("en-cours", "phase-appui");
    const etape = (ms, fn) => minuteurs.push(setTimeout(fn, ms));
    etape(170, () => section.classList.replace("phase-appui", "phase-obturation"));
    etape(400, () => {
      section.classList.replace("phase-obturation", "phase-depart");
      ouvrir(href);
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

  // Retour arrière vers une page restaurée telle quelle par le navigateur
  // (après être passé par l'espace client, par exemple) : on remet l'appareil.
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

// ---------- Page tarifs : en-tête de l'univers ----------
//
// Titre de la page et photo de l'univers affiché (particuliers ou
// commerces). La photo est encadrée à une taille où elle reste parfaitement
// nette, et c'est elle que la photo « prise » par l'appareil de l'accueil
// vient remplacer pendant la transition (view-transition-name, voir le CSS).
// Les sections de la page qui portent un champ "tab" ne s'affichent que
// dans leur univers.

function buildOngletsTarifs(data, basePath) {
  const onglets = data.tabs || [];
  const u = universCourant();
  const t = onglets.find((o) => o.id === u) || onglets[0] || {};
  return el(
    "section",
    { class: "univers-entete" },
    `
    <div class="container univers-entete-grid">
      <div class="univers-entete-texte">
        <span class="eyebrow">${escapeHtml(data.eyebrow)}</span>
        <h1>${escapeHtml(data.title)}</h1>
        <p class="univers-entete-intro">${escapeHtml(t.text || "")}</p>
      </div>
      ${
        t.image
          ? `<figure class="univers-entete-photo photo-univers">
        <img src="${resolveSrc(t.image, basePath)}"${attributsTaillesHtml(t.image, basePath, "(max-width: 860px) 100vw, 600px")} alt="${escapeHtml(t.alt || "")}" style="object-position:${escapeHtml(t.position || "50% 50%")}" fetchpriority="high" decoding="async" />
      </figure>`
          : ""
      }
    </div>
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
      <label for="type">Formule souhaitée</label>
      <select id="type" name="Formule souhaitée"></select>
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
  await remplirFormules(form.querySelector("#type"), basePath);

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

// Liste des formules du formulaire de contact : reprise de la page tarifs
// (un groupe par onglet), pour rester à jour quand les formules changent
// dans l'admin. Le lien « Choisir cette formule » ajoute ?formule=<nom>,
// qui est alors présélectionné.
async function remplirFormules(select, basePath) {
  const groupes = [];
  try {
    const page = await fetchJson(basePath, "content/pages/services.json");
    const sections = page.sections || [];
    const onglets = sections.find((s) => s.type === "onglets_tarifs")?.data?.tabs || [];
    sections
      .filter((s) => s.type === "tarifs")
      .forEach((s) => {
        const titres = (s.data?.plans || []).map((p) => p.title).filter(Boolean);
        if (!titres.length) return;
        if (!estDeLUnivers(s.tab)) return;
        const libelle = universCourant() ? "" : onglets.find((t) => t.id === s.tab)?.label || "";
        groupes.push({ libelle, titres });
      });
  } catch (e) {
    console.error(e);
  }

  groupes.forEach(({ libelle, titres }) => {
    const parent = libelle ? el("optgroup", { label: libelle }) : select;
    titres.forEach((t) => parent.appendChild(el("option", { value: t }, escapeHtml(t))));
    if (parent !== select) select.appendChild(parent);
  });

  const voulue = new URLSearchParams(window.location.search).get("formule");
  if (voulue && !Array.from(select.options).some((o) => o.value === voulue)) {
    select.appendChild(el("option", { value: voulue }, escapeHtml(voulue)));
  }
  select.appendChild(el("option", { value: "Autre" }, "Autre / je ne sais pas encore"));
  select.value = voulue || "Autre";

  // Sur téléphone, le formulaire est sous les coordonnées : on y descend
  // directement quand le visiteur arrive depuis une formule.
  if (voulue && window.matchMedia("(max-width: 900px)").matches) {
    // On vise la colonne du formulaire (avec son titre), pas le formulaire seul.
    setTimeout(() => select.closest("form")?.parentElement?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
  }
}

// ---------- FAQ (questions fréquentes, en accordéon) ----------

function buildFaq(data) {
  const section = el("section", { class: "faq" });
  const container = el("div", { class: "container faq-inner" });
  let entete = "";
  if (data.eyebrow) entete += `<span class="eyebrow">${escapeHtml(data.eyebrow)}</span>`;
  if (data.title) entete += `<h2>${escapeHtml(data.title)}</h2>`;
  container.appendChild(el("div", { class: "faq-entete" }, entete));

  const liste = el("div", { class: "faq-liste" });
  (data.items || []).forEach((item) => {
    if (!item.question) return;
    liste.appendChild(
      el(
        "details",
        { class: "faq-item" },
        `<summary>${escapeHtml(item.question)}<span class="faq-signe" aria-hidden="true"></span></summary>
        <p>${escapeHtml(item.answer)}</p>`
      )
    );
  });
  container.appendChild(liste);
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
  faq: buildFaq,
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
  await chargerTaillesImages(basePath);
  container.innerHTML = "";
  for (const section of sections || []) {
    const builder = SECTION_BUILDERS[section.type];
    if (!builder || !estDeLUnivers(section.tab)) continue;
    try {
      const node = await builder(section.data || {}, basePath);
      if (node) {
        if (section.id) node.id = section.id;
        container.appendChild(node);
      }
    } catch (err) {
      console.error(`Erreur de rendu pour la section "${section.type}"`, err);
    }
  }
  highlightPlaceholders(container);

  if (typeof window.initScrollReveal === "function") window.initScrollReveal();
}

window.renderSections = renderSections;
window.SECTION_BUILDERS = SECTION_BUILDERS;
