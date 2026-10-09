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
// Bindings attendus (configurés sur le dashboard, jamais ici) :
//   - PHOTOS_BUCKET   : bucket R2 "galerie-photos"
//   - RATE_LIMIT_KV   : namespace KV "galerie-rate-limit"
// Secrets attendus (Settings → Variables and Secrets, "Encrypt") :
//   - ADMIN_PASSWORD  : mot de passe de /galerie-admin/
//   - SESSION_SECRET  : chaîne aléatoire longue, signe les sessions admin

const ALLOWED_ORIGINS = ["https://nicolasleveugle.be", "https://www.nicolasleveugle.be"];
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const LOGIN_RATE_LIMIT = { max: 5, windowSeconds: 15 * 60 };
const TOKEN_BYTES = 24; // 192 bits — jeton de galerie impossible à deviner

// ---------- CORS ----------

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
  galleries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json({ galleries }, 200, origin);
}

async function handleGetGalleryAdmin(env, id, origin) {
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  const gallery = data.galleries.find((g) => g.id === id);
  if (!gallery) return errorResponse("Galerie introuvable.", 404, origin);
  const photos = await listPhotos(env.PHOTOS_BUCKET, id);
  return json({ ...gallery, photos }, 200, origin);
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

  const id = randomToken(TOKEN_BYTES);
  const token = randomToken(TOKEN_BYTES);
  const createdAt = new Date().toISOString();
  const gallery = { id, token, name, title, createdAt };

  await writeIndexWithRetry(env.PHOTOS_BUCKET, (data) => {
    data.galleries.push(gallery);
    return data;
  });

  return json(gallery, 201, origin);
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
  return json({ ok: true }, 200, origin);
}

// ---------- Handlers : client (galerie privée, pas d'auth — le jeton
// dans l'URL en tient lieu, cf. checklist sécurité) ----------

async function handleGetClientGallery(env, token, origin) {
  if (!isValidToken(token)) return errorResponse("Galerie introuvable.", 404, origin);
  const data = await ensureMigratedIndex(env.PHOTOS_BUCKET);
  const gallery = data.galleries.find((g) => g.token === token);
  if (!gallery) return errorResponse("Galerie introuvable.", 404, origin);
  const photos = await listPhotos(env.PHOTOS_BUCKET, gallery.id);
  return json({ name: gallery.name, title: gallery.title, photos }, 200, origin);
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

      m = pathname.match(/^\/api\/gallery\/([^/]+)$/);
      if (m && request.method === "GET") {
        return handleGetClientGallery(env, m[1], origin);
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
