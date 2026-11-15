// Appareil photo hybride en 3D, construit entièrement en code (aucun modèle à
// télécharger). Silhouette inspirée d'un hybride compact : viseur en haut à
// gauche, grosse poignée à droite, deux molettes, écran arrière, focale fixe
// courte avec bague de mise au point striée. Aucun logo.
//
// Repère (vu de dos, l'écran face à nous) : x vers la droite, y vers le haut,
// z vers nous. L'objectif pointe donc vers −z.

import * as THREE from "../vendor/three.module.min.js";

const COULEUR_OR = 0xae8c5b;

// ---------- Textures fabriquées à la volée (grain du cuir, reflets) ----------

function toileTexture(taille, dessiner) {
  const c = document.createElement("canvas");
  c.width = c.height = taille;
  dessiner(c.getContext("2d"), taille);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Grain « cuir » : petits galets irréguliers, pour le relief (bumpMap).
function textureCuir() {
  return toileTexture(256, (g, n) => {
    g.fillStyle = "#808080";
    g.fillRect(0, 0, n, n);
    let graine = 7;
    const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2600; i++) {
      const x = hasard() * n;
      const y = hasard() * n;
      const r = 1.2 + hasard() * 2.6;
      const v = 95 + hasard() * 70;
      g.fillStyle = `rgba(${v},${v},${v},0.9)`;
      for (const dx of [-n, 0, n]) {
        for (const dy of [-n, 0, n]) {
          g.beginPath();
          g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  });
}

// Grain fin (boîtier satiné).
function textureGrainFin() {
  return toileTexture(128, (g, n) => {
    const img = g.createImageData(n, n);
    let graine = 11;
    for (let i = 0; i < img.data.length; i += 4) {
      graine = (graine * 16807) % 2147483647;
      const v = 110 + (graine % 40);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

// Reflet doux en diagonale, posé sur l'écran arrière.
function textureReflet() {
  return toileTexture(256, (g, n) => {
    const d = g.createLinearGradient(0, 0, n, n);
    d.addColorStop(0, "rgba(255,255,255,0.0)");
    d.addColorStop(0.38, "rgba(255,255,255,0.0)");
    d.addColorStop(0.46, "rgba(255,255,255,0.55)");
    d.addColorStop(0.6, "rgba(255,255,255,0.06)");
    d.addColorStop(1, "rgba(255,255,255,0.0)");
    g.fillStyle = d;
    g.fillRect(0, 0, n, n);
  });
}

// ---------- Environnement studio (pour les reflets réalistes) ----------

function environnementStudio(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x0b0a09);
  const boite = (l, h, couleur, intensite, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(l, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(couleur).multiplyScalar(intensite), side: THREE.DoubleSide })
    );
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  boite(16, 10, 0xffffff, 3.0, [0, 13, 7]); // grande boîte à lumière au-dessus
  boite(4, 16, 0xfff1e2, 2.2, [-15, 2, 5]); // bande gauche, chaude
  boite(4, 16, 0xe6edf8, 1.3, [15, 1, 7]); // bande droite, froide
  boite(18, 2.2, COULEUR_OR, 1.6, [0, 5, -15]); // liseré doré à l'arrière
  boite(5, 3, 0xffffff, 2.6, [-5, 6, 15]); // petite boîte en face (reflet sur la lentille)
  boite(36, 10, 0x2b241d, 0.7, [0, -12, 0]); // sol sombre et chaud
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.035).texture;
  pm.dispose();
  return env;
}

// ---------- Formes ----------

function rectangleArrondi(l, h, r) {
  const s = new THREE.Shape();
  const x = -l / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + l - r, y);
  s.quadraticCurveTo(x + l, y, x + l, y + r);
  s.lineTo(x + l, y + h - r);
  s.quadraticCurveTo(x + l, y + h, x + l - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Volume arrondi centré, épaisseur le long de z.
function blocArrondi(l, h, p, r, biseau, segments = 4) {
  const prof = Math.max(0.01, p - 2 * biseau);
  const g = new THREE.ExtrudeGeometry(rectangleArrondi(l - 2 * biseau, h - 2 * biseau, Math.max(0.01, r - biseau)), {
    depth: prof,
    bevelEnabled: biseau > 0,
    bevelThickness: biseau,
    bevelSize: biseau,
    bevelSegments: segments + 3,
    curveSegments: 18,
  });
  g.translate(0, 0, -prof / 2);
  return g;
}

// Cylindre strié (molettes, bague de mise au point). Axe le long de y.
function cylindreStrie(r, h, stries, profondeur, segmentsH = 1, ouvert = false) {
  const g = new THREE.CylinderGeometry(r, r, h, stries * 4, segmentsH, ouvert);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const rayon = Math.hypot(v.x, v.z);
    if (rayon < r * 0.6) continue; // centre des faces : inchangé
    const a = Math.atan2(v.z, v.x);
    const k = 1 - profondeur * (0.5 + 0.5 * Math.cos(a * stries));
    // les bords des faces gardent la même forme pour éviter les trous
    v.x *= k;
    v.z *= k;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Calotte sphérique (lentille) : bord de rayon `rayonBord`, bombé `fleche`.
// Le sommet pointe vers −z, la base est à z = 0.
function calotte(rayonBord, fleche) {
  const R = (rayonBord * rayonBord + fleche * fleche) / (2 * fleche);
  const theta = Math.asin(Math.min(1, rayonBord / R));
  const g = new THREE.SphereGeometry(R, 64, 18, 0, Math.PI * 2, 0, theta);
  g.rotateX(-Math.PI / 2); // pôle vers −z
  g.translate(0, 0, R * Math.cos(theta)); // base à z = 0, sommet à z = −flèche
  return g;
}

// ---------- L'appareil ----------

export function creerAppareil({ canvas, photo, geo, mobile, cadrage }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  scene.environment = environnementStudio(renderer);

  const camera = new THREE.PerspectiveCamera(geo.fov, 1, 0.1, 300);
  camera.position.set(0, 0, geo.camZ);
  camera.lookAt(0, 0, 0);

  // Lumières studio (fixes dans la pièce : l'appareil tourne dedans)
  const cle = new THREE.DirectionalLight(0xfff2e4, 2.6);
  cle.position.set(-8, 10, 12);
  const remplissage = new THREE.DirectionalLight(0xdfe7ff, 0.55);
  remplissage.position.set(10, 2, 8);
  const contreOr = new THREE.DirectionalLight(COULEUR_OR, 2.2);
  contreOr.position.set(7, 7, -12);
  const contreOr2 = new THREE.DirectionalLight(0xc9a46a, 0.9);
  contreOr2.position.set(-10, -3, -8);
  const balayage = new THREE.PointLight(0xffffff, 0, 30, 1.6);
  balayage.position.set(-9, 3, 12);
  const eclair = new THREE.PointLight(0xfff6e8, 0, 40, 1.4);
  eclair.position.set(0, 2, 10);
  scene.add(cle, remplissage, contreOr, contreOr2, balayage, eclair);

  // ----- Matériaux -----
  const cuir = textureCuir();
  cuir.repeat.set(0.42, 0.42);
  const grain = textureGrainFin();
  grain.repeat.set(1.4, 1.4);

  const M = {
    corps: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.56, metalness: 0.18, bumpMap: grain, bumpScale: 0.35, envMapIntensity: 0.95 }),
    cuir: new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.86, metalness: 0.0, bumpMap: cuir, bumpScale: 2.2, envMapIntensity: 0.7 }),
    noirBrillant: new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.22, metalness: 0.2, envMapIntensity: 1.2 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9c9893, roughness: 0.32, metalness: 1.0, envMapIntensity: 1.1 }),
    metalSombre: new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.36, metalness: 0.92, envMapIntensity: 1.0 }),
    caoutchouc: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.6 }),
    or: new THREE.MeshStandardMaterial({ color: COULEUR_OR, roughness: 0.26, metalness: 1.0, envMapIntensity: 1.3 }),
    interieur: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide }),
    blanc: new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.5, metalness: 0.0 }),
    verre: new THREE.MeshPhysicalMaterial({
      color: 0x0a0e14,
      metalness: 0.0,
      roughness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      iridescence: 0.75,
      iridescenceIOR: 1.55,
      iridescenceThicknessRange: [220, 640],
      envMapIntensity: 1.8,
    }),
    verreFond: new THREE.MeshPhysicalMaterial({
      color: 0x06080b,
      roughness: 0.08,
      clearcoat: 1,
      iridescence: 1,
      iridescenceIOR: 1.8,
      iridescenceThicknessRange: [300, 800],
      envMapIntensity: 1.4,
    }),
  };

  const groupe = new THREE.Group(); // ce que l'on anime
  scene.add(groupe);
  const ajouter = (geom, mat, x = 0, y = 0, z = 0, parent = groupe) => {
    const m = new THREE.Mesh(geom, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // Boîtier
  const C = geo.corps; // l, h, p
  ajouter(blocArrondi(C.l, C.h, C.p, 0.62, 0.26, 5), M.corps);
  // Habillage cuir sur la face avant (côté objectif)
  ajouter(blocArrondi(C.l - 0.5, C.h - 1.5, 0.12, 0.4, 0.04, 2), M.cuir, -0.2, -0.35, -C.p / 2 - 0.02);

  // Poignée (côté droit vu de dos, en avant)
  ajouter(blocArrondi(3.3, 6.6, 2.9, 1.15, 0.6, 6), M.cuir, 4.2, 0, -C.p / 2 - 0.95);

  // Plateau supérieur : molette de mode + molette de commande, déclencheur, griffe
  const yHaut = C.h / 2;
  const molette = ajouter(cylindreStrie(0.95, 0.5, 30, 0.035, 2), M.metalSombre, 2.45, yHaut + 0.25, 0.3);
  ajouter(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 48), M.metal, 2.45, yHaut + 0.53, 0.3);
  const molette2 = ajouter(cylindreStrie(0.72, 0.3, 26, 0.04, 1), M.metalSombre, 4.45, yHaut + 0.15, -0.35);
  ajouter(new THREE.CylinderGeometry(0.52, 0.56, 0.16, 48), M.metal, 4.25, yHaut + 0.05, -2.9);
  ajouter(new THREE.CylinderGeometry(0.36, 0.38, 0.2, 48), M.metalSombre, 4.25, yHaut + 0.2, -2.9);
  ajouter(new THREE.BoxGeometry(2.1, 0.14, 1.75), M.metal, -0.95, yHaut + 0.07, 0.15);
  ajouter(new THREE.BoxGeometry(1.7, 0.08, 1.35), M.noirBrillant, -0.95, yHaut + 0.15, 0.15);
  // repère doré discret sur la molette de mode
  ajouter(new THREE.BoxGeometry(0.08, 0.06, 0.32), M.or, 2.45, yHaut + 0.57, 0.62);

  // Attaches de courroie
  for (const sx of [-1, 1]) ajouter(new THREE.BoxGeometry(0.3, 0.5, 0.55), M.metal, sx * (C.l / 2 + 0.08), yHaut - 0.75, 0);

  // Dos : viseur (œilleton), écran, molette arrière, boutons, repose-pouce
  const zDos = C.p / 2;
  const E = geo.ecran;
  ajouter(blocArrondi(2.7, 1.25, 0.5, 0.35, 0.09, 3), M.caoutchouc, -3.95, 2.62, zDos + 0.2);
  ajouter(new THREE.PlaneGeometry(1.75, 0.72), M.noirBrillant, -3.95, 2.62, zDos + 0.46);
  ajouter(blocArrondi(E.l + 0.5, E.h + 0.45, 0.12, 0.22, 0.03, 2), M.noirBrillant, E.cx, E.cy, zDos + 0.06);

  // Écran : la même photo que le viseur, sans retouche de couleur
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
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
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
  tex.needsUpdate = true;
  const ecran = ajouter(
    new THREE.PlaneGeometry(E.l, E.h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
    E.cx,
    E.cy,
    E.z
  );
  const reflet = ajouter(
    new THREE.PlaneGeometry(E.l, E.h),
    new THREE.MeshBasicMaterial({ map: textureReflet(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    E.cx,
    E.cy,
    E.z + 0.005
  );

  const molette3 = ajouter(cylindreStrie(0.85, 0.22, 28, 0.05), M.metalSombre, 4.3, -0.7, zDos + 0.11);
  molette3.rotation.x = Math.PI / 2;
  const centre = ajouter(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 40), M.noirBrillant, 4.3, -0.7, zDos + 0.13);
  centre.rotation.x = Math.PI / 2;
  for (const [bx, by] of [[4.75, 1.45], [3.55, 1.45], [4.85, -2.5], [3.6, -2.5]]) {
    const b = ajouter(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 32), M.noirBrillant, bx, by, zDos + 0.07);
    b.rotation.x = Math.PI / 2;
  }
  ajouter(blocArrondi(1.9, 1.15, 0.14, 0.35, 0.05, 2), M.cuir, 4.55, 2.45, zDos + 0.05);

  // Objectif : focale fixe courte, bague de mise au point striée
  const objectif = new THREE.Group();
  objectif.position.set(geo.objectif.x, geo.objectif.y, -C.p / 2);
  groupe.add(objectif);
  const cylZ = (r1, r2, longueur, z, mat, ouvert = true, seg = 72) => {
    const m = ajouter(new THREE.CylinderGeometry(r1, r2, longueur, seg, 1, ouvert), mat, 0, 0, z - longueur / 2, objectif);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  cylZ(2.6, 2.6, 0.32, 0, M.metal, false); // baïonnette
  cylZ(2.46, 2.46, 0.75, -0.32, M.noirBrillant); // fût arrière
  ajouter(new THREE.BoxGeometry(0.12, 0.3, 0.08), M.blanc, 0, 2.48, -0.66, objectif); // repère de montage
  const bague = ajouter(cylindreStrie(2.56, 1.5, 70, 0.028, 1, true), M.caoutchouc, 0, 0, -1.07 - 0.75, objectif);
  bague.rotation.x = Math.PI / 2;
  cylZ(2.47, 2.47, 0.06, -2.57, M.or); // liseré doré
  cylZ(2.44, 2.4, 0.62, -2.63, M.noirBrillant); // fût avant
  // face avant (anneau) et intérieur
  const anneau = ajouter(new THREE.RingGeometry(1.92, 2.4, 72), M.metalSombre, 0, 0, -3.25, objectif);
  anneau.rotation.y = Math.PI;
  const tube = ajouter(new THREE.CylinderGeometry(1.92, 1.92, 0.9, 64, 1, true), M.interieur, 0, 0, -3.25 + 0.45, objectif);
  tube.rotation.x = Math.PI / 2;
  // lentilles
  const frontale = ajouter(calotte(1.92, 0.42), M.verre, 0, 0, -2.8, objectif);
  ajouter(calotte(1.25, 0.32), M.verreFond, 0, 0, -2.4, objectif);
  ajouter(new THREE.CircleGeometry(1.25, 48), M.interieur, 0, 0, -2.35, objectif);

  // Petit bouton de déverrouillage de l'objectif
  const deverrou = ajouter(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 32), M.metal, 1.9, -1.55, -C.p / 2 - 0.08);
  deverrou.rotation.x = Math.PI / 2;

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
    // Reflet qui balaie l'objectif : une lumière passe devant, de gauche à droite.
    const b = e.balayage;
    const echelle = e.s || 1;
    if (b > 0 && b < 1) {
      balayage.position.set(e.x + (-10 + 20 * b) * echelle, e.y + (3 - 2 * b) * echelle, e.z + 9 * echelle);
      balayage.distance = 30 * echelle;
      balayage.intensity = 260 * echelle * echelle * Math.sin(Math.PI * b);
    } else {
      balayage.intensity = 0;
    }
    eclair.position.set(e.x - 2 * echelle, e.y + 2 * echelle, e.z + 8 * echelle);
    eclair.distance = 40 * echelle;
    eclair.intensity = 420 * echelle * echelle * (e.flash || 0);
    molette.rotation.y = e.ry * 0.15;
    molette2.rotation.y = -e.ry * 0.22;
  }

  // Position à l'écran (pixels CSS) d'un point de l'appareil, ex. le centre de l'objectif.
  function projeter(nom) {
    if (nom === "objectif") frontale.getWorldPosition(tmp);
    else groupe.getWorldPosition(tmp);
    tmp.project(camera);
    return { x: ((tmp.x + 1) / 2) * largeur, y: ((1 - tmp.y) / 2) * hauteur };
  }

  function rendre() {
    renderer.render(scene, camera);
  }

  // Préparer les shaders tout de suite (évite un à-coup au premier défilement).
  renderer.compile(scene, camera);

  return { appliquer, rendre, redimensionner, projeter, renderer };
}
