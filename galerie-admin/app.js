// Espace galeries clients — interface d'administration du Worker
// "galerie-api" (R2 + KV). Aucun secret ici : le mot de passe est vérifié
// par le Worker, qui renvoie une session temporaire (24h) stockée dans ce
// navigateur (localStorage), jamais dans le dépôt. Le mot de passe est retenu
// dans ce navigateur pour se reconnecter sans rien demander quand elle expire.

const API_BASE = "https://galerie-api.nicoleveugle.workers.dev";
const SESSION_KEY = "galerie-admin-session";
const UPLOAD_CONCURRENCY = 3;
const THUMB_MAX_DIMENSION = 700;
const THUMB_QUALITY = 0.82;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ---------- Session ----------

function getSession() {
  return localStorage.getItem(SESSION_KEY);
}
function setSession(token) {
  localStorage.setItem(SESSION_KEY, token);
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Le mot de passe est retenu dans ce navigateur (même clé que l'administration du
// site) : quand la session expire, on se reconnecte sans rien demander.
const MDP_KEY = "galerie-admin-mdp";

async function loginAvecMotDePasse(password) {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || "Connexion impossible.");
    err.refuse = res.status === 401 || res.status === 403;
    throw err;
  }
  const { token } = await res.json();
  setSession(token);
  try {
    localStorage.setItem(MDP_KEY, password);
  } catch {}
  return token;
}

let reconnexionEnCours = null;
/** Tente de rouvrir la session avec le mot de passe retenu. Renvoie true si c'est réussi. */
function reconnecterSilencieusement() {
  const mdp = localStorage.getItem(MDP_KEY);
  if (!mdp) return Promise.resolve(false);
  if (!reconnexionEnCours) {
    reconnexionEnCours = loginAvecMotDePasse(mdp)
      .then(() => true)
      .catch((e) => {
        // Mot de passe changé : on l'oublie. Simple panne réseau : on le garde.
        if (e.refuse) localStorage.removeItem(MDP_KEY);
        return false;
      })
      .finally(() => {
        reconnexionEnCours = null;
      });
  }
  return reconnexionEnCours;
}

// ---------- Appels API ----------

async function apiFetch(path, options = {}, dejaReessaye = false) {
  const headers = { ...(options.headers || {}) };
  const token = getSession();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    if (!dejaReessaye && (await reconnecterSilencieusement())) return apiFetch(path, options, true);
    clearSession();
    showLoginScreen("Session expirée, reconnecte-toi.");
    throw new Error("Session expirée.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur serveur (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

// ---------- Statut ----------

const statusEl = document.getElementById("admin-status");
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `admin-status ${type}`;
  statusEl.hidden = false;
  if (type === "success") setTimeout(() => (statusEl.hidden = true), 4000);
}

// ---------- Écrans ----------

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const viewList = document.getElementById("view-list");
const viewDetail = document.getElementById("view-detail");

function showLoginScreen(message) {
  loginScreen.hidden = false;
  appScreen.hidden = true;
  const err = document.getElementById("login-error");
  if (message) {
    err.textContent = message;
    err.hidden = false;
  }
}

function showApp() {
  loginScreen.hidden = true;
  appScreen.hidden = false;
}

function showListView() {
  viewList.hidden = false;
  viewDetail.hidden = true;
  loadGalleries();
}

function showDetailView() {
  viewList.hidden = true;
  viewDetail.hidden = false;
}

// ---------- Connexion ----------

document.getElementById("login-btn").addEventListener("click", async () => {
  const password = document.getElementById("password-input").value;
  if (!password) return;
  const err = document.getElementById("login-error");
  err.hidden = true;
  try {
    await loginAvecMotDePasse(password);
    showApp();
    showListView();
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  clearSession();
  try {
    localStorage.removeItem(MDP_KEY);
  } catch {}
  showLoginScreen();
});

document.getElementById("back-to-list-btn").addEventListener("click", showListView);

// ---------- Liste des galeries ----------

async function loadGalleries() {
  const list = document.getElementById("galleries-list");
  try {
    showStatus("Chargement…", "loading");
    const { galleries } = await apiFetch("/api/admin/galleries");
    statusEl.hidden = true;
    renderGalleriesList(galleries);
  } catch (e) {
    list.innerHTML = "";
    showStatus(`Erreur : ${e.message}`, "error");
  }
}

function clientLinkFor(token) {
  return `${window.location.origin}/galerie/?g=${token}`;
}

function renderGalleriesList(galleries) {
  const list = document.getElementById("galleries-list");
  list.innerHTML = "";
  if (!galleries.length) {
    list.innerHTML = `<p class="admin-hint">Aucune galerie pour l'instant.</p>`;
    return;
  }
  galleries.forEach((g) => {
    const card = document.createElement("div");
    card.className = "admin-card";
    const dateLabel = new Date(g.createdAt).toLocaleDateString("fr-BE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    card.innerHTML = `
      <div class="galerie-admin-card-row">
        <div>
          <strong>${escapeHtml(g.name)}</strong>
          ${g.title ? `<div class="admin-hint">${escapeHtml(g.title)}</div>` : ""}
          <div class="admin-hint">${g.photoCount} photo${g.photoCount > 1 ? "s" : ""} · créée le ${dateLabel}${g.favoriteCount ? ` · <strong>♥ ${g.favoriteCount} favori${g.favoriteCount > 1 ? "s" : ""}</strong>` : ""}</div>
        </div>
        <div class="galerie-admin-card-actions">
          <button type="button" class="btn-outline btn-small f-open">Ouvrir</button>
          <button type="button" class="btn-outline btn-small f-copy">Copier le lien</button>
          <button type="button" class="admin-icon-btn danger f-delete">Supprimer</button>
        </div>
      </div>
    `;
    card.querySelector(".f-open").addEventListener("click", () => openGallery(g.id, g.token, g.name, g.title));
    card.querySelector(".f-copy").addEventListener("click", () => copyClientLink(g.token));
    card.querySelector(".f-delete").addEventListener("click", () => deleteGallery(g.id, g.name));
    list.appendChild(card);
  });
}

async function copyClientLink(token) {
  const link = clientLinkFor(token);
  try {
    await navigator.clipboard.writeText(link);
    showStatus("Lien copié dans le presse-papiers ✓", "success");
  } catch {
    window.prompt("Copie ce lien :", link);
  }
}

document.getElementById("create-gallery-btn").addEventListener("click", async () => {
  const nameInput = document.getElementById("new-gallery-name");
  const titleInput = document.getElementById("new-gallery-title");
  const name = nameInput.value.trim();
  const title = titleInput.value.trim();
  if (!name) {
    showStatus("Le nom du client est requis.", "error");
    return;
  }
  try {
    showStatus("Création…", "loading");
    await apiFetch("/api/admin/galleries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, title }),
    });
    nameInput.value = "";
    titleInput.value = "";
    showStatus("Galerie créée ✓", "success");
    loadGalleries();
  } catch (e) {
    showStatus(`Erreur : ${e.message}`, "error");
  }
});

async function deleteGallery(id, name) {
  if (!confirm(`Supprimer définitivement la galerie « ${name} » et toutes ses photos ?`)) return;
  try {
    showStatus("Suppression…", "loading");
    await apiFetch(`/api/admin/galleries/${id}`, { method: "DELETE" });
    showStatus("Galerie supprimée ✓", "success");
    loadGalleries();
  } catch (e) {
    showStatus(`Erreur : ${e.message}`, "error");
  }
}

// ---------- Détail d'une galerie ----------

let currentGalleryId = null;
let currentGalleryToken = null;
let currentGalleryName = null;
let currentPhotoNames = [];

async function openGallery(id, token, name, title) {
  currentGalleryId = id;
  currentGalleryToken = token;
  currentGalleryName = name;
  document.getElementById("detail-name").textContent = name;
  document.getElementById("detail-title").textContent = title || "";
  document.getElementById("upload-progress-list").innerHTML = "";
  currentPhotoNames = [];
  document.getElementById("client-email-input").value = "";
  document.getElementById("gallery-message").value = "";
  showDetailView();
  await loadGalleryPhotos();
}

document.getElementById("copy-link-btn").addEventListener("click", () => {
  if (currentGalleryToken) copyClientLink(currentGalleryToken);
});

document.getElementById("regenerate-link-btn").addEventListener("click", async () => {
  if (!currentGalleryId) return;
  if (!confirm("Régénérer le lien ? L'ancien lien cessera immédiatement de fonctionner.")) return;
  try {
    showStatus("Régénération du lien…", "loading");
    const { token } = await apiFetch(`/api/admin/galleries/${currentGalleryId}/regenerate-link`, { method: "POST" });
    currentGalleryToken = token;
    showStatus("Nouveau lien généré ✓", "success");
  } catch (e) {
    showStatus(`Erreur : ${e.message}`, "error");
  }
});

document.getElementById("save-message-btn").addEventListener("click", async () => {
  if (!currentGalleryId) return;
  const message = document.getElementById("gallery-message").value.trim();
  try {
    showStatus("Enregistrement…", "loading");
    await apiFetch(`/api/admin/galleries/${currentGalleryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    showStatus(message ? "Mot enregistré ✓ : il s'affiche sous la couverture." : "Mot retiré ✓", "success");
  } catch (e) {
    // Worker pas encore mis à jour : la route n'existe pas
    const ancien = /Introuvable|404/.test(e.message);
    showStatus(ancien ? "Pour activer cette fonction, il faut mettre à jour le Worker Cloudflare (colle la dernière version du code, comme pour les statistiques)." : `Erreur : ${e.message}`, "error");
  }
});

document.getElementById("send-email-btn").addEventListener("click", () => {
  const emailInput = document.getElementById("client-email-input");
  const email = emailInput.value.trim();
  if (!email) {
    showStatus("L'email du client est requis.", "error");
    return;
  }
  if (!currentGalleryToken) return;
  const link = clientLinkFor(currentGalleryToken);
  const subject = `Vos photos${currentGalleryName ? ` — ${currentGalleryName}` : ""}`;
  const body = `Bonjour,\n\nVos photos sont en ligne. Vous pouvez les consulter et les télécharger ici :\n${link}\n\nBien à vous,\nNicolas Leveugle`;
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
});

async function loadGalleryPhotos() {
  const grid = document.getElementById("photos-grid");
  try {
    const gallery = await apiFetch(`/api/admin/galleries/${currentGalleryId}`);
    currentFavoris = new Set(gallery.favoris || []);
    currentPhotoNames = (gallery.photos || []).map((p) => p.filename);
    document.getElementById("gallery-message").value = gallery.message || "";
    renderFavorisResume(gallery.favorisUpdatedAt);
    renderPhotosGrid(gallery.photos);
  } catch (e) {
    grid.innerHTML = "";
    showStatus(`Erreur : ${e.message}`, "error");
  }
}

// ---------- Favoris choisis par le client ----------

let currentFavoris = new Set();

/** Nom d'origine de la photo (sans le préfixe ajouté à l'envoi) : « 1739…-dsc4139.jpg » → « DSC4139 ». */
function nomOrigine(filename) {
  return filename
    .replace(/^\d+-/, "")
    .replace(/^-+/, "")
    .replace(/\.[^.]+$/, "")
    .toUpperCase();
}

function renderFavorisResume(updatedAt) {
  const el = document.getElementById("favoris-resume");
  if (!el) return;
  if (!currentFavoris.size) {
    el.innerHTML = `<span class="admin-hint">Le client n'a pas encore choisi de favoris.</span>`;
    return;
  }
  const date = updatedAt ? new Date(updatedAt).toLocaleString("fr-BE", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
  el.innerHTML = `
    <strong>♥ ${currentFavoris.size} favori${currentFavoris.size > 1 ? "s" : ""}</strong>
    <span class="admin-hint">${date ? `mis à jour le ${escapeHtml(date)}` : ""}</span>
    <button type="button" class="btn-outline btn-small" id="copier-favoris-btn">Copier la liste</button>
  `;
  document.getElementById("copier-favoris-btn").addEventListener("click", async () => {
    // Une liste de noms, à coller dans l'Assistant photo (ou à chercher dans Lightroom).
    const texte = [...currentFavoris].map(nomOrigine).join(" ");
    try {
      await navigator.clipboard.writeText(texte);
      showStatus("Liste des favoris copiée ✓ — collez-la dans l'Assistant photo (Favoris du client).", "success");
    } catch {
      prompt("Copiez la liste des favoris :", texte);
    }
  });
}

function photoUrl(token, filename, variant) {
  return `${API_BASE}/api/gallery/${token}/photo/${encodeURIComponent(filename)}?variant=${variant}`;
}

function renderPhotosGrid(photos) {
  const grid = document.getElementById("photos-grid");
  grid.innerHTML = "";
  photos.forEach((photo) => {
    const tile = document.createElement("div");
    tile.className = "galerie-photo-tile";
    const favori = currentFavoris.has(photo.filename);
    if (favori) tile.classList.add("favori");
    tile.innerHTML = `
      <img src="${photoUrl(currentGalleryToken, photo.filename, "thumb")}" alt="" loading="lazy" />
      ${favori ? `<span class="favori-badge" title="Favori du client">♥</span>` : ""}
      <button type="button" class="delete-btn" title="Supprimer cette photo">×</button>
    `;
    tile.querySelector(".delete-btn").addEventListener("click", () => deletePhoto(photo.filename));
    grid.appendChild(tile);
  });
}

async function deletePhoto(filename) {
  if (!confirm("Supprimer cette photo ?")) return;
  try {
    await apiFetch(`/api/admin/galleries/${currentGalleryId}/photos/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
    loadGalleryPhotos();
  } catch (e) {
    showStatus(`Erreur : ${e.message}`, "error");
  }
}

// ---------- Envoi des photos : léger, patient, reprenable ----------
//
// Les photos sont réduites dans le navigateur avant l'envoi (mode « allégé »),
// envoyées 1 ou 2 à la fois, réessayées en cas d'échec, et on peut mettre
// l'envoi en pause. Les fichiers RAW ne peuvent pas être lus par un navigateur :
// ils sont refusés avec un message clair plutôt qu'envoyés en pleine taille.

const EXT_RAW = /\.(nef|nrw|arw|srf|sr2|cr2|cr3|crw|raf|orf|rw2|rwl|dng|pef|srw|3fr|iiq|erf|kdc|mrw|x3f|raw)$/i;
const DIMENSION_ALLEGEE = 2400;
const QUALITE_ALLEGEE = 0.85;
const CLE_OPTIONS_ENVOI = "galerie-admin-envoi";

function lireOptionsEnvoi() {
  try {
    return { qualite: "allegee", debit: "normal", ...JSON.parse(localStorage.getItem(CLE_OPTIONS_ENVOI) || "{}") };
  } catch {
    return { qualite: "allegee", debit: "normal" };
  }
}
function ecrireOptionsEnvoi() {
  const o = { qualite: document.getElementById("envoi-qualite").value, debit: document.getElementById("envoi-debit").value };
  try {
    localStorage.setItem(CLE_OPTIONS_ENVOI, JSON.stringify(o));
  } catch {}
  return o;
}

function canvasVersBlob(canvas, qualite) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", qualite));
}

function redimensionner(bitmap, maxDim) {
  const echelle = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * echelle));
  const h = Math.max(1, Math.round(bitmap.height * echelle));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

/** Prépare ce qui sera envoyé : l'image (allégée ou d'origine) et sa miniature. La photo n'est lue qu'une fois. */
async function preparer(file, qualite) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Format illisible par le navigateur : exporte la photo en JPEG.");
  }
  try {
    const miniature = await canvasVersBlob(redimensionner(bitmap, THUMB_MAX_DIMENSION), THUMB_QUALITY);
    if (!miniature) throw new Error("Miniature impossible.");
    const nom = file.name;
    if (qualite === "pleine") return { original: file, nom, thumb: miniature };
    const grand = Math.max(bitmap.width, bitmap.height);
    const dejaLegere = grand <= DIMENSION_ALLEGEE && file.size <= 1.6 * 1024 * 1024 && /jpe?g$/i.test(file.name);
    if (dejaLegere) return { original: file, nom, thumb: miniature };
    const allegee = await canvasVersBlob(redimensionner(bitmap, DIMENSION_ALLEGEE), QUALITE_ALLEGEE);
    if (!allegee) throw new Error("Réduction impossible.");
    // On garde le nom d'origine (DSC4139) : c'est lui qui sert à retrouver la photo dans Lightroom.
    return { original: allegee, nom: nom.replace(/\.[^.]+$/, "") + ".jpg", thumb: miniature };
  } finally {
    if (typeof bitmap.close === "function") bitmap.close();
  }
}

// ---------- Envoi (glisser-déposer, file d'attente, progression) ----------

function createProgressRow(filename) {
  const list = document.getElementById("upload-progress-list");
  const row = document.createElement("div");
  row.className = "galerie-upload-row";
  row.innerHTML = `
    <span class="name">${escapeHtml(filename)}</span>
    <span class="bar-track"><span class="bar-fill"></span></span>
    <span class="status-label">En attente</span>
  `;
  list.appendChild(row);
  return row;
}

function updateProgressRow(row, fraction) {
  row.querySelector(".bar-fill").style.width = `${Math.round(fraction * 100)}%`;
  row.querySelector(".status-label").textContent = `${Math.round(fraction * 100)} %`;
}

function setRowLabel(row, texte) {
  row.querySelector(".status-label").textContent = texte;
}

function markProgressRowDone(row) {
  row.classList.add("done");
  row.querySelector(".bar-fill").style.width = "100%";
  setRowLabel(row, "Envoyée");
  // La liste reste courte : seules les photos à vérifier restent affichées.
  setTimeout(() => row.remove(), 2500);
}

function markProgressRowError(row, message) {
  row.classList.add("error");
  setRowLabel(row, "Échec");
  row.title = message;
  const detail = document.createElement("span");
  detail.className = "upload-detail";
  detail.textContent = message;
  row.appendChild(detail);
}

function markProgressRowSkipped(row, message) {
  row.classList.add("skipped");
  setRowLabel(row, message);
}

function uploadPhotoRequest(id, prepare, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("filename", prepare.nom);
    form.append("original", prepare.original, prepare.nom);
    form.append("thumb", prepare.thumb, prepare.nom);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/admin/galleries/${id}/photos`);
    xhr.setRequestHeader("Authorization", `Bearer ${getSession()}`);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else if (xhr.status === 401) {
        const err = new Error("Session expirée.");
        err.session = true;
        reject(err);
      } else {
        let message = `Erreur serveur (${xhr.status})`;
        try {
          message = JSON.parse(xhr.responseText).error || message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'envoi."));
    xhr.send(form);
  });
}

/** Nom sans préfixe, sans extension, en minuscules : sert à reconnaître une photo déjà envoyée. */
function cleDoublon(nom) {
  return String(nom || "")
    .toLowerCase()
    .replace(/[^a-z0-9.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\d+-/, "")
    .replace(/^-+/, "")
    .replace(/\.[^.]+$/, "");
}

const envoi = {
  actif: false,
  pause: false,
  file: [],
  total: 0,
  envoyees: 0,
  echecs: [],
  debuts: [],
  premier: 0,
  octets: 0,
};

function attendre(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formaterDuree(ms) {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

function majResumeEnvoi(fin) {
  const bloc = document.getElementById("envoi-resume");
  if (!bloc) return;
  const traitees = envoi.envoyees + envoi.echecs.length;
  bloc.hidden = envoi.total === 0;
  const pct = envoi.total ? Math.round((traitees / envoi.total) * 100) : 0;
  document.getElementById("envoi-barre").style.width = `${pct}%`;
  let texte = `${envoi.envoyees} / ${envoi.total} photos envoyées`;
  if (envoi.echecs.length) texte += ` · ${envoi.echecs.length} à relancer`;
  if (!fin && envoi.envoyees >= 3) {
    const ecoule = Date.now() - envoi.premier;
    const reste = (ecoule / envoi.envoyees) * (envoi.total - traitees);
    if (!envoi.pause) texte += ` · il reste environ ${formaterDuree(reste)}`;
  }
  if (envoi.pause && !fin) texte += " · en pause";
  if (fin) texte += envoi.echecs.length ? " · terminé, quelques photos n'ont pas pu partir" : " · terminé ✓";
  document.getElementById("envoi-texte").textContent = texte;
  document.getElementById("envoi-pause").hidden = fin || !envoi.actif;
  document.getElementById("envoi-pause").textContent = envoi.pause ? "▶ Reprendre" : "⏸ Pause";
  document.getElementById("envoi-relancer").hidden = !(fin && envoi.echecs.length);
}

async function envoyerUne(item, options) {
  const { file, row } = item;
  let essais = 0;
  for (;;) {
    while (envoi.pause) await attendre(400);
    try {
      setRowLabel(row, essais ? `Nouvel essai ${essais}…` : "Préparation…");
      const prepare = await preparer(file, options.qualite);
      const debut = Date.now();
      await uploadPhotoRequest(currentGalleryId, prepare, (p) => updateProgressRow(row, p));
      envoi.octets += prepare.original.size || 0;
      return Date.now() - debut;
    } catch (err) {
      if (err.session) {
        // Session expirée pendant l'envoi : on se reconnecte tout seul, sans perdre la file.
        if (essais < 3 && (await reconnecterSilencieusement())) {
          essais++;
          continue;
        }
        clearSession();
        showLoginScreen("Session expirée, reconnecte-toi.");
        err.fatal = true;
        throw err;
      }
      if (err.fatal || /Format illisible|Miniature|Réduction/.test(err.message) || essais >= 2) throw err;
      essais++;
      row.querySelector(".bar-fill").style.width = "0%";
      await attendre(2000 * essais);
    }
  }
}

async function demarrerEnvoi(items, options) {
  envoi.file.push(...items);
  if (envoi.actif) {
    envoi.total += items.length;
    majResumeEnvoi(false);
    return;
  }
  envoi.actif = true;
  envoi.pause = false;
  envoi.total = items.length;
  envoi.envoyees = 0;
  envoi.echecs = [];
  envoi.premier = Date.now();
  majResumeEnvoi(false);
  window.addEventListener("beforeunload", avantFermeture);

  const simultanees = options.debit === "discret" ? 1 : 2;
  async function ouvrier() {
    while (envoi.file.length) {
      const item = envoi.file.shift();
      try {
        const duree = await envoyerUne(item, options);
        envoi.envoyees++;
        markProgressRowDone(item.row);
        // Débit discret : on laisse autant de temps de repos que d'envoi pour ne pas saturer la connexion.
        if (options.debit === "discret") await attendre(Math.min(8000, Math.max(500, duree)));
      } catch (err) {
        envoi.echecs.push(item);
        markProgressRowError(item.row, err.message);
      }
      majResumeEnvoi(false);
    }
  }
  await Promise.all(Array.from({ length: Math.min(simultanees, items.length) }, ouvrier));
  envoi.actif = false;
  window.removeEventListener("beforeunload", avantFermeture);
  majResumeEnvoi(true);
  loadGalleryPhotos();
}

function avantFermeture(e) {
  e.preventDefault();
  e.returnValue = "";
}

async function uploadFiles(files) {
  const options = ecrireOptionsEnvoi();
  const dejaEnvoyees = new Set((currentPhotoNames || []).map(cleDoublon));
  const items = [];
  let ignorees = 0;
  Array.from(files).forEach((file) => {
    if (EXT_RAW.test(file.name)) {
      const row = createProgressRow(file.name);
      markProgressRowSkipped(row, "RAW : à exporter en JPEG");
      row.title = "Un navigateur ne peut pas lire les fichiers RAW. Exporte la photo en JPEG depuis Lightroom (voir l'aide ci-dessus).";
      ignorees++;
      return;
    }
    if (file.type && !file.type.startsWith("image/")) return;
    if (dejaEnvoyees.has(cleDoublon(file.name))) {
      ignorees++;
      return;
    }
    dejaEnvoyees.add(cleDoublon(file.name));
    items.push({ file, row: createProgressRow(file.name) });
  });
  if (ignorees) showStatus(`${ignorees} fichier${ignorees > 1 ? "s" : ""} ignoré${ignorees > 1 ? "s" : ""} (RAW ou déjà envoyé${ignorees > 1 ? "s" : ""}).`, "info");
  if (items.length) await demarrerEnvoi(items, options);
}

document.getElementById("envoi-pause").addEventListener("click", () => {
  envoi.pause = !envoi.pause;
  majResumeEnvoi(false);
});

document.getElementById("envoi-relancer").addEventListener("click", () => {
  const reprises = envoi.echecs.splice(0);
  reprises.forEach((item) => {
    item.row.classList.remove("error");
    item.row.querySelectorAll(".upload-detail").forEach((e) => e.remove());
    item.row.querySelector(".bar-fill").style.width = "0%";
    setRowLabel(item.row, "En attente");
  });
  if (reprises.length) demarrerEnvoi(reprises, ecrireOptionsEnvoi());
});

(() => {
  const o = lireOptionsEnvoi();
  document.getElementById("envoi-qualite").value = o.qualite;
  document.getElementById("envoi-debit").value = o.debit;
  ["envoi-qualite", "envoi-debit"].forEach((id) => document.getElementById(id).addEventListener("change", ecrireOptionsEnvoi));
})();

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) uploadFiles(e.target.files);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
  })
);
dropZone.addEventListener("drop", (e) => {
  const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
  if (files.length) uploadFiles(files);
});

// ---------- Démarrage ----------

(async function demarrer() {
  if (!getSession()) await reconnecterSilencieusement();
  if (getSession()) {
    showApp();
    showListView();
  }
})();
