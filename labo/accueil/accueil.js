// Labo v2 — l'accueil « de la lentille à la photo ».
//
// Une seule idée, comme la vidéo du café (du grain à la tasse) :
//   01 une lentille seule → 02 les bagues se montent, l'objectif se forme →
//   03 le boîtier arrive, l'appareil est complet → 04 le déclic, une photo sort →
//   05 la photo se développe, avec ce qui est inclus.
// Puis une page simple : les formules, qui je suis, réserver.
//
// Défilement libre (aucun « un geste = une étape »). Textes et formules repris
// des fichiers de contenu du site (modifiables dans l'admin), sans les prix.

(function () {
  "use strict";

  const R = document.documentElement;
  const calme = R.classList.contains("calme");
  const BASE = "../../";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const borne = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (v, a, b) => borne((v - a) / (b - a));
  const lisse = (t) => t * t * (3 - 2 * t);
  const sortie3 = (t) => 1 - Math.pow(1 - t, 3);
  const echapper = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // Interpolation douce entre des repères [c, valeur]
  function cle(c, reperes) {
    if (c <= reperes[0][0]) return reperes[0][1];
    for (let i = 1; i < reperes.length; i++) {
      const [c1, v1] = reperes[i];
      if (c <= c1) {
        const [c0, v0] = reperes[i - 1];
        return lerp(v0, v1, lisse((c - c0) / (c1 - c0)));
      }
    }
    return reperes[reperes.length - 1][1];
  }

  // ---------- Textes (un mot par étape, deux lignes au plus) ----------
  const TEXTES = {
    particuliers: {
      0: "Mariages, couples, portraits : des photos naturelles, une lumière soignée.",
      1: "On parle de vos envies, des lieux et du bon moment. Réponse sous 48 h.",
      2: "Je vous guide sans vous figer. Vous vivez le moment, je m'occupe du reste.",
      3: "Un instant vrai, pas une pose.",
      4: "Vos photos retouchées, dans votre galerie privée en ligne.",
      titre2: "Le jour J.",
      titre4: "Rien qu'à vous.",
    },
    commerces: {
      0: "Commerces et indépendants : votre lieu, votre équipe, votre savoir-faire.",
      1: "On fixe un créneau qui vous arrange et la liste des photos utiles.",
      2: "Je viens sur place, sans bloquer votre journée. Vous travaillez, je photographie.",
      3: "Votre métier, sur le vif.",
      4: "Retouchées, prêtes pour Google, vos réseaux et votre site.",
      titre2: "La séance.",
      titre4: "Prêtes à servir.",
    },
  };
  const NOMS = ["La lumière", "La préparation", "La séance", "Le déclic", "Vos photos"];
  const TIRAGE = {
    particuliers: { image: "images/mariages/maries-colonnes.jpg", pos: "50% 35%" },
    commerces: { image: "images/commerces/barbier-sourire-client.jpg", pos: "50% 30%" },
  };
  const FORMULES = {
    particuliers: [
      { title: "Formule découverte", features: ["Environ 1h de séance", "1 lieu", "Galerie privée en ligne"], image: "images/portfolio/portraits/img1.jpg" },
      { title: "Formule complète", badge: "Le plus demandé", features: ["2h à 3h de séance", "Plusieurs lieux possibles", "Galerie privée en ligne"], image: "images/mariages/baiser-pont-chateau.jpg" },
      { title: "Sur devis", features: ["Événements, journées complètes, entreprises...", "Durée et lieux adaptés à votre besoin", "Galerie privée en ligne"], image: "images/mariages/premiere-danse-etincelles.jpg" },
    ],
    commerces: [
      { title: "Séance photo commerce", features: ["1h sur place", "Photos retouchées", "Prêtes pour Google, les réseaux et votre site"], image: "images/commerces/barbier-sourire-client.jpg" },
      { title: "Site vitrine 1 page", features: ["Un site moderne et rapide", "Adapté à tous les écrans", "Vos photos intégrées"], image: "images/formules/site-vitrine.jpg" },
      { title: "Pack Photo + Site", badge: "Le plus choisi", features: ["Séance photo commerce incluse", "Site vitrine 1 page inclus"], image: "images/commerces/salon-vue-ensemble.jpg" },
    ],
  };

  // ---------- Éléments ----------
  const histoire = $("#histoire");
  const plateau = $("#plateau");
  const toile = $("#toile");
  const fixe = $("#lentille-fixe");
  const eclair = $("#eclair");
  const ombre = $("#ombre-sol");
  const tirage = $("#tirage");
  const tiragePhoto = $("#tirage-photo");
  const voile = $(".tirage-voile");
  const listeEtiquettes = $("#etiquettes");
  const etapes = $$(".etape");
  const repereNum = $(".repere-num");
  const repereNom = $(".repere-nom");
  const sommaire = $$("#sommaire li");
  const defiler = $("#defiler");
  const cartes = $("#cartes");
  const N = etapes.length;

  let univers = window.Univers ? window.Univers.courant() : "particuliers";
  let forcer = true; // redessiner au prochain passage
  let manifeste = {};
  let donnees = null;

  // ---------- Images (tailles WebP du site) ----------
  function image(chemin, max, sizes, alt, extra) {
    const info = manifeste[chemin];
    const sans = chemin.replace(/^images\//, "").replace(/\.[a-z]+$/i, "");
    let attrs;
    if (info && info.tailles && info.tailles.length) {
      const t = info.tailles.filter((w) => w <= max);
      const liste = t.length ? t : [info.tailles[0]];
      attrs = `src="${BASE}images/tailles/${sans}-${liste[liste.length - 1]}.webp" srcset="${liste
        .map((w) => `${BASE}images/tailles/${sans}-${w}.webp ${w}w`)
        .join(", ")}" sizes="${sizes}"`;
    } else attrs = `src="${BASE}${chemin}"`;
    return `<img ${attrs} alt="${echapper(alt)}" decoding="async"${extra || ""} />`;
  }

  // ---------- Contenu selon l'univers ----------
  function afficherTextes(u) {
    const t = TEXTES[u];
    $$("[data-texte]").forEach((el) => (el.textContent = t[el.dataset.texte] || ""));
    $$("[data-titre]").forEach((el) => (el.textContent = t["titre" + el.dataset.titre] || el.textContent));
    $$("button[data-univers]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.univers === u)));
    $$("[data-lien-univers]").forEach((a) => {
      if (!a.dataset.base) a.dataset.base = a.getAttribute("href");
      a.setAttribute("href", `${a.dataset.base}?pour=${u}`);
    });
  }

  function afficherTirage(u) {
    const t = TIRAGE[u];
    tiragePhoto.innerHTML = image(t.image, 1200, "(max-width: 900px) 62vw, 30vw", "");
    const img = tiragePhoto.querySelector("img");
    img.style.objectPosition = t.pos;
  }

  function afficherFormules(u) {
    if (!cartes) return;
    const plans = donnees && donnees.plans[u] && donnees.plans[u].length ? donnees.plans[u] : FORMULES[u];
    cartes.innerHTML = plans
      .map((p, i) => {
        const img = p.image || ((p.maquette && p.maquette.ecran) || {}).image || FORMULES[u][i % FORMULES[u].length].image;
        const points = (p.features || []).filter((f) => !/€|euros?\b/i.test(f)).slice(0, 3);
        const titre = p.title || "";
        return `<li class="carte">
          <div class="carte-photo">${image(img, 1200, "(max-width: 900px) 78vw, 30vw", p.alt || titre, ' loading="lazy"')}</div>
          ${p.badge ? `<p class="carte-badge">${echapper(p.badge)}</p>` : ""}
          <h3 class="carte-titre">${echapper(titre)}</h3>
          ${points.length ? `<ul class="carte-points">${points.map((f) => `<li>${echapper(f)}</li>`).join("")}</ul>` : ""}
          <div class="actions"><a class="lien" href="${BASE}contact.html?pour=${u}&amp;formule=${encodeURIComponent(titre)}">Réserver cette formule</a></div>
        </li>`;
      })
      .join("");
    // Les petits points sous les fiches (téléphone : on glisse sur le côté)
    let points = $(".points-defile");
    if (!points) {
      points = document.createElement("div");
      points.className = "points-defile";
      points.setAttribute("aria-hidden", "true");
      cartes.after(points);
    }
    points.innerHTML = plans.map((_, i) => `<span${i ? "" : ' class="est-actif"'}></span>`).join("");
    cartes.scrollLeft = 0;
  }
  if (cartes)
    cartes.addEventListener(
      "scroll",
      () => {
        const fiches = cartes.children;
        if (!fiches.length) return;
        const pas = fiches[0].getBoundingClientRect().width + 16;
        const i = Math.round(cartes.scrollLeft / pas);
        $$(".points-defile span").forEach((s, k) => s.classList.toggle("est-actif", k === i));
      },
      { passive: true }
    );

  function afficherTout(u, anime) {
    afficherTextes(u);
    const faire = () => {
      afficherFormules(u);
      afficherTirage(u);
    };
    if (!anime || !cartes) return faire();
    cartes.classList.add("change");
    setTimeout(() => {
      faire();
      cartes.classList.remove("change");
    }, 300);
  }

  function choisir(u) {
    if (u === univers) return;
    univers = u;
    if (window.Univers) {
      window.Univers.definir(u);
      if (window.Univers.confirmer) window.Univers.confirmer();
    }
    afficherTout(u, true);
  }
  $$("button[data-univers]").forEach((b) => b.addEventListener("click", () => choisir(b.dataset.univers)));

  // ---------- Données du site (admin) ----------
  function chargerDonnees() {
    const lire = (f) => fetch(BASE + f, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return Promise.all([lire("content/pages/services.json"), lire("content/contact.json"), lire("content/images.json")]).then(([services, contact, images]) => {
      manifeste = (images && images.images) || {};
      const d = { plans: { particuliers: [], commerces: [] } };
      ((services && services.sections) || []).forEach((s) => {
        if (s.type === "tarifs" && d.plans[s.tab]) d.plans[s.tab] = s.data.plans || [];
        if (s.type === "reassurance") {
          const items = (s.data.items || []).filter((it) => it && it.text).slice(0, 3);
          if (items.length) listeEtiquettes.innerHTML = items.map((it) => `<li>${echapper(it.text)}</li>`).join("");
        }
      });
      donnees = d;
      if (contact) {
        const liens = [];
        if (contact.instagram_url) liens.push(`<a href="${echapper(contact.instagram_url)}" target="_blank" rel="noopener">Instagram</a>`);
        if (contact.whatsapp_url) liens.push(`<a href="${echapper(contact.whatsapp_url)}" target="_blank" rel="noopener">WhatsApp</a>`);
        if (contact.email) liens.push(`<a href="mailto:${echapper(contact.email)}">${echapper(contact.email)}</a>`);
        $$("[data-canaux]").forEach((el) => (el.innerHTML = liens.join("")));
      }
    });
  }

  afficherTextes(univers);
  const annee = $("#annee");
  if (annee) annee.textContent = new Date().getFullYear();
  const pret = chargerDonnees().then(() => {
    afficherTout(univers, false);
    forcer = true;
  });

  // ---------- Jour / nuit ----------
  const boutonTheme = $("#theme");
  const boutonThemeMenu = $("#menu-theme");
  const metaCouleur = $('meta[name="theme-color"]');
  function majTheme() {
    const nuit = R.getAttribute("data-theme") === "nuit";
    if (boutonTheme) boutonTheme.setAttribute("aria-label", nuit ? "Passer en mode jour" : "Passer en mode nuit");
    if (boutonThemeMenu) boutonThemeMenu.textContent = nuit ? "Mode jour" : "Mode nuit";
    if (metaCouleur) metaCouleur.setAttribute("content", nuit ? "#111113" : "#ededf0");
  }
  function basculerTheme() {
    const t = R.getAttribute("data-theme") === "nuit" ? "jour" : "nuit";
    R.setAttribute("data-theme", t);
    try {
      localStorage.setItem("labo-theme", t);
    } catch (e) {}
    majTheme();
  }
  majTheme();
  if (boutonTheme) boutonTheme.addEventListener("click", basculerTheme);
  if (boutonThemeMenu) boutonThemeMenu.addEventListener("click", basculerTheme);

  // ---------- Menu du téléphone ----------
  const menu = $("#menu");
  const boutonMenu = $("#menu-btn");
  function ouvrirMenu(ouvert) {
    if (!menu) return;
    boutonMenu.setAttribute("aria-expanded", String(ouvert));
    R.classList.toggle("menu-ouvert", ouvert);
    if (ouvert) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add("est-ouvert"));
      const premier = $("a", menu);
      if (premier) premier.focus({ preventScroll: true });
    } else {
      menu.classList.remove("est-ouvert");
      setTimeout(() => (menu.hidden = true), 300);
      boutonMenu.focus({ preventScroll: true });
    }
  }
  if (boutonMenu) boutonMenu.addEventListener("click", () => ouvrirMenu(menu.hidden));
  const fermer = $("#menu-fermer");
  if (fermer) fermer.addEventListener("click", () => ouvrirMenu(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu && !menu.hidden) ouvrirMenu(false);
  });

  // ---------- Version calme (mouvements réduits) : tout est posé, rien ne bouge ----------
  if (calme) {
    pret.then(() => {
      if (voile) voile.style.opacity = 0;
    });
    return;
  }

  // ---------- Défilement doux à la molette (ordinateur) ----------
  let lenis = null;
  try {
    if (window.Lenis && window.matchMedia("(pointer: fine)").matches) lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
  } catch (e) {
    lenis = null;
  }
  $$("[data-saut]").forEach((a) =>
    a.addEventListener("click", (e) => {
      const cible = $(a.getAttribute("href"));
      if (!cible) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(cible, { duration: 1.8 });
      else window.scrollTo({ top: cible.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
    })
  );

  // ---------- Mesures ----------
  const M = { l: 1, h: 1, mobile: true, pas: 1, haut: 0 };
  function mesurer() {
    M.l = plateau.clientWidth;
    M.h = plateau.clientHeight;
    M.mobile = M.l < 900;
    M.pas = Math.round((M.mobile ? 0.85 : 0.95) * M.h);
    histoire.style.setProperty("--histoire-h", Math.round(M.h + M.pas * (N - 1 + 0.75)) + "px");
    M.haut = histoire.getBoundingClientRect().top + window.scrollY;
    // où se pose l'objet, et à quelle taille
    if (M.mobile) {
      M.x = M.l * 0.5;
      M.y = M.h * 0.47;
      M.dLentille = Math.min(M.l * 0.48, M.h * 0.3); // diamètre de la lentille à l'écran
      M.lCorps = Math.min(M.l * 0.78, M.h * 0.58); // largeur de l'appareil complet
      M.tw = Math.min(M.l * 0.6, M.h * 0.34); // largeur du tirage
      M.ty = M.h * 0.47;
      M.tx = M.l * 0.5;
    } else {
      M.x = M.l * 0.61;
      M.y = M.h * 0.53;
      M.dLentille = Math.min(M.l * 0.22, M.h * 0.38);
      M.lCorps = Math.min(M.l * 0.34, M.h * 0.72);
      M.tw = Math.min(M.l * 0.22, M.h * 0.44);
      M.ty = M.h * 0.53;
      M.tx = M.l * 0.61;
    }
    plateau.style.setProperty("--ox", M.x + "px");
    plateau.style.setProperty("--oy", M.y + "px");
    tirage.style.setProperty("--tw", M.tw + "px");
    if (api) api.redimensionner(M.l, M.h);
    forcer = true;
  }

  // ---------- L'état à un instant c (c = l'étape, 0 → 4, en continu) ----------
  const PI = Math.PI;
  function calculer(c) {
    const pxL = M.dLentille / 4.04; // la lentille fait 4,04 unités de diamètre
    const pxC = M.lCorps / 12.8; // le boîtier fait 12,8 unités de large
    const e = {
      x: M.x,
      y: cle(c, [
        [2.85, M.y],
        [3.55, M.y - M.h * 0.1],
      ]),
      px: cle(c, [
        [0, pxL],
        [1.2, pxL * 0.86],
        [1.95, pxC],
        [2.8, pxC * 1.05],
        [3.55, pxC * 0.62],
      ]),
      ancre: cle(c, [
        [1.1, 0],
        [1.85, 1],
      ]),
      ry: cle(c, [
        [0, PI - 0.78],
        [1.25, PI - 0.3],
        [2.15, PI - 0.62],
        [3.0, PI - 0.5],
      ]),
      rx: cle(c, [
        [0, 0.24],
        [1.25, 0.12],
        [2.15, 0.14],
      ]),
      rz: cle(c, [
        [0, -0.05],
        [2.15, 0],
      ]),
      assemble: seg(c, 0.15, 1.25),
      corps: seg(c, 1.25, 2.05),
      flash: Math.pow(Math.max(0, 1 - Math.abs(c - 2.86) / 0.12), 2),
      toile: 1 - seg(c, 3.05, 3.55),
    };
    e.tirage = sortie3(seg(c, 2.86, 3.5));
    e.dev = seg(c, 3.0, 3.85);
    e.etiquettes = [0, 1, 2].map((k) => sortie3(seg(c, 3.72 + 0.1 * k, 3.98 + 0.1 * k)));
    e.textes = etapes.map((_, i) => {
      const entree = i === 0 ? 1 : seg(c, i - 0.45, i - 0.2);
      const fin = i === N - 1 ? 0 : seg(c, i + 0.25, i + 0.5);
      return { o: entree * (1 - fin), y: (1 - entree) * 22 - fin * 14 };
    });
    e.etape = Math.round(borne(c, 0, N - 1));
    e.defiler = 1 - seg(c, 0.04, 0.3);
    return e;
  }

  // ---------- Affichage ----------
  let api = null;
  let signature = "";
  let lentilleVue = null; // position de la lentille à l'écran (pour le tirage)

  function appliquer(e) {
    // Les textes
    e.textes.forEach((t, i) => {
      const el = etapes[i];
      el.style.opacity = t.o.toFixed(3);
      el.style.visibility = t.o > 0.01 ? "visible" : "hidden";
      el.style.transform = `translateY(${t.y.toFixed(1)}px)`;
      el.classList.toggle("est-active", t.o > 0.5);
    });
    const num = String(e.etape + 1).padStart(2, "0");
    if (repereNum && repereNum.textContent !== num) {
      repereNum.textContent = num;
      repereNom.textContent = NOMS[e.etape];
    }
    sommaire.forEach((li, i) => li.classList.toggle("est-active", i === e.etape));
    if (defiler) defiler.style.opacity = e.defiler.toFixed(3);

    // L'appareil
    if (api) {
      api.appliquer(e);
      api.rendre();
      lentilleVue = api.lentilleEcran();
    } else {
      // en attendant la 3D : l'image fixe de la lentille, à la même place
      const d = M.dLentille * 1.6;
      fixe.style.width = d + "px";
      fixe.style.transform = `translate(${(M.x - d / 2).toFixed(1)}px, ${(M.y - d / 2).toFixed(1)}px)`;
      fixe.style.opacity = (1 - seg(e.assemble, 0, 0.3)).toFixed(3);
      lentilleVue = { x: M.x, y: M.y, r: M.dLentille / 2 };
    }
    toile.style.setProperty("--toile-o", e.toile.toFixed(3));
    eclair.style.opacity = (0.7 * e.flash).toFixed(3);

    // L'ombre au sol, sous l'objet
    const largeurObjet = lerp(M.dLentille * 0.95, M.lCorps * 0.92, e.ancre) * (e.px / lerp(M.dLentille / 4.04, M.lCorps / 12.8, e.ancre));
    const hauteurObjet = lerp(M.dLentille, M.lCorps * 0.55, e.ancre) * (e.px / lerp(M.dLentille / 4.04, M.lCorps / 12.8, e.ancre));
    const oy = e.y + hauteurObjet * 0.5 + M.h * 0.03;
    ombre.style.width = largeurObjet.toFixed(1) + "px";
    ombre.style.height = (largeurObjet * 0.16).toFixed(1) + "px";
    ombre.style.transform = `translate(${(e.x - largeurObjet / 2).toFixed(1)}px, ${(oy - largeurObjet * 0.08).toFixed(1)}px)`;
    ombre.style.opacity = ((api ? 0.9 : 0.6) * e.toile).toFixed(3);

    // Le tirage sort de l'objectif et vient se poser
    const t = e.tirage;
    if (t > 0.001) {
      const th = M.tw * 1.329;
      const depart = lentilleVue || { x: M.x, y: M.y, r: 30 };
      const s0 = Math.max(0.08, (2 * depart.r * 0.8) / M.tw);
      const cx = lerp(depart.x, M.tx, t);
      const cy = lerp(depart.y, M.ty, t);
      const s = lerp(s0, 1, t);
      const rot = lerp(-12, -2.5, t);
      const rotX = lerp(55, 0, t);
      tirage.style.visibility = "visible";
      tirage.style.opacity = seg(t, 0, 0.12).toFixed(3);
      tirage.style.transform = `translate(${(cx - M.tw / 2).toFixed(1)}px, ${(cy - th / 2).toFixed(1)}px) perspective(900px) rotateX(${rotX.toFixed(2)}deg) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})`;
      voile.style.opacity = (1 - e.dev).toFixed(3);
      // Les étiquettes, autour de la photo posée
      const gauche = M.tx - M.tw / 2;
      const droite = M.tx + M.tw / 2;
      const haut = M.ty - th / 2;
      $$("li", listeEtiquettes).forEach((li, k) => {
        const p = e.etiquettes[k] || 0;
        li.style.visibility = p > 0.01 ? "visible" : "hidden";
        li.style.opacity = p.toFixed(3);
        const w = li.offsetWidth;
        const cote = k === 1 ? 1 : -1; // gauche, droite, gauche
        const ancreX = cote < 0 ? gauche - (M.mobile ? 26 : 70) : droite + (M.mobile ? 26 : 70) - w;
        const x = borne(ancreX, 12, M.l - 12 - w);
        const y = haut + th * [0.06, 0.6, 0.86][k];
        li.style.transform = `translate(${x.toFixed(1)}px, ${(y + (1 - p) * 14).toFixed(1)}px)`;
      });
    } else {
      tirage.style.visibility = "hidden";
      tirage.style.opacity = 0;
      $$("li", listeEtiquettes).forEach((li) => {
        li.style.visibility = "hidden";
        li.style.opacity = 0;
      });
    }
  }

  // ---------- Boucle : suit le défilement, ne redessine que si ça bouge ----------
  let cLisse = null;
  let tPrec = 0;
  function boucle(t) {
    if (lenis) lenis.raf(t);
    const dt = Math.min(64, t - (tPrec || t));
    tPrec = t;
    const c = (window.scrollY - M.haut) / M.pas;
    if (cLisse === null) cLisse = c;
    cLisse += (c - cLisse) * (1 - Math.exp(-dt / (lenis ? 40 : 70)));
    if (Math.abs(c - cLisse) < 0.0005) cLisse = c;
    const cc = borne(cLisse, -0.2, N);
    const sig = cc.toFixed(4);
    if (forcer || sig !== signature) {
      signature = sig;
      forcer = false;
      appliquer(calculer(cc));
    }
    requestAnimationFrame(boucle);
  }

  // ---------- La 3D, chargée sans retarder l'affichage ----------
  let lance = false;
  function lancer3D() {
    if (lance) return;
    lance = true;
    import("./scene.js?v=1")
      .then((m) => m.creerAppareil({ canvas: toile, mobile: M.mobile, base: "../appareil/" }))
      .then((a) => {
        api = a;
        api.redimensionner(M.l, M.h);
        forcer = true;
        requestAnimationFrame(() => {
          toile.classList.add("est-prete");
          fixe.style.opacity = "0";
          setTimeout(() => (fixe.style.display = "none"), 700);
        });
      })
      .catch((err) => console.warn("3D indisponible :", err));
  }
  ["scroll", "pointerdown", "touchstart", "wheel", "keydown"].forEach((ev) => window.addEventListener(ev, lancer3D, { once: true, passive: true }));
  window.addEventListener("load", () => setTimeout(lancer3D, 2500));

  let largeurPrec = 0;
  let hauteurPrec = 0;
  window.addEventListener("resize", () => {
    // la barre d'adresse du téléphone ne change pas la mise en page (hauteur en svh)
    if (plateau.clientWidth === largeurPrec && plateau.clientHeight === hauteurPrec) return;
    largeurPrec = plateau.clientWidth;
    hauteurPrec = plateau.clientHeight;
    mesurer();
  });
  largeurPrec = plateau.clientWidth;
  hauteurPrec = plateau.clientHeight;
  mesurer();
  requestAnimationFrame(boucle);

  // Pour les tests
  window.__accueil = { M, calculer, get api() { return api; }, lancer3D };
})();
