// Admin maison — pas de dépendance externe. Utilise un token d'accès
// personnel GitHub (stocké uniquement dans ce navigateur) pour lire et
// écrire directement les fichiers content/*.json (et uploader des images)
// via l'API REST de GitHub, appelée depuis le navigateur.

const OWNER = "Nicolev24";
const REPO = "Site-photo";
const BRANCH = "main";
const TOKEN_KEY = "site-photo-admin-token";

const CATEGORIES = [
  { value: "portraits", label: "Portraits" },
  { value: "couples", label: "Couples" },
  { value: "entreprises", label: "Entreprises & commerces" },
  { value: "evenements", label: "Événements" },
];

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
    throw new Error(body.message || `Erreur GitHub API (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
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

// ---------- Connexion ----------

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const tokenInput = document.getElementById("token-input");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

async function tryLogin(token) {
  localStorage.setItem(TOKEN_KEY, token);
  try {
    await githubRequest(`/repos/${OWNER}/${REPO}`);
    loginScreen.hidden = true;
    appScreen.hidden = false;
    initApp();
  } catch (err) {
    localStorage.removeItem(TOKEN_KEY);
    loginError.textContent =
      "Connexion impossible : token invalide, expiré, ou sans accès en écriture à ce repo.";
    loginError.hidden = false;
  }
}

loginBtn.addEventListener("click", () => {
  const token = tokenInput.value.trim();
  if (!token) return;
  loginError.hidden = true;
  tryLogin(token);
});

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  window.location.reload();
});

// ---------- Onglets ----------

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach((p) => (p.hidden = true));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.tab}`).hidden = false;
  });
});

// ---------- État ----------

const state = {
  portfolio: null, // { sha, items: [{category, image, alt, _file, _previewUrl}] }
  settings: null,
  services: null,
  contact: null,
};

function categoryOptionsHtml(selected) {
  return CATEGORIES.map(
    (c) => `<option value="${c.value}" ${c.value === selected ? "selected" : ""}>${c.label}</option>`
  ).join("");
}

// ---------- Portfolio ----------

const portfolioList = document.getElementById("portfolio-list");

function renderPortfolioList() {
  portfolioList.innerHTML = "";
  state.portfolio.items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "admin-card";

    const previewSrc = item._previewUrl || sitePath(item.image);

    card.innerHTML = `
      <div class="admin-card-row">
        <div class="admin-card-preview">
          ${previewSrc ? `<img src="${previewSrc}" alt="" />` : ""}
        </div>
        <div class="admin-card-fields">
          <div class="admin-field">
            <label>Catégorie</label>
            <select class="f-category">${categoryOptionsHtml(item.category)}</select>
          </div>
          <div class="admin-field">
            <label>Photo</label>
            <input type="file" class="f-file" accept="image/*" />
          </div>
          <div class="admin-field">
            <label>Description (texte alternatif)</label>
            <input type="text" class="f-alt" value="${item.alt || ""}" />
          </div>
        </div>
      </div>
      <div class="admin-card-toolbar">
        <div class="admin-card-toolbar-left">
          <button type="button" class="admin-icon-btn f-up" ${index === 0 ? "disabled" : ""}>↑ Monter</button>
          <button type="button" class="admin-icon-btn f-down" ${index === state.portfolio.items.length - 1 ? "disabled" : ""}>↓ Descendre</button>
        </div>
        <button type="button" class="admin-icon-btn danger f-delete">Supprimer</button>
      </div>
    `;

    card.querySelector(".f-category").addEventListener("change", (e) => {
      item.category = e.target.value;
    });
    card.querySelector(".f-alt").addEventListener("input", (e) => {
      item.alt = e.target.value;
    });
    card.querySelector(".f-file").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      item._file = file;
      item._previewUrl = URL.createObjectURL(file);
      renderPortfolioList();
    });
    card.querySelector(".f-up").addEventListener("click", () => {
      if (index === 0) return;
      [state.portfolio.items[index - 1], state.portfolio.items[index]] = [
        state.portfolio.items[index],
        state.portfolio.items[index - 1],
      ];
      renderPortfolioList();
    });
    card.querySelector(".f-down").addEventListener("click", () => {
      if (index === state.portfolio.items.length - 1) return;
      [state.portfolio.items[index + 1], state.portfolio.items[index]] = [
        state.portfolio.items[index],
        state.portfolio.items[index + 1],
      ];
      renderPortfolioList();
    });
    card.querySelector(".f-delete").addEventListener("click", () => {
      if (!confirm("Supprimer cette photo du portfolio ?")) return;
      state.portfolio.items.splice(index, 1);
      renderPortfolioList();
    });

    portfolioList.appendChild(card);
  });
}

async function loadPortfolio() {
  if (state.portfolio) return;
  showStatus("Chargement du portfolio…", "loading");
  const { sha, data } = await getJsonFile("content/portfolio.json");
  state.portfolio = { sha, items: data.items };
  renderPortfolioList();
  statusEl.hidden = true;
}

document.getElementById("portfolio-add").addEventListener("click", () => {
  state.portfolio.items.push({ category: "portraits", image: "", alt: "", _file: null });
  renderPortfolioList();
});

document.getElementById("portfolio-save").addEventListener("click", async () => {
  try {
    showStatus("Enregistrement…", "loading");
    for (const item of state.portfolio.items) {
      if (item._file) {
        item.image = await uploadImage(item._file, `images/portfolio/${item.category}`);
        item._file = null;
        item._previewUrl = null;
      }
      if (!item.image) throw new Error("Une photo n'a pas d'image sélectionnée.");
    }
    const cleanItems = state.portfolio.items.map(({ category, image, alt }) => ({
      category,
      image,
      alt,
    }));
    const fresh = await getJsonFile("content/portfolio.json");
    await putJsonFile(
      "content/portfolio.json",
      { items: cleanItems },
      "Mise à jour du portfolio (admin)",
      fresh.sha
    );
    state.portfolio = null;
    await loadPortfolio();
    showStatus("Portfolio enregistré ✓ Le site se met à jour automatiquement (~1 min).", "success");
  } catch (err) {
    showStatus(`Erreur : ${err.message}`, "error");
  }
});

// ---------- Accueil ----------

function renderHeroCard() {
  const hero = state.settings.data.hero;
  const card = document.getElementById("hero-card");
  card.innerHTML = `
    <div class="admin-card-row">
      <div class="admin-card-preview"><img src="${state.settings._heroPreview || sitePath(hero.image)}" alt="" /></div>
      <div class="admin-card-fields">
        <div class="admin-field"><label>Photo</label><input type="file" id="hero-file" accept="image/*" /></div>
        <div class="admin-field"><label>Description (texte alternatif)</label><input type="text" id="hero-alt" value="${hero.alt || ""}" /></div>
        <div class="admin-field"><label>Petite ligne au-dessus du titre</label><input type="text" id="hero-eyebrow" value="${hero.eyebrow || ""}" /></div>
        <div class="admin-field"><label>Titre — 1ère ligne</label><input type="text" id="hero-title1" value="${hero.title_line1 || ""}" /></div>
        <div class="admin-field"><label>Titre — 2ème ligne</label><input type="text" id="hero-title2" value="${hero.title_line2 || ""}" /></div>
        <div class="admin-field"><label>Sous-titre</label><textarea id="hero-subtitle" rows="2">${hero.subtitle || ""}</textarea></div>
      </div>
    </div>
  `;
  card.querySelector("#hero-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    state.settings._heroFile = file;
    state.settings._heroPreview = URL.createObjectURL(file);
    renderHeroCard();
  });
  card.querySelector("#hero-alt").addEventListener("input", (e) => (hero.alt = e.target.value));
  card.querySelector("#hero-eyebrow").addEventListener("input", (e) => (hero.eyebrow = e.target.value));
  card.querySelector("#hero-title1").addEventListener("input", (e) => (hero.title_line1 = e.target.value));
  card.querySelector("#hero-title2").addEventListener("input", (e) => (hero.title_line2 = e.target.value));
  card.querySelector("#hero-subtitle").addEventListener("input", (e) => (hero.subtitle = e.target.value));
}

function renderApproachCard() {
  const approach = state.settings.data.approach;
  const card = document.getElementById("approach-card");
  card.innerHTML = `
    <div class="admin-card-row">
      <div class="admin-card-preview"><img src="${state.settings._approachPreview || sitePath(approach.image)}" alt="" /></div>
      <div class="admin-card-fields">
        <div class="admin-field"><label>Photo (toi)</label><input type="file" id="approach-file" accept="image/*" /></div>
        <div class="admin-field"><label>Description (texte alternatif)</label><input type="text" id="approach-alt" value="${approach.alt || ""}" /></div>
        <div class="admin-field"><label>Petite ligne au-dessus du titre</label><input type="text" id="approach-eyebrow" value="${approach.eyebrow || ""}" /></div>
        <div class="admin-field"><label>Titre</label><input type="text" id="approach-title" value="${approach.title || ""}" /></div>
        <div class="admin-field"><label>Texte</label><textarea id="approach-text" rows="4">${approach.text || ""}</textarea></div>
      </div>
    </div>
  `;
  card.querySelector("#approach-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    state.settings._approachFile = file;
    state.settings._approachPreview = URL.createObjectURL(file);
    renderApproachCard();
  });
  card.querySelector("#approach-alt").addEventListener("input", (e) => (approach.alt = e.target.value));
  card.querySelector("#approach-eyebrow").addEventListener("input", (e) => (approach.eyebrow = e.target.value));
  card.querySelector("#approach-title").addEventListener("input", (e) => (approach.title = e.target.value));
  card.querySelector("#approach-text").addEventListener("input", (e) => (approach.text = e.target.value));
}

function renderTeasersList() {
  const list = document.getElementById("teasers-list");
  list.innerHTML = "";
  state.settings.data.teasers.forEach((teaser) => {
    const card = document.createElement("div");
    card.className = "admin-card";
    const previewSrc = teaser._previewUrl || sitePath(teaser.image);
    card.innerHTML = `
      <div class="admin-card-row">
        <div class="admin-card-preview">${previewSrc ? `<img src="${previewSrc}" alt="" />` : ""}</div>
        <div class="admin-card-fields">
          <div class="admin-field"><label>Catégorie</label><input type="text" value="${CATEGORIES.find((c) => c.value === teaser.category)?.label || teaser.category}" disabled /></div>
          <div class="admin-field"><label>Titre affiché</label><input type="text" class="t-label" value="${teaser.label || ""}" /></div>
          <div class="admin-field"><label>Photo</label><input type="file" class="t-file" accept="image/*" /></div>
          <div class="admin-field"><label>Description (texte alternatif)</label><input type="text" class="t-alt" value="${teaser.alt || ""}" /></div>
        </div>
      </div>
    `;
    card.querySelector(".t-label").addEventListener("input", (e) => (teaser.label = e.target.value));
    card.querySelector(".t-alt").addEventListener("input", (e) => (teaser.alt = e.target.value));
    card.querySelector(".t-file").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      teaser._file = file;
      teaser._previewUrl = URL.createObjectURL(file);
      renderTeasersList();
    });
    list.appendChild(card);
  });
}

async function loadSettings() {
  if (state.settings) return;
  showStatus("Chargement de l'accueil…", "loading");
  const { sha, data } = await getJsonFile("content/settings.json");
  state.settings = { sha, data };
  renderHeroCard();
  renderApproachCard();
  renderTeasersList();
  statusEl.hidden = true;
}

document.getElementById("accueil-save").addEventListener("click", async () => {
  try {
    showStatus("Enregistrement…", "loading");
    const s = state.settings;

    if (s._heroFile) {
      s.data.hero.image = await uploadImage(s._heroFile, "images/uploads");
      s._heroFile = null;
    }
    if (s._approachFile) {
      s.data.approach.image = await uploadImage(s._approachFile, "images/uploads");
      s._approachFile = null;
    }
    for (const teaser of s.data.teasers) {
      if (teaser._file) {
        teaser.image = await uploadImage(teaser._file, "images/uploads");
        teaser._file = null;
        delete teaser._previewUrl;
      }
    }

    const cleanData = {
      hero: s.data.hero,
      approach: s.data.approach,
      teasers: s.data.teasers.map(({ category, label, image, alt }) => ({ category, label, image, alt })),
    };

    const fresh = await getJsonFile("content/settings.json");
    await putJsonFile("content/settings.json", cleanData, "Mise à jour de l'accueil (admin)", fresh.sha);
    state.settings = null;
    await loadSettings();
    showStatus("Accueil enregistré ✓ Le site se met à jour automatiquement (~1 min).", "success");
  } catch (err) {
    showStatus(`Erreur : ${err.message}`, "error");
  }
});

// ---------- Tarifs ----------

const plansList = document.getElementById("plans-list");

function renderPlansList() {
  plansList.innerHTML = "";
  state.services.data.plans.forEach((plan, index) => {
    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="admin-card-fields">
        <div class="admin-field"><label>Nom de la formule</label><input type="text" class="p-title" value="${plan.title || ""}" /></div>
        <div class="admin-field"><label>Prix (ex: 100€ ou Devis)</label><input type="text" class="p-price" value="${plan.price || ""}" /></div>
        <div class="admin-field"><label>Complément après le prix (optionnel)</label><input type="text" class="p-suffix" value="${plan.price_suffix || ""}" /></div>
        <div class="admin-field admin-checkbox-row"><input type="checkbox" class="p-highlight" id="highlight-${index}" ${plan.highlight ? "checked" : ""} /><label for="highlight-${index}">Mettre en avant (bordure colorée)</label></div>
        <div class="admin-field"><label>Badge (optionnel)</label><input type="text" class="p-badge" value="${plan.badge || ""}" /></div>
        <div class="admin-field"><label>Caractéristiques (une par ligne)</label><textarea class="p-features" rows="4">${(plan.features || []).join("\n")}</textarea></div>
        <div class="admin-field"><label>Texte du bouton</label><input type="text" class="p-cta" value="${plan.cta_label || ""}" /></div>
      </div>
      <div class="admin-card-toolbar">
        <div class="admin-card-toolbar-left">
          <button type="button" class="admin-icon-btn f-up" ${index === 0 ? "disabled" : ""}>↑ Monter</button>
          <button type="button" class="admin-icon-btn f-down" ${index === state.services.data.plans.length - 1 ? "disabled" : ""}>↓ Descendre</button>
        </div>
        <button type="button" class="admin-icon-btn danger f-delete">Supprimer</button>
      </div>
    `;
    card.querySelector(".p-title").addEventListener("input", (e) => (plan.title = e.target.value));
    card.querySelector(".p-price").addEventListener("input", (e) => (plan.price = e.target.value));
    card.querySelector(".p-suffix").addEventListener("input", (e) => (plan.price_suffix = e.target.value));
    card.querySelector(".p-highlight").addEventListener("change", (e) => (plan.highlight = e.target.checked));
    card.querySelector(".p-badge").addEventListener("input", (e) => (plan.badge = e.target.value));
    card.querySelector(".p-features").addEventListener("input", (e) => {
      plan.features = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
    });
    card.querySelector(".p-cta").addEventListener("input", (e) => (plan.cta_label = e.target.value));
    card.querySelector(".f-up").addEventListener("click", () => {
      if (index === 0) return;
      const p = state.services.data.plans;
      [p[index - 1], p[index]] = [p[index], p[index - 1]];
      renderPlansList();
    });
    card.querySelector(".f-down").addEventListener("click", () => {
      const p = state.services.data.plans;
      if (index === p.length - 1) return;
      [p[index + 1], p[index]] = [p[index], p[index + 1]];
      renderPlansList();
    });
    card.querySelector(".f-delete").addEventListener("click", () => {
      if (!confirm("Supprimer cette formule ?")) return;
      state.services.data.plans.splice(index, 1);
      renderPlansList();
    });
    plansList.appendChild(card);
  });
}

async function loadServices() {
  if (state.services) return;
  showStatus("Chargement des tarifs…", "loading");
  const { sha, data } = await getJsonFile("content/services.json");
  state.services = { sha, data };
  renderPlansList();
  document.getElementById("services-note").value = data.note || "";
  statusEl.hidden = true;
}

document.getElementById("services-note").addEventListener("input", (e) => {
  if (state.services) state.services.data.note = e.target.value;
});

document.getElementById("plans-add").addEventListener("click", () => {
  state.services.data.plans.push({
    title: "Nouvelle formule",
    price: "",
    price_suffix: "",
    highlight: false,
    badge: "",
    features: [],
    cta_label: "Choisir cette formule",
  });
  renderPlansList();
});

document.getElementById("tarifs-save").addEventListener("click", async () => {
  try {
    showStatus("Enregistrement…", "loading");
    const fresh = await getJsonFile("content/services.json");
    await putJsonFile("content/services.json", state.services.data, "Mise à jour des tarifs (admin)", fresh.sha);
    state.services = null;
    await loadServices();
    showStatus("Tarifs enregistrés ✓ Le site se met à jour automatiquement (~1 min).", "success");
  } catch (err) {
    showStatus(`Erreur : ${err.message}`, "error");
  }
});

// ---------- Contact ----------

function renderContactCard() {
  const c = state.contact.data;
  const card = document.getElementById("contact-card");
  card.innerHTML = `
    <div class="admin-field"><label>Email</label><input type="text" id="c-email" value="${c.email || ""}" /></div>
    <div class="admin-field"><label>Pseudo Instagram (avec @)</label><input type="text" id="c-handle" value="${c.instagram_handle || ""}" /></div>
    <div class="admin-field"><label>Lien Instagram complet</label><input type="text" id="c-url" value="${c.instagram_url || ""}" /></div>
    <div class="admin-field"><label>Zone d'intervention</label><input type="text" id="c-zone" value="${c.zone || ""}" /></div>
    <div class="admin-field"><label>Délai de réponse</label><input type="text" id="c-delay" value="${c.response_delay || ""}" /></div>
  `;
  card.querySelector("#c-email").addEventListener("input", (e) => (c.email = e.target.value));
  card.querySelector("#c-handle").addEventListener("input", (e) => (c.instagram_handle = e.target.value));
  card.querySelector("#c-url").addEventListener("input", (e) => (c.instagram_url = e.target.value));
  card.querySelector("#c-zone").addEventListener("input", (e) => (c.zone = e.target.value));
  card.querySelector("#c-delay").addEventListener("input", (e) => (c.response_delay = e.target.value));
}

async function loadContact() {
  if (state.contact) return;
  showStatus("Chargement des coordonnées…", "loading");
  const { sha, data } = await getJsonFile("content/contact.json");
  state.contact = { sha, data };
  renderContactCard();
  statusEl.hidden = true;
}

document.getElementById("contact-save").addEventListener("click", async () => {
  try {
    showStatus("Enregistrement…", "loading");
    const fresh = await getJsonFile("content/contact.json");
    await putJsonFile("content/contact.json", state.contact.data, "Mise à jour des coordonnées (admin)", fresh.sha);
    state.contact = null;
    await loadContact();
    showStatus("Coordonnées enregistrées ✓ Le site se met à jour automatiquement (~1 min).", "success");
  } catch (err) {
    showStatus(`Erreur : ${err.message}`, "error");
  }
});

// ---------- Démarrage ----------

function initApp() {
  loadPortfolio().catch((err) => showStatus(`Erreur : ${err.message}`, "error"));
  loadSettings().catch((err) => showStatus(`Erreur : ${err.message}`, "error"));
  loadServices().catch((err) => showStatus(`Erreur : ${err.message}`, "error"));
  loadContact().catch((err) => showStatus(`Erreur : ${err.message}`, "error"));
}

if (getToken()) {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  initApp();
}
