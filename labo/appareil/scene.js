// Labo — l'appareil photo 3D : un vrai modèle (télémétrique ancien, cuir et laiton usés).
//
// Modèle « Camera 01 » de Poly Haven (Rajil Jose Macatangay), licence CC0 :
// libre de droits, sans obligation de citation. La sangle est retirée.
//
// Le modèle est remis à l'échelle de la chorégraphie (boîtier = 12,8 unités de large,
// objectif vers -z, centre du boîtier en 0). L'objectif est découpé en bagues
// (tranches le long de son axe) pour la vue éclatée.

import * as THREE from "../vendor/three.module.min.js";

const OR = 0xae8c5b;
const K = 12.8 / 0.1473; // mètres du modèle → unités de la scène
const CENTRE = new THREE.Vector3(0.00005, 0.0393, 0.00045);
const AXE = { x: 0.0088, y: 0.03385, r: 0.0272 }; // axe de l'objectif (coordonnées du modèle)

// Calotte sphérique (lentille), bombée vers -z
function calotte(rayonBord, fleche) {
  const R = (rayonBord * rayonBord + fleche * fleche) / (2 * fleche);
  const theta = Math.asin(rayonBord / R);
  const g = new THREE.SphereGeometry(R, 64, 12, 0, Math.PI * 2, 0, theta);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, R - fleche);
  return g;
}

// Sous-géométrie : seulement certains triangles (les attributs sont partagés)
function sousGeometrie(geom, triangles) {
  const g = new THREE.BufferGeometry();
  for (const nom in geom.attributes) g.setAttribute(nom, geom.attributes[nom]);
  g.setIndex(triangles);
  g.computeBoundingSphere();
  return g;
}

export async function creerAppareil({ canvas, geo, mobile, base }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(geo.fov, 1, 0.05, 400);
  camera.position.set(0, 0, geo.camZ);
  camera.lookAt(0, 0, 0);

  // Éclairage studio (fixe : l'appareil tourne dedans)
  const cle = new THREE.DirectionalLight(0xfff4e8, 2.2);
  cle.position.set(-8, 12, 14);
  const remplissage = new THREE.DirectionalLight(0xe6ecff, 0.45);
  remplissage.position.set(12, 2, 8);
  const contre = new THREE.DirectionalLight(OR, 1.6);
  contre.position.set(8, 9, -12);
  const balayage = new THREE.PointLight(0xffffff, 0, 30, 1.6);
  const eclair = new THREE.PointLight(0xfff6e8, 0, 40, 1.4);
  scene.add(cle, remplissage, contre, balayage, eclair);

  // ----- Le modèle -----
  const gltf = await new THREE.GLTFLoader().loadAsync(base + (mobile ? "modele/appareil-1k.gltf" : "modele/appareil-2k.gltf"));
  const groupe = new THREE.Group();
  scene.add(groupe);
  const objectif = new THREE.Group(); // tout ce qui sort pendant la vue éclatée
  groupe.add(objectif);

  const verre = new THREE.MeshPhysicalMaterial({
    color: 0x080a0e,
    metalness: 0,
    roughness: 0.02,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 0.7,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [260, 640],
    envMapIntensity: 2.2,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 1, roughness: 0.3, envMapIntensity: 1.2 });

  const maillages = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => o.isMesh && maillages.push(o));

  // Tranches de l'objectif, de la monture (arrière) vers l'avant
  const NB = 6;
  const zMin = 0.0108;
  const zMax = 0.0701;
  const pieces = []; // { m, ecart, sens }
  const verreObjectif = [];

  for (const o of maillages) {
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const pos = g.attributes.position;
    const idx = g.index ? Array.from(g.index.array) : Array.from({ length: pos.count }, (_, i) => i);
    const nomMat = o.material.name || "";
    let mat = o.material;
    if (nomMat === "Camera_01_lens") mat = verre;
    else if (mat.metalnessMap) {
      // la texture « ARM » contient aussi l'occlusion ambiante (canal rouge)
      mat.aoMap = mat.metalnessMap;
      mat.aoMapIntensity = 1;
      mat.envMapIntensity = 1;
    }
    const corps = [];
    const parTranche = Array.from({ length: NB }, () => []);
    const verreAvant = [];
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
      if (nomMat === "Camera_01_lens_body" || (nomMat === "Camera_01_strap" && dansObjectif)) {
        const n = Math.min(NB - 1, Math.max(0, Math.floor(((cz - zMin) / (zMax - zMin)) * NB)));
        parTranche[n].push(...tri);
      } else if (nomMat === "Camera_01_lens" && dansObjectif) {
        verreAvant.push(...tri);
      } else corps.push(...tri);
    }
    // Remise à l'échelle : centre du boîtier en 0, objectif vers -z
    g.translate(-CENTRE.x, -CENTRE.y, -CENTRE.z);
    g.rotateY(Math.PI);
    g.scale(K, K, K);
    if (corps.length) groupe.add(new THREE.Mesh(sousGeometrie(g, corps), mat));
    parTranche.forEach((tri, n) => {
      if (!tri.length) return;
      const m = new THREE.Mesh(sousGeometrie(g, tri), mat);
      objectif.add(m);
      pieces.push({ m, ecart: 0.35 + n * 1.0, sens: n % 2 ? 1 : -1 });
    });
    if (verreAvant.length) verreObjectif.push(new THREE.Mesh(sousGeometrie(g, verreAvant), mat));
  }
  verreObjectif.forEach((m) => {
    objectif.add(m);
    pieces.push({ m, ecart: NB * 1.0 + 1.1, sens: 1 });
  });

  // Lentilles intérieures : invisibles une fois monté, elles apparaissent quand l'objectif s'ouvre.
  const ax = -(AXE.x - CENTRE.x) * K;
  const ay = (AXE.y - CENTRE.y) * K;
  [
    [1.55, 0.32, -1.9, 1.5],
    [1.8, 0.4, -2.9, 2.6],
    [1.65, 0.34, -3.9, 3.7],
  ].forEach(([r, f, z, ecart]) => {
    const g = new THREE.Group();
    g.position.set(ax, ay, z);
    const avant = new THREE.Mesh(calotte(r, f), verre);
    const arriere = new THREE.Mesh(calotte(r, f * 0.7), verre);
    arriere.rotation.y = Math.PI;
    const bord = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 10, 72), chrome);
    g.add(avant, arriere, bord);
    g.visible = false;
    objectif.add(g);
    pieces.push({ m: g, ecart, sens: -1, interne: true });
  });
  pieces.forEach((p) => {
    p.z0 = p.m.position.z;
    p.y0 = p.m.position.y;
  });

  // Point de mire pour le flash : le centre de la lentille frontale
  const frontale = new THREE.Object3D();
  frontale.position.set(ax, ay, -6.0);
  groupe.add(frontale);
  const bordFrontale = new THREE.Object3D(); // un point du bord de la lentille (pour son rayon à l'écran)
  bordFrontale.position.set(ax + 2.0, ay, -6.0);
  groupe.add(bordFrontale);
  const tmp2 = new THREE.Vector3();

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
    const k = e.s || 1;
    const b = e.balayage;
    if (b > 0 && b < 1) {
      balayage.position.set(e.x + (-10 + 20 * b) * k, e.y + (3 - 2 * b) * k, e.z + 9 * k);
      balayage.distance = 30 * k;
      balayage.intensity = 200 * k * k * Math.sin(Math.PI * b);
    } else balayage.intensity = 0;
    eclair.position.set(e.x - 2 * k, e.y + 2 * k, e.z + 8 * k);
    eclair.distance = 40 * k;
    eclair.intensity = 380 * k * k * (e.flash || 0);

    // Vue éclatée (0 = monté, 1 = bagues et lentilles écartées)
    const x = e.eclate || 0;
    const vague = Math.sin(Math.PI * x);
    pieces.forEach((p) => {
      p.m.position.z = p.z0 - 1.15 * p.ecart * x;
      p.m.position.y = p.y0 + 0.16 * p.sens * vague;
      if (p.interne) p.m.visible = x > 0.02;
    });
    const zf = -6.0 - 1.15 * (NB * 1.0 + 1.1) * x; // la lentille frontale, là où elle flotte
    frontale.position.z = zf;
    bordFrontale.position.z = zf;
  }

  function projeter(nom) {
    if (nom === "objectif") frontale.getWorldPosition(tmp);
    else groupe.getWorldPosition(tmp);
    tmp.project(camera);
    const x = ((tmp.x + 1) / 2) * largeur;
    const y = ((1 - tmp.y) / 2) * hauteur;
    let r = 0;
    if (nom === "objectif") {
      bordFrontale.getWorldPosition(tmp2);
      tmp2.project(camera);
      r = Math.hypot(((tmp2.x + 1) / 2) * largeur - x, ((1 - tmp2.y) / 2) * hauteur - y);
    }
    return { x, y, r };
  }

  function rendre() {
    renderer.render(scene, camera);
  }

  renderer.compile(scene, camera);
  return { appliquer, rendre, redimensionner, projeter, renderer };
}
