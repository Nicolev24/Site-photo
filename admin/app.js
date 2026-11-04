// Admin maison — pas de dépendance externe. Utilise un token d'accès
// personnel GitHub (stocké uniquement dans ce navigateur) pour lire et
// écrire directement les fichiers content/*.json (et uploader des images)
// via l'API REST de GitHub, appelée depuis le navigateur.

const OWNER = "Nicolev24";
const REPO = "Site-photo";
const BRANCH = "main";
const TOKEN_KEY = "site-photo-admin-token";

const SECTION_TYPES = [
  {
    value: "hero",
    label: "Bannière d'accueil (hero)",
    defaultData: () => ({
      image: "", alt: "", eyebrow: "", title_line1: "", title_line2: "",
      subtitle: "", button_label: "", button_href: "",
    }),
  },
  {
    value: "texte_image",
    label: "Texte + image",
    defaultData: () => ({
      eyebrow: "", title: "", text: "", image: "", alt: "",
      image_side: "droite", button_label: "", button_href: "",
    }),
  },
  {
    value: "texte",
    label: "Texte (en-tête de page)",
    defaultData: () => ({ eyebrow: "", title: "", text: "" }),
  },
  {
    value: "tarifs",
    label: "Tarifs / formules",
    defaultData: () => ({ plans: [], note: "" }),
  },
  {
    value: "cta",
    label: "Bandeau d'appel à l'action",
    defaultData: () => ({ title: "", text: "", button_label: "", button_href: "" }),
  },
  {
    value: "contact",
    label: "Coordonnées + formulaire de contact",
    defaultData: () => ({ coordonnees_title: "Coordonnées", formulaire_title: "Formulaire de contact" }),
  },
  {
    value: "texte_juridique",
    label: "Texte juridique (mentions légales, CGV...)",
    defaultData: () => ({ blocks: [{ type: "paragraph", text: "" }] }),
  },
  {
    value: "polaroids",
    label: "Accueil : deux Polaroïds (particuliers / commerces)",
    defaultData: () => ({
      eyebrow: "", title: "", text: "", hint: "↑ choisissez votre photo",
      panels: [
        { univers: "particuliers", label: "Particuliers", title: "", image: "", alt: "", position: "50% 50%", href: "services.html?pour=particuliers" },
        { univers: "commerces", label: "Commerces", title: "", image: "", alt: "", position: "50% 50%", href: "services.html?pour=commerces" },
      ],
    }),
  },
  {
    value: "contact_bref",
    label: "Contact court (titre, bouton, coordonnées)",
    defaultData: () => ({ eyebrow: "Contact", title: "", text: "", button_label: "Me contacter", button_href: "contact.html" }),
  },
  {
    value: "onglets_tarifs",
    label: "Tarifs : en-tête (photo + texte pour particuliers / commerces)",
    defaultData: () => ({
      eyebrow: "Services & tarifs", title: "",
      tabs: [
        { id: "particuliers", label: "Particuliers", image: "", alt: "", position: "50% 50%", text: "" },
        { id: "commerces", label: "Commerces", image: "", alt: "", position: "50% 50%", text: "" },
      ],
    }),
  },
  {
    value: "presentation",
    label: "Présentation (portrait en Polaroïd + texte)",
    defaultData: () => ({ eyebrow: "", title: "", text: "", text_suite: "", image: "", alt: "", position: "50% 50%", button_label: "", button_href: "" }),
  },
  {
    value: "texte_duo",
    label: "Texte + deux photos",
    defaultData: () => ({ eyebrow: "", title: "", text: "", text_suite: "", button_label: "", button_href: "", image_side: "droite", photos: [] }),
  },
  {
    value: "conseils",
    label: "Conseils en colonnes (2 colonnes de 3 conseils numérotés)",
    defaultData: () => ({
      eyebrow: "Avant de se rencontrer", title: "Quelques conseils pour de belles photos",
      colonnes: [
        { titre: "Particuliers", items: [{ titre: "", texte: "" }, { titre: "", texte: "" }, { titre: "", texte: "" }] },
        { titre: "Commerces", items: [{ titre: "", texte: "" }, { titre: "", texte: "" }, { titre: "", texte: "" }] },
      ],
    }),
  },
  {
    value: "citation",
    label: "Phrase forte (grande citation + signature)",
    defaultData: () => ({ text: "", signature: "Nicolas" }),
  },
  {
    value: "apercu_formules",
    label: "Aperçu des formules et prix (lu depuis la page Services)",
    defaultData: () => ({ eyebrow: "Les formules", title: "Des tarifs clairs, dès le départ", button_label: "Voir le détail" }),
  },
  {
    value: "contact_canaux",
    label: "Contact : WhatsApp, Instagram, email",
    defaultData: () => ({ eyebrow: "Contact", title: "Une envie de séance ?", text: "Écrivez-moi : je réponds sous 48 h." }),
  },
  {
    value: "reassurance",
    label: "Bandeau de confiance (quelques faits courts)",
    defaultData: () => ({ items: [{ text: "Réponse sous 48 h" }, { text: "Galerie privée en ligne" }] }),
  },
  {
    value: "ouverture",
    label: "Ouverture de page (grande photo + titre + bouton)",
    defaultData: () => ({ eyebrow: "", title: "", text: "", button_label: "", button_href: "", image: "", alt: "", position: "50% 50%", image_side: "gauche", titre_page: true }),
  },
  {
    value: "photo_pleine",
    label: "Grande photo (toute la largeur)",
    defaultData: () => ({ image: "", alt: "", position: "50% 50%" }),
  },
  {
    value: "bande_photos",
    label: "Bande de photos qui défile",
    defaultData: () => ({ photos: [] }),
  },
  {
    value: "instagram",
    label: "Instagram (6 photos + bouton)",
    defaultData: () => ({ eyebrow: "Instagram", title: "Tout mon travail est sur Instagram", text: "", button_label: "Voir mon Instagram", photos: [] }),
  },
  {
    value: "etapes",
    label: "Comment ça se passe (étapes avec photo)",
    defaultData: () => ({
      eyebrow: "Comment ça se passe", title: "", text: "",
      steps: [
        { visuel: "message", title: "Prise de contact", text: "", message_client: "", message_reponse: "" },
        { visuel: "planning", title: "Préparation", text: "", date_mois: "", date_jour: "", appel: "Appel de préparation", checklist: ["", "", ""] },
        { visuel: "photo", title: "Le jour J", text: "", image: "", alt: "" },
        { visuel: "galerie", title: "Votre galerie privée", text: "", galerie_titre: "Votre galerie", photos: [] },
      ],
    }),
  },
  {
    value: "faq",
    label: "Questions fréquentes (FAQ)",
    defaultData: () => ({ eyebrow: "", title: "Questions fréquentes", items: [{ question: "", answer: "" }] }),
  },
];

function sectionTypeLabel(type) {
  return SECTION_TYPES.find((t) => t.value === type)?.label || type;
}

// ---------- Aides GitHub API ----------

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function githubRequest(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `Erreur GitHub API (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// L'API GitHub peut renvoyer une lecture légèrement en retard (réplication)
// juste après une écriture : même en relisant le "sha" juste avant
// d'écrire, le PUT peut échouer une fois avec "<fichier> does not match
// <sha>". On relit et on réessaie plutôt que de remonter l'erreur tout de
// suite — ce conflit se résout presque toujours en une tentative.
function isStaleShaConflict(err) {
  return err?.status === 409 || /does not match/i.test(err?.message || "");
}

async function putJsonFileWithRetry(path, obj, message, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    let sha;
    try {
      sha = (await getJsonFile(path)).sha;
    } catch {
      sha = undefined; // le fichier n'existe pas encore
    }
    try {
      return await putJsonFile(path, obj, message, sha);
    } catch (err) {
      lastErr = err;
      if (!isStaleShaConflict(err) || i === attempts - 1) throw err;
      await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

async function putRawFileWithRetry(path, text, message, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    let sha;
    try {
      sha = (await getRawFile(path)).sha;
    } catch {
      sha = undefined;
    }
    try {
      return await putRawFile(path, text, message, sha);
    } catch (err) {
      lastErr = err;
      if (!isStaleShaConflict(err) || i === attempts - 1) throw err;
      await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

async function getJsonFile(path) {
  const data = await githubRequest(
    `/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`
  );
  const text = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
  return { sha: data.sha, data: JSON.parse(text) };
}

async function putJsonFile(path, obj, message, sha) {
  return githubRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: utf8ToBase64(JSON.stringify(obj, null, 2) + "\n"),
      branch: BRANCH,
      sha,
    }),
  });
}

async function getRawFile(path) {
  const data = await githubRequest(
    `/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`
  );
  const text = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
  return { sha: data.sha, text };
}

async function putRawFile(path, text, message, sha) {
  return githubRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: utf8ToBase64(text),
      branch: BRANCH,
      sha,
    }),
  });
}

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file, folder = "images/uploads") {
  const content = await fileToBase64(file);
  const path = `${folder}/${Date.now()}-${sanitizeFilename(file.name)}`;
  await githubRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Ajout de la photo ${file.name} (admin)`,
      content,
      branch: BRANCH,
    }),
  });
  return path;
}

function sitePath(p) {
  return p ? `../${p}` : "";
}

// ---------- Aides génériques ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function escapeHtmlAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slugify(str) {
  return str
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function swapAdjacent(array, i, j) {
  [array[i], array[j]] = [array[j], array[i]];
}

// Réordonnancement pour le glisser-déposer : `to` est la position (dans le
// tableau avant retrait) devant laquelle insérer l'élément déplacé.
function reorderArray(array, from, to) {
  const insertAt = to > from ? to - 1 : to;
  const [moved] = array.splice(from, 1);
  array.splice(insertAt, 0, moved);
}

function enableDragReorder(listEl, array, rerender) {
  let dragIndex = null;
  Array.from(listEl.children).forEach((card, i) => {
    card.draggable = true;
    card.addEventListener("dragstart", () => {
      dragIndex = i;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      if (dragIndex === null || dragIndex === i) return;
      reorderArray(array, dragIndex, i);
      dragIndex = null;
      rerender();
    });
  });
}

// Supprime récursivement les clés privées (_file, _previewUrl...) avant
// d'enregistrer, sans modifier l'état en mémoire (utile pour continuer à
// éditer après un enregistrement).
function stripPrivateDeep(node) {
  if (Array.isArray(node)) return node.map(stripPrivateDeep);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("_")) continue;
      out[k] = stripPrivateDeep(v);
    }
    return out;
  }
  return node;
}

// Parcourt récursivement une structure (sections d'une page) à la
// recherche d'objets avec un fichier en attente (`_file`, posé par un
// champ image), les téléverse et remplace `image` par le chemin obtenu.
async function uploadPendingImagesDeep(node, folder = "images/uploads") {
  if (Array.isArray(node)) {
    for (const item of node) await uploadPendingImagesDeep(item, folder);
    return;
  }
  if (node && typeof node === "object") {
    if (node._file instanceof File) {
      node.image = await uploadImage(node._file, folder);
      delete node._file;
      delete node._previewUrl;
    }
    for (const key of Object.keys(node)) {
      if (key.startsWith("_")) continue;
      await uploadPendingImagesDeep(node[key], folder);
    }
  }
}

// Adresse publique du site : les aperçus de partage (WhatsApp, Facebook…)
// demandent une adresse complète pour l'image.
const SITE_URL = "https://nicolasleveugle.be/";

function urlAbsolue(chemin) {
  if (!chemin || /^https?:\/\//i.test(chemin)) return chemin || "";
  return SITE_URL + chemin.replace(/^\//, "");
}

function patchSeoHead(html, seo) {
  const title = escapeHtmlAttr(seo.title || "");
  const desc = escapeHtmlAttr(seo.description || "");
  const ogImage = escapeHtmlAttr(urlAbsolue(seo.og_image));

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${desc}" />`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${title}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${desc}" />`
  );
  html = html.replace(
    /<meta property="og:image" content="[^"]*" \/>/,
    `<meta property="og:image" content="${ogImage}" />`
  );
  return html;
}

function pageHtmlTemplate(seo, slug) {
  const title = escapeHtmlAttr(seo.title || "");
  const desc = escapeHtmlAttr(seo.description || "");
  const ogImage = escapeHtmlAttr(urlAbsolue(seo.og_image));
  const url = escapeHtmlAttr(`${SITE_URL}${slug}.html`);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:image" content="${ogImage}" />
<meta name="twitter:card" content="summary_large_image" />
<meta property="og:url" content="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Nicolas Leveugle Photographie" />
<meta property="og:locale" content="fr_BE" />
<link rel="canonical" href="${url}" />
<link rel="stylesheet" href="css/style.css" />
<script src="js/univers.js"></script>
<link rel="icon" href="favicon.ico" sizes="48x48" />
<link rel="icon" href="icones/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="icones/apple-touch-icon.png" />
<link rel="manifest" href="site.webmanifest" />
<meta name="theme-color" content="#1c1916" />
</head>
<body>

<div class="univers-barre" id="univers-barre">
  <div class="container univers-barre-inner">
    <span class="univers-libelle">Vous êtes</span>
    <div class="univers-switch" role="group" aria-label="Vous êtes">
      <button type="button" data-univers="particuliers" aria-pressed="false">Particulier</button>
      <button type="button" data-univers="commerces" aria-pressed="false">Commerce</button>
    </div>
  </div>
</div>

<header class="site-header">
  <div class="container">
    <a href="index.html" class="logo js-logo">Nicolas Leveugle</a>
    <div class="header-nav">
      <button class="nav-toggle" aria-label="Ouvrir le menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-links" id="nav-links"></ul>
      <a href="contact.html" class="btn btn-primary btn-small" id="header-cta"></a>
    </div>
  </div>
</header>

<main id="sections-root"></main>

<footer class="site-footer">
  <div class="container footer-row">
    <span class="logo js-logo" style="font-size:1.1rem">Nicolas Leveugle</span>
    <ul class="footer-links" id="footer-links"></ul>
  </div>
  <div class="container">
    <p class="footer-copy" id="footer-copy" style="margin-top:16px"></p>
  </div>
</footer>

<script src="js/main.js"></script>
<script src="js/sections-renderer.js"></script>
<script src="js/render.js"></script>
</body>
</html>
`;
}

// ---------- Statut / messages ----------

const statusEl = document.getElementById("admin-status");

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `admin-status ${type}`;
  statusEl.hidden = false;
  if (type === "success") {
    setTimeout(() => (statusEl.hidden = true), 4000);
  }
}

// ---------- Connexion : chiffrement du token par mot de passe ----------
//
// Le token GitHub réel reste le seul moyen d'authentification auprès de
// GitHub — mais au lieu de le transporter partout, on le chiffre une fois
// avec un mot de passe choisi (AES-GCM + PBKDF2, API Web Crypto native du
// navigateur) et on enregistre le résultat chiffré dans admin/auth.json,
// un fichier public du dépôt (comme tout le reste du site). À chaque
// connexion, on retélécharge ce fichier et on le déchiffre avec le mot de
// passe tapé : en cas d'erreur de mot de passe, le déchiffrement échoue
// simplement (aucune info exploitable n'est renvoyée).
//
// Important : le dépôt étant public, ce fichier chiffré est visible de
// tous. La sécurité dépend donc entièrement de la force du mot de passe
// (pas de limite de tentatives possible sur un site statique).

const AUTH_FILE_PATH = "admin/auth.json";
const PBKDF2_ITERATIONS = 600000;

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveAesKey(password, saltBytes, iterations) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptTokenWithPassword(password, token) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, PBKDF2_ITERATIONS);
  const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuf)),
    iterations: PBKDF2_ITERATIONS,
  };
}

// Lève une exception si le mot de passe est incorrect (échec de l'AES-GCM).
async function decryptTokenWithPassword(password, blob) {
  const key = await deriveAesKey(password, base64ToBytes(blob.salt), blob.iterations || PBKDF2_ITERATIONS);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(blob.iv) },
    key,
    base64ToBytes(blob.ciphertext)
  );
  return new TextDecoder().decode(plainBuf);
}

async function fetchAuthBlob() {
  // admin/index.html et admin/auth.json sont dans le même dossier.
  const res = await fetch("auth.json", { cache: "no-cache" });
  if (!res.ok) return null;
  return res.json();
}

async function saveAuthBlob(blob, message) {
  let sha;
  try {
    const existing = await githubRequest(`/repos/${OWNER}/${REPO}/contents/${AUTH_FILE_PATH}?ref=${BRANCH}`);
    sha = existing.sha;
  } catch (err) {
    sha = undefined; // le fichier n'existe pas encore
  }
  await putJsonFile(AUTH_FILE_PATH, blob, message, sha);
}

// ---------- Écrans de connexion ----------

const appScreen = document.getElementById("app-screen");
const screens = {
  checking: document.getElementById("login-checking"),
  password: document.getElementById("login-password"),
  setup: document.getElementById("login-setup"),
  token: document.getElementById("login-token"),
};

function showLoginScreen(name) {
  Object.values(screens).forEach((el) => (el.hidden = true));
  screens[name].hidden = false;
}

function enterApp() {
  document.getElementById("login-screen").hidden = true;
  document.getElementById("login-header").hidden = true;
  appScreen.hidden = false;
  initApp();
}

async function tryLoginWithToken(token, errorEl) {
  localStorage.setItem(TOKEN_KEY, token);
  try {
    await githubRequest(`/repos/${OWNER}/${REPO}`);
    return true;
  } catch (err) {
    localStorage.removeItem(TOKEN_KEY);
    errorEl.textContent = "Connexion impossible : token invalide, expiré, ou sans accès en écriture à ce repo.";
    errorEl.hidden = false;
    return false;
  }
}

// Connexion par mot de passe (cas normal)
const passwordInput = document.getElementById("password-input");
const passwordLoginError = document.getElementById("password-login-error");

document.getElementById("password-login-btn").addEventListener("click", async () => {
  const password = passwordInput.value;
  if (!password) return;
  passwordLoginError.hidden = true;
  try {
    const blob = await fetchAuthBlob();
    const token = await decryptTokenWithPassword(password, blob);
    localStorage.setItem(TOKEN_KEY, token);
    // Si le mot de passe des galeries clients est le même, la photothèque y
    // aura accès sans rien demander (voir connexionGaleries, editor.js).
    if (!localStorage.getItem("galerie-admin-mdp") && typeof connexionGaleries === "function") {
      connexionGaleries(password).catch(() => {});
    }
    enterApp();
  } catch (err) {
    passwordLoginError.textContent = "Mot de passe incorrect.";
    passwordLoginError.hidden = false;
  }
});

// Première configuration : token + choix du mot de passe
const setupError = document.getElementById("setup-error");

document.getElementById("setup-btn").addEventListener("click", async () => {
  const token = document.getElementById("setup-token-input").value.trim();
  const password = document.getElementById("setup-password-input").value;
  const confirm = document.getElementById("setup-password-confirm").value;
  setupError.hidden = true;

  if (!token || !password) return;
  if (password.length < 8) {
    setupError.textContent = "Choisis un mot de passe d'au moins 8 caractères.";
    setupError.hidden = false;
    return;
  }
  if (password !== confirm) {
    setupError.textContent = "Les deux mots de passe ne correspondent pas.";
    setupError.hidden = false;
    return;
  }

  const ok = await tryLoginWithToken(token, setupError);
  if (!ok) return;

  try {
    const blob = await encryptTokenWithPassword(password, token);
    await saveAuthBlob(blob, "Configuration du mot de passe d'administration");
    enterApp();
  } catch (err) {
    setupError.textContent = `Erreur lors de l'enregistrement du mot de passe : ${err.message}`;
    setupError.hidden = false;
  }
});

// Secours : connexion directe par token
const tokenInput = document.getElementById("token-input");
const loginError = document.getElementById("login-error");

document.getElementById("login-btn").addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) return;
  loginError.hidden = true;
  const ok = await tryLoginWithToken(token, loginError);
  if (ok) enterApp();
});

document.getElementById("show-token-login").addEventListener("click", (e) => {
  e.preventDefault();
  showLoginScreen("token");
});
document.getElementById("show-password-login").addEventListener("click", (e) => {
  e.preventDefault();
  showLoginScreen("password");
});

// Changer le mot de passe (une fois connecté)
document.getElementById("change-password-btn").addEventListener("click", async () => {
  const newPassword = prompt("Nouveau mot de passe (8 caractères minimum) :");
  if (!newPassword) return;
  if (newPassword.length < 8) {
    alert("Le mot de passe doit faire au moins 8 caractères.");
    return;
  }
  const confirmPassword = prompt("Confirme le nouveau mot de passe :");
  if (newPassword !== confirmPassword) {
    alert("Les deux mots de passe ne correspondent pas. Rien n'a été changé.");
    return;
  }
  try {
    showStatus("Enregistrement du nouveau mot de passe…", "loading");
    const blob = await encryptTokenWithPassword(newPassword, getToken());
    await saveAuthBlob(blob, "Changement du mot de passe d'administration");
    showStatus("Mot de passe changé ✓", "success");
  } catch (err) {
    showStatus(`Erreur : ${err.message}`, "error");
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  window.location.reload();
});

// ---------- Navigation (barre latérale) ----------

function showView(viewId) {
  document.querySelectorAll(".admin-view").forEach((v) => (v.hidden = true));
  document.getElementById(viewId).hidden = false;
}

function setActiveSidebarItem(el) {
  document.querySelectorAll(".admin-sidebar-item").forEach((i) => i.classList.remove("active"));
  if (el) el.classList.add("active");
}

document.querySelectorAll(".admin-sidebar-item[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    showView(`view-${btn.dataset.view}`);
    setActiveSidebarItem(btn);
  });
});

// ========================================================================
// Statistiques de visite (Cloudflare Web Analytics, via le Worker des
// galeries : /api/admin/stats, même connexion que les galeries clients)
// ========================================================================

let joursStats = 30;

const NOMS_SOURCES = [
  [/(^|\.)google\./, "Google"],
  [/instagram\.com$/, "Instagram"],
  [/facebook\.com$|fb\.me$/, "Facebook"],
  [/bing\.com$/, "Bing"],
  [/nicolasleveugle\.be$/, "Ton site (d'une page à l'autre)"],
];
const NOMS_APPAREILS = { mobile: "Téléphone", desktop: "Ordinateur", tablet: "Tablette" };

function nomSource(hote) {
  if (!hote) return "Accès direct (lien, favori, adresse tapée)";
  const trouve = NOMS_SOURCES.find(([re]) => re.test(hote));
  return trouve ? trouve[1] : hote;
}

function nomPage(chemin) {
  const slug = (chemin || "/").replace(/^\/|\.html$/g, "") || "index";
  const page = state.site && state.site.data.pages.find((p) => p.slug === slug);
  if (page) return page.title;
  if (slug.startsWith("galerie")) return "Galerie client";
  return chemin;
}

function nomPays(code) {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function formatNombre(n) {
  return new Intl.NumberFormat("fr-BE").format(n);
}

function formatDate(iso, court) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-BE", court ? { day: "numeric", month: "short" } : { weekday: "long", day: "numeric", month: "long" });
}

// Barres horizontales classées : une seule teinte, la plus grande en premier.
function barresClassees(titre, lignes, nommer, mesure) {
  if (!lignes.length) return `<section class="stats-carte"><h3>${titre}</h3><p class="admin-hint">Pas encore de données.</p></section>`;
  const max = Math.max(...lignes.map((l) => l[mesure])) || 1;
  return `
    <section class="stats-carte">
      <h3>${titre}</h3>
      <ul class="stats-barres">
        ${lignes
          .map(
            (l) => `
          <li title="${escapeHtml(nommer(l.nom))} : ${formatNombre(l[mesure])}">
            <span class="stats-barres-nom">${escapeHtml(nommer(l.nom))}</span>
            <span class="stats-barres-valeur">${formatNombre(l[mesure])}</span>
            <span class="stats-barres-piste"><span style="width:${Math.max(2, (l[mesure] / max) * 100)}%"></span></span>
          </li>`
          )
          .join("")}
      </ul>
    </section>`;
}

// Visites par jour : colonnes sur un seul axe, infobulle au survol.
function colonnesParJour(lignes, jours) {
  const parDate = new Map(lignes.map((l) => [l.nom, l]));
  const dates = [];
  for (let i = jours - 1; i >= 0; i--) dates.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const valeurs = dates.map((d) => ({ date: d, visites: (parDate.get(d) || {}).visites || 0, vues: (parDate.get(d) || {}).vues || 0 }));
  const max = Math.max(1, ...valeurs.map((v) => v.visites));
  const graduation = Math.ceil(max / 4) || 1;
  const haut = graduation * 4;
  return `
    <section class="stats-carte stats-carte-large">
      <h3>Visites par jour</h3>
      <div class="stats-colonnes" style="--n:${valeurs.length}">
        <div class="stats-grille">${[4, 3, 2, 1, 0].map((k) => `<span><i>${formatNombre(graduation * k)}</i></span>`).join("")}</div>
        <div class="stats-colonnes-zone">
          ${valeurs
            .map(
              (v) => `<span class="stats-col" tabindex="0" data-info="${escapeHtml(`${formatDate(v.date)} : ${formatNombre(v.visites)} visite${v.visites > 1 ? "s" : ""}, ${formatNombre(v.vues)} page${v.vues > 1 ? "s" : ""} vue${v.vues > 1 ? "s" : ""}`)}"><span style="height:${(v.visites / haut) * 100}%"></span></span>`
            )
            .join("")}
          <div class="stats-infobulle" hidden></div>
        </div>
      </div>
      <div class="stats-axe-x"><span>${formatDate(dates[0], true)}</span><span>${formatDate(dates[dates.length - 1], true)}</span></div>
      <details class="stats-tableau">
        <summary>Voir les chiffres jour par jour</summary>
        <table><thead><tr><th>Jour</th><th>Visites</th><th>Pages vues</th></tr></thead><tbody>
          ${valeurs.slice().reverse().map((v) => `<tr><td>${formatDate(v.date)}</td><td>${formatNombre(v.visites)}</td><td>${formatNombre(v.vues)}</td></tr>`).join("")}
        </tbody></table>
      </details>
    </section>`;
}

function brancherInfobulles(racine) {
  const zone = racine.querySelector(".stats-colonnes-zone");
  if (!zone) return;
  const bulle = zone.querySelector(".stats-infobulle");
  const montrer = (col) => {
    bulle.textContent = col.dataset.info;
    bulle.hidden = false;
    const r = col.getBoundingClientRect();
    const z = zone.getBoundingClientRect();
    const x = Math.min(Math.max(r.left - z.left + r.width / 2, 90), z.width - 90);
    bulle.style.left = `${x}px`;
    zone.querySelectorAll(".stats-col.actif").forEach((c) => c.classList.remove("actif"));
    col.classList.add("actif");
  };
  zone.querySelectorAll(".stats-col").forEach((col) => {
    col.addEventListener("mouseenter", () => montrer(col));
    col.addEventListener("focus", () => montrer(col));
    col.addEventListener("click", () => montrer(col));
  });
  zone.addEventListener("mouseleave", () => {
    bulle.hidden = true;
    zone.querySelectorAll(".stats-col.actif").forEach((c) => c.classList.remove("actif"));
  });
}

async function chargerStats() {
  const contenu = document.getElementById("stats-contenu");
  contenu.innerHTML = '<p class="admin-hint">Chargement…</p>';
  let d;
  try {
    d = await appelGaleries(`/api/admin/stats?jours=${joursStats}`);
  } catch (err) {
    if (err.connexion) {
      contenu.innerHTML = '<p class="admin-hint">Pour voir les statistiques, ouvre une fois la photothèque › « Galeries clients » et entre le mot de passe des galeries (ce navigateur s\'en souviendra).</p>';
    } else if (/501/.test(err.message)) {
      contenu.innerHTML = '<p class="admin-hint">Les statistiques ne sont pas encore branchées sur le serveur des galeries (jeton Cloudflare à ajouter). Voir les étapes données par Claude.</p>';
    } else {
      contenu.innerHTML = `<p class="admin-hint">Impossible de charger les statistiques : ${escapeHtml(err.message)}</p>`;
    }
    return;
  }
  const parVisite = d.total.visites ? (d.total.vues / d.total.visites).toLocaleString("fr-BE", { maximumFractionDigits: 1 }) : "–";
  contenu.innerHTML = `
    <div class="stats-kpi">
      <div><span>Visites</span><b>${formatNombre(d.total.visites)}</b></div>
      <div><span>Pages vues</span><b>${formatNombre(d.total.vues)}</b></div>
      <div><span>Pages par visite</span><b>${parVisite}</b></div>
    </div>
    ${colonnesParJour(d.parJour, d.jours)}
    <div class="stats-grille-cartes">
      ${barresClassees("Pages les plus vues", d.pages, nomPage, "vues")}
      ${barresClassees("D'où viennent les visiteurs", d.sources, nomSource, "visites")}
      ${barresClassees("Appareils", d.appareils, (n) => NOMS_APPAREILS[n] || n, "visites")}
      ${barresClassees("Pays", d.pays, nomPays, "visites")}
    </div>
    <p class="admin-hint">Mesure anonyme, sans cookie (Cloudflare Web Analytics). Les chiffres des dernières heures peuvent encore bouger.</p>`;
  brancherInfobulles(contenu);
}

document.querySelector('.admin-sidebar-item[data-view="stats"]').addEventListener("click", chargerStats);
document.querySelectorAll(".stats-periodes button").forEach((b) => {
  b.addEventListener("click", () => {
    joursStats = Number(b.dataset.jours);
    document.querySelectorAll(".stats-periodes button").forEach((x) => x.classList.toggle("actif", x === b));
    chargerStats();
  });
});

// ---------- État ----------

const state = {
  site: null, // { sha, data: { pages: [{slug, title}] } }
  navigation: null,
  appearance: null,
  contact: null,
  pages: {}, // slug -> { sha, isNew, title, data: {seo, sections} }
};

let currentEditingSlug = null;

// ========================================================================
// Onglet Pages
// ========================================================================

function renderSidebarPagesList() {
  const list = document.getElementById("sidebar-pages-list");
  list.innerHTML = "";
  state.site.data.pages.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "admin-sidebar-item";
    btn.textContent = p.title;
    btn.dataset.slug = p.slug;
    btn.addEventListener("click", () => openPageEditor(p.slug, p.title));
    list.appendChild(btn);
  });
}

async function openPageEditor(slug, title) {
  if (!state.pages[slug]) {
    try {
      showStatus("Chargement de la page…", "loading");
      const { sha, data } = await getJsonFile(`content/pages/${slug}.json`);
      state.pages[slug] = { sha, isNew: false, title, data };
      statusEl.hidden = true;
    } catch (err) {
      showStatus(`Erreur : ${err.message}`, "error");
      return;
    }
  }

  showView("view-page-editor");
  setActiveSidebarItem(document.querySelector(`#sidebar-pages-list .admin-sidebar-item[data-slug="${slug}"]`));
  currentEditingSlug = slug;
  document.getElementById("pages-editor-title").textContent = title;
  renderPageEditor();
}

function renderPageEditor() {
  const page = state.pages[currentEditingSlug];
  document.getElementById("seo-title").value = page.data.seo.title || "";
  document.getElementById("seo-description").value = page.data.seo.description || "";
  document.getElementById("seo-og-image").value = page.data.seo.og_image || "";
  majApercuPartage();
  renderEditableSections(document.getElementById("live-editor-root"), page.data.sections);
}

document.getElementById("seo-title").addEventListener("input", (e) => {
  if (currentEditingSlug) state.pages[currentEditingSlug].data.seo.title = e.target.value;
});
document.getElementById("seo-description").addEventListener("input", (e) => {
  if (currentEditingSlug) state.pages[currentEditingSlug].data.seo.description = e.target.value;
});
// Image d'aperçu des partages : choisie dans la photothèque (photos du
// site, galeries clients ou ordinateur), envoyée à l'enregistrement.
function majApercuPartage() {
  const seo = state.pages[currentEditingSlug].data.seo;
  const img = document.getElementById("seo-og-apercu");
  const src = seo._ogPreview || sitePath(seo.og_image);
  img.hidden = !src;
  if (src) img.src = src;
}

document.getElementById("seo-og-choisir").addEventListener("click", () => {
  if (!currentEditingSlug) return;
  const seo = state.pages[currentEditingSlug].data.seo;
  ouvrirPhototheque({
    surChoix: ([photo]) => {
      seo.og_image = photo.chemin;
      delete seo._ogFile;
      delete seo._ogPreview;
      majApercuPartage();
    },
    surFichiers: ([file]) => {
      seo._ogFile = file;
      seo._ogPreview = URL.createObjectURL(file);
      majApercuPartage();
    },
  });
});

document.getElementById("sidebar-add-page").addEventListener("click", () => {
  const title = prompt("Titre de la nouvelle page (ex : À propos) :");
  if (!title || !title.trim()) return;
  const slug = slugify(title.trim());
  if (!slug || slug === "admin") {
    alert("Ce titre ne donne pas un nom de page valide. Essaie un autre titre.");
    return;
  }
  if (state.site.data.pages.some((p) => p.slug === slug)) {
    alert(`Une page nommée « ${slug} » existe déjà.`);
    return;
  }
  state.pages[slug] = {
    sha: null,
    isNew: true,
    title: title.trim(),
    data: {
      seo: { title: title.trim(), description: "", og_image: "" },
      sections: [
        { id: `s${Date.now()}`, type: "texte", data: { eyebrow: "", title: title.trim(), text: "" } },
      ],
    },
  };
  openPageEditor(slug, title.trim());
});

// ---------- Champs de formulaire génériques (réutilisés par les popovers
// de réglages de l'éditeur visuel, pour les quelques champs sans
// équivalent visuel direct : liens, position d'image...) ----------

function textField(container, label, obj, key, opts = {}) {
  const wrap = document.createElement("div");
  wrap.className = "admin-field";
  if (opts.textarea) {
    wrap.innerHTML = `<label>${escapeHtml(label)}</label><textarea rows="${opts.rows || 3}">${escapeHtml(obj[key] || "")}</textarea>`;
    wrap.querySelector("textarea").addEventListener("input", (e) => (obj[key] = e.target.value));
  } else {
    wrap.innerHTML = `<label>${escapeHtml(label)}</label><input type="text" value="${escapeHtml(obj[key] || "")}" />`;
    wrap.querySelector("input").addEventListener("input", (e) => (obj[key] = e.target.value));
  }
  container.appendChild(wrap);
  return wrap;
}

function selectField(container, label, obj, key, options) {
  const wrap = document.createElement("div");
  wrap.className = "admin-field";
  wrap.innerHTML = `
    <label>${escapeHtml(label)}</label>
    <select>${options.map((o) => `<option value="${o.value}" ${o.value === obj[key] ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}</select>
  `;
  wrap.querySelector("select").addEventListener("change", (e) => (obj[key] = e.target.value));
  container.appendChild(wrap);
  return wrap;
}

// Une photo trop petite paraît floue sur grand écran ou sur un écran Retina :
// on prévient (sans bloquer) quand son grand côté fait moins de 2000 px.
const DEFINITION_CONSEILLEE = 2000;

function verifierDefinition(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    if (Math.max(img.naturalWidth, img.naturalHeight) < DEFINITION_CONSEILLEE) {
      showStatus(
        `Attention : « ${file.name} » ne fait que ${img.naturalWidth} × ${img.naturalHeight} px, elle risque d'être un peu floue sur grand écran. Utilise de préférence le fichier original (au moins ${DEFINITION_CONSEILLEE} px) : le site prépare tout seul les versions légères.`,
        "error"
      );
    }
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

function imageField(container, label, obj, rerender) {
  const wrap = document.createElement("div");
  wrap.className = "admin-field";
  const previewSrc = obj._previewUrl || sitePath(obj.image);
  wrap.innerHTML = `
    <label>${escapeHtml(label)}</label>
    <div class="admin-card-row" style="align-items:center">
      <div class="admin-card-preview" style="width:72px;height:72px">${previewSrc ? `<img src="${previewSrc}" alt="" />` : ""}</div>
      <input type="file" accept="image/*" style="flex:1" />
    </div>
  `;
  wrap.querySelector("input[type=file]").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    verifierDefinition(file);
    obj._file = file;
    obj._previewUrl = URL.createObjectURL(file);
    rerender();
  });
  container.appendChild(wrap);
  return wrap;
}

// ---------- Prévisualisation ----------

document.getElementById("page-preview").addEventListener("click", () => {
  const page = state.pages[currentEditingSlug];
  const draft = {
    navigation: stripPrivateDeep(state.navigation.data),
    appearance: stripPrivateDeep(state.appearance.data),
    page: stripPrivateDeep(page.data),
  };
  localStorage.setItem("site-photo-admin-preview", JSON.stringify(draft));
  window.open("preview.html", "_blank");
});

// ---------- Enregistrement d'une page ----------

document.getElementById("page-save").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  btn.disabled = true;
  const slug = currentEditingSlug;
  const page = state.pages[slug];
  try {
    showStatus("Enregistrement…", "loading");

    if (page.data.seo._ogFile) {
      page.data.seo.og_image = await uploadImage(page.data.seo._ogFile);
      delete page.data.seo._ogFile;
      delete page.data.seo._ogPreview;
    }
    await uploadPendingImagesDeep(page.data.sections);
    const cleanData = stripPrivateDeep({ seo: page.data.seo, sections: page.data.sections });
    const jsonPath = `content/pages/${slug}.json`;

    if (page.isNew) {
      await putJsonFile(jsonPath, cleanData, `Création de la page « ${slug} » (admin)`, undefined);
      await githubRequest(`/repos/${OWNER}/${REPO}/contents/${slug}.html`, {
        method: "PUT",
        body: JSON.stringify({
          message: `Création de la page « ${slug} » (admin)`,
          content: utf8ToBase64(pageHtmlTemplate(cleanData.seo, slug)),
          branch: BRANCH,
        }),
      });
      const freshSite = await getJsonFile("content/site.json");
      freshSite.data.pages.push({ slug, title: page.title });
      await putJsonFileWithRetry("content/site.json", freshSite.data, `Ajout de la page « ${slug} » au registre (admin)`);
      state.site = freshSite;
      page.isNew = false;
    } else {
      await putJsonFileWithRetry(jsonPath, cleanData, `Mise à jour de la page « ${slug} » (admin)`);
      const rawHead = await getRawFile(`${slug}.html`);
      const patched = patchSeoHead(rawHead.text, cleanData.seo);
      await putRawFileWithRetry(`${slug}.html`, patched, `Mise à jour SEO de la page « ${slug} » (admin)`);
    }

    const hasContactSection = cleanData.sections.some((s) => s.type === "contact");
    if (hasContactSection && state.contact) {
      await putJsonFileWithRetry("content/contact.json", state.contact.data, "Mise à jour des coordonnées (admin)");
    }

    page.data = cleanData;
    renderSidebarPagesList();
    setActiveSidebarItem(document.querySelector(`#sidebar-pages-list .admin-sidebar-item[data-slug="${slug}"]`));
    showStatus("Page enregistrée ✓ Le site se met à jour automatiquement (~1 min).", "success");
  } catch (err) {
    showStatus(`Erreur : ${err.message}`, "error");
  } finally {
    btn.disabled = false;
  }
});

// ========================================================================
// Onglet Navigation
// ========================================================================

function renderLinksList(containerId, links, rerender) {
  const list = document.getElementById(containerId);
  list.innerHTML = "";
  links.forEach((link, idx) => {
    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="admin-field-row">
        <div class="admin-field"><label>Texte affiché</label><input type="text" class="f-label" value="${escapeHtml(link.label || "")}" /></div>
        <div class="admin-field"><label>Lien (ex : a-propos.html)</label><input type="text" class="f-href" value="${escapeHtml(link.href || "")}" /></div>
      </div>
      <div class="admin-card-toolbar">
        <div class="admin-card-toolbar-left">
          <button type="button" class="admin-icon-btn f-up" ${idx === 0 ? "disabled" : ""}>↑ Monter</button>
          <button type="button" class="admin-icon-btn f-down" ${idx === links.length - 1 ? "disabled" : ""}>↓ Descendre</button>
        </div>
        <button type="button" class="admin-icon-btn danger f-delete">Supprimer</button>
      </div>
    `;
    card.querySelector(".f-label").addEventListener("input", (e) => (link.label = e.target.value));
    card.querySelector(".f-href").addEventListener("input", (e) => (link.href = e.target.value));
    card.querySelector(".f-up").addEventListener("click", () => {
      if (idx === 0) return;
      swapAdjacent(links, idx, idx - 1);
      rerender();
    });
    card.querySelector(".f-down").addEventListener("click", () => {
      if (idx === links.length - 1) return;
      swapAdjacent(links, idx, idx + 1);
      rerender();
    });
    card.querySelector(".f-delete").addEventListener("click", () => {
      if (!confirm("Supprimer ce lien ?")) return;
      links.splice(idx, 1);
      rerender();
    });
    list.appendChild(card);
  });
}

function renderNavigationTab() {
  const nav = state.navigation.data;
  renderLinksList("nav-links-list", nav.nav_links, renderNavigationTab);
  renderLinksList("footer-links-list", nav.footer_links, renderNavigationTab);
  document.getElementById("cta-label").value = nav.cta_button.label || "";
  document.getElementById("cta-href").value = nav.cta_button.href || "";
  document.getElementById("copyright-text").value = nav.copyright_text || "";
}

document.getElementById("cta-label").addEventListener("input", (e) => (state.navigation.data.cta_button.label = e.target.value));
document.getElementById("cta-href").addEventListener("input", (e) => (state.navigation.data.cta_button.href = e.target.value));
document.getElementById("copyright-text").addEventListener("input", (e) => (state.navigation.data.copyright_text = e.target.value));

document.getElementById("nav-link-add").addEventListener("click", () => {
  state.navigation.data.nav_links.push({ label: "Nouveau lien", href: "" });
  renderNavigationTab();
});
document.getElementById("footer-link-add").addEventListener("click", () => {
  state.navigation.data.footer_links.push({ label: "Nouveau lien", href: "" });
  renderNavigationTab();
});

document.getElementById("navigation-save").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    showStatus("Enregistrement…", "loading");
    await putJsonFileWithRetry("content/navigation.json", state.navigation.data, "Mise à jour du menu et du pied de page (admin)");
    showStatus("Menu et pied de page enregistrés ✓ Le site se met à jour automatiquement (~1 min).", "success");
  } catch (err) {
    showStatus(`Erreur : ${err.message}`, "error");
  } finally {
    btn.disabled = false;
  }
});

// ========================================================================
// Onglet Apparence
// ========================================================================

function renderApparenceTab() {
  const a = state.appearance.data;
  document.getElementById("accent-color").value = a.accent_color || "#000000";
  document.getElementById("accent-color-text").value = a.accent_color || "";
  document.getElementById("accent-color-dark").value = a.accent_color_dark || "#000000";
  document.getElementById("accent-color-dark-text").value = a.accent_color_dark || "";
  document.getElementById("logo-text").value = a.logo_text || "";

  const logoPreview = document.getElementById("logo-preview");
  const logoSrc = a._logoPreviewUrl || sitePath(a.logo_image);
  logoPreview.innerHTML = logoSrc ? `<img src="${logoSrc}" alt="" />` : "";

  const faviconPreview = document.getElementById("favicon-preview");
  const faviconSrc = a._faviconPreviewUrl || sitePath(a.favicon_image);
  faviconPreview.innerHTML = faviconSrc ? `<img src="${faviconSrc}" alt="" />` : "";

  applyAppearancePreview();
}

function applyAppearancePreview() {
  const a = state.appearance.data;
  document.documentElement.style.setProperty("--couleur-accent", a.accent_color || "#b5652e");
  document.documentElement.style.setProperty("--couleur-accent-fonce", a.accent_color_dark || "#8f4f22");
}

function wireColorPair(colorId, textId, key) {
  const colorInput = document.getElementById(colorId);
  const textInput = document.getElementById(textId);
  colorInput.addEventListener("input", (e) => {
    state.appearance.data[key] = e.target.value;
    textInput.value = e.target.value;
    applyAppearancePreview();
  });
  textInput.addEventListener("input", (e) => {
    state.appearance.data[key] = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) colorInput.value = e.target.value;
    applyAppearancePreview();
  });
}
wireColorPair("accent-color", "accent-color-text", "accent_color");
wireColorPair("accent-color-dark", "accent-color-dark-text", "accent_color_dark");

document.getElementById("logo-text").addEventListener("input", (e) => (state.appearance.data.logo_text = e.target.value));

document.getElementById("logo-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  state.appearance.data._logoFile = file;
  state.appearance.data._logoPreviewUrl = URL.createObjectURL(file);
  renderApparenceTab();
});
document.getElementById("logo-remove").addEventListener("click", () => {
  state.appearance.data.logo_image = "";
  delete state.appearance.data._logoFile;
  delete state.appearance.data._logoPreviewUrl;
  renderApparenceTab();
});
document.getElementById("favicon-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  state.appearance.data._faviconFile = file;
  state.appearance.data._faviconPreviewUrl = URL.createObjectURL(file);
  renderApparenceTab();
});
document.getElementById("favicon-remove").addEventListener("click", () => {
  state.appearance.data.favicon_image = "";
  delete state.appearance.data._faviconFile;
  delete state.appearance.data._faviconPreviewUrl;
  renderApparenceTab();
});

document.getElementById("apparence-save").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    showStatus("Enregistrement…", "loading");
    const a = state.appearance.data;
    if (a._logoFile) {
      a.logo_image = await uploadImage(a._logoFile, "images/uploads");
      delete a._logoFile;
      delete a._logoPreviewUrl;
    }
    if (a._faviconFile) {
      a.favicon_image = await uploadImage(a._faviconFile, "images/uploads");
      delete a._faviconFile;
      delete a._faviconPreviewUrl;
    }
    const clean = stripPrivateDeep(a);
    await putJsonFileWithRetry("content/appearance.json", clean, "Mise à jour de l'apparence (admin)");
    state.appearance.data = clean;
    renderApparenceTab();
    showStatus("Apparence enregistrée ✓ Le site se met à jour automatiquement (~1 min).", "success");
  } catch (err) {
    showStatus(`Erreur : ${err.message}`, "error");
  } finally {
    btn.disabled = false;
  }
});

// ========================================================================
// Démarrage
// ========================================================================

async function initApp() {
  try {
    showStatus("Chargement…", "loading");
    const [site, navigation, appearance, contact] = await Promise.all([
      getJsonFile("content/site.json"),
      getJsonFile("content/navigation.json"),
      getJsonFile("content/appearance.json"),
      getJsonFile("content/contact.json"),
    ]);
    state.site = site;
    state.navigation = navigation;
    state.appearance = appearance;
    state.contact = contact;
    statusEl.hidden = true;
  } catch (err) {
    showStatus(`Erreur de chargement : ${err.message}`, "error");
    return;
  }

  renderSidebarPagesList();
  renderNavigationTab();
  renderApparenceTab();
  document.getElementById("stats-jeton").value = state.site.data.statistiques_cloudflare || "";
}

// Statistiques de visite (Cloudflare Web Analytics) : jeton dans
// content/site.json, lu par js/render.js.
document.getElementById("stats-save").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const jeton = document.getElementById("stats-jeton").value.trim();
  if (jeton && !/^[0-9a-f]{32}$/i.test(jeton)) {
    showStatus("Ce jeton ne semble pas valide : il fait 32 caractères (chiffres et lettres de a à f).", "error");
    return;
  }
  btn.disabled = true;
  try {
    showStatus("Enregistrement…", "loading");
    const frais = await getJsonFile("content/site.json");
    if (jeton) frais.data.statistiques_cloudflare = jeton;
    else delete frais.data.statistiques_cloudflare;
    await putJsonFileWithRetry("content/site.json", frais.data, "Statistiques de visite (admin)");
    state.site = await getJsonFile("content/site.json");
    showStatus(jeton ? "Statistiques activées ✓ (visibles sur Cloudflare d'ici quelques minutes)." : "Statistiques désactivées.", "success");
  } catch (err) {
    showStatus(`Erreur : ${err.message}`, "error");
  } finally {
    btn.disabled = false;
  }
});

async function startLoginFlow() {
  if (getToken()) {
    enterApp();
    return;
  }
  showLoginScreen("checking");
  const blob = await fetchAuthBlob().catch(() => null);
  showLoginScreen(blob ? "password" : "setup");
}

startLoginFlow();
