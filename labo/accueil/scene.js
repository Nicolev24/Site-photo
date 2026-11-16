// Labo v2 — l'appareil qui se construit : une lentille, puis les bagues, puis le boîtier.
//
// Modèle « Camera 01 » de Poly Haven (Rajil Jose Macatangay), licence CC0
// (fichiers partagés avec ../appareil/modele/). La sangle est retirée.
//
// Repère : boîtier = 12,8 unités de large, centre du boîtier en 0, objectif vers -z.

import * as THREE from "../vendor/three.module.min.js";

const K = 12.8 / 0.1473; // mètres du modèle → unités de la scène
const CENTRE = new THREE.Vector3(0.00005, 0.0393, 0.00045);
const AXE = { x: 0.0088, y: 0.03385, r: 0.0272 }; // axe de l'objectif (coordonnées du modèle)
const FOV = 30;
const CAM_Z = 60;

// Calotte sphérique (une face de lentille), bombée vers -z
function calotte(rayonBord, fleche) {
  const R = (rayonBord * rayonBord + fleche * fleche) / (2 * fleche);
  const theta = Math.asin(rayonBord / R);
  const g = new THREE.SphereGeometry(R, 64, 14, 0, Math.PI * 2, 0, theta);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, R - fleche);
  return g;
}

function sousGeometrie(geom, triangles) {
  const g = new THREE.BufferGeometry();
  for (const nom in geom.attributes) g.setAttribute(nom, geom.attributes[nom]);
  g.setIndex(triangles);
  g.computeBoundingSphere();
  return g;
}

const lisse = (t) => t * t * (3 - 2 * t);
const borne = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export async function creerAppareil({ canvas, mobile, base }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.9;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 200);
  camera.position.set(0, 0, CAM_Z);
  camera.lookAt(0, 0, 0);
  const hauteurVue = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360); // hauteur visible au plan z = 0

  // Éclairage studio, fixe
  const cle = new THREE.DirectionalLight(0xffffff, 2.0);
  cle.position.set(-10, 14, 16);
  const remplissage = new THREE.DirectionalLight(0xeef2ff, 0.5);
  remplissage.position.set(14, 0, 10);
  const contre = new THREE.DirectionalLight(0xffffff, 1.4);
  contre.position.set(6, 10, -14);
  const eclair = new THREE.PointLight(0xffffff, 0, 60, 1.2);
  scene.add(cle, remplissage, contre, eclair);

  // ----- Le modèle -----
  const gltf = await new THREE.GLTFLoader().loadAsync(base + (mobile ? "modele/appareil-1k.gltf" : "modele/appareil-2k.gltf"));
  const groupe = new THREE.Group(); // tout l'appareil (son origine = centre du boîtier)
  scene.add(groupe);
  const boitier = new THREE.Group();
  groupe.add(boitier);

  const verre = new THREE.MeshPhysicalMaterial({
    color: 0x0b0d12,
    metalness: 0,
    roughness: 0.03,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    iridescence: 0.85,
    iridescenceIOR: 1.65,
    iridescenceThicknessRange: [240, 620],
    envMapIntensity: 2.4,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x202022, metalness: 1, roughness: 0.28, envMapIntensity: 1.3 });

  const ax = -(AXE.x - CENTRE.x) * K; // centre de l'objectif, dans le repère du boîtier
  const ay = (AXE.y - CENTRE.y) * K;
  const zLentille = -6.0;

  const maillages = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => o.isMesh && maillages.push(o));

  // L'objectif est découpé en bagues (tranches le long de son axe)
  const NB = 6;
  const zMin = 0.0108;
  const zMax = 0.0701;
  const parBague = Array.from({ length: NB }, () => []); // [ { g, tri, mat } ]

  for (const o of maillages) {
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const pos = g.attributes.position;
    const idx = g.index ? Array.from(g.index.array) : Array.from({ length: pos.count }, (_, i) => i);
    const nomMat = o.material.name || "";
    let mat = o.material;
    if (mat.metalnessMap) {
      mat.aoMap = mat.metalnessMap; // la texture « ARM » contient l'occlusion (canal rouge)
      mat.aoMapIntensity = 1;
    }
    const corps = [];
    const tranches = Array.from({ length: NB }, () => []);
    for (let t = 0; t < idx.length; t += 3) {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (let k = 0; k < 3; k++) {
        const i = idx[t + k];
        cx += pos.getX(i) / 3;
        cy += pos.getY(i) / 3;
        cz += pos.getZ(i) / 3;
      }
      const dansObjectif = cz > zMin && Math.hypot(cx - AXE.x, cy - AXE.y) < AXE.r;
      const tri = [idx[t], idx[t + 1], idx[t + 2]];
      if (nomMat === "Camera_01_lens" && dansObjectif) continue; // remplacé par notre lentille
      if (nomMat === "Camera_01_lens_body" || (nomMat === "Camera_01_strap" && dansObjectif)) {
        const n = Math.min(NB - 1, Math.max(0, Math.floor(((cz - zMin) / (zMax - zMin)) * NB)));
        tranches[n].push(...tri);
      } else corps.push(...tri);
    }
    g.translate(-CENTRE.x, -CENTRE.y, -CENTRE.z);
    g.rotateY(Math.PI);
    g.scale(K, K, K);
    if (corps.length) boitier.add(new THREE.Mesh(sousGeometrie(g, corps), nomMat === "Camera_01_lens" ? verre : mat));
    tranches.forEach((tri, n) => tri.length && parBague[n].push(new THREE.Mesh(sousGeometrie(g, tri), mat)));
  }

  // Chaque bague tourne autour de l'axe de l'objectif : on la place dans un pivot sur cet axe.
  const bagues = [];
  parBague.forEach((liste, n) => {
    if (!liste.length) return;
    const zc = -(zMin + ((n + 0.5) / NB) * (zMax - zMin) - CENTRE.z) * K;
    const pivot = new THREE.Group();
    pivot.position.set(ax, ay, zc);
    liste.forEach((m) => {
      m.position.set(-ax, -ay, -zc);
      pivot.add(m);
    });
    groupe.add(pivot);
    // d'où elle arrive : derrière la lentille, écartée sur le côté, en tournant
    const angle = -0.9 + n * 1.05;
    bagues.push({
      pivot,
      x0: ax,
      y0: ay,
      z0: zc,
      ox: Math.cos(angle) * (3.6 + n * 0.5),
      oy: Math.sin(angle) * (2.6 + n * 0.4),
      oz: 7 + (NB - n) * 2.4,
      tour: (n % 2 ? 1 : -1) * (1.6 + n * 0.25),
      retard: (NB - 1 - n) * 0.09, // la bague du fond arrive en premier
    });
  });

  // ----- La lentille (le « grain ») -----
  const lentille = new THREE.Group();
  lentille.position.set(ax, ay, zLentille);
  const rL = 2.02;
  const avant = new THREE.Mesh(calotte(rL, 0.55), verre);
  const arriere = new THREE.Mesh(calotte(rL, 0.32), verre);
  arriere.rotation.y = Math.PI;
  const tranche = new THREE.Mesh(new THREE.CylinderGeometry(rL, rL, 0.36, 96, 1, true), chrome);
  tranche.rotation.x = Math.PI / 2;
  tranche.position.z = 0.18;
  lentille.add(avant, arriere, tranche);
  groupe.add(lentille);

  // Repères pour la chorégraphie
  const centreLentille = new THREE.Vector3(ax, ay, zLentille);
  const bordLentille = new THREE.Vector3(ax + rL, ay, zLentille);

  // ----- API -----
  let largeur = 1;
  let hauteur = 1;
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const v = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const ancre = new THREE.Vector3();

  function redimensionner(l, h) {
    largeur = l;
    hauteur = h;
    renderer.setSize(l, h, false);
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
  }

  // e : { x, y (px à l'écran), px (pixels par unité), ancre (0 lentille → 1 boîtier),
  //       rx, ry, rz, assemble (0 → 1), corps (0 → 1), flash (0 → 1) }
  function appliquer(e) {
    const s = e.px / (hauteur / hauteurVue);
    eul.set(e.rx, e.ry, e.rz);
    q.setFromEuler(eul);
    groupe.quaternion.copy(q);
    groupe.scale.setScalar(s);
    // le point d'ancrage (lentille → centre du boîtier) se pose sur (x, y)
    ancre.set(ax * (1 - e.ancre), ay * (1 - e.ancre), zLentille * (1 - e.ancre)).multiplyScalar(s).applyQuaternion(q);
    const wx = (e.x / largeur - 0.5) * hauteurVue * (largeur / hauteur);
    const wy = (0.5 - e.y / hauteur) * hauteurVue;
    groupe.position.set(wx - ancre.x, wy - ancre.y, -ancre.z);

    // Les bagues viennent se monter derrière la lentille
    bagues.forEach((b) => {
      const t = lisse(borne((e.assemble - b.retard) / (1 - 0.45)));
      const r = 1 - t;
      b.pivot.visible = t > 0.001;
      b.pivot.position.set(b.x0 + b.ox * r, b.y0 + b.oy * r, b.z0 + b.oz * r);
      b.pivot.rotation.set(0.5 * r, -0.4 * r, b.tour * r);
    });

    // Le boîtier arrive par en dessous et vient se fixer
    const c = lisse(borne(e.corps));
    boitier.visible = c > 0.001;
    boitier.position.set(0, -6 * (1 - c), 18 * (1 - c));
    boitier.rotation.set(-0.35 * (1 - c), 0, 0);

    eclair.position.set(wx - 4 * s, wy + 3 * s, 20);
    eclair.intensity = 900 * (e.flash || 0);
  }

  function projeter(p) {
    v.copy(p).applyMatrix4(groupe.matrixWorld).project(camera);
    return { x: ((v.x + 1) / 2) * largeur, y: ((1 - v.y) / 2) * hauteur };
  }
  // La lentille à l'écran : centre et rayon (en px)
  function lentilleEcran() {
    groupe.updateMatrixWorld(true);
    const c = projeter(centreLentille);
    v2.copy(bordLentille);
    const b = projeter(v2);
    return { x: c.x, y: c.y, r: Math.hypot(b.x - c.x, b.y - c.y) };
  }

  function rendre() {
    renderer.render(scene, camera);
  }

  // Compile tout (bagues et boîtier compris) pour éviter un à-coup au premier scroll
  bagues.forEach((b) => (b.pivot.visible = true));
  renderer.compile(scene, camera);
  return { appliquer, rendre, redimensionner, lentilleEcran };
}
