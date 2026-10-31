// Prépare des versions plus légères de chaque photo du site, pour que les
// téléphones et tablettes ne téléchargent pas l'original en entier.
//
// - Les originaux dans images/ ne sont JAMAIS modifiés : le site continue de
//   les servir aux écrans qui en ont besoin (grand écran, écran Retina).
// - Pour chaque photo, on crée dans images/tailles/ des copies WebP à
//   plusieurs largeurs (qualité 90, profil couleur d'origine conservé), et
//   on note dans content/images.json ce qui existe. Le navigateur choisit
//   ensuite lui-même la plus petite version qui reste nette sur son écran.
// - Les copies d'une photo supprimée ou remplacée sont supprimées / refaites.
// - Régénère aussi sitemap.xml à partir de la liste des pages.
//
// Lancé automatiquement par .github/workflows/images.yml après chaque envoi
// sur GitHub (donc aussi après un ajout de photo depuis l'admin). Pour le
// lancer à la main : cd outils && npm ci && node optimiser-images.mjs

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER_IMAGES = "images";
const DOSSIER_TAILLES = "images/tailles";
const MANIFESTE = "content/images.json";
const SITE = "https://nicolasleveugle.be/";

const LARGEURS = [480, 800, 1200, 1600, 2400];
const QUALITE_WEBP = 90;
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const abs = (p) => path.join(RACINE, p);
const posix = (p) => p.split(path.sep).join("/");

async function listerPhotos(dossier) {
  const resultats = [];
  let entrees;
  try {
    entrees = await fs.readdir(abs(dossier), { withFileTypes: true });
  } catch {
    return resultats;
  }
  for (const e of entrees) {
    const rel = posix(path.join(dossier, e.name));
    if (e.isDirectory()) {
      if (rel === DOSSIER_TAILLES) continue;
      resultats.push(...(await listerPhotos(rel)));
    } else if (EXTENSIONS.has(path.extname(e.name).toLowerCase())) {
      resultats.push(rel);
    }
  }
  return resultats;
}

function cheminTaille(source, largeur) {
  const sansExt = source.slice(DOSSIER_IMAGES.length + 1).replace(/\.[^.]+$/, "");
  return `${DOSSIER_TAILLES}/${sansExt}-${largeur}.webp`;
}

async function lireManifeste() {
  try {
    return JSON.parse(await fs.readFile(abs(MANIFESTE), "utf8")).images || {};
  } catch {
    return {};
  }
}

async function existe(p) {
  try {
    await fs.access(abs(p));
    return true;
  } catch {
    return false;
  }
}

async function traiterPhoto(source, ancien) {
  const contenu = await fs.readFile(abs(source));
  const empreinte = createHash("sha1").update(contenu).digest("hex").slice(0, 12);

  // Dimensions telles qu'affichées (après rotation EXIF éventuelle).
  const meta = await sharp(contenu).metadata();
  const tourne = (meta.orientation || 1) >= 5;
  const l = tourne ? meta.height : meta.width;
  const h = tourne ? meta.width : meta.height;

  // Pas de copie presque aussi grande que l'original : il fait l'affaire.
  const tailles = LARGEURS.filter((w) => w <= l * 0.9);

  const aJour =
    ancien &&
    ancien.empreinte === empreinte &&
    JSON.stringify(ancien.tailles) === JSON.stringify(tailles) &&
    (await Promise.all(tailles.map((w) => existe(cheminTaille(source, w))))).every(Boolean);

  if (!aJour) {
    for (const w of tailles) {
      const sortie = cheminTaille(source, w);
      await fs.mkdir(path.dirname(abs(sortie)), { recursive: true });
      await sharp(contenu)
        .rotate()
        .resize({ width: w, kernel: "lanczos3" })
        .keepIccProfile()
        .webp({ quality: QUALITE_WEBP, effort: 6, smartSubsample: true })
        .toFile(abs(sortie));
    }
    console.log(`${source} (${l}×${h}) → ${tailles.length ? tailles.join(", ") + " px" : "assez petite, gardée telle quelle"}`);
  }
  return { l, h, tailles, empreinte };
}

async function nettoyerTailles(attendues) {
  const toutes = [];
  async function parcourir(dossier) {
    let entrees;
    try {
      entrees = await fs.readdir(abs(dossier), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entrees) {
      const rel = posix(path.join(dossier, e.name));
      if (e.isDirectory()) await parcourir(rel);
      else toutes.push(rel);
    }
  }
  await parcourir(DOSSIER_TAILLES);
  for (const f of toutes) {
    if (!attendues.has(f)) {
      await fs.unlink(abs(f));
      console.log(`supprimé : ${f}`);
    }
  }
}

// Une page dont le contenu change selon l'univers (particuliers /
// commerces) a deux adresses : services.html et services.html?pour=commerces.
async function aDesUnivers(slug) {
  try {
    const page = JSON.parse(await fs.readFile(abs(`content/pages/${slug}.json`), "utf8"));
    return (page.sections || []).some((s) => s.tab || s.type === "contact");
  } catch {
    return false;
  }
}

async function genererSitemap() {
  const site = JSON.parse(await fs.readFile(abs("content/site.json"), "utf8"));
  const urls = [];
  for (const p of site.pages || []) {
    if (p.slug === "index") {
      urls.push(SITE);
      continue;
    }
    urls.push(`${SITE}${p.slug}.html`);
    if (await aDesUnivers(p.slug)) urls.push(`${SITE}${p.slug}.html?pour=commerces`);
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>\n`).join("") +
    `</urlset>\n`;
  await fs.writeFile(abs("sitemap.xml"), xml);
}

const ancien = await lireManifeste();
const photos = (await listerPhotos(DOSSIER_IMAGES)).sort();
const images = {};
const attendues = new Set();
for (const source of photos) {
  try {
    images[source] = await traiterPhoto(source, ancien[source]);
    images[source].tailles.forEach((w) => attendues.add(cheminTaille(source, w)));
  } catch (err) {
    console.error(`⚠ ${source} ignorée : ${err.message}`);
  }
}
await nettoyerTailles(attendues);
await fs.writeFile(abs(MANIFESTE), JSON.stringify({ images }, null, 2) + "\n");
await genererSitemap();
console.log(`${photos.length} photos, manifeste et sitemap à jour.`);
