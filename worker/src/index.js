// Worker "galerie-api" — API privée entre le site et le bucket R2
// "galerie-photos". Aucune photo n'est jamais exposée par une URL publique
// du bucket : tout passe par ce Worker, qui vérifie l'autorisation avant
// de streamer le moindre octet.
//
// Déploiement : ce fichier est pensé pour être collé tel quel dans
// l'éditeur "Quick edit" du Worker sur le dashboard Cloudflare (aucune
// étape de build). Il peut aussi être déployé avec `wrangler deploy`
// depuis ce dossier (voir wrangler.toml) si tu préfères la ligne de
// commande plus tard.
//
// Accès aux galeries : un seul lien par galerie, « invité » (lien seul : voir et
// télécharger, sans les cœurs) ou « client » (mot de passe de la galerie : cœurs
// + retrouver le shooting dans l'espace client). Une galerie sans mot de passe
// (anciennes galeries) s'ouvre directement, comme avant.
//
// Bindings attendus (configurés sur le dashboard, jamais ici) :
//   - PHOTOS_BUCKET   : bucket R2 "galerie-photos"
//   - RATE_LIMIT_KV   : namespace KV "galerie-rate-limit"
// Secrets attendus (Settings → Variables and Secrets, "Encrypt") :
//   - ADMIN_PASSWORD  : mot de passe de /galerie-admin/
//   - SESSION_SECRET  : chaîne aléatoire longue, signe les sessions admin
//   - CF_API_TOKEN    : (facultatif) jeton API Cloudflare « Account Analytics:
//                       Read », pour afficher les statistiques de visite dans
//                       l'admin du site
// Variable (texte simple) :
//   - CF_ACCOUNT_ID   : (facultatif) identifiant du compte Cloudflare, avec
//                       CF_API_TOKEN

const ALLOWED_ORIGINS = ["https://nicolasleveugle.be", "https://www.nicolasleveugle.be"];
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const LOGIN_RATE_LIMIT = { max: 5, windowSeconds: 15 * 60 };
const TOKEN_BYTES = 24; // 192 bits — jeton de galerie impossible à deviner

// ---------- CORS ----------

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cle-Client",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

function errorResponse(message, status, origin) {
  return json({ error: message }, status, origin);
}

// ---------- Aléatoire / encodage ----------

function base64url(bytes) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function randomToken(byteLength) {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const len = Math.max(a.length, b.length);
  let result = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    result |= ca ^ cb;
  }
  return result === 0;
}

// ---------- Session admin (HMAC, sans dépendance) ----------

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function createSessionToken(secret) {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_DURATION_MS });
  const payloadB64 = base64url(new TextEncoder().encode(payload));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64url(new Uint8Array(sig))}`;
}

async function verifySessionToken(token, secret) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payloadB64, sigB64] = token.split(".");
  const key = await hmacKey(secret);
  const expectedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  if (!timingSafeEqual(base64url(new Uint8Array(expectedSig)), sigB64)) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

async function requireAuth(request, env, origin, handler) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const valid = await verifySessionToken(token, env.SESSION_SECRET);
  if (!valid) return errorResponse("Non autorisé — reconnecte-toi.", 401, origin);
  return handler();
}

// ---------- Accès « client » et « invité » ----------
// Un seul lien par galerie. Qui a le lien est « invité » : il voit et
// télécharge les photos, sans les cœurs (la sélection appartient au client).
// Qui tape le mot de passe de la galerie devient « client » : il reçoit une
// clé (HMAC, liée à l'id de la galerie ET au mot de passe, donc changer le mot
// de passe annule toutes les clés déjà distribuées) que son navigateur
// mémorise pour retrouver le shooting dans l'espace client. Une galerie sans
// mot de passe (anciennes galeries) reste ouverte directement, comme avant.

const CLIENT_LOGIN_RATE_LIMIT = { max: 8, windowSeconds: 15 * 60 };
const MAX_CLES_ESPACE = 50;
const MOTS_DEBUT = [
  "pivoine", "lavande", "olivier", "cerise", "amande", "noisette", "citron", "abricot", "jasmin", "tilleul",
  "bleuet", "mimosa", "figuier", "coquelicot", "muguet", "glycine", "myrtille", "pommier", "romarin", "violette",
];
const MOTS_FIN = [
  "sable", "ocre", "soleil", "brume", "rosee", "nacre", "lagon", "falaise", "prairie", "aurore",
  "horizon", "lumiere", "dune", "criquet", "ruisseau", "colline", "marais", "plage", "bruyere", "etoile",
];

function entierAleatoire(max) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

// Ex : « Pivoine-Sable-48 » : facile à lire, à dicter et à taper sur un téléphone.
function genererMotDePasse() {
  const mot = (liste) => liste[entierAleatoire(liste.length)];
  const debut = mot(MOTS_DEBUT);
  return `${debut[0].toUpperCase()}${debut.slice(1)}-${mot(MOTS_FIN).replace(/^./, (c) => c.toUpperCase())}-${10 + entierAleatoire(90)}`;
}

// Majuscules, espaces autour : sans importance (les claviers de téléphone corrigent tout seuls).
function normaliserMotDePasse(s) {
  return String(s || "").trim().toLowerCase();
}

async function signerAccesClient(env, gallery) {
  const key = await hmacKey(env.SESSION_SECRET);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`client:${gallery.id}:${normaliserMotDePasse(gallery.motdepasse)}`)
  );
  return `${gallery.id}.${base64url(new Uint8Array(sig))}`;
}

async function cleClientValide(env, gallery, cle) {
  if (!gallery || !gallery.motdepasse || typeof cle !== "string" || cle.length > 200) return false;
  return timingSafeEqual(cle, await signerAccesClient(env, gallery));
}

// Valide un mot de passe saisi par Nicolas (4 à 64 caractères).
function motDePasseSaisi(valeur) {
  const v = String(valeur || "").trim();
  if (v.length < 4 || v.length > 64) return null;
  return v;
}

// ---------- Limitation des tentatives de connexion (KV) ----------

async function checkRateLimit(kv, key, max, windowSeconds) {
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= max) return false;
  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return true;
}

// ---------- Clés R2 ----------

function galleryPrefix(id) {
  return `galleries/${id}/`;
}
function originalsPrefix(id) {
  return `galleries/${id}/originals/`;
}
function thumbsPrefix(id) {
  return `galleries/${id}/thumbs/`;
}
function originalKey(id, filename) {
  return `${originalsPrefix(id)}${filename}`;
}
function thumbKey(id, filename) {
  return `${thumbsPrefix(id)}${filename}`;
}

function sanitizeFilename(name) {
  const cleaned = String(name || "photo")
    .toLowerCase()
    .replace(/[^a-z0-9.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return cleaned || "photo";
}

// ---------- Favoris du client (galleries/<id>/favoris.json) ----------

const MAX_FAVORIS = 2000;

function favorisKey(id) {
  return `${galleryPrefix(id)}favoris.json`;
}

async function readFavoris(bucket, id) {
  const obj = await bucket.get(favorisKey(id));
  if (!obj) return { photos: [], updatedAt: null };
  try {
    const data = await obj.json();
    return { photos: Array.isArray(data.photos) ? data.photos : [], updatedAt: data.updatedAt || null };
  } catch {
    return { photos: [], updatedAt: null };
  }
}

function isValidToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(token);
}

// ---------- Index des galeries (galleries/index.json), écriture sûre ----------

async function readIndex(bucket) {
  const obj = await bucket.get("galleries/index.json");
  if (!obj) return { data: { galleries: [] }, etag: null };
  const data = await obj.json();
  if (!Array.isArray(data.galleries)) data.galleries = [];
  return { data, etag: obj.etag };
}

// Lecture-modification-écriture avec contrôle de concurrence optimiste
// (R2 refuse l'écriture — et renvoie null — si l'objet a changé entre la
// lecture et l'écriture ; on relit et on réessaie).
async function writeIndexWithRetry(bucket, mutateFn, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const { data, etag } = await readIndex(bucket);
    const mutated = mutateFn(JSON.parse(JSON.stringify(data)));
    const putOptions = {
      httpMetadata: { contentType: "application/json" },
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotExist: true },
    };
    const result = await bucket.put("galleries/index.json", JSON.stringify(mutated, null, 2), putOptions);
    if (result !== null) return mutated;
  }
  throw new Error("Conflit d'écriture sur l'index des galeries, réessaie.");
}

// Galeries créées avant l'introduction de l'id stable (séparé du token) :
// elles n'ont qu'un "token" en mémoire. On leur attribue, une seule fois,
// un id égal à ce token (c'est déjà le préfixe R2 utilisé pour leurs
// photos), pour qu'elles redeviennent gérables par id comme les autres.
async function ensureMigratedIndex(bucket) {
  const { data } = await readIndex(bucket);
  if (!data.galleries.some((g) => !g.id)) return data;
  return writeIndexWithRetry(bucket, (d) => {
    d.galleries.forEach((g) => {
      if (!g.id) g.id = g.token;
    });
    return d;
  });
}

async function countPhotos(bucket, id) {
  let count = 0;
  let cursor;
  do {
    const listed = await bucket.list({ prefix: originalsPrefix(id), cursor, limit: 1000 });
    count += listed.objects.length;
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return count;
}

async function listPhotos(bucket, id) {
  const photos = [];
  let cursor;
  do {
    const listed = await bucket.list({ prefix: originalsPrefix(id), cursor, limit: 1000 });
    for (const obj of listed.objects) {
      photos.push({
        filename: obj.key.slice(originalsPrefix(id).length),
        size: obj.size,
        uploadedAt: obj.uploaded,
      });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  photos.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
  return photos;
}

// ---------- Handlers : admin ----------

async function handleLogin(request, env, origin) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const allowed = await checkRateLimit(
    env.RATE_LIMIT_KV,
    `ratelimit:login:${ip}`,
    LOGIN_RATE_LIMIT.max,
    LOGIN_RATE_LIMIT.windowSeconds
  );
  if (!allowed) return errorResponse("Trop de tentatives. Réessaie dans quelques minutes.", 429, origin);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Requête invalide.", 400, origin);
  }
  const password = typeof body?.password === "string" ? body.password : "";
  if (!env.ADMIN_PASSWORD || !timingSafeEqual(password, env.ADMIN_PASSWORD)) {
    return errorResponse("Mot de passe incorrect.", 401, origin);
  }
  const token = await createSessionToken(env.SESSION_SECRET);
  return json({ token }, 200, origin);
}

async function handleListGalleries(env, origin) {
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  const galleries = await Promise.all(
    data.galleries.map(async (g) => ({
      ...g,
      photoCount: await countPhotos(env.PHOTOS_BUCKET, g.id),
    }))
  );
  await Promise.all(
    galleries.map(async (g) => {
      g.favoriteCount = (await readFavoris(env.PHOTOS_BUCKET, g.id)).photos.length;
    })
  );
  galleries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json({ galleries }, 200, origin);
}

async function handleGetGalleryAdmin(env, id, origin) {
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  const gallery = data.galleries.find((g) => g.id === id);
  if (!gallery) return errorResponse("Galerie introuvable.", 404, origin);
  const photos = await listPhotos(env.PHOTOS_BUCKET, id);
  const favoris = await readFavoris(env.PHOTOS_BUCKET, id);
  const existantes = new Set(photos.map((p) => p.filename));
  return json({ ...gallery, photos, favoris: favoris.photos.filter((f) => existantes.has(f)), favorisUpdatedAt: favoris.updatedAt }, 200, origin);
}

async function handleCreateGallery(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Requête invalide.", 400, origin);
  }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!name) return errorResponse("Le nom du client est requis.", 400, origin);

  // Mot de passe client : choisi par Nicolas, sinon proposé au hasard.
  let motdepasse;
  if (typeof body?.motdepasse === "string" && body.motdepasse.trim()) {
    motdepasse = motDePasseSaisi(body.motdepasse);
    if (!motdepasse) return errorResponse("Le mot de passe doit faire entre 4 et 64 caractères.", 400, origin);
  } else {
    motdepasse = genererMotDePasse();
  }

  const id = randomToken(TOKEN_BYTES);
  const token = randomToken(TOKEN_BYTES);
  const createdAt = new Date().toISOString();
  const gallery = { id, token, name, title, createdAt, motdepasse };

  await writeIndexWithRetry(env.PHOTOS_BUCKET, (data) => {
    data.galleries.push(gallery);
    return data;
  });

  return json(gallery, 201, origin);
}

// Modifie le nom, le titre, le mot de bienvenue ou le mot de passe client d'une galerie (champs facultatifs).
async function handleUpdateGallery(request, env, id, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Requête invalide.", 400, origin);
  }
  const champs = {};
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return errorResponse("Le nom du client est requis.", 400, origin);
    champs.name = name.slice(0, 120);
  }
  if (typeof body?.title === "string") champs.title = body.title.trim().slice(0, 200);
  if (typeof body?.message === "string") champs.message = body.message.trim().slice(0, 1500);
  // Mot de passe client : vide = galerie ouverte à tous ceux qui ont le lien (sans espace client).
  if (typeof body?.motdepasse === "string") {
    if (!body.motdepasse.trim()) champs.motdepasse = undefined;
    else {
      const mdp = motDePasseSaisi(body.motdepasse);
      if (!mdp) return errorResponse("Le mot de passe doit faire entre 4 et 64 caractères.", 400, origin);
      champs.motdepasse = mdp;
    }
  }
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  if (!data.galleries.some((g) => g.id === id)) return errorResponse("Galerie introuvable.", 404, origin);
  const maj = await writeIndexWithRetry(env.PHOTOS_BUCKET, (d) => {
    const g = d.galleries.find((x) => x.id === id);
    if (g) Object.assign(g, champs);
    return d;
  });
  return json(maj.galleries.find((g) => g.id === id), 200, origin);
}

async function handleDeleteGallery(env, id, origin) {
  const prefix = galleryPrefix(id);
  let cursor;
  do {
    const listed = await env.PHOTOS_BUCKET.list({ prefix, cursor, limit: 1000 });
    if (listed.objects.length) {
      await env.PHOTOS_BUCKET.delete(listed.objects.map((o) => o.key));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  await writeIndexWithRetry(env.PHOTOS_BUCKET, (data) => {
    data.galleries = data.galleries.filter((g) => g.id !== id);
    return data;
  });

  return json({ ok: true }, 200, origin);
}

async function handleRegenerateLink(env, id, origin) {
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  if (!data.galleries.some((g) => g.id === id)) {
    return errorResponse("Galerie introuvable.", 404, origin);
  }

  const newToken = randomToken(TOKEN_BYTES);
  await writeIndexWithRetry(env.PHOTOS_BUCKET, (data2) => {
    const gallery = data2.galleries.find((g) => g.id === id);
    if (gallery) gallery.token = newToken;
    return data2;
  });

  return json({ token: newToken }, 200, origin);
}

async function handleUploadPhoto(request, env, id, origin) {
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  if (!data.galleries.some((g) => g.id === id)) {
    return errorResponse("Galerie introuvable.", 404, origin);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Formulaire invalide.", 400, origin);
  }
  const originalFile = form.get("original");
  const thumbFile = form.get("thumb");
  if (!(originalFile instanceof File) || !(thumbFile instanceof File)) {
    return errorResponse("Photo originale et miniature requises.", 400, origin);
  }
  const rawFilename = (form.get("filename") || originalFile.name || "photo.jpg").toString();
  const filename = `${Date.now()}-${sanitizeFilename(rawFilename)}`;

  await env.PHOTOS_BUCKET.put(originalKey(id, filename), originalFile, {
    httpMetadata: { contentType: originalFile.type || "image/jpeg" },
  });
  await env.PHOTOS_BUCKET.put(thumbKey(id, filename), thumbFile, {
    httpMetadata: { contentType: thumbFile.type || "image/jpeg" },
  });

  return json({ filename }, 201, origin);
}

async function handleDeletePhoto(env, id, filename, origin) {
  await env.PHOTOS_BUCKET.delete([originalKey(id, filename), thumbKey(id, filename)]);
  // La photo n'existe plus : elle sort aussi des favoris du client.
  const favoris = await readFavoris(env.PHOTOS_BUCKET, id);
  if (favoris.photos.includes(filename)) {
    await env.PHOTOS_BUCKET.put(
      favorisKey(id),
      JSON.stringify({ photos: favoris.photos.filter((f) => f !== filename), updatedAt: favoris.updatedAt }),
      { httpMetadata: { contentType: "application/json" } }
    );
  }
  return json({ ok: true }, 200, origin);
}

// ---------- Handlers : client (galerie privée, pas d'auth — le jeton
// dans l'URL en tient lieu, cf. checklist sécurité) ----------

async function handleGetClientGallery(request, env, token, origin) {
  if (!isValidToken(token)) return errorResponse("Galerie introuvable.", 404, origin);
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  const gallery = data.galleries.find((g) => g.token === token);
  if (!gallery) return errorResponse("Galerie introuvable.", 404, origin);
  const protegee = Boolean(gallery.motdepasse);
  const client = await cleClientValide(env, gallery, request.headers.get("X-Cle-Client"));
  // Galerie protégée : seul le client (mot de passe tapé) a les cœurs. L'invité voit et télécharge.
  const peutFavoris = !protegee || client;
  const photos = await listPhotos(env.PHOTOS_BUCKET, gallery.id);
  const favoris = peutFavoris ? await readFavoris(env.PHOTOS_BUCKET, gallery.id) : { photos: [] };
  const existantes = new Set(photos.map((p) => p.filename));
  return json(
    { name: gallery.name, title: gallery.title, message: gallery.message || "", photos, favoris: favoris.photos.filter((f) => existantes.has(f)), protegee, client, peutFavoris },
    200,
    origin
  );
}

// Écran de choix « client / invité » : le nom, le titre et la photo de couverture
// seulement (pas la liste des photos). Le lien privé suffit à les voir.
async function handleGalleryAccueil(env, token, origin) {
  if (!isValidToken(token)) return errorResponse("Galerie introuvable.", 404, origin);
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  const gallery = data.galleries.find((g) => g.token === token);
  if (!gallery) return errorResponse("Galerie introuvable.", 404, origin);
  const photos = await listPhotos(env.PHOTOS_BUCKET, gallery.id);
  return json(
    { name: gallery.name, title: gallery.title || "", protegee: Boolean(gallery.motdepasse), couverture: photos[0] ? photos[0].filename : null },
    200,
    origin
  );
}

// « Je suis le client » : le mot de passe donne une clé que le navigateur mémorise.
async function handleClientLogin(request, env, token, origin) {
  if (!isValidToken(token)) return errorResponse("Galerie introuvable.", 404, origin);
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  const gallery = data.galleries.find((g) => g.token === token);
  if (!gallery) return errorResponse("Galerie introuvable.", 404, origin);
  if (!gallery.motdepasse) return errorResponse("Cette galerie n'a pas de mot de passe.", 400, origin);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const autorise = await checkRateLimit(
    env.RATE_LIMIT_KV,
    `ratelimit:client:${ip}:${gallery.id}`,
    CLIENT_LOGIN_RATE_LIMIT.max,
    CLIENT_LOGIN_RATE_LIMIT.windowSeconds
  );
  if (!autorise) return errorResponse("Trop de tentatives. Réessayez dans quelques minutes.", 429, origin);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Requête invalide.", 400, origin);
  }
  const saisi = normaliserMotDePasse(body?.motdepasse);
  if (!saisi || !timingSafeEqual(saisi, normaliserMotDePasse(gallery.motdepasse))) {
    return errorResponse("Mot de passe incorrect.", 401, origin);
  }
  return json({ cle: await signerAccesClient(env, gallery) }, 200, origin);
}

// Espace client : le navigateur envoie les clés qu'il a mémorisées, on renvoie
// les shootings correspondants. Une clé dont le mot de passe a changé, ou dont
// la galerie n'existe plus, est renvoyée dans « perimees » pour être oubliée.
async function handleEspaceClient(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Requête invalide.", 400, origin);
  }
  const cles = Array.isArray(body?.cles) ? body.cles.filter((c) => typeof c === "string").slice(0, MAX_CLES_ESPACE) : [];
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  const perimees = [];
  const trouvees = [];
  for (const cle of cles) {
    const gallery = data.galleries.find((g) => g.id === cle.split(".")[0]);
    if (gallery && (await cleClientValide(env, gallery, cle))) trouvees.push({ cle, gallery });
    else perimees.push(cle);
  }
  const galeries = await Promise.all(
    trouvees.map(async ({ cle, gallery }) => {
      const photos = await listPhotos(env.PHOTOS_BUCKET, gallery.id);
      return {
        cle,
        token: gallery.token,
        name: gallery.name,
        title: gallery.title || "",
        createdAt: gallery.createdAt,
        photoCount: photos.length,
        couverture: photos[0] ? photos[0].filename : null,
      };
    })
  );
  galeries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json({ galeries, perimees }, 200, origin);
}

// Le client enregistre ses favoris (le jeton privé de la galerie fait office d'accès,
// comme pour voir les photos). On ne garde que des noms de photos qui existent.
async function handleSaveFavoris(request, env, token, origin) {
  if (!isValidToken(token)) return errorResponse("Galerie introuvable.", 404, origin);
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  const gallery = data.galleries.find((g) => g.token === token);
  if (!gallery) return errorResponse("Galerie introuvable.", 404, origin);
  if (gallery.motdepasse && !(await cleClientValide(env, gallery, request.headers.get("X-Cle-Client")))) {
    return errorResponse("Les favoris sont réservés au client de la galerie.", 403, origin);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Requête invalide.", 400, origin);
  }
  if (!Array.isArray(body?.photos) || body.photos.length > MAX_FAVORIS) return errorResponse("Liste de favoris invalide.", 400, origin);
  const existantes = new Set((await listPhotos(env.PHOTOS_BUCKET, gallery.id)).map((p) => p.filename));
  const photos = [...new Set(body.photos.filter((f) => typeof f === "string" && existantes.has(f)))];
  const updatedAt = new Date().toISOString();
  await env.PHOTOS_BUCKET.put(favorisKey(gallery.id), JSON.stringify({ photos, updatedAt }), {
    httpMetadata: { contentType: "application/json" },
  });
  return json({ photos, updatedAt }, 200, origin);
}

async function handleGetPhoto(env, token, filename, searchParams, origin) {
  if (!isValidToken(token)) return errorResponse("Photo introuvable.", 404, origin);
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  const gallery = data.galleries.find((g) => g.token === token);
  if (!gallery) return errorResponse("Photo introuvable.", 404, origin);
  const variant = searchParams.get("variant") === "thumb" ? "thumb" : "original";
  const key = variant === "thumb" ? thumbKey(gallery.id, filename) : originalKey(gallery.id, filename);
  const obj = await env.PHOTOS_BUCKET.get(key);
  if (!obj) return errorResponse("Photo introuvable.", 404, origin);

  const headers = new Headers(corsHeaders(origin));
  headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "private, max-age=3600");
  if (searchParams.get("download") === "1") {
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  }
  return new Response(obj.body, { headers });
}

// ---------- Statistiques de visite (admin du site) ----------
// Cloudflare Web Analytics, lu avec l'API GraphQL de Cloudflare. Le
// navigateur ne peut pas l'appeler lui-même (pas de CORS, et le jeton doit
// rester secret) : l'admin passe par ici, avec la session admin.

const GRAPHQL_CLOUDFLARE = "https://api.cloudflare.com/client/v4/graphql";

async function handleStats(env, searchParams, origin) {
  if (!env.CF_API_TOKEN || !/^[0-9a-f]{32}$/i.test(env.CF_ACCOUNT_ID || "")) {
    return errorResponse("Statistiques non configurées sur le Worker (CF_API_TOKEN et CF_ACCOUNT_ID).", 501, origin);
  }
  const jours = Math.min(90, Math.max(1, parseInt(searchParams.get("jours"), 10) || 30));
  const fin = new Date();
  const debut = new Date(fin.getTime() - jours * 24 * 60 * 60 * 1000);
  const filtre = `{AND: [{datetime_geq: "${debut.toISOString()}", datetime_leq: "${fin.toISOString()}"}, {bot: 0}]}`;
  const groupe = (alias, limite, tri, champs) =>
    `${alias}: rumPageloadEventsAdaptiveGroups(limit: ${limite}, filter: ${filtre}${tri ? `, orderBy: [${tri}]` : ""}) { count sum { visits } ${champs} }`;
  const query = `{ viewer { accounts(filter: {accountTag: "${env.CF_ACCOUNT_ID}"}) {
    ${groupe("total", 1, "", "")}
    ${groupe("parJour", 100, "date_ASC", "dimensions { date }")}
    ${groupe("pages", 12, "count_DESC", "dimensions { requestPath }")}
    ${groupe("sources", 10, "count_DESC", "dimensions { refererHost }")}
    ${groupe("appareils", 5, "count_DESC", "dimensions { deviceType }")}
    ${groupe("pays", 8, "count_DESC", "dimensions { countryName }")}
  } } }`;
  const res = await fetch(GRAPHQL_CLOUDFLARE, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const corps = await res.json().catch(() => ({}));
  if (!res.ok || (corps.errors && corps.errors.length)) {
    const detail = (corps.errors && corps.errors[0] && corps.errors[0].message) || `HTTP ${res.status}`;
    return errorResponse(`Cloudflare a refusé la demande de statistiques : ${detail}`, 502, origin);
  }
  const compte = (corps.data && corps.data.viewer && corps.data.viewer.accounts && corps.data.viewer.accounts[0]) || {};
  const ligne = (g, cle) => ({ nom: cle ? g.dimensions[cle] : undefined, vues: g.count || 0, visites: (g.sum && g.sum.visits) || 0 });
  const liste = (nomGroupe, cle) => (compte[nomGroupe] || []).map((g) => ligne(g, cle));
  const total = (compte.total && compte.total[0]) || { count: 0, sum: { visits: 0 } };
  return json(
    {
      jours,
      depuis: debut.toISOString(),
      total: { vues: total.count || 0, visites: (total.sum && total.sum.visits) || 0 },
      parJour: liste("parJour", "date"),
      pages: liste("pages", "requestPath"),
      sources: liste("sources", "refererHost"),
      appareils: liste("appareils", "deviceType"),
      pays: liste("pays", "countryName"),
    },
    200,
    origin
  );
}

// ---------- Routeur ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    try {
      if (pathname === "/" && request.method === "GET") {
        return new Response("Galerie API — OK", { headers: corsHeaders(origin) });
      }

      if (pathname === "/api/admin/login" && request.method === "POST") {
        return handleLogin(request, env, origin);
      }

      if (pathname === "/api/admin/stats" && request.method === "GET") {
        return requireAuth(request, env, origin, () => handleStats(env, url.searchParams, origin));
      }

      if (pathname === "/api/admin/galleries" && request.method === "GET") {
        return requireAuth(request, env, origin, () => handleListGalleries(env, origin));
      }
      if (pathname === "/api/admin/galleries" && request.method === "POST") {
        return requireAuth(request, env, origin, () => handleCreateGallery(request, env, origin));
      }

      let m = pathname.match(/^\/api\/admin\/galleries\/([^/]+)$/);
      if (m && request.method === "GET") {
        return requireAuth(request, env, origin, () => handleGetGalleryAdmin(env, m[1], origin));
      }
      if (m && request.method === "PUT") {
        return requireAuth(request, env, origin, () => handleUpdateGallery(request, env, m[1], origin));
      }
      if (m && request.method === "DELETE") {
        return requireAuth(request, env, origin, () => handleDeleteGallery(env, m[1], origin));
      }

      m = pathname.match(/^\/api\/admin\/galleries\/([^/]+)\/regenerate-link$/);
      if (m && request.method === "POST") {
        return requireAuth(request, env, origin, () => handleRegenerateLink(env, m[1], origin));
      }

      m = pathname.match(/^\/api\/admin\/galleries\/([^/]+)\/photos$/);
      if (m && request.method === "POST") {
        return requireAuth(request, env, origin, () => handleUploadPhoto(request, env, m[1], origin));
      }

      m = pathname.match(/^\/api\/admin\/galleries\/([^/]+)\/photos\/([^/]+)$/);
      if (m && request.method === "DELETE") {
        return requireAuth(request, env, origin, () => handleDeletePhoto(env, m[1], m[2], origin));
      }

      if (pathname === "/api/admin/mot-de-passe" && request.method === "GET") {
        return requireAuth(request, env, origin, () => json({ motdepasse: genererMotDePasse() }, 200, origin));
      }

      if (pathname === "/api/espace" && request.method === "POST") {
        return handleEspaceClient(request, env, origin);
      }

      m = pathname.match(/^\/api\/gallery\/([^/]+)$/);
      if (m && request.method === "GET") {
        return handleGetClientGallery(request, env, m[1], origin);
      }

      m = pathname.match(/^\/api\/gallery\/([^/]+)\/accueil$/);
      if (m && request.method === "GET") {
        return handleGalleryAccueil(env, m[1], origin);
      }

      m = pathname.match(/^\/api\/gallery\/([^/]+)\/client$/);
      if (m && request.method === "POST") {
        return handleClientLogin(request, env, m[1], origin);
      }

      m = pathname.match(/^\/api\/gallery\/([^/]+)\/favoris$/);
      if (m && request.method === "POST") {
        return handleSaveFavoris(request, env, m[1], origin);
      }

      m = pathname.match(/^\/api\/gallery\/([^/]+)\/photo\/([^/]+)$/);
      if (m && request.method === "GET") {
        return handleGetPhoto(env, m[1], m[2], url.searchParams, origin);
      }

      return errorResponse("Introuvable.", 404, origin);
    } catch (err) {
      console.error(err);
      return errorResponse("Erreur serveur.", 500, origin);
    }
  },
};
