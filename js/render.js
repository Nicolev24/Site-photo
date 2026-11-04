// Orchestrateur du site public : charge navigation/apparence/contenu depuis
// content/*.json, construit le header/footer, puis délègue le rendu des
// sections au moteur partagé js/sections-renderer.js.
//
// Navigation : les liens entre pages du site ne rechargent pas la page. Le
// contenu est remplacé sur place, avec une transition (View Transitions
// quand le navigateur sait faire, simple fondu sinon). C'est ce qui permet
// à la photo choisie sur l'accueil de s'ouvrir puis de glisser jusqu'à la
// page tarifs, et d'y revenir au retour. L'adresse et le
// bouton « retour » du navigateur restent ceux d'un site classique.

const SITE_URL = "https://nicolasleveugle.be/";
const RACINE = new URL("./", window.location.href);

let NAVIGATION = null;
const PAGES = new Set(["index"]);
let pageCourante = null;
let adresseCourante = "";
let fileNavigation = Promise.resolve();

function currentSlug() {
  const file = window.location.pathname.split("/").pop();
  if (!file || file === "") return "index";
  return file.replace(/\.html$/, "");
}

function isSameHref(href, slug) {
  return href.split(/[?#]/)[0].replace(/\.html$/, "") === slug;
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
    // Un favicon choisi dans l'admin remplace l'icône NL par défaut
    // (les deux balises : .ico et .svg).
    let links = Array.from(document.querySelectorAll('link[rel="icon"]'));
    if (!links.length) {
      const link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
      links = [link];
    }
    links.forEach((link) => {
      link.href = appearance.favicon_image;
      link.removeAttribute("type");
      link.removeAttribute("sizes");
    });
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
    else cta.removeAttribute("aria-current");
  }
}

async function buildFooter(navigation) {
  const pied = document.querySelector(".site-footer");
  if (!pied) return;

  let contact = null;
  try {
    contact = await fetchJson("", "content/contact.json");
  } catch (e) {
    // silencieux : le pied de page reste utilisable sans les coordonnées
  }
  const lien = (href, label, externe) =>
    `<li><a href="${href}"${externe ? ' target="_blank" rel="noopener"' : ""}>${label}</a></li>`;
  const pages = (navigation.footer_links || []).map((l) => lien(l.href, l.label)).join("") + lien("galerie/index.html", "Espace client");
  let coordonnees = "";
  if (contact) {
    if (contact.email) coordonnees += lien(`mailto:${contact.email}`, contact.email);
    if (typeof lienWhatsapp === "function" && lienWhatsapp(contact)) coordonnees += lien(lienWhatsapp(contact), "WhatsApp", true);
    if (contact.instagram_url) coordonnees += lien(contact.instagram_url, contact.instagram_handle || "Instagram", true);
  }
  const legal = (navigation.footer_legal_links || []).map((l) => lien(l.href, l.label)).join("");
  const zone = (contact && contact.zone) || "Ath · Wallonie et Bruxelles";

  pied.classList.add("pied-riche");
  pied.innerHTML = `
    <div class="container pied-grille">
      <div class="pied-marque">
        <a href="index.html" class="logo js-logo">Nicolas Leveugle</a>
        <p>Photographe à Ath<br>${zone.replace(/^Ath\s*·\s*/, "")}</p>
      </div>
      <nav class="pied-colonne" aria-label="Pages du site">
        <h3>Le site</h3>
        <ul>${pages}</ul>
      </nav>
      <div class="pied-colonne">
        <h3>Contact</h3>
        <ul>${coordonnees}</ul>
      </div>
    </div>
    <div class="container">
      <div class="pied-bas">
        <p class="footer-copy" id="footer-copy"></p>
        <ul class="pied-legal">${legal}</ul>
      </div>
    </div>`;

  const copy = document.getElementById("footer-copy");
  if (copy) {
    copy.innerHTML = `© <span id="year"></span> ${navigation.copyright_text}`;
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  }
}

// Une page « a des univers » si son contenu change selon particuliers /
// commerces : Google doit alors connaître les deux adresses.
function pageAUnivers(page) {
  return (page.sections || []).some((s) => s.tab || s.type === "contact");
}

function applySeo(seo, slug, avecUnivers) {
  if (seo && seo.title) document.title = seo.title;
  if (seo && seo.description) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", seo.description);
  }
  let url = slug === "index" ? SITE_URL : `${SITE_URL}${slug}.html`;
  if (avecUnivers && window.Univers && window.Univers.courant() === "commerces") url += "?pour=commerces";
  const canonique = document.querySelector('link[rel="canonical"]');
  if (canonique) canonique.href = url;
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute("content", url);
}

// ---------- Bouton « Réserver » flottant (téléphone) ----------
// Petit rond en bas à droite, toujours à portée de pouce une fois qu'on a
// commencé à descendre dans la page (caché sur la page contact, voir
// css/style.css).

function initReserverFixe(navigation) {
  const cta = navigation && navigation.cta_button;
  if (!cta || document.querySelector(".reserver-fixe")) return;
  const lien = document.createElement("a");
  lien.className = "reserver-fixe";
  lien.href = cta.href;
  lien.title = cta.label === "Réserver" ? "Réserver une séance" : cta.label;
  lien.setAttribute("aria-label", lien.title);
  // Petit calendrier
  lien.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M9.5 14.5l2 2 3.5-3.5"/></svg>';
  document.body.appendChild(lien);
  let prevu = false;
  const maj = () => {
    prevu = false;
    lien.classList.toggle("est-visible", window.scrollY > 320);
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!prevu) {
        prevu = true;
        requestAnimationFrame(maj);
      }
    },
    { passive: true }
  );
  maj();
}

// ---------- Statistiques de visite ----------
// Cloudflare Web Analytics : anonyme, sans cookie. Actif seulement si le
// jeton est renseigné dans l'admin (Général › Statistiques de visite).

function initStatistiques(site) {
  const jeton = site && site.statistiques_cloudflare;
  if (!jeton || !/^[0-9a-f]{32}$/i.test(jeton)) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token: jeton, spa: true }));
  document.head.appendChild(script);
}

// ---------- Sélecteur d'univers (en haut des pages, sauf l'accueil) ----------

function majBarreUnivers() {
  if (!window.Univers) return;
  document.querySelectorAll("#univers-barre [data-univers]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.univers === window.Univers.courant() ? "true" : "false");
  });
}

function initBarreUnivers() {
  if (!window.Univers) return;
  document.querySelectorAll("#univers-barre [data-univers]").forEach((b) => {
    b.addEventListener("click", () => changerUnivers(b.dataset.univers));
  });
  majBarreUnivers();
}

function changerUnivers(id) {
  if (!window.Univers) return;
  window.Univers.confirmer();
  if (id === window.Univers.courant()) return;
  window.Univers.definir(id);
  const url = new URL(window.location.href);
  url.searchParams.set("pour", id);
  // une formule présélectionnée appartenait à l'autre univers
  url.searchParams.delete("formule");
  window.history.replaceState(window.history.state, "", url);
  adresseCourante = url.pathname + url.search;
  fileNavigation = fileNavigation
    .then(() => transition(() => rendrePage(pageCourante), "univers"))
    .catch((err) => console.error(err));
}

// ---------- Fenêtre « Vous êtes un particulier ou un professionnel ? » ----------
//
// Affichée quand un visiteur qui n'a pas encore choisi touche une des photos du
// bas de l'accueil. Son choix est retenu : on ne lui demande plus ensuite.

let choixOuvert = false;

async function ouvrirChoixUnivers(href, textes = {}) {
  if (choixOuvert) return;
  choixOuvert = true;
  const precedent = document.activeElement;
  let panneaux = [];
  try {
    const accueil = await fetchJson("", "content/pages/index.json");
    const section = (accueil.sections || []).find((s) => s.type === "polaroids");
    panneaux = (section && section.data && section.data.panels) || [];
  } catch (e) {
    // sans les photos, les deux choix restent utilisables
  }
  const photo = (u) => panneaux.find((p) => p.univers === u) || {};
  const choix = [
    { id: "particuliers", titre: "Particulier", texte: "Mariage, couple, portrait, événement", p: photo("particuliers") },
    { id: "commerces", titre: "Professionnel", texte: "Commerce, entreprise, site vitrine", p: photo("commerces") },
  ];
  const fenetre = document.createElement("div");
  fenetre.className = "choix-univers";
  fenetre.setAttribute("role", "dialog");
  fenetre.setAttribute("aria-modal", "true");
  fenetre.setAttribute("aria-labelledby", "choix-titre");
  fenetre.innerHTML = `
    <div class="choix-boite">
      <button type="button" class="choix-fermer" aria-label="Fermer">×</button>
      <p class="choix-intro">${escapeHtml(textes.intro || "Pour vous montrer ce qui vous concerne")}</p>
      <h2 id="choix-titre">${escapeHtml(textes.titre || "Vous êtes plutôt…")}</h2>
      <div class="choix-cartes">
        ${choix
          .map(
            (c) => `
        <button type="button" class="choix-carte" data-univers="${c.id}">
          ${c.p.image ? `<img src="${escapeHtml(resolveSrc(c.p.image, ""))}"${attributsTaillesHtml(c.p.image, "", "(max-width: 700px) 90vw, 340px")} alt="" style="${escapeHtml(styleCadrage(c.p))}" />` : ""}
          <span class="choix-texte">
            <span class="choix-nom">${c.titre}</span>
            <span class="choix-detail">${c.texte}</span>
          </span>
        </button>`
          )
          .join("")}
      </div>
      <button type="button" class="choix-passer">Je regarde d'abord, je choisirai plus tard</button>
    </div>`;
  document.body.appendChild(fenetre);
  document.documentElement.classList.add("choix-ouvert");
  requestAnimationFrame(() => fenetre.classList.add("est-visible"));

  const fermer = (aller) => {
    document.removeEventListener("keydown", surTouche);
    fenetre.classList.remove("est-visible");
    document.documentElement.classList.remove("choix-ouvert");
    setTimeout(() => fenetre.remove(), 260);
    choixOuvert = false;
    if (aller) naviguerVers(href, { transition: "page" });
    else if (precedent && precedent.focus) precedent.focus();
  };
  const surTouche = (e) => {
    if (e.key === "Escape") fermer(false);
    if (e.key === "Tab") {
      const focusables = Array.from(fenetre.querySelectorAll("button"));
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    }
  };
  document.addEventListener("keydown", surTouche);
  fenetre.addEventListener("click", (e) => {
    if (e.target === fenetre) fermer(false);
  });
  fenetre.querySelector(".choix-fermer").addEventListener("click", () => fermer(false));
  fenetre.querySelector(".choix-passer").addEventListener("click", () => fermer(true));
  fenetre.querySelectorAll(".choix-carte").forEach((b) =>
    b.addEventListener("click", () => {
      window.Univers.definir(b.dataset.univers);
      window.Univers.confirmer();
      fermer(true);
    })
  );
  fenetre.querySelector(".choix-carte").focus();
}

window.ouvrirChoixUnivers = ouvrirChoixUnivers;

// ---------- Rendu d'une page ----------

// Adresse « propre » : ?pour=<univers> sur toutes les pages sauf l'accueil
// (les anciens liens services.html#commerces sont convertis).
function adresseAvecUnivers(url, slug) {
  const u = new URL(url.href);
  if (!window.Univers) return u;
  const depuis = window.Univers.depuisAdresse(u);
  if (depuis) window.Univers.definir(depuis);
  if (window.Univers.normaliser(u.hash)) u.hash = "";
  if (slug === "index") u.searchParams.delete("pour");
  else u.searchParams.set("pour", window.Univers.courant());
  return u;
}

// Attend que les photos du haut de page soient prêtes, pour que la
// transition arrive sur une page complète (au plus 0,6 s).
function imagesPretes(root) {
  const imgs = Array.from(root.querySelectorAll('.photo-univers img, img[fetchpriority="high"]')).slice(0, 3);
  const attente = Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
  return Promise.race([attente, new Promise((r) => setTimeout(r, 600))]);
}

async function rendrePage(slug) {
  const page = await fetchJson("", `content/pages/${slug}.json`);
  pageCourante = slug;
  document.documentElement.dataset.page = slug;
  buildNav(NAVIGATION, slug);
  majBarreUnivers();
  applySeo(page.seo, slug, pageAUnivers(page));
  const root = document.getElementById("sections-root");
  if (root) {
    await renderSections(root, page.sections, "");
    await imagesPretes(root);
  }
}

function defilerVersAncre(hash) {
  if (!hash) return false;
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return false;
  const header = document.querySelector(".site-header");
  const offset = (header ? header.offsetHeight : 0) + 16;
  window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: "auto" });
  return true;
}

// ---------- Transitions ----------

function mouvementReduit() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// type : "page" (page à page), "ouverture" (départ de l'accueil quand on
// choisit une des deux photos), "retour" (vers l'accueil), "univers"
// (changement d'univers).
// Les animations elles-mêmes sont dans css/style.css (« Transitions »).
async function transition(maj, type) {
  if (mouvementReduit()) {
    await maj();
    return;
  }
  const html = document.documentElement;
  if (document.startViewTransition) {
    html.dataset.transition = type;
    try {
      const t = document.startViewTransition(maj);
      await t.updateCallbackDone;
      await t.finished.catch(() => {});
    } finally {
      delete html.dataset.transition;
    }
    return;
  }
  // Navigateurs sans View Transitions : fondu enchaîné du contenu.
  const root = document.getElementById("sections-root");
  const sortie = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards", easing: "ease-out" });
  await sortie.finished.catch(() => {});
  await maj();
  sortie.cancel();
  root.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], {
    duration: 480,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  });
}

// ---------- Navigation sans rechargement ----------

function slugDe(url) {
  if (url.origin !== window.location.origin || !url.pathname.startsWith(RACINE.pathname)) return null;
  const reste = url.pathname.slice(RACINE.pathname.length);
  if (reste.includes("/") || (reste && !reste.endsWith(".html"))) return null;
  const slug = !reste || reste === "index.html" ? "index" : reste.replace(/\.html$/, "");
  return PAGES.has(slug) ? slug : null;
}

function naviguerVers(href, options = {}) {
  const url = new URL(href, window.location.href);
  const slug = slugDe(url);
  if (!slug) {
    window.location.href = url.href;
    return Promise.resolve();
  }
  const pousser = options.pousser !== false;
  let type = options.transition || "page";
  if (type === "page" && slug === "index" && pageCourante !== "index") type = "retour";

  const cible = adresseAvecUnivers(url, slug);
  if (pousser) {
    window.history.replaceState({ ...(window.history.state || {}), y: window.scrollY }, "");
    window.history.pushState({ y: 0 }, "", cible);
  } else {
    window.history.replaceState(window.history.state, "", cible);
  }
  adresseCourante = cible.pathname + cible.search;

  const maj = async () => {
    // En haut de la nouvelle page avant de la construire (l'ancienne est
    // déjà figée par la transition) : les sections visibles d'emblée
    // s'affichent alors sans attendre le défilement.
    if (typeof options.defilement !== "number" && !cible.hash) window.scrollTo(0, 0);
    await rendrePage(slug);
    if (typeof options.defilement === "number") window.scrollTo(0, options.defilement);
    else if (!defilerVersAncre(cible.hash)) window.scrollTo(0, 0);
  };

  fileNavigation = fileNavigation
    .then(() => transition(maj, type))
    .catch((err) => {
      console.error(err);
      window.location.href = cible.href;
    });
  return fileNavigation;
}

window.naviguerVers = naviguerVers;

function intercepterLiens(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest("a[href]");
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
  const url = new URL(a.href, window.location.href);
  if (!slugDe(url)) return;
  const memePage = url.pathname === window.location.pathname;
  if (memePage && url.hash && !url.search) return; // simple ancre : comportement normal
  e.preventDefault();
  if (memePage && !url.hash && (!url.search || url.search === window.location.search)) {
    window.scrollTo({ top: 0, behavior: mouvementReduit() ? "auto" : "smooth" });
    return;
  }
  naviguerVers(url.href);
}

function surRetourArriere(e) {
  const url = new URL(window.location.href);
  // simple changement d'ancre sur la même page : rien à refaire
  if (url.pathname + url.search === adresseCourante) return;
  const y = e.state && typeof e.state.y === "number" ? e.state.y : 0;
  naviguerVers(url.href, { pousser: false, defilement: y });
}

async function init() {
  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  const slug = currentSlug();
  PAGES.add(slug);

  const [navigation, appearance, site] = await Promise.all([
    fetchJson("", "content/navigation.json"),
    fetchJson("", "content/appearance.json"),
    fetchJson("", "content/site.json").catch(() => null),
  ]);
  NAVIGATION = navigation;
  ((site && site.pages) || []).forEach((p) => PAGES.add(p.slug));

  applyAppearance(appearance);
  buildFooter(navigation);
  initReserverFixe(navigation);
  initStatistiques(site);
  initBarreUnivers();

  const cible = adresseAvecUnivers(new URL(window.location.href), slug);
  window.history.replaceState({ y: 0 }, "", cible);
  adresseCourante = cible.pathname + cible.search;

  await rendrePage(slug);
  defilerVersAncre(cible.hash);

  document.addEventListener("click", intercepterLiens);
  window.addEventListener("popstate", surRetourArriere);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Erreur de chargement de la page", err));
});
