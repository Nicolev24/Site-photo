// Espace galeries clients — interface d'administration du Worker
// "galerie-api" (R2 + KV). Aucun secret ici : le mot de passe est vérifié
// par le Worker, qui renvoie une session temporaire (24h) stockée dans ce
// navigateur (localStorage), jamais dans le dépôt.

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

// ---------- Appels API ----------

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getSession();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
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
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Connexion impossible.");
    }
    const { token } = await res.json();
    setSession(token);
    showApp();
    showListView();
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  clearSession();
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
          <div class="admin-hint">${g.photoCount} photo${g.photoCount > 1 ? "s" : ""} · créée le ${dateLabel}</div>
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

async function openGallery(id, token, name, title) {
  currentGalleryId = id;
  currentGalleryToken = token;
  currentGalleryName = name;
  document.getElementById("detail-name").textContent = name;
  document.getElementById("detail-title").textContent = title || "";
  document.getElementById("upload-progress-list").innerHTML = "";
  document.getElementById("client-email-input").value = "";
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
    renderPhotosGrid(gallery.photos);
  } catch (e) {
    grid.innerHTML = "";
    showStatus(`Erreur : ${e.message}`, "error");
  }
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
    tile.innerHTML = `
      <img src="${photoUrl(currentGalleryToken, photo.filename, "thumb")}" alt="" loading="lazy" />
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

// ---------- Génération de miniature (dans le navigateur) ----------

async function generateThumbnail(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, THUMB_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (typeof bitmap.close === "function") bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", THUMB_QUALITY));
    return blob || file;
  } catch (err) {
    console.warn("Miniature impossible à générer, envoi de l'original comme miniature.", err);
    return file;
  }
}

// ---------- Envoi (drag-and-drop + barre de progression) ----------

function createProgressRow(filename) {
  const list = document.getElementById("upload-progress-list");
  const row = document.createElement("div");
  row.className = "galerie-upload-row";
  row.innerHTML = `
    <span class="name">${escapeHtml(filename)}</span>
    <span class="bar-track"><span class="bar-fill"></span></span>
    <span class="status-label">0 %</span>
  `;
  list.appendChild(row);
  return row;
}

function updateProgressRow(row, fraction) {
  row.querySelector(".bar-fill").style.width = `${Math.round(fraction * 100)}%`;
  row.querySelector(".status-label").textContent = `${Math.round(fraction * 100)} %`;
}

function markProgressRowDone(row) {
  row.classList.add("done");
  row.querySelector(".bar-fill").style.width = "100%";
  row.querySelector(".status-label").textContent = "Envoyée";
}

function markProgressRowError(row, message) {
  row.classList.add("error");
  row.querySelector(".status-label").textContent = "Échec";
  row.title = message;
}

function uploadPhotoRequest(id, file, thumbBlob, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("filename", file.name);
    form.append("original", file, file.name);
    form.append("thumb", thumbBlob, file.name);

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
        clearSession();
        showLoginScreen("Session expirée, reconnecte-toi.");
        reject(new Error("Session expirée."));
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

async function uploadFiles(files) {
  const queue = Array.from(files);
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const file = queue[index++];
      const row = createProgressRow(file.name);
      try {
        const thumb = await generateThumbnail(file);
        await uploadPhotoRequest(currentGalleryId, file, thumb, (p) => updateProgressRow(row, p));
        markProgressRowDone(row);
      } catch (err) {
        markProgressRowError(row, err.message);
      }
    }
  }

  const workerCount = Math.min(UPLOAD_CONCURRENCY, queue.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  loadGalleryPhotos();
}

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

if (getSession()) {
  showApp();
  showListView();
}
