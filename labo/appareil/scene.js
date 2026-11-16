// Appareil photo en 3D, construit en code (aucun modèle à télécharger).
// Inspiration : les hybrides « télémètre » rétro (style Fujifilm X100) —
// capots supérieur et inférieur en aluminium brossé, gainage noir façon cuir,
// molettes gravées (vitesses, correction d'exposition), fenêtre de viseur à
// l'avant, focale fixe courte avec bague de diaphragme chiffrée. Aucun logo.
//
// Repère (vu de dos, l'écran face à nous) : x vers la droite, y vers le haut,
// z vers nous. L'objectif pointe donc vers −z.

import * as THREE from "../vendor/three.module.min.js";

const OR = 0xae8c5b;

// ---------- Petits outils ----------

function hasardGraine(g) {
  let s = g;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function toile(l, h, dessiner) {
  const c = document.createElement("canvas");
  c.width = l;
  c.height = h;
  dessiner(c.getContext("2d"), l, h);
  return c;
}

function textureDe(c, couleur, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (couleur) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

// Carte de relief → carte de normales (pour un grain de cuir crédible).
function versNormales(hauteur, force) {
  const l = hauteur.width;
  const h = hauteur.height;
  const src = hauteur.getContext("2d").getImageData(0, 0, l, h).data;
  const H = (x, y) => src[(((y + h) % h) * l + ((x + l) % l)) * 4] / 255;
  return toile(l, h, (g) => {
    const img = g.createImageData(l, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < l; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * force;
        const dy = (H(x, y + 1) - H(x, y - 1)) * force;
        const n = Math.hypot(dx, dy, 1);
        const i = (y * l + x) * 4;
        img.data[i] = ((-dx / n) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((dy / n) * 0.5 + 0.5) * 255;
        img.data[i + 2] = ((1 / n) * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

// Gainage : petits grains irréguliers et serrés.
function textureCuir() {
  const r = hasardGraine(7);
  const haut = toile(512, 512, (g, n) => {
    g.fillStyle = "#7a7a7a";
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 9000; i++) {
      const x = r() * n;
      const y = r() * n;
      const rx = 1.6 + r() * 3.2;
      const ry = rx * (0.7 + r() * 0.5);
      const a = r() * 3;
      const v = 120 + r() * 90;
      g.fillStyle = `rgba(${v},${v},${v},0.85)`;
      for (const dx of [-n, 0, n]) {
        for (const dy of [-n, 0, n]) {
          g.beginPath();
          g.ellipse(x + dx, y + dy, rx, ry, a, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  });
  return { normales: textureDe(versNormales(haut, 2.4), false), rugosite: textureDe(haut, false) };
}

// Aluminium brossé : fines stries horizontales.
function textureBrosse() {
  const r = hasardGraine(13);
  return textureDe(
    toile(512, 512, (g, l, h) => {
      for (let y = 0; y < h; y++) {
        const v = 100 + r() * 18;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(0, y, l, 1);
      }
      for (let i = 0; i < 900; i++) {
        const v = 85 + r() * 50;
        g.fillStyle = `rgba(${v},${v},${v},0.25)`;
        g.fillRect(r() * l, r() * h, 20 + r() * 160, 1);
      }
    }),
    false
  );
}

// Face supérieure d'une molette : graduations et chiffres gravés.
function faceMolette(valeurs, rouges, fond, encre) {
  return textureDe(
    toile(512, 512, (g, n) => {
      const c = n / 2;
      g.fillStyle = fond;
      g.fillRect(0, 0, n, n);
      for (let i = 0; i < 70; i++) {
        g.strokeStyle = `rgba(255,255,255,${0.02 + (i % 3) * 0.01})`;
        g.beginPath();
        g.arc(c, c, 40 + i * 3, 0, Math.PI * 2);
        g.stroke();
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "600 34px Helvetica, Arial, sans-serif";
      valeurs.forEach((v, i) => {
        const a = -Math.PI / 2 + (i / valeurs.length) * Math.PI * 2;
        g.save();
        g.translate(c + Math.cos(a) * 178, c + Math.sin(a) * 178);
        g.rotate(a + Math.PI / 2);
        g.fillStyle = rouges.includes(v) ? "#b3261e" : encre;
        g.fillText(v, 0, 0);
        g.restore();
        g.save();
        g.translate(c, c);
        g.rotate(a);
        g.fillStyle = encre;
        g.fillRect(212, -2, 20, 4);
        g.restore();
      });
      g.beginPath();
      g.arc(c, c, 96, 0, Math.PI * 2);
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 3;
      g.stroke();
    }),
    true
  );
}

// Bande chiffrée autour d'une bague (diaphragme, distances).
function bandeChiffres(valeurs, fond, encre, hauteurTexte) {
  return textureDe(
    toile(2048, 128, (g, l, h) => {
      g.fillStyle = fond;
      g.fillRect(0, 0, l, h);
      g.fillStyle = encre;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `600 ${hauteurTexte}px Helvetica, Arial, sans-serif`;
      const pas = l / (valeurs.length * 2);
      valeurs.forEach((v, i) => {
        g.fillText(v, pas * (i + 0.5), h / 2 + 8);
        g.fillRect(pas * (i + 0.5) - 1.5, 6, 3, 16);
      });
    }),
    true
  );
}

// Inscription gravée sur l'anneau avant de l'objectif (sans marque).
function anneauTexte(texte, fond, encre) {
  return textureDe(
    toile(1024, 1024, (g, n) => {
      const c = n / 2;
      g.fillStyle = fond;
      g.fillRect(0, 0, n, n);
      g.fillStyle = encre;
      g.font = "500 30px Helvetica, Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const lettres = texte.split("");
      const pas = 0.034;
      const total = lettres.length * pas;
      lettres.forEach((ch, i) => {
        const a = -Math.PI / 2 - total / 2 + i * pas;
        g.save();
        g.translate(c + Math.cos(a) * 440, c + Math.sin(a) * 440);
        g.rotate(a + Math.PI / 2);
        g.fillText(ch, 0, 0);
        g.restore();
      });
    }),
    true
  );
}

// Reflet doux en diagonale, posé sur l'écran arrière.
function textureReflet() {
  return textureDe(
    toile(256, 256, (g, n) => {
      const d = g.createLinearGradient(0, 0, n, n);
      d.addColorStop(0, "rgba(255,255,255,0)");
      d.addColorStop(0.4, "rgba(255,255,255,0)");
      d.addColorStop(0.47, "rgba(255,255,255,0.5)");
      d.addColorStop(0.6, "rgba(255,255,255,0.05)");
      d.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = d;
      g.fillRect(0, 0, n, n);
    }),
    false
  );
}

// ---------- Environnement studio (reflets réalistes sur le métal et le verre) ----------

function environnementStudio(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x24211e);
  const boite = (l, h, couleur, intensite, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(l, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(couleur).multiplyScalar(intensite), side: THREE.DoubleSide })
    );
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  boite(22, 9, 0xffffff, 2.6, [0, 14, 4]); // grande boîte au-dessus
  boite(5, 18, 0xfff3e6, 2.4, [-16, 3, 6]); // bande gauche, chaude
  boite(5, 18, 0xe8eef8, 1.5, [16, 2, 6]); // bande droite, froide
  boite(9, 4, 0xffffff, 2.2, [-6, 6, 15]); // boîte en face (reflet sur la lentille)
  boite(34, 7, 0xd8d2c8, 1.1, [0, -1, 18]); // grand fond clair devant (les faces verticales du métal)
  boite(34, 7, 0xbfb8ad, 0.8, [0, 0, -18]); // et derrière
  boite(20, 2.4, OR, 1.4, [0, 5, -16]); // liseré doré à l'arrière
  boite(40, 12, 0x2a231c, 0.9, [0, -14, 0]); // sol sombre et chaud
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return env;
}

// ---------- Formes ----------

function rectangleArrondi(l, h, r) {
  const s = new THREE.Shape();
  const x = -l / 2;
  const y = -h / 2;
  r = Math.min(r, l / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + l - r, y);
  s.absarc(x + l - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + l, y + h - r);
  s.absarc(x + l - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

// Tranche du boîtier : forme vue de dessus (largeur × profondeur), extrudée en hauteur.
function tranche(l, p, r, hauteur, biseau) {
  const h = Math.max(0.01, hauteur - 2 * biseau);
  const g = new THREE.ExtrudeGeometry(rectangleArrondi(l - 2 * biseau, p - 2 * biseau, Math.max(0.02, r - biseau)), {
    depth: h,
    bevelEnabled: biseau > 0,
    bevelThickness: biseau,
    bevelSize: biseau,
    bevelSegments: 6,
    curveSegments: 28,
  });
  g.rotateX(-Math.PI / 2); // la forme se couche, l'extrusion monte en y
  g.translate(0, biseau, 0);
  return g; // de y = 0 à y = hauteur
}

// Plaque arrondie (épaisseur le long de z), centrée.
function plaque(l, h, p, r, biseau = 0.03) {
  const prof = Math.max(0.005, p - 2 * biseau);
  const g = new THREE.ExtrudeGeometry(rectangleArrondi(l - 2 * biseau, h - 2 * biseau, Math.max(0.01, r - biseau)), {
    depth: prof,
    bevelEnabled: biseau > 0,
    bevelThickness: biseau,
    bevelSize: biseau,
    bevelSegments: 3,
    curveSegments: 16,
  });
  g.translate(0, 0, -prof / 2);
  return g;
}

// Cylindre strié (bord des molettes, bagues). Axe le long de y.
function cylindreStrie(r, h, stries, profondeur, ouvert = false) {
  const g = new THREE.CylinderGeometry(r, r, h, stries * 4, 1, ouvert);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const rayon = Math.hypot(v.x, v.z);
    if (rayon < r * 0.6) continue;
    const a = Math.atan2(v.z, v.x);
    const k = 1 - profondeur * (0.5 + 0.5 * Math.cos(a * stries));
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

// Calotte (lentille) : sommet vers −z, base à z = 0.
function calotte(rayonBord, fleche) {
  const R = (rayonBord * rayonBord + fleche * fleche) / (2 * fleche);
  const theta = Math.asin(Math.min(1, rayonBord / R));
  const g = new THREE.SphereGeometry(R, 64, 20, 0, Math.PI * 2, 0, theta);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, R * Math.cos(theta));
  return g;
}

// ---------- L'appareil ----------

export function creerAppareil({ canvas, photo, geo, mobile, cadrage }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.environment = environnementStudio(renderer);

  const camera = new THREE.PerspectiveCamera(geo.fov, 1, 0.1, 300);
  camera.position.set(0, 0, geo.camZ);
  camera.lookAt(0, 0, 0);

  // Éclairage studio (fixe : l'appareil tourne dedans)
  const cle = new THREE.DirectionalLight(0xfff3e8, 2.4);
  cle.position.set(-8, 11, 12);
  const remplissage = new THREE.DirectionalLight(0xe2e9ff, 0.5);
  remplissage.position.set(11, 1, 8);
  const contre = new THREE.DirectionalLight(OR, 1.8);
  contre.position.set(7, 8, -12);
  const contre2 = new THREE.DirectionalLight(0xd9c6a3, 0.7);
  contre2.position.set(-10, -2, -9);
  const balayage = new THREE.PointLight(0xffffff, 0, 30, 1.6);
  const eclair = new THREE.PointLight(0xfff6e8, 0, 40, 1.4);
  scene.add(cle, remplissage, contre, contre2, balayage, eclair);

  // ----- Matériaux -----
  const cuir = textureCuir();
  cuir.normales.repeat.set(0.55, 0.55);
  cuir.rugosite.repeat.set(0.55, 0.55);
  const brosse = textureBrosse();
  brosse.repeat.set(0.18, 0.18);

  const M = {
    alu: new THREE.MeshPhysicalMaterial({
      color: 0xd2cfc9,
      metalness: 1,
      roughness: 0.36,
      roughnessMap: brosse,
      anisotropy: 0.25,
      clearcoat: 0.15,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.15,
    }),
    aluClair: new THREE.MeshStandardMaterial({ color: 0xe2dfd9, metalness: 1, roughness: 0.24, envMapIntensity: 1.2 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xf0eeea, metalness: 1, roughness: 0.1, envMapIntensity: 1.4 }),
    cuir: new THREE.MeshPhysicalMaterial({
      color: 0x141414,
      roughness: 0.78,
      roughnessMap: cuir.rugosite,
      normalMap: cuir.normales,
      normalScale: new THREE.Vector2(0.9, 0.9),
      sheen: 0.4,
      sheenColor: new THREE.Color(0x3a3a3a),
      sheenRoughness: 0.6,
      envMapIntensity: 0.8,
    }),
    peinture: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.42, metalness: 0.25, envMapIntensity: 0.9 }),
    noirBrillant: new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.16, metalness: 0.3, envMapIntensity: 1.2 }),
    caoutchouc: new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.92, metalness: 0, envMapIntensity: 0.5 }),
    interieur: new THREE.MeshStandardMaterial({ color: 0x040404, roughness: 0.75, metalness: 0, side: THREE.DoubleSide }),
    or: new THREE.MeshStandardMaterial({ color: OR, metalness: 1, roughness: 0.28, envMapIntensity: 1.2 }),
    verre: new THREE.MeshPhysicalMaterial({
      color: 0x0a0d12,
      metalness: 0,
      roughness: 0.03,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      iridescence: 0.85,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [240, 680],
      envMapIntensity: 2.0,
    }),
    verreFond: new THREE.MeshPhysicalMaterial({
      color: 0x05070a,
      roughness: 0.06,
      clearcoat: 1,
      iridescence: 1,
      iridescenceIOR: 1.9,
      iridescenceThicknessRange: [300, 820],
      envMapIntensity: 1.5,
    }),
    vitre: new THREE.MeshPhysicalMaterial({ color: 0x0b1016, roughness: 0.04, metalness: 0.1, clearcoat: 1, envMapIntensity: 1.8 }),
  };

  const groupe = new THREE.Group();
  scene.add(groupe);
  const ajouter = (geom, mat, x = 0, y = 0, z = 0, parent = groupe) => {
    const m = new THREE.Mesh(geom, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ----- Boîtier : capot inférieur argent, gainage noir, capot supérieur argent -----
  const C = geo.corps; // l, h, p
  const R = 0.95; // arrondi des flancs vus de dessus
  const yBas = -C.h / 2;
  const hBas = 0.72;
  const hHaut = 2.2;
  const hCuir = C.h - hBas - hHaut;
  ajouter(tranche(C.l, C.p, R, hBas, 0.14), M.alu, 0, yBas, 0);
  ajouter(tranche(C.l - 0.07, C.p - 0.07, R - 0.035, hCuir + 0.02, 0.0), M.cuir, 0, yBas + hBas - 0.01, 0);
  const yHautPlaque = yBas + hBas + hCuir;
  ajouter(tranche(C.l, C.p, R, hHaut, 0.16), M.alu, 0, yHautPlaque, 0);
  const yHaut = C.h / 2;
  const zDos = C.p / 2;
  const zFace = -C.p / 2;

  // Dos peint en noir (sur la hauteur du gainage)
  ajouter(plaque(C.l - 2 * R + 0.1, hCuir - 0.08, 0.05, 0.3, 0.015), M.peinture, 0, yBas + hBas + hCuir / 2, zDos - 0.01);

  // ----- Plateau supérieur -----
  const molVitesses = ajouter(cylindreStrie(1.08, 0.62, 44, 0.03), M.aluClair, 2.15, yHaut + 0.31, 0.05);
  const faceVitesses = ajouter(
    new THREE.CircleGeometry(1.02, 64),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: faceMolette(["A", "4000", "2000", "1000", "500", "250", "125", "60", "30", "15", "8", "4", "2", "1", "T", "B"], ["A"], "#cfccc6", "#1d1d1d"),
      metalness: 0.85,
      roughness: 0.3,
      envMapIntensity: 1.1,
    }),
    2.15,
    yHaut + 0.625,
    0.05
  );
  faceVitesses.rotation.x = -Math.PI / 2;
  const capVitesses = ajouter(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 40), M.chrome, 2.15, yHaut + 0.645, 0.05);

  const molExpo = ajouter(cylindreStrie(0.86, 0.5, 36, 0.035), M.aluClair, 5.05, yHaut + 0.25, 0.62);
  const faceExpo = ajouter(
    new THREE.CircleGeometry(0.8, 64),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: faceMolette(["0", "+1", "+2", "+3", "C", "-3", "-2", "-1"], ["C"], "#cfccc6", "#1d1d1d"),
      metalness: 0.85,
      roughness: 0.3,
    }),
    5.05,
    yHaut + 0.505,
    0.62
  );
  faceExpo.rotation.x = -Math.PI / 2;

  // Déclencheur chromé, filetage pour déclencheur souple, levier marche/arrêt
  ajouter(new THREE.CylinderGeometry(0.62, 0.66, 0.12, 48), M.alu, 3.85, yHaut + 0.06, -0.72);
  ajouter(new THREE.BoxGeometry(0.5, 0.1, 0.36), M.alu, 4.42, yHaut + 0.07, -1.05);
  ajouter(cylindreStrie(0.46, 0.26, 40, 0.02), M.chrome, 3.85, yHaut + 0.25, -0.72);
  const bouton = ajouter(new THREE.CylinderGeometry(0.3, 0.32, 0.18, 40), M.chrome, 3.85, yHaut + 0.46, -0.72);
  const centreBouton = ajouter(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 24), M.noirBrillant, 3.85, yHaut + 0.56, -0.72);

  // Griffe porte-flash et micro
  ajouter(new THREE.BoxGeometry(2.0, 0.12, 1.8), M.alu, -0.85, yHaut + 0.06, 0.05);
  ajouter(new THREE.BoxGeometry(1.6, 0.06, 1.4), M.noirBrillant, -0.85, yHaut + 0.14, 0.05);
  for (let i = 0; i < 4; i++) ajouter(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), M.noirBrillant, -3.2 + i * 0.22, yHaut + 0.005, -0.7);

  // Attaches de courroie avec anneaux
  for (const sx of [-1, 1]) {
    const att = ajouter(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 24), M.alu, sx * (C.l / 2 + 0.05), yHautPlaque + 0.9, -0.2);
    att.rotation.z = Math.PI / 2;
    const anneau = ajouter(new THREE.TorusGeometry(0.42, 0.06, 12, 40), M.chrome, sx * (C.l / 2 + 0.28), yHautPlaque + 0.5, -0.2);
    anneau.rotation.y = Math.PI / 2;
  }

  // ----- Face avant : fenêtre du viseur, levier, lampe, poignée -----
  ajouter(plaque(2.2, 1.35, 0.14, 0.18, 0.03), M.aluClair, -4.35, yHautPlaque + 1.08, zFace - 0.04);
  ajouter(plaque(1.86, 1.05, 0.1, 0.12, 0.02), M.vitre, -4.35, yHautPlaque + 1.08, zFace - 0.1);
  const axeLevier = ajouter(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), M.aluClair, -2.9, yHautPlaque + 1.1, zFace - 0.06);
  axeLevier.rotation.x = Math.PI / 2;
  const levier = ajouter(plaque(0.2, 0.8, 0.1, 0.09, 0.03), M.aluClair, -2.82, yHautPlaque + 0.72, zFace - 0.1);
  levier.rotation.z = 0.18;
  const lampe = ajouter(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24), M.vitre, -2.4, yBas + hBas + hCuir - 0.6, zFace - 0.02);
  lampe.rotation.x = Math.PI / 2;
  ajouter(plaque(1.35, hCuir - 0.7, 0.34, 0.5, 0.16), M.cuir, 5.2, yBas + hBas + hCuir / 2 - 0.05, zFace - 0.1);

  // ----- Dos : œilleton du viseur, écran, boutons, levier de mise au point -----
  ajouter(plaque(1.95, 1.4, 0.48, 0.28, 0.08), M.caoutchouc, -4.35, yHautPlaque + 1.05, zDos + 0.2);
  ajouter(plaque(1.25, 0.82, 0.04, 0.08, 0.01), M.vitre, -4.35, yHautPlaque + 1.05, zDos + 0.44);
  const E = geo.ecran;
  const cadreEcran = ajouter(plaque(E.l + 0.42, E.h + 0.4, 0.16, 0.12, 0.03), M.noirBrillant, E.cx, E.cy, zDos + 0.07);

  // L'écran : la même photo que le viseur, sans retouche de couleur
  const nw = photo.naturalWidth || 1200;
  const nh = photo.naturalHeight || 800;
  const ech = Math.min(1, 2048 / Math.max(nw, nh));
  const toilePhoto = document.createElement("canvas");
  toilePhoto.width = Math.round(nw * ech);
  toilePhoto.height = Math.round(nh * ech);
  toilePhoto.getContext("2d").drawImage(photo, 0, 0, toilePhoto.width, toilePhoto.height);
  const tex = new THREE.CanvasTexture(toilePhoto);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const ratioImage = nw / nh;
  const ratioEcran = E.l / E.h;
  const fx = cadrage ? cadrage[0] : 0.5;
  const fy = cadrage ? cadrage[1] : 0.5;
  if (ratioImage > ratioEcran) {
    tex.repeat.set(ratioEcran / ratioImage, 1);
    tex.offset.set((1 - tex.repeat.x) * fx, 0);
  } else {
    tex.repeat.set(1, ratioImage / ratioEcran);
    tex.offset.set(0, (1 - tex.repeat.y) * (1 - fy));
  }
  const ecran = ajouter(new THREE.PlaneGeometry(E.l, E.h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), E.cx, E.cy, E.z);
  const reflet = ajouter(
    new THREE.PlaneGeometry(E.l, E.h),
    new THREE.MeshBasicMaterial({ map: textureReflet(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    E.cx,
    E.cy,
    E.z + 0.005
  );

  // Boutons arrière (colonne de droite), levier de mise au point, molette, repose-pouce
  const xBoutons = 3.55;
  [
    [xBoutons, 0.35, 0.23],
    [xBoutons + 1.1, -0.35, 0.21],
    [xBoutons, -1.25, 0.21],
    [xBoutons + 1.1, -2.1, 0.21],
    [xBoutons, -2.3, 0.21],
  ].forEach(([bx, by, br]) => {
    const b = ajouter(new THREE.CylinderGeometry(br, br, 0.1, 32), M.peinture, bx, by, zDos + 0.06);
    b.rotation.x = Math.PI / 2;
  });
  const levierAF = ajouter(new THREE.CylinderGeometry(0.15, 0.2, 0.32, 24), M.caoutchouc, xBoutons + 1.1, 0.75, zDos + 0.16);
  levierAF.rotation.x = Math.PI / 2;
  const molDos = ajouter(cylindreStrie(0.5, 0.3, 26, 0.05), M.peinture, 5.55, yHautPlaque - 0.15, zDos - 0.12);
  molDos.rotation.x = Math.PI / 2;
  ajouter(plaque(1.4, 1.1, 0.12, 0.35, 0.04), M.caoutchouc, 5.2, yHautPlaque + 0.85, zDos + 0.04);

  // ----- Objectif : focale fixe courte (style 23 mm) -----
  const objectif = new THREE.Group();
  objectif.position.set(geo.objectif.x, geo.objectif.y, zFace);
  objectif.scale.setScalar(0.92);
  groupe.add(objectif);
  const cylZ = (r1, r2, longueur, z, mat, ouvert = true, seg = 96) => {
    const m = ajouter(new THREE.CylinderGeometry(r1, r2, longueur, seg, 1, ouvert), mat, 0, 0, z - longueur / 2, objectif);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  cylZ(2.42, 2.42, 0.22, 0, M.alu, false); // embase
  cylZ(2.3, 2.3, 0.1, -0.22, M.peinture); // gorge
  // bague de diaphragme : partie lisse chiffrée + partie striée
  cylZ(2.36, 2.36, 0.42, -0.32, new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: bandeChiffres(["A", "16", "11", "8", "5.6", "4", "2.8", "2"], "#cfccc6", "#1d1d1d", 44),
    metalness: 0.9,
    roughness: 0.32,
    envMapIntensity: 1.1,
  }));
  const stries = ajouter(cylindreStrie(2.4, 0.34, 120, 0.018, true), M.aluClair, 0, 0, -0.74 - 0.17, objectif);
  stries.rotation.x = Math.PI / 2;
  // bague de mise au point (noire, échelle des distances)
  cylZ(2.26, 2.26, 0.5, -1.08, new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: bandeChiffres(["∞", "10", "5", "3", "2", "1.5", "1", "0.8", "0.5m", "∞", "10", "5", "3", "2"], "#121212", "#d8d4cc", 38),
    metalness: 0.2,
    roughness: 0.5,
  }));
  cylZ(2.27, 2.27, 0.04, -1.58, M.or); // fin liseré doré (l'accent du site)
  cylZ(2.24, 2.2, 0.32, -1.62, M.alu); // fût avant
  // face avant : anneau gravé, intérieur, lentilles
  const zAvant = -1.94;
  const anneau = ajouter(new THREE.RingGeometry(1.62, 2.2, 96), new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: anneauTexte("1:2  f=23mm  ·  Ø49", "#0f0f0f", "#cfcac0"),
    metalness: 0.3,
    roughness: 0.45,
  }), 0, 0, zAvant, objectif);
  anneau.rotation.y = Math.PI;
  const tube = ajouter(new THREE.CylinderGeometry(1.62, 1.62, 0.8, 64, 1, true), M.interieur, 0, 0, zAvant + 0.4, objectif);
  tube.rotation.x = Math.PI / 2;
  const frontale = ajouter(calotte(1.62, 0.34), M.verre, 0, 0, zAvant + 0.38, objectif);
  ajouter(calotte(1.05, 0.26), M.verreFond, 0, 0, zAvant + 0.72, objectif);
  ajouter(new THREE.CircleGeometry(1.05, 48), M.interieur, 0, 0, zAvant + 0.78, objectif);

  // Lentilles intérieures : cachées dans le fût, elles sortent quand l'appareil se démonte.
  const lentilles = [];
  [
    [1.5, 0.3, -0.55],
    [1.75, 0.36, -0.95],
    [1.6, 0.3, -1.35],
  ].forEach(([r, f, z]) => {
    const g = new THREE.Group();
    g.position.set(0, 0, z);
    const avant = new THREE.Mesh(calotte(r, f), M.verre);
    const arriere = new THREE.Mesh(calotte(r, f * 0.7), M.verreFond);
    arriere.rotation.y = Math.PI;
    const bord = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 10, 72), M.chrome);
    g.add(avant, arriere, bord);
    objectif.add(g);
    lentilles.push(g);
  });

  // Vue éclatée : chaque pièce de l'objectif avance d'un cran (ordre de montage).
  const ECARTS = [0, 0.7, 1.5, 1.5, 3.0, 3.9, 3.9, 5.0, 5.0, 7.2, 4.4, 5.0, 2.2, 3.3, 4.4];
  const pieces = objectif.children.map((m, i) => ({ m, z0: m.position.z, ecart: ECARTS[i] || 0, sens: i % 2 ? 1 : -1 }));
  const levees = [
    [molVitesses, 1.9],
    [faceVitesses, 1.9],
    [capVitesses, 1.9],
    [molExpo, 1.5],
    [faceExpo, 1.5],
    [centreBouton, 2.6],
  ].map(([m, h]) => ({ m, y0: m.position.y, h }));
  const reculs = [cadreEcran, ecran, reflet].map((m) => ({ m, z0: m.position.z }));

  // ----- API pour la chorégraphie -----
  const tmp = new THREE.Vector3();
  let largeur = 1;
  let hauteur = 1;

  function redimensionner(l, h) {
    largeur = l;
    hauteur = h;
    renderer.setSize(l, h, false);
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
  }

  function appliquer(e) {
    groupe.position.set(e.x, e.y, e.z);
    groupe.rotation.set(e.rx, e.ry, e.rz);
    groupe.scale.setScalar(e.s);
    reflet.material.opacity = e.reflet || 0;
    ecran.visible = e.ecran !== false;
    const k = e.s || 1;
    const b = e.balayage;
    if (b > 0 && b < 1) {
      balayage.position.set(e.x + (-10 + 20 * b) * k, e.y + (3 - 2 * b) * k, e.z + 9 * k);
      balayage.distance = 30 * k;
      balayage.intensity = 240 * k * k * Math.sin(Math.PI * b);
    } else {
      balayage.intensity = 0;
    }
    eclair.position.set(e.x - 2 * k, e.y + 2 * k, e.z + 8 * k);
    eclair.distance = 40 * k;
    eclair.intensity = 420 * k * k * (e.flash || 0);
    molVitesses.rotation.y = e.ry * 0.12;
    faceVitesses.rotation.z = e.ry * 0.12;
    molExpo.rotation.y = -e.ry * 0.18;
    faceExpo.rotation.z = -e.ry * 0.18;
    // Démontage (0 = monté, 1 = pièces écartées)
    const x = e.eclate || 0;
    objectif.position.z = zFace - 0.9 * x;
    pieces.forEach((p) => {
      p.m.position.z = p.z0 - 1.05 * p.ecart * x;
      p.m.position.y = 0.18 * p.sens * Math.sin(Math.PI * x) * (p.ecart > 0 ? 1 : 0);
    });
    levees.forEach((l) => (l.m.position.y = l.y0 + l.h * x));
    bouton.position.y = yHaut + 0.46 - 0.05 * (e.flash || 0) + 2.6 * x;
  }

  function projeter(nom) {
    if (nom === "objectif") frontale.getWorldPosition(tmp);
    else groupe.getWorldPosition(tmp);
    tmp.project(camera);
    return { x: ((tmp.x + 1) / 2) * largeur, y: ((1 - tmp.y) / 2) * hauteur };
  }

  function rendre() {
    renderer.render(scene, camera);
  }

  renderer.compile(scene, camera);
  return { appliquer, rendre, redimensionner, projeter, renderer };
}
