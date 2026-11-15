// Labo — accueil « dans l'appareil photo ».
//
// 1. Arrivée dans le viseur (vraie photo HTML, interface du viseur, mise au point).
// 2. Le visiteur choisit Particulier / Commerce (déclenchement, obturateur) ou
//    fait défiler : on recule hors de l'appareil, il fait un tour sur lui-même,
//    puis se range (colonne de droite sur ordinateur, en haut sur téléphone).
// 3. Le contenu de l'univers défile à côté.
//
// Toute l'animation est calculée à partir d'un seul nombre, l'avancement p
// (0 → 1) du défilement de l'intro : elle se rejoue à l'envers en remontant.

(function () {
  "use strict";

  const R = document.documentElement;
  const calme = R.classList.contains("calme");
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const BASE = "../../";
  const aGsap = typeof window.gsap !== "undefined";

  // ---------- Géométrie partagée avec la scène 3D ----------
  const GEO = {
    fov: 26,
    camZ: 46,
    corps: { l: 11.8, h: 6.6, p: 3.1 },
    ecran: { cx: -1.05, cy: -0.55, l: 6.6, h: 4.4, z: 1.68 },
    objectif: { x: -1.05, y: -0.3 },
  };
  const TOUR = 3 * Math.PI - 0.5; // un tour complet, puis trois-quarts face (objectif visible)
  const PH = { a: 0.34, b0: 0.3, b1: 0.9, c0: 0.64, c1: 1 };

  // ---------- Outils ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = {
    inOut2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inOut3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOut4: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
    out3: (t) => 1 - Math.pow(1 - t, 3),
    sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  };
  const echapper = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const emphase = (s) => echapper(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const toile = $("#toile");
  const cadre = $("#cadre");
  const photo = $("#photo");
  const viseur = $("#viseur");
  const colli = $("#collimateur");
  const entete = $("#entete");
  const fondPhoto = $("#fond-photo");
  const halo = $("#fond-halo");
  const fixe = $("#appareil-fixe");
  const intro = $("#intro");
  const scene = $("#scene");
  const contenu = $("#contenu");
  const zones = $$(".zone");
  const accroche = $("#accroche");

  // ---------- Mesures (taille d'écran → distances 3D) ----------
  const M = {};
  function mesurer(force) {
    const l = window.innerWidth;
    const h = window.innerHeight;
    // Sur téléphone, la barre d'adresse qui se replie change la hauteur : on ignore.
    if (!force && M.l === l && Math.abs(M.h - h) < 140) return false;
    M.l = l;
    M.h = h;
    M.mobile = l <= 760;
    M.aspect = l / h;
    M.tan = Math.tan((GEO.fov * Math.PI) / 360);
    M.course = Math.round((calme ? 0.9 : M.mobile ? 1.45 : 1.7) * h);
    M.entete = M.mobile ? 56 : 64;
    intro.style.height = h + M.course + "px";
    scene.style.height = h + "px";

    const E = GEO.ecran;
    const dLarg = (f) => E.l / (2 * M.tan * M.aspect * f);
    const dHaut = (f) => E.h / (2 * M.tan * f);
    M.d0 = Math.min(dLarg(1), dHaut(1)) * 0.985; // l'écran arrière couvre tout l'écran
    M.dA = Math.max(dLarg(M.mobile ? 0.8 : 0.5), dHaut(M.mobile ? 0.42 : 0.6)); // posé sur l'appareil

    // Rangement : colonne de droite (ordinateur) ou en haut, dans l'en-tête (téléphone)
    const prof = M.dA + E.z; // profondeur du centre de l'appareil
    const versMonde = (x, y) => ({
      x: ((x / l) * 2 - 1) * prof * M.tan * M.aspect,
      y: (1 - (y / h) * 2) * prof * M.tan,
    });
    const pxParUnite = l / (2 * prof * M.tan * M.aspect);
    let cx, cy, largeur;
    if (M.mobile) {
      cx = l / 2;
      cy = M.entete / 2;
      largeur = 64;
    } else {
      const finColonne = Math.min(0.56 * l, 800) + clamp(0.06 * l, 22, 96);
      cx = (finColonne + l) / 2;
      cy = h * 0.53;
      largeur = Math.min((l - finColonne) * 0.78, 560);
    }
    const w = versMonde(cx, cy);
    M.dock = { x: w.x, y: w.y, s: largeur / (GEO.corps.l * pxParUnite), px: cx, py: cy };
    halo.style.background = M.mobile
      ? ""
      : `radial-gradient(${largeur * 1.15}px ${largeur * 1.05}px at ${cx}px ${cy}px, rgba(174,140,91,0.17), rgba(174,140,91,0) 72%)`;
    return true;
  }

  // Rectangle (pixels) de l'écran arrière quand l'appareil est de dos, à la distance d.
  function rectEcran(d) {
    const E = GEO.ecran;
    const w = (E.l / (2 * d * M.tan * M.aspect)) * M.l;
    const h = (E.h / (2 * d * M.tan)) * M.h;
    return { x: (M.l - w) / 2, y: (M.h - h) / 2, w, h };
  }

  // ---------- L'état de toute la scène pour un avancement p ----------
  const reaction = { ry: 0, rx: 0, flash: 0 };
  let api3d = null;
  let modeFixe = false;

  function calculer(p, temps) {
    const e = { p };
    if (calme) {
      // Version douce : pas de recul ni de rotation, l'appareil apparaît rangé.
      const f = seg(p, 0, 0.55);
      e.cadre = { x: 0, y: 0, w: M.l, h: M.h, o: 1 - f };
      e.d = { x: M.dock.x, y: M.dock.y, z: GEO.camZ - M.dA - GEO.ecran.z, s: M.dock.s, rx: 0.16, ry: TOUR, rz: -0.05, balayage: -1, reflet: 0 };
      e.toile = seg(p, 0.35, 0.8);
      e.viseur = 1 - seg(p, 0, 0.12);
      e.fond = 0;
      e.halo = seg(p, 0.5, 1);
      e.accroche = seg(p, 0.4, 0.8);
      return e;
    }

    // a. On recule hors de l'appareil : interpolation sur 1/distance (mouvement « optique »)
    const ta = seg(p, 0, PH.a);
    const kA = ease.inOut3(ta);
    const d = 1 / lerp(1 / M.d0, 1 / M.dA, kA);
    const re = rectEcran(d);
    const k = ease.inOut2(ta);
    e.cadre = { x: lerp(0, re.x, k), y: lerp(0, re.y, k), w: lerp(M.l, re.w, k), h: lerp(M.h, re.h, k), o: 1 };
    if (p >= PH.a && api3d) e.cadre.o = 0; // l'écran 3D prend le relais, au pixel près
    else if (!api3d) e.cadre.o = 1 - seg(p, PH.a, PH.a + 0.14);

    // b. Un tour complet, légère inclinaison ; c. rangement
    const tb = seg(p, PH.b0, PH.b1);
    const tour = ease.inOut3(tb) * TOUR;
    const vague = Math.sin(Math.PI * tb);
    const tc = ease.inOut4(seg(p, PH.c0, PH.c1));
    const recentre = ease.inOut2(seg(p, PH.b0, PH.b0 + 0.22));
    let x = -GEO.ecran.cx * (1 - recentre);
    let y = -GEO.ecran.cy * (1 - recentre) + 0.55 * vague * (1 - tc);
    const z = GEO.camZ - d - GEO.ecran.z;
    x = lerp(x, M.dock.x, tc);
    y = lerp(y, M.dock.y, tc);
    // pendant le tour, l'appareil recule un peu (l'objectif ne sort pas de l'écran)
    const recul = 1 - (M.mobile ? 0.42 : 0.24) * ease.inOut2(seg(p, PH.b0, PH.b0 + 0.3));
    const s = lerp(recul, M.dock.s, tc);
    let rx = 0.16 * vague + 0.16 * tc;
    let ry = tour;
    let rz = 0.07 * vague - 0.05 * tc;

    // Reflet qui balaie l'objectif : au premier passage de face, puis à l'arrivée
    let balayage = -1;
    if (tour > Math.PI - 1.2 && tour < Math.PI + 1.2) balayage = (tour - (Math.PI - 1.2)) / 2.4;
    else if (tour > TOUR - 1.3) balayage = seg(tour, TOUR - 1.3, TOUR);

    // Après l'intro : l'appareil reste vivant
    const vivant = seg(p, 0.9, 1);
    let yFlotte = 0;
    if (vivant > 0) {
      const apres = (window.scrollY - M.course) / M.h;
      ry += vivant * (Math.sin(apres * 1.1) * 0.16 + reaction.ry);
      rx += vivant * (Math.sin(apres * 0.8 + 1) * 0.04 + reaction.rx);
      if (!M.mobile && temps) {
        yFlotte = Math.sin(temps * 0.9) * 0.05 * s * 6;
        ry += Math.sin(temps * 0.45) * 0.035 * vivant;
        rz += Math.sin(temps * 0.6) * 0.01 * vivant;
      }
    }
    e.d = { x, y: y + yFlotte * vivant, z, s, rx, ry, rz, balayage, reflet: 0.32 * seg(p, PH.a, PH.a + 0.08), flash: reaction.flash };
    e.toile = 1;
    e.viseur = 1 - seg(p, 0, 0.09);
    e.fond = 0.85 * seg(p, 0.06, 0.26) * (1 - seg(p, 0.42, 0.68));
    e.halo = seg(p, 0.72, 1);
    e.accroche = seg(p, 0.74, 0.95);
    return e;
  }

  // ---------- Appliquer l'état (DOM + 3D) ----------
  let derniereCadre = "";
  function appliquer(e) {
    const c = e.cadre;
    const cle = `${c.x | 0},${c.y | 0},${c.w | 0},${c.h | 0},${c.o.toFixed(3)}`;
    if (cle !== derniereCadre) {
      derniereCadre = cle;
      cadre.style.left = c.x + "px";
      cadre.style.top = c.y + "px";
      cadre.style.width = c.w + "px";
      cadre.style.height = c.h + "px";
      cadre.style.opacity = c.o;
      cadre.style.visibility = c.o <= 0.001 ? "hidden" : "";
      cadre.style.setProperty("--voile", String(1 - seg(e.p, 0, 0.16)));
    }
    viseur.style.opacity = e.viseur;
    viseur.style.transform = `translateY(${-24 * (1 - e.viseur)}px)`;
    viseur.style.visibility = e.viseur <= 0.01 ? "hidden" : "";
    fondPhoto.style.opacity = e.fond;
    accroche.style.opacity = e.accroche;
    accroche.style.transform = e.accroche < 1 ? `translateY(${30 * (1 - ease.out3(e.accroche))}px)` : "";
    halo.style.opacity = e.halo;
    entete.classList.toggle("est-plein", e.p > 0.9);
    R.classList.toggle("dock", M.mobile && e.p > 0.86);
    if (modeFixe) {
      fixe.style.opacity = seg(e.p, 0.7, 1);
    } else if (api3d) {
      toile.style.opacity = calme ? e.toile : "";
      api3d.appliquer(e.d);
      api3d.rendre();
    }
  }

  // ---------- Boucle : on suit le défilement (lissé), on ne dessine que si besoin ----------
  let pLisse = 0;
  let pDernier = -1;
  let signature = "";
  let temps = 0;
  let forcer = true;

  function avancement() {
    return clamp(window.scrollY / M.course);
  }

  function tick(_t, dtMs) {
    const dt = Math.min(0.1, (dtMs || 16) / 1000);
    temps += dt;
    const cible = avancement();
    pLisse = calme ? cible : pLisse + (cible - pLisse) * (1 - Math.exp(-dt * (M.mobile ? 16 : 11)));
    if (Math.abs(cible - pLisse) < 0.0002) pLisse = cible;
    const vivantContinu = !calme && !M.mobile && pLisse > 0.9 && api3d && document.visibilityState === "visible";
    const sig = `${reaction.ry.toFixed(4)},${reaction.rx.toFixed(4)},${reaction.flash.toFixed(3)},${pLisse > 0.9 ? window.scrollY : 0}`;
    if (forcer || vivantContinu || Math.abs(pLisse - pDernier) > 0.00005 || sig !== signature) {
      forcer = false;
      pDernier = pLisse;
      signature = sig;
      appliquer(calculer(pLisse, vivantContinu ? temps : 0));
    }
  }

  // ---------- Interface du viseur : collimateur, mise au point, obturateur ----------
  const pos = { x: 0, y: 0, l: 86, h: 86 };
  function placerCollimateur(x, y, l, h, duree) {
    pos.x = x;
    pos.y = y;
    pos.l = l;
    pos.h = h;
    if (aGsap && duree) {
      gsap.to(colli, { x, y, width: l, height: h, duration: duree, ease: "expo.out", overwrite: true });
    } else {
      colli.style.transform = `translate(${x}px, ${y}px)`;
      colli.style.width = l + "px";
      colli.style.height = h + "px";
    }
  }

  // Le sujet de la photo (le gâteau), en pixels, selon le cadrage « cover » de l'image.
  function pointSujet() {
    const iw = photo.naturalWidth || 2134;
    const ih = photo.naturalHeight || 1421;
    const ech = Math.max(M.l / iw, M.h / ih);
    const pw = iw * ech;
    const ph = ih * ech;
    const op = getComputedStyle(photo).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
    const ox = (M.l - pw) * (isNaN(op[0]) ? 0.5 : op[0]);
    const oy = (M.h - ph) * (isNaN(op[1]) ? 0.5 : op[1]);
    return { x: ox + 0.5 * pw, y: oy + 0.4 * ph };
  }

  let minuterie = 0;
  function verrouiller(oui) {
    colli.classList.toggle("verrouille", oui);
    viseur.classList.toggle("verrouille", oui);
  }
  function surSujet(duree) {
    const t = M.mobile ? 70 : 86;
    const s = pointSujet();
    placerCollimateur(s.x - t / 2, s.y - t / 2, t, t, duree);
    zones.forEach((z) => z.classList.remove("vise"));
    clearTimeout(minuterie);
    minuterie = setTimeout(() => verrouiller(true), duree ? duree * 600 : 0);
  }
  function viser(el, immediat) {
    if (window.scrollY > M.h * 0.1) return;
    const r = el.getBoundingClientRect();
    const marge = 7;
    verrouiller(false);
    placerCollimateur(r.left - marge, r.top - marge, r.width + 2 * marge, r.height + 2 * marge, immediat ? 0.18 : 0.42);
    zones.forEach((z) => z.classList.toggle("vise", z === el));
    clearTimeout(minuterie);
    minuterie = setTimeout(() => verrouiller(true), immediat ? 120 : 260);
  }
  let retour = 0;
  function relacher() {
    clearTimeout(retour);
    retour = setTimeout(() => {
      if (!document.activeElement || !document.activeElement.classList.contains("zone")) surSujet(0.7);
    }, 650);
  }

  // Mise au point qui « cherche » à l'ouverture, puis se verrouille.
  function chercherMiseAuPoint() {
    const t = M.mobile ? 70 : 86;
    const s = pointSujet();
    if (!aGsap || calme) {
      surSujet(0);
      return;
    }
    placerCollimateur(s.x - t * 0.75, s.y - t * 0.75, t * 1.5, t * 1.5, 0);
    verrouiller(false);
    gsap
      .timeline()
      .to(colli, { x: s.x - t * 0.62 + 6, y: s.y - t * 0.62 - 4, width: t * 1.24, height: t * 1.24, duration: 0.42, ease: "power2.out" })
      .to(colli, { x: s.x - t * 0.56 - 5, y: s.y - t * 0.56 + 3, width: t * 1.12, height: t * 1.12, duration: 0.34, ease: "power2.inOut" })
      .to(colli, { x: s.x - t / 2, y: s.y - t / 2, width: t, height: t, duration: 0.5, ease: "expo.out" })
      .add(() => verrouiller(true), "-=0.18");
  }

  // Obturateur : lamelles qui se ferment puis s'ouvrent.
  const obt = $("#obturateur");
  const octx = obt.getContext("2d");
  function tailleObturateur() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    obt.width = Math.round(M.l * dpr);
    obt.height = Math.round(M.h * dpr);
  }
  function dessinerIris(k) {
    const l = obt.width;
    const h = obt.height;
    octx.clearRect(0, 0, l, h);
    if (k <= 0.001) return;
    const cx = l / 2;
    const cy = h / 2;
    const rMax = Math.hypot(l, h) * 0.58;
    const r = rMax * (1 - k);
    const rot = k * 1.1;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * Math.PI) / 3;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    octx.fillStyle = "#0b0908";
    octx.beginPath();
    octx.rect(0, 0, l, h);
    octx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 6; i++) octx.lineTo(pts[i][0], pts[i][1]);
    octx.closePath();
    octx.fill("evenodd");
    // arêtes des lamelles
    octx.strokeStyle = "rgba(214,184,134,0.16)";
    octx.lineWidth = Math.max(1, l / 900);
    for (let i = 0; i < 6; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 6];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const n = Math.hypot(dx, dy) || 1;
      octx.beginPath();
      octx.moveTo(a[0], a[1]);
      octx.lineTo(a[0] - (dx / n) * rMax * 2, a[1] - (dy / n) * rMax * 2);
      octx.stroke();
    }
  }
  function declencher() {
    return new Promise((fin) => {
      if (calme || !aGsap) {
        fin();
        return;
      }
      const iris = { k: 0 };
      const vues = $("#vues");
      gsap
        .timeline({ onComplete: fin })
        .to(iris, { k: 1, duration: 0.17, ease: "power2.in", onUpdate: () => dessinerIris(iris.k) })
        .add(() => {
          vues.textContent = String(Math.max(0, parseInt(vues.textContent, 10) - 1));
        })
        .to(iris, { k: 0, duration: 0.34, ease: "power3.out", delay: 0.05, onUpdate: () => dessinerIris(iris.k) });
    });
  }

  // ---------- Univers et contenu ----------
  let donnees = null;
  let manifeste = {};
  const PHOTOS = {
    particuliers: [
      ["images/mariages/baiser-cortege.jpg", "Les mariés s'embrassent pendant que le cortège passe devant eux"],
      ["images/mariages/bouquets-leves.jpg", "Les témoins lèvent leurs bouquets autour des mariés"],
      ["images/mariages/maries-course-jardin.jpg", "Les mariés courent main dans la main dans un jardin"],
      ["images/mariages/maries-ponton-noir-et-blanc.jpg", "Les mariés sur un ponton, en noir et blanc"],
      ["images/mariages/baiser-renverse.jpg", "Baiser renversé des mariés"],
    ],
    commerces: [
      ["images/commerces/salon-vue-ensemble.jpg", "Vue d'ensemble du salon de barbier, sous ses néons hexagonaux"],
      ["images/commerces/barbier-sourire-client.jpg", "Le barbier sourit à son client"],
      ["images/commerces/coupe-ciseaux.jpg", "Coupe aux ciseaux"],
      ["images/commerces/rasage-coupe-chou.jpg", "Rasage au coupe-chou"],
      ["images/commerces/outils-miroir.jpg", "Les outils du barbier devant le miroir"],
    ],
  };
  const TEXTES_PAR_DEFAUT = {
    particuliers: {
      titre: "Des moments *vrais*, rien de forcé.",
      texte: "Mariages, couples, portraits, événements : je photographie les gens tels qu'ils sont, avec une lumière soignée et des couleurs fidèles.",
      formules: "Trois formules pour s'adapter à votre besoin, du portrait rapide à la journée complète.",
      photos: "Mariages, couples, *portraits*",
    },
    commerces: {
      titre: "Des photos qui donnent envie de *pousser la porte*.",
      texte: "Commerces et entreprises : votre lieu, votre équipe et votre savoir-faire, tels qu'ils sont, prêts pour votre fiche Google et vos réseaux.",
      formules: "Des photos pro et un site simple pour les petits commerces de la région.",
      photos: "Votre lieu, votre *savoir-faire*",
    },
  };

  function image(chemin, largeurs, sizes, alt, classe) {
    const info = manifeste[chemin];
    const sans = chemin.replace(/^images\//, "").replace(/\.[a-z]+$/i, "");
    let attrs;
    if (info && info.tailles && info.tailles.length) {
      const t = info.tailles.filter((w) => !largeurs || w <= largeurs);
      const liste = t.length ? t : info.tailles;
      attrs = `src="${BASE}images/tailles/${sans}-${liste[liste.length - 1]}.webp" srcset="${liste
        .map((w) => `${BASE}images/tailles/${sans}-${w}.webp ${w}w`)
        .join(", ")}" sizes="${sizes}"`;
    } else {
      attrs = `src="${BASE}${chemin}"`;
    }
    // Adresses « en attente » : chargées seulement quand le contenu approche
    // (la photo du viseur passe d'abord, à pleine vitesse).
    attrs = attrs.replace(/\b(src|srcset|sizes)="/g, "data-$1=\"");
    return `<img ${attrs} alt="${echapper(alt || "")}" decoding="async"${classe ? ` class="${classe}"` : ""} />`;
  }

  // Charge une image du contenu quand elle arrive à moins d'un écran.
  function reveler(img) {
    ["sizes", "srcset", "src"].forEach((a) => {
      const v = img.getAttribute("data-" + a);
      if (v) {
        img.setAttribute(a, v);
        img.removeAttribute("data-" + a);
      }
    });
  }
  const observateurImages =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entrees, obs) =>
            entrees.forEach((e) => {
              if (!e.isIntersecting) return;
              obs.unobserve(e.target);
              reveler(e.target);
            }),
          { rootMargin: "100% 0px" }
        )
      : { observe: reveler };

  function prix(p) {
    const brut = String(p.price || "").trim();
    if (/\d/.test(brut)) {
      const joli = brut.replace(/\s*€\s*$/, " €");
      return `<small>dès</small><strong>${echapper(joli)}</strong>${p.price_suffix ? `<span>${echapper(p.price_suffix)}</span>` : ""}`;
    }
    return `<small>sur</small><strong>${echapper(brut || "Devis")}</strong>`;
  }

  function afficherUnivers(u, anime) {
    const faire = () => {
      const t = Object.assign({}, TEXTES_PAR_DEFAUT[u], (donnees && donnees.textes[u]) || {});
      $$("[data-texte]").forEach((el) => {
        const cle = el.dataset.texte === "photos-titre" ? "photos" : el.dataset.texte;
        el.innerHTML = emphase(t[cle] || "");
      });
      const plans = (donnees && donnees.plans[u]) || [];
      $("#formules-liste").innerHTML = plans
        .map((p) => {
          const img = p.image || (p.maquette && (p.visuel === "pack" ? p.maquette.tirage1 : p.maquette.ecran) || {}).image;
          const points = (p.features || []).slice(0, 2).join(" · ");
          return `<li class="formule"><a href="${BASE}services.html?pour=${u}">
            <span class="formule-photo">${img ? image(img, 480, "76px", "") : ""}</span>
            <span class="formule-texte"><span class="formule-nom">${echapper(p.title)}${
              p.badge ? ` <span class="formule-badge">${echapper(p.badge)}</span>` : ""
            }</span><span class="formule-points">${echapper(points)}</span></span>
            <span class="formule-prix">${prix(p)}</span></a></li>`;
        })
        .join("");
      $("#photos-grille").innerHTML = PHOTOS[u]
        .map(([chemin, alt], i) => `<figure>${image(chemin, i === 0 ? 1200 : 800, i === 0 ? "(max-width: 760px) 100vw, 36vw" : "(max-width: 760px) 50vw, 18vw", alt)}</figure>`)
        .join("");
      $$("#photos-grille img").forEach((img) => img.addEventListener("load", () => img.classList.add("charge"), { once: true }));
      $$("#contenu img[data-src]").forEach((img) => observateurImages.observe(img));
      $$(".bascule-btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.univers === u)));
      $$("[data-lien-univers]").forEach((a) => {
        if (!a.dataset.base) a.dataset.base = a.getAttribute("href");
        a.setAttribute("href", `${a.dataset.base}?pour=${u}`);
      });
      if (aGsap && window.ScrollTrigger) ScrollTrigger.refresh();
    };
    if (!anime) {
      faire();
      return;
    }
    contenu.classList.add("change");
    setTimeout(() => {
      faire();
      contenu.classList.remove("change");
    }, 320);
  }

  function chargerDonnees() {
    const lire = (f) => fetch(BASE + f, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return Promise.all([lire("content/pages/services.json"), lire("content/pages/a-propos.json"), lire("content/contact.json"), lire("content/images.json")]).then(
      ([services, apropos, contact, images]) => {
        manifeste = (images && images.images) || {};
        const d = { textes: { particuliers: {}, commerces: {} }, plans: { particuliers: [], commerces: [] } };
        ((services && services.sections) || []).forEach((s) => {
          if (s.type === "tarifs" && d.plans[s.tab]) d.plans[s.tab] = s.data.plans || [];
          if (s.type === "onglets_tarifs") (s.data.tabs || []).forEach((t) => d.textes[t.id] && (d.textes[t.id].formules = t.text));
        });
        ((apropos && apropos.sections) || []).forEach((s) => {
          if (s.type === "ouverture" && d.textes[s.tab]) {
            d.textes[s.tab].titre = s.data.title;
            d.textes[s.tab].texte = s.data.text;
          }
        });
        donnees = d;
        if (contact) {
          const liens = [];
          if (contact.whatsapp_url) liens.push(`<a href="${echapper(contact.whatsapp_url)}" target="_blank" rel="noopener" data-flash>WhatsApp</a>`);
          if (contact.instagram_url) liens.push(`<a href="${echapper(contact.instagram_url)}" target="_blank" rel="noopener">${echapper(contact.instagram_handle || "Instagram")}</a>`);
          if (contact.email) liens.push(`<a href="mailto:${echapper(contact.email)}" data-flash>${echapper(contact.email)}</a>`);
          $("#canaux").innerHTML = liens.join("");
          brancherFlash();
        }
      }
    );
  }

  // ---------- Réactions de l'appareil ----------
  let dernierFlash = 0;
  function flash() {
    const maintenant = Date.now();
    if (!api3d || calme || !aGsap || maintenant - dernierFlash < 1200) return;
    dernierFlash = maintenant;
    const o = api3d.projeter("objectif");
    const ecl = $("#eclair");
    const taille = M.mobile ? 0.25 : 1;
    gsap.set(ecl, { x: o.x, y: o.y, scale: 0.2 * taille, opacity: 0 });
    gsap
      .timeline()
      .to(reaction, { flash: 1, duration: 0.05, ease: "power2.out" })
      .to(ecl, { opacity: M.mobile ? 0.5 : 0.38, scale: 0.6 * taille, duration: 0.06 }, 0)
      .to(reaction, { flash: 0, duration: 0.55, ease: "power3.out" })
      .to(ecl, { opacity: 0, scale: 0.9 * taille, duration: 0.6, ease: "power3.out" }, 0.06);
  }
  function brancherFlash() {
    $$("[data-flash]").forEach((el) => {
      if (el.dataset.flashBranche) return;
      el.dataset.flashBranche = "1";
      el.addEventListener("mouseenter", flash);
      el.addEventListener("focus", flash);
    });
  }

  function brancherSections() {
    if (!aGsap || !window.ScrollTrigger || calme) return;
    ScrollTrigger.create({
      trigger: "#photos",
      start: "top 70%",
      end: "bottom 35%",
      onToggle: (s) => gsap.to(reaction, { ry: s.isActive ? (M.mobile ? -0.4 : -0.62) : 0, duration: 1.2, ease: "power3.out" }),
    });
    ScrollTrigger.create({
      trigger: "#formules",
      start: "top 65%",
      end: "bottom 40%",
      onToggle: (s) => gsap.to(reaction, { rx: s.isActive ? 0.14 : 0, duration: 1.1, ease: "power3.out" }),
    });
  }

  // ---------- Chargement de la 3D (après la photo) ----------
  let charge3D = null;
  function webglDisponible() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) {
      return false;
    }
  }
  function passerEnImageFixe() {
    modeFixe = true;
    if (fixe.dataset.src) fixe.src = fixe.dataset.src;
    fixe.hidden = false;
    forcer = true;
  }
  function charger3D() {
    if (charge3D) return charge3D;
    if (!webglDisponible() || /[?&]fixe\b/.test(location.search)) {
      passerEnImageFixe();
      return (charge3D = Promise.resolve(null));
    }
    const photoPrete =
      photo.complete && photo.naturalWidth
        ? Promise.resolve()
        : new Promise((ok) => {
            photo.addEventListener("load", ok, { once: true });
            photo.addEventListener("error", ok, { once: true });
          });
    charge3D = photoPrete
      .then(() => import("./scene.js"))
      .then((m) => {
        const api = m.creerAppareil({ canvas: toile, photo, geo: GEO, mobile: M.mobile, cadrage: [0.5, 0.5] });
        api.redimensionner(M.l, M.h);
        api3d = api;
        forcer = true;
        tick(0, 16);
        requestAnimationFrame(() => toile.classList.add("est-prete"));
        return api;
      })
      .catch((err) => {
        console.warn("3D indisponible, image fixe à la place.", err);
        passerEnImageFixe();
        return null;
      });
    return charge3D;
  }

  // ---------- Choix de l'univers (clic sur une zone) ----------
  let enCours = false;
  function choisir(u, zone) {
    if (enCours) return;
    enCours = true;
    charger3D();
    if (zone) viser(zone, true);
    // On laisse l'appareil 3D finir de se préparer (au plus 1,5 s) avant de déclencher :
    // l'obturateur et le défilement restent fluides.
    const pret = Promise.race([charger3D(), new Promise((ok) => setTimeout(ok, 1500))]);
    const attente = new Promise((ok) => setTimeout(ok, calme ? 0 : 160));
    Promise.all([pret, attente]).then(() =>
        declencher().then(() => {
          window.Univers.definir(u);
          window.Univers.confirmer();
          afficherUnivers(u, true);
          const cible = M.course + Math.round(M.h * 0.42);
          const finir = () => {
            enCours = false;
            contenu.focus({ preventScroll: true });
          };
          if (lenis) lenis.scrollTo(cible, { duration: M.mobile ? 2.1 : 2.5, easing: ease.inOut3, lock: true, onComplete: finir });
          else {
            window.scrollTo(0, cible);
            finir();
          }
        })
    );
  }

  // ---------- Démarrage ----------
  let lenis = null;
  function demarrer() {
    mesurer(true);
    tailleObturateur();

    if (!calme && window.Lenis && aGsap) {
      lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 0.9, smoothWheel: true });
      if (window.ScrollTrigger) lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
    }
    if (aGsap) {
      gsap.ticker.lagSmoothing(0);
      gsap.ticker.add(tick);
      if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    } else {
      let avant = performance.now();
      const boucle = (t) => {
        tick(t, t - avant);
        avant = t;
        requestAnimationFrame(boucle);
      };
      requestAnimationFrame(boucle);
    }

    afficherUnivers(window.Univers ? window.Univers.courant() : "particuliers", false);
    chargerDonnees().then(() => {
      afficherUnivers(window.Univers ? window.Univers.courant() : "particuliers", false);
      brancherSections();
    });
    brancherFlash();

    // Viseur
    const lancer = () => chercherMiseAuPoint();
    if (photo.complete) lancer();
    else photo.addEventListener("load", lancer, { once: true });
    zones.forEach((z) => {
      z.addEventListener("mouseenter", () => viser(z));
      z.addEventListener("focus", () => viser(z));
      z.addEventListener("mouseleave", relacher);
      z.addEventListener("blur", relacher);
      z.addEventListener("touchstart", () => viser(z, true), { passive: true });
      z.addEventListener("click", () => choisir(z.dataset.univers, z));
    });
    const titre = $(".titre");
    titre.addEventListener("mouseenter", () => viser(titre));
    titre.addEventListener("mouseleave", relacher);

    $$(".bascule-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const u = b.dataset.univers;
        if (window.Univers.courant() === u) return;
        window.Univers.definir(u);
        window.Univers.confirmer();
        afficherUnivers(u, true);
        if (aGsap && !calme) gsap.fromTo(reaction, { ry: reaction.ry + 0.5 }, { ry: reaction.ry, duration: 1.2, ease: "elastic.out(1, 0.5)" });
      })
    );
    const lienFormules = $('a[href="#formules"]');
    lienFormules.addEventListener("click", (ev) => {
      if (!lenis) return;
      ev.preventDefault();
      lenis.scrollTo("#formules", { offset: -90, duration: 1.4, easing: ease.inOut3 });
    });

    // La 3D démarre au premier geste du visiteur (souris, toucher, défilement,
    // clavier) : la photo et les textes s'affichent d'abord, sans rien bloquer.
    // En attendant, ses fichiers sont simplement téléchargés en arrière-plan.
    const gestes = ["scroll", "pointerdown", "pointermove", "touchstart", "keydown", "wheel"];
    const premierGeste = () => {
      charger3D();
      gestes.forEach((t) => window.removeEventListener(t, premierGeste));
    };
    gestes.forEach((t) => window.addEventListener(t, premierGeste, { passive: true }));
    const prechargerFichiers = () => {
      ["scene.js", "../vendor/three.module.min.js"].forEach((f) => {
        const l = document.createElement("link");
        l.rel = "prefetch";
        l.href = f;
        document.head.appendChild(l);
      });
    };
    const apresChargement = () => {
      setTimeout(prechargerFichiers, 1500);
      setTimeout(premierGeste, 8000); // aucun geste : on prépare l'appareil quand même
    };
    if (document.readyState === "complete") apresChargement();
    else window.addEventListener("load", apresChargement, { once: true });

    let minuterieTaille = 0;
    window.addEventListener("resize", () => {
      clearTimeout(minuterieTaille);
      minuterieTaille = setTimeout(() => {
        if (!mesurer(false)) return;
        tailleObturateur();
        if (api3d) api3d.redimensionner(M.l, M.h);
        if (window.scrollY < M.h * 0.1) surSujet(0);
        if (aGsap && window.ScrollTrigger) ScrollTrigger.refresh();
        forcer = true;
      }, 160);
    });
    document.addEventListener("visibilitychange", () => (forcer = true));

    // Accès pour les captures et les tests
    window.__labo = {
      M,
      GEO,
      calculer,
      appliquer,
      api: () => api3d,
      charger3D,
      avancement: () => pLisse,
      figer: (p) => {
        pLisse = p;
        pDernier = -1;
        appliquer(calculer(p, 0));
      },
    };
  }

  demarrer();
})();
