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
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const BASE = "../../";
  const aGsap = typeof window.gsap !== "undefined";

  // ---------- Géométrie partagée avec la scène 3D ----------
  const GEO = {
    fov: 26,
    camZ: 46,
    corps: { l: 12.8, h: 7.4, p: 3.3 },
    ecran: { cx: -1.4, cy: -0.75, l: 6.3, h: 4.2, z: 1.81 },
    objectif: { x: 0.5, y: -0.74 },
  };
  const TOUR = Math.PI - 0.5; // un demi-tour : du dos vers l'objectif, en trois-quarts
  const PH = { a: 0.36, b0: 0.32, b1: 0.86, c0: 0.62, c1: 1 };

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
  const chapitres = $("#chapitres");
  const chaps = $$(".chap");
  const cartes = $$(".carte");
  const indexChap = $$(".chap-index li");
  const numChap = $("#chap-num");
  const ombre = $("#ombre");
  const cale = $("#contenu-cale");
  const pellicule = $("#pellicule");
  const bande = $("#pellicule-bande");
  const porte = $("#pellicule-porte");
  const fenetre = $("#pellicule-fenetre");

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
    M.course = Math.round((calme ? 0.9 : M.mobile ? 1.3 : 1.5) * h);
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
    // Rangé à la fin : au centre de l'en-tête, sur téléphone comme sur ordinateur
    const cx = l / 2;
    const cy = M.entete / 2;
    const largeur = M.mobile ? 56 : 72;
    const w = versMonde(cx, cy);
    M.prof = prof;
    M.pxu = pxParUnite;
    M.dock = { x: w.x, y: w.y, s: largeur / (GEO.corps.l * pxParUnite), px: cx, py: cy, l: largeur };
    // Les chapitres : un écran de défilement chacun environ
    M.pasCh = Math.round(h * (M.mobile ? 0.95 : 1.05));
    chapitres.style.height = calme ? "" : h + Math.round(3.75 * M.pasCh) + "px";
    M.contenuHaut = contenu.getBoundingClientRect().top + window.scrollY;
    halo.style.background = "";
    mesurerPellicule();
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

  // Les quatre temps : position de l'appareil (fractions d'écran), largeur (px), angles.
  function etats() {
    const l = M.l;
    if (M.mobile)
      return [
        { x: 0.5, y: 0.3, w: 0.8 * l, ry: TOUR, rx: 0.16, rz: -0.05 },
        { x: 0.6, y: 0.29, w: 0.56 * l, ry: 2.3, rx: 0.14, rz: 0 },
        { x: 0.5, y: 0.29, w: 0.66 * l, ry: Math.PI + 0.2, rx: 0.1, rz: 0 },
        { x: 0.5, y: 0.29, w: 0.7 * l, ry: 2 * Math.PI - 0.3, rx: 0.08, rz: 0.02 },
      ];
    return [
      { x: 0.68, y: 0.52, w: Math.min(0.4 * l, 640), ry: TOUR, rx: 0.16, rz: -0.05 },
      { x: 0.37, y: 0.53, w: Math.min(0.3 * l, 470), ry: 2.3, rx: 0.14, rz: 0 },
      { x: 0.65, y: 0.5, w: Math.min(0.34 * l, 540), ry: Math.PI + 0.2, rx: 0.1, rz: 0 },
      { x: 0.3, y: 0.52, w: Math.min(0.33 * l, 520), ry: 2 * Math.PI - 0.3, rx: 0.08, rz: 0.02 },
    ];
  }
  const melange = (a, b, k) => ({
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    w: lerp(a.w, b.w, k),
    ry: lerp(a.ry, b.ry, k),
    rx: lerp(a.rx, b.rx, k),
    rz: lerp(a.rz, b.rz, k),
  });
  function monde(st) {
    return {
      x: (st.x * 2 - 1) * M.prof * M.tan * M.aspect,
      y: (1 - st.y * 2) * M.prof * M.tan,
      s: st.w / (GEO.corps.l * M.pxu),
    };
  }

  // pp : défilement / longueur de l'intro (0 → 1 pendant l'intro, puis au-delà)
  function calculer(pp, temps) {
    const p = clamp(pp);
    const c = ((pp - 1) * M.course) / M.pasCh; // avancement dans les chapitres (0 → 4)
    const e = { p, c };
    if (calme) {
      // Version douce : pas de recul ni de rotation, l'appareil apparaît rangé.
      const f = seg(p, 0, 0.55);
      e.cadre = { x: 0, y: 0, w: M.l, h: M.h, o: 1 - f };
      e.d = { x: M.dock.x, y: M.dock.y, z: GEO.camZ - M.dA - GEO.ecran.z, s: M.dock.s, rx: 0.16, ry: TOUR, rz: -0.05, balayage: -1, reflet: 0 };
      e.toile = seg(p, 0.35, 0.8);
      e.viseur = 1 - seg(p, 0, 0.12);
      e.fond = 0;
      e.dock = true;
      e.px = { x: M.dock.px, y: M.dock.py, w: M.dock.l };
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

    // b. Demi-tour vers l'objectif ; c. il se place pour le premier chapitre
    const E = etats();
    const tb = seg(p, PH.b0, PH.b1);
    const tour = ease.inOut3(tb) * TOUR;
    const vague = Math.sin(Math.PI * tb);
    const tc = ease.inOut3(seg(p, PH.c0, PH.c1));
    const recentre = ease.inOut2(seg(p, PH.b0, PH.b0 + 0.22));
    const recul = 1 - (M.mobile ? 0.42 : 0.24) * ease.inOut2(seg(p, PH.b0, PH.b0 + 0.3));
    const w0 = monde(E[0]);
    let x = lerp(-GEO.ecran.cx * (1 - recentre), w0.x, tc);
    let y = lerp(-GEO.ecran.cy * (1 - recentre) + 0.55 * vague, w0.y, tc);
    let s = lerp(recul, w0.s, tc);
    let ry = tour;
    let rx = 0.16 * vague * (1 - tc) + E[0].rx * tc;
    let rz = 0.07 * vague * (1 - tc) + E[0].rz * tc;
    let eclate = 0;
    const z = GEO.camZ - d - GEO.ecran.z;

    // Les chapitres : l'appareil passe d'une pose à l'autre, se démonte (02), se remonte et déclenche (03),
    // montre son écran (04), puis se range dans l'en-tête.
    if (c > 0) {
      let st = E[0];
      for (let i = 1; i < E.length; i++) if (c > i - 0.62) st = melange(E[i - 1], E[i], ease.inOut3(seg(c, i - 0.62, i - 0.08)));
      const kd = ease.inOut3(seg(c, 3.5, 4.3));
      if (kd > 0) st = melange(st, { x: 0.5, y: M.dock.py / M.h, w: M.dock.l, ry: 2 * Math.PI + TOUR, rx: 0.16, rz: -0.05 }, kd);
      const w = monde(st);
      x = w.x;
      y = w.y;
      s = w.s;
      ry = st.ry;
      rx = st.rx;
      rz = st.rz;
      eclate = ease.inOut3(seg(c, 0.5, 1.02)) * (1 - ease.inOut3(seg(c, 1.42, 1.95)));
    }

    const balayage = tour > TOUR - 1.5 && c <= 0 ? seg(tour, TOUR - 1.5, TOUR) : -1;

    // Vivant : réactions (pellicule, choix d'univers) et léger flottement sur ordinateur
    const vivant = seg(pp, 0.9, 1);
    let yFlotte = 0;
    ry += vivant * reaction.ry;
    rx += vivant * reaction.rx;
    if (!M.mobile && temps && c < 3.5) {
      yFlotte = Math.sin(temps * 0.9) * 0.05 * s * 6 * vivant;
      ry += Math.sin(temps * 0.45) * 0.035 * vivant;
    }
    e.d = { x, y: y + yFlotte, z, s, rx, ry, rz, balayage, reflet: 0.32 * seg(p, PH.a, PH.a + 0.08), flash: reaction.flash, eclate };

    // Position à l'écran (ombre, image fixe sans 3D)
    const ppu = M.h / (2 * (GEO.camZ - z) * M.tan);
    const cxp = M.l / 2 + x * ppu;
    const cyp = M.h / 2 - (y + yFlotte) * ppu;
    const larg = GEO.corps.l * s * ppu;
    e.px = { x: cxp, y: cyp, w: larg };
    e.ombre = { x: cxp, y: cyp + GEO.corps.h * 0.56 * s * ppu, w: larg * 1.1, o: seg(pp, 0.8, 1) * (1 - seg(c, 3.45, 3.8)) };

    // Textes des chapitres, index, numéro, cartes
    e.chap = [0, 1, 2, 3].map((i) => {
      const entree = i === 0 ? seg(pp, 0.84, 1) : seg(c, i - 0.34, i - 0.1);
      return entree * (1 - seg(c, i + 0.44, i + 0.64));
    });
    e.chapActif = clamp(Math.round(c), 0, 3);
    e.chrome = seg(pp, 0.9, 1) * (1 - seg(c, 3.4, 3.65));
    e.cartes = { 2: seg(c, 0.78, 1.02) * (1 - seg(c, 1.46, 1.68)), 3: seg(c, 2.02, 2.3) * (1 - seg(c, 2.5, 2.72)) };
    e.dock = c > 3.95;
    e.toile = 1;
    e.viseur = 1 - seg(p, 0, 0.09);
    e.fond = 0.85 * seg(p, 0.06, 0.26) * (1 - seg(p, 0.42, 0.68));
    return e;
  }

  // ---------- Appliquer l'état (DOM + 3D) ----------
  let derniereCadre = "";
  let dernierC = -9;
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
    halo.style.opacity = 0;

    if (e.chap) {
      chaps.forEach((el, i) => {
        const o = e.chap[i];
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o <= 0.01 ? "hidden" : "visible";
        el.classList.toggle("est-visible", o > 0.6);
        const decale = (1 - ease.out3(o)) * 26;
        el.style.transform = M.mobile ? `translateY(${decale.toFixed(1)}px)` : `translateY(calc(-50% + ${decale.toFixed(1)}px))`;
      });
      indexChap.forEach((li, i) => li.classList.toggle("actif", i === e.chapActif));
      numChap.textContent = String(e.chapActif + 1).padStart(2, "0");
      numChap.style.opacity = e.chrome.toFixed(3);
      numChap.parentNode.querySelector(".chap-index").style.opacity = e.chrome.toFixed(3);
      cartes.forEach((el, i) => {
        const g = e.cartes[el.dataset.groupe] || 0;
        const rang = el.dataset.groupe === "2" ? i : i - 3;
        el.style.setProperty("--o", clamp(g * 1.5 - rang * 0.22).toFixed(3));
      });
      // L'appareil déclenche quand il revient face à nous (chapitre 03)
      if (e.c >= 2 && dernierC < 2 && dernierC > 1) flash();
      dernierC = e.c;
    }
    if (e.ombre) {
      const o = e.ombre;
      ombre.style.width = o.w.toFixed(0) + "px";
      ombre.style.height = (o.w * 0.14).toFixed(0) + "px";
      ombre.style.transform = `translate(${(o.x - o.w / 2).toFixed(1)}px, ${(o.y - o.w * 0.07).toFixed(1)}px)`;
      ombre.style.opacity = (o.o * (modeFixe || api3d ? 1 : 0)).toFixed(3);
    }
    majPellicule();
    entete.classList.toggle("est-plein", e.p > 0.62);
    R.classList.toggle("dock", !!e.dock);
    if (modeFixe) {
      const px = e.px;
      fixe.style.width = px.w.toFixed(0) + "px";
      fixe.style.transform = `translate(${(px.x - px.w / 2).toFixed(1)}px, ${(px.y - px.w * 0.36).toFixed(1)}px)`;
      fixe.style.opacity = calme ? 1 : seg(e.p, 0.7, 1);
    } else if (api3d) {
      toile.style.opacity = calme ? e.toile : "";
      api3d.appliquer(e.d);
      api3d.rendre();
    }
  }

  // Le contenu « posé » (position fixe) pendant qu'il suit l'appareil ; une cale
  // garde la hauteur de la page. Sa position ne dépend alors plus du défilement :
  // le navigateur ne peut plus le décaler entre deux images (c'était le tremblement).
  let contenuPose = false;
  function hauteurCale() {
    return Math.max(0, contenu.offsetHeight + M.cibleContenu - M.h) + "px";
  }
  function poserContenu(haut) {
    const pose = haut != null;
    if (pose !== contenuPose) {
      contenuPose = pose;
      if (pose) cale.style.height = hauteurCale();
      contenu.classList.toggle("pose", pose);
      cale.classList.toggle("actif", pose);
      if (!pose) contenu.style.transform = "";
    }
    if (pose) contenu.style.transform = `translate3d(0, ${(haut - (M.cibleContenu - M.h)).toFixed(1)}px, 0)`;
  }
  if ("ResizeObserver" in window) new ResizeObserver(() => contenuPose && (cale.style.height = hauteurCale())).observe(contenu);

  // ---------- Pellicule : la bande avance d'un cran à la fois, chaque vue se développe ----------
  const P = { n: 0, vues: [], fw: 1, fen: 1, pas: 1, course: 0, actif: false, verrou: -1 };
  function mesurerPellicule() {
    if (!bande) return;
    P.vues = $$(".vue", bande);
    P.n = P.vues.length;
    if (!P.n || calme) {
      pellicule.style.height = "";
      return;
    }
    P.glisse = M.mobile;
    pellicule.classList.toggle("glisse", P.glisse);
    pellicule.classList.toggle("defile", !P.glisse);
    P.fw = P.vues[0].offsetWidth || 1;
    P.fen = fenetre.clientWidth || 1;
    if (P.glisse) {
      // Téléphone : la bande se fait glisser au doigt, la page défile normalement.
      P.course = 0;
      pellicule.style.height = "";
      bande.style.transform = "";
    } else {
      // Ordinateur : le bloc reste en place pendant que la bande avance d'un cran à la fois.
      const colle = $(".pellicule-colle");
      P.pas = Math.round(M.h * 0.7);
      P.course = (P.n - 1) * P.pas;
      P.haut = parseFloat(getComputedStyle(colle).top) || 0;
      const marge = parseFloat(getComputedStyle(pellicule).paddingTop) || 0;
      pellicule.style.height = Math.round(marge + colle.offsetHeight + P.course + P.pas * 0.35) + "px";
      P.debut = pellicule.offsetTop + marge - P.haut; // défilement où le bloc s'arrête
    }
    P.vues.forEach((li) => {
      li._neg = li.querySelector(".vue-negatif");
      li._leg = li.querySelector(".vue-legende");
    });
    $("#pellicule-total").textContent = String(P.n).padStart(2, "0");
    P.verrou = -1;
  }
  function majPellicule() {
    if (calme || !P.n) return;
    const y = window.scrollY;
    const haut = M.contenuHaut + (P.glisse ? pellicule.offsetTop : P.debut);
    if (y < haut - M.h * 1.3 || y > haut + P.course + M.h * 1.5) {
      if (P.actif) reagirPellicule(false);
      P.verrou = -1;
      return;
    }
    // Avance « au cran » : la vue reste un moment en place, puis la suivante arrive.
    let f, approche;
    if (P.glisse) {
      f = clamp(fenetre.scrollLeft / P.fw, 0, P.n - 1);
      approche = seg(y, haut - 0.9 * M.h, haut - 0.4 * M.h);
    } else {
      const brut = clamp((y - haut) / P.pas, 0, P.n - 1);
      const i0 = Math.min(Math.floor(brut), P.n - 1);
      f = i0 >= P.n - 1 ? P.n - 1 : i0 + ease.inOut3(seg(brut - i0, 0.32, 0.94));
      approche = seg(y, haut - 0.8 * M.h, haut - 0.12 * M.h);
      bande.style.transform = `translate3d(${(P.fen / 2 - (f + 0.5) * P.fw).toFixed(1)}px, 0, 0)`;
    }
    const fDev = f - 0.7 * (1 - approche);
    P.vues.forEach((li, i) => {
      li._neg.style.opacity = (1 - seg(fDev, i - 0.62, i - 0.1)).toFixed(3);
      li._leg.style.opacity = clamp(1 - Math.abs(f - i) * 1.7).toFixed(3);
    });
    const vue = Math.round(f);
    $("#pellicule-vue").textContent = String(vue + 1).padStart(2, "0");
    const enPlace = Math.abs(f - vue) < (P.glisse ? 0.04 : 0.025) && approche >= 1;
    porte.classList.toggle("verrouille", enPlace);
    if (enPlace && vue !== P.verrou) {
      if (vue > P.verrou) flash(); // l'appareil déclenche à chaque nouvelle vue
      P.verrou = vue;
    }
    const actif = P.glisse ? y > haut - M.h * 0.6 && y < haut + M.h * 0.5 : y > haut - M.h * 0.4 && y < haut + P.course + P.pas * 0.3;
    if (actif !== P.actif) reagirPellicule(actif);
  }
  let rafPellicule = 0;
  fenetre.addEventListener(
    "scroll",
    () => {
      if (!P.glisse) return;
      if (fenetre.scrollLeft > 8) pellicule.classList.add("a-glisse");
      if (!rafPellicule)
        rafPellicule = requestAnimationFrame(() => {
          rafPellicule = 0;
          majPellicule();
        });
    },
    { passive: true }
  );
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(() => {
      mesurerPellicule();
      forcer = true;
    });

  function reagirPellicule(actif) {
    P.actif = actif;
    if (aGsap) gsap.to(reaction, { ry: actif ? (M.mobile ? -0.4 : -0.62) : 0, duration: 1.2, ease: "power3.out", overwrite: "auto" });
  }

  // ---------- Boucle : on suit le défilement (lissé), on ne dessine que si besoin ----------
  let pLisse = 0;
  let pDernier = -1;
  let signature = "";
  let temps = 0;
  let forcer = true;

  function avancement() {
    return Math.max(0, window.scrollY / M.course);
  }

  function tick(_t, dtMs) {
    const dt = Math.min(0.1, (dtMs || 16) / 1000);
    temps += dt;
    const cible = avancement();
    pLisse = calme ? cible : pLisse + (cible - pLisse) * (1 - Math.exp(-dt * (M.mobile ? 16 : 11)));
    if (Math.abs(cible - pLisse) < 0.0002) pLisse = cible;
    const vivantContinu = !calme && !M.mobile && pLisse > 0.9 && pLisse < 1 + (3.5 * M.pasCh) / M.course && api3d && document.visibilityState === "visible";
    const sig = `${reaction.ry.toFixed(4)},${reaction.rx.toFixed(4)},${reaction.flash.toFixed(3)},${window.scrollY}`;
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
  // Les vues de la pellicule (sans prix : la vitrine montre le travail)
  const VUES = {
    particuliers: [
      { titre: "Mariages", texte: "Toute la journée, des préparatifs à la première danse.", image: "images/mariages/premiere-danse-etincelles.jpg", alt: "Première danse des mariés entre deux fontaines d'étincelles", pos: "50% 45%" },
      { titre: "Couples", texte: "Une balade à deux, naturelle, sans pose figée.", image: "images/portfolio/couples/img1.jpg", alt: "Un couple assis dans l'herbe avec son chien", pos: "50% 62%" },
      { titre: "Portraits", texte: "Pour vous, en famille ou entre amis.", image: "images/portfolio/portraits/img3.jpg", alt: "Deux amies assises sur un muret de briques", pos: "50% 62%" },
      { titre: "Événements", texte: "Baptêmes, anniversaires, fêtes : les moments qui comptent.", image: "images/portfolio/evenements/img2.jpg", alt: "Les mariés entourés de leurs invités", pos: "50% 40%" },
    ],
    commerces: [
      { titre: "Votre lieu", texte: "L'ambiance de votre commerce, qui donne envie d'entrer.", image: "images/commerces/salon-vue-ensemble.jpg", alt: "Vue d'ensemble du salon de barbier, sous ses néons hexagonaux", pos: "50% 50%" },
      { titre: "Votre savoir-faire", texte: "Vos gestes et votre métier, pris sur le vif.", image: "images/commerces/rasage-coupe-chou.jpg", alt: "Rasage au coupe-chou", pos: "50% 42%" },
      { titre: "Vos équipes", texte: "Vos équipes et vos chantiers, pour vos réseaux et votre site.", image: "images/portfolio/entreprises/img2.jpg", alt: "Une équipe en casques de chantier dans un entrepôt", pos: "50% 40%" },
      { titre: "Votre site vitrine", texte: "Un site simple et soigné, avec vos propres photos.", image: "images/formules/site-vitrine.jpg", alt: "Exemple de site vitrine, sur ordinateur et sur téléphone", pos: "50% 50%" },
    ],
  };

  // Les photos des trois tirages de fin de page
  const TIRAGES = {
    particuliers: [
      ["images/nicolas-leveugle-portrait.jpg", "50% 30%"],
      ["images/mariages/baiser-pont-chateau.jpg", "50% 40%"],
      ["images/mariages/photo-instantanee.jpg", "50% 45%"],
    ],
    commerces: [
      ["images/nicolas-leveugle-portrait.jpg", "50% 30%"],
      ["images/commerces/outils-miroir.jpg", "50% 50%"],
      ["images/commerces/barbier-sourire-client.jpg", "50% 35%"],
    ],
  };

  const TEXTES_PAR_DEFAUT = {
    particuliers: {
      titre: "Des moments *vrais*, rien de forcé.",
      texte: "Mariages, couples, portraits, événements : je photographie les gens tels qu'ils sont, avec une lumière soignée et des couleurs fidèles.",
      formules: "Trois formules pour s'adapter à votre besoin, du portrait rapide à la journée complète.",
      declic: "Un instant, *pas une pose*.",
      "declic-texte": "Je vous guide sans vous figer : les vrais moments arrivent quand on oublie l'appareil.",
      photos: "Mariages, couples, *portraits*",
    },
    commerces: {
      titre: "Des photos qui donnent envie de *pousser la porte*.",
      texte: "Commerces et entreprises : votre lieu, votre équipe et votre savoir-faire, tels qu'ils sont, prêts pour votre fiche Google et vos réseaux.",
      formules: "Des photos pro et un site simple pour les petits commerces de la région.",
      declic: "Votre métier, *sur le vif*.",
      "declic-texte": "Vos gestes, votre lieu, votre équipe : pris au naturel, pendant que vous travaillez.",
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

  // Les images de la pellicule se chargent quand la section approche
  // (la bande déborde sur les côtés : on ne peut pas attendre que chaque vue soit visible).
  const observateurPellicule =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entrees) =>
            entrees.forEach((e) => {
              if (e.isIntersecting) $$("img[data-src]", bande).forEach(reveler);
            }),
          { rootMargin: "150% 0px" }
        )
      : null;

  function construirePellicule(u) {
    const sizes = "(max-width: 760px) 74vw, 30vw";
    bande.innerHTML = VUES[u]
      .map((v, i) => {
        const n = i + 1;
        return `<li class="vue">
          <div class="vue-film">
            <span class="vue-bord vue-bord-haut" aria-hidden="true"><span>▸ ${n}</span><span>${n}A</span></span>
            <div class="vue-image" style="--pos: ${v.pos}">
              ${image(v.image, 800, sizes, v.alt)}
              <div class="vue-negatif" aria-hidden="true">${image(v.image, 800, sizes, "")}</div>
            </div>
            <span class="vue-bord vue-bord-bas" aria-hidden="true"><span>NL 400</span><span>${n + 1}</span></span>
          </div>
          <div class="vue-legende"><h3>${echapper(v.titre)}</h3></div>
        </li>`;
      })
      .join("");
    if (observateurPellicule) {
      observateurPellicule.disconnect();
      observateurPellicule.observe(pellicule);
    } else $$("img[data-src]", bande).forEach(reveler);
    mesurerPellicule();
    forcer = true;
  }

  function afficherUnivers(u, anime) {
    const faire = () => {
      const t = Object.assign({}, TEXTES_PAR_DEFAUT[u], (donnees && donnees.textes[u]) || {});
      $$("[data-texte]").forEach((el) => {
        const cle = el.dataset.texte === "photos-titre" ? "photos" : el.dataset.texte;
        el.innerHTML = emphase(t[cle] || "");
      });
      construirePellicule(u);
      $$("[data-tirage]").forEach((el) => {
        const t = TIRAGES[u][+el.dataset.tirage];
        if (!t) return;
        el.style.setProperty("--pos", t[1]);
        el.innerHTML = image(t[0], 800, "(max-width: 760px) 32vw, 16vw", "");
      });
      $$("[data-vue]").forEach((el) => {
        const v = VUES[u][+el.dataset.vue];
        if (!v) return;
        el.style.setProperty("--pos", v.pos);
        el.innerHTML = image(v.image, 480, "150px", "");
        reveler(el.querySelector("img"));
      });
      $$("[data-tirage] img[data-src]").forEach((img) => observateurImages.observe(img));
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
    return Promise.all([
      lire("content/pages/services.json"),
      lire("content/pages/a-propos.json"),
      lire("content/contact.json"),
      lire("content/images.json"),
      lire("content/pages/index.json"),
    ]).then(
      ([services, apropos, contact, images, accueil]) => {
        manifeste = (images && images.images) || {};
        const d = { textes: { particuliers: {}, commerces: {} }, plans: { particuliers: [], commerces: [] } };
        ((services && services.sections) || []).forEach((s) => {
          if (s.type === "tarifs" && d.plans[s.tab]) d.plans[s.tab] = s.data.plans || [];
          if (s.type === "onglets_tarifs") (s.data.tabs || []).forEach((t) => d.textes[t.id] && (d.textes[t.id].formules = t.text));
          if (s.type === "reassurance") afficherReglages(s.data.items || []);
        });
        ((accueil && accueil.sections) || []).forEach((s) => {
          if (s.type === "citation" && s.data.text) {
            $$("[data-citation]").forEach((el) => (el.innerHTML = emphase(s.data.text)));
            $$("[data-signature]").forEach((el) => (el.textContent = s.data.signature || ""));
          }
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
          const sep = '<span class="canaux-sep" aria-hidden="true">·</span>';
          $$("[data-canaux]").forEach((el) => (el.innerHTML = liens.join(sep)));
          brancherFlash();
        }
      }
    );
  }

  // Les points rassurants (réponse sous 48 h, galerie privée…), repris de l'admin.
  function afficherReglages(items) {
    const liste = items.filter((it) => it && it.text).slice(0, 3);
    if (!liste.length) return;
    const html = liste.map((it) => `<li>${echapper(it.text)}</li>`).join("");
    $$("[data-reglages]").forEach((el) => (el.innerHTML = html));
  }

  // Mise au point : flou → net quand l'élément arrive à l'écran (et le cadre passe en or).
  const observateurMap =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entrees) =>
            entrees.forEach((e) => {
              if (!e.isIntersecting) return;
              observateurMap.unobserve(e.target);
              e.target.classList.add("net");
            }),
          { rootMargin: "0px 0px -18% 0px", threshold: 0.2 }
        )
      : null;
  function observerMiseAuPoint() {
    $$(".map:not(.net)").forEach((el) => (observateurMap ? observateurMap.observe(el) : el.classList.add("net")));
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
    observerMiseAuPoint();
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
      .then(() => import("./scene.js?v=10"))
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
          const cible = M.course + Math.round(0.1 * M.pasCh); // le chapitre 01 bien en place
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
    // Jour / nuit (mémorisé dans ce navigateur)
    const boutonTheme = $("#theme-btn");
    const meta = document.querySelector('meta[name="theme-color"]');
    const majTheme = () => {
      const nuit = R.getAttribute("data-theme") === "nuit";
      boutonTheme.setAttribute("aria-label", nuit ? "Passer en mode jour" : "Passer en mode nuit");
      if (meta) meta.setAttribute("content", nuit ? "#1c1916" : "#f3ede4");
    };
    majTheme();
    boutonTheme.addEventListener("click", () => {
      const t = R.getAttribute("data-theme") === "nuit" ? "jour" : "nuit";
      R.setAttribute("data-theme", t);
      try {
        localStorage.setItem("labo-theme", t);
      } catch (err) {}
      majTheme();
      forcer = true;
    });

    const lienTravail = $('a[href="#pellicule"]');
    lienTravail.addEventListener("click", (ev) => {
      ev.preventDefault();
      const cible = Math.round(pellicule.getBoundingClientRect().top + window.scrollY);
      if (lenis) lenis.scrollTo(cible, { duration: 1.6, easing: ease.inOut3 });
      else window.scrollTo({ top: cible, behavior: calme ? "auto" : "smooth" });
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
      ["scene.js?v=10", "../vendor/three.module.min.js"].forEach((f) => {
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
