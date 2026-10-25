// Éditeur visuel « mode construction » : construit le rendu RÉEL de la page
// (mêmes classes CSS que js/sections-renderer.js, donc visuellement
// identique au site public) directement dans l'admin, et rend chaque champ
// éditable en place (texte cliquable, photo cliquable) plutôt que par des
// formulaires séparés. Les quelques champs sans équivalent visuel (liens,
// position d'image) restent accessibles via une petite icône ⚙.
//
// Ce fichier ne touche jamais js/sections-renderer.js (utilisé par le site
// public et l'aperçu) : c'est une reconstruction parallèle, volontairement
// dupliquée, pour ne jamais risquer de régression sur le site réel.

// ---------- Champs de texte éditables en place ----------

function wireEditableText(el, obj, key) {
  el.addEventListener("input", () => {
    obj[key] = el.textContent;
  });
  el.addEventListener("blur", () => {
    obj[key] = el.textContent.trim();
    el.textContent = obj[key];
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.preventDefault();
  });
  el.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });
}

function editableSpan(obj, key, opts = {}) {
  const el = document.createElement(opts.tag || "span");
  if (opts.className) el.className = opts.className;
  el.classList.add("admin-editable");
  if (opts.placeholder) el.dataset.placeholder = opts.placeholder;
  el.contentEditable = "true";
  el.textContent = obj[key] || "";
  wireEditableText(el, obj, key);
  return el;
}

// ---------- Photos éditables en place ----------

// `positionedEl` doit déjà avoir position:relative (ou obtenir la classe
// admin-image-hotspot, qui la lui donne) : la superposition se cale dessus.
function attachImageOverlay(positionedEl, img, obj, altObj) {
  positionedEl.classList.add("admin-image-hotspot");

  const overlay = document.createElement("div");
  overlay.className = "admin-image-overlay";

  const label = document.createElement("label");
  label.className = "admin-image-upload-btn";
  label.textContent = "📷 Changer la photo";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.hidden = true;
  label.appendChild(fileInput);
  overlay.appendChild(label);

  const altInput = document.createElement("input");
  altInput.type = "text";
  altInput.className = "admin-image-alt-input";
  altInput.placeholder = "Texte alternatif (accessibilité)";
  altInput.value = altObj.alt || "";
  overlay.appendChild(altInput);

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (typeof verifierDefinition === "function") verifierDefinition(file);
    obj._file = file;
    obj._previewUrl = URL.createObjectURL(file);
    img.src = obj._previewUrl;
  });
  altInput.addEventListener("input", (e) => {
    altObj.alt = e.target.value;
  });
  altInput.addEventListener("click", (e) => e.stopPropagation());

  positionedEl.appendChild(overlay);
  return overlay;
}

// ---------- Réglages additionnels (icône ⚙) pour les champs sans
// équivalent visuel direct : liens, position d'image... ----------

function buildSettingsPopover(fields) {
  const wrap = document.createElement("span");
  wrap.className = "admin-inline-settings";

  const gearBtn = document.createElement("button");
  gearBtn.type = "button";
  gearBtn.className = "admin-gear-btn";
  gearBtn.title = "Réglages (lien, position...)";
  gearBtn.textContent = "⚙";

  const panel = document.createElement("div");
  panel.className = "admin-inline-popover";
  panel.hidden = true;

  fields.forEach((f) => {
    if (f.type === "select") selectField(panel, f.label, f.obj, f.key, f.options);
    else textField(panel, f.label, f.obj, f.key);
  });

  gearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) panel.hidden = true;
  });
  panel.addEventListener("click", (e) => e.stopPropagation());

  wrap.appendChild(gearBtn);
  wrap.appendChild(panel);
  return wrap;
}

// ---------- Constructeurs de sections éditables (un par type) ----------

function buildEditableHero(data) {
  const sectionEl = document.createElement("section");
  sectionEl.className = "hero";

  const img = document.createElement("img");
  img.src = data._previewUrl || sitePath(data.image) || "";
  img.alt = data.alt || "";
  sectionEl.appendChild(img);
  attachImageOverlay(sectionEl, img, data, data);

  const content = document.createElement("div");
  content.className = "container hero-content";

  const eyebrow = editableSpan(data, "eyebrow", { tag: "span", className: "eyebrow", placeholder: "Petite ligne au-dessus du titre" });
  eyebrow.style.color = "#f1ebe1";
  content.appendChild(eyebrow);

  const h1 = document.createElement("h1");
  h1.appendChild(editableSpan(data, "title_line1", { placeholder: "Titre — 1ère ligne" }));
  h1.appendChild(document.createElement("br"));
  h1.appendChild(editableSpan(data, "title_line2", { placeholder: "Titre — 2ème ligne" }));
  content.appendChild(h1);

  content.appendChild(editableSpan(data, "subtitle", { tag: "p", placeholder: "Sous-titre" }));

  const actions = document.createElement("div");
  actions.className = "hero-actions";
  const btn = editableSpan(data, "button_label", { tag: "a", className: "btn btn-primary", placeholder: "Texte du bouton" });
  btn.href = "#";
  actions.appendChild(btn);
  actions.appendChild(buildSettingsPopover([{ label: "Lien du bouton", obj: data, key: "button_href" }]));
  content.appendChild(actions);

  sectionEl.appendChild(content);
  return sectionEl;
}

function buildEditableTexteImage(data) {
  const sectionEl = document.createElement("section");
  const container = document.createElement("div");
  container.className = "container two-col";

  const imgSide = data.image_side === "gauche" ? "gauche" : "droite";

  const textCol = document.createElement("div");
  textCol.style.order = imgSide === "gauche" ? "2" : "1";
  textCol.appendChild(editableSpan(data, "eyebrow", { tag: "span", className: "eyebrow", placeholder: "Petite ligne au-dessus du titre" }));
  textCol.appendChild(editableSpan(data, "title", { tag: "h2", placeholder: "Titre" }));
  textCol.appendChild(editableSpan(data, "text", { tag: "p", className: "lead", placeholder: "Texte" }));

  const btnRow = document.createElement("div");
  const btn = editableSpan(data, "button_label", { tag: "a", className: "btn-secondary", placeholder: "Texte du bouton (optionnel)" });
  btn.href = "#";
  btnRow.appendChild(btn);
  btnRow.appendChild(
    buildSettingsPopover([
      { label: "Lien du bouton", obj: data, key: "button_href" },
      {
        label: "Position de l'image",
        obj: data,
        key: "image_side",
        type: "select",
        options: [
          { value: "droite", label: "À droite du texte" },
          { value: "gauche", label: "À gauche du texte" },
        ],
      },
    ])
  );
  textCol.appendChild(btnRow);
  container.appendChild(textCol);

  const imgWrap = document.createElement("div");
  imgWrap.className = "admin-editable-image-wrap";
  imgWrap.style.order = imgSide === "gauche" ? "1" : "2";
  const img = document.createElement("img");
  img.src = data._previewUrl || sitePath(data.image) || "";
  img.alt = data.alt || "";
  imgWrap.appendChild(img);
  attachImageOverlay(imgWrap, img, data, data);
  container.appendChild(imgWrap);

  sectionEl.appendChild(container);
  return sectionEl;
}

function buildEditableTexte(data) {
  const sectionEl = document.createElement("section");
  sectionEl.className = "page-header";
  const container = document.createElement("div");
  container.className = "container";
  container.appendChild(editableSpan(data, "eyebrow", { tag: "span", className: "eyebrow", placeholder: "Petite ligne au-dessus du titre" }));
  container.appendChild(editableSpan(data, "title", { tag: "h1", placeholder: "Titre" }));
  container.appendChild(editableSpan(data, "text", { tag: "p", className: "lead", placeholder: "Texte" }));
  sectionEl.appendChild(container);
  return sectionEl;
}

function buildEditableGalerieCategories(data) {
  const sectionEl = document.createElement("section");
  sectionEl.className = "section-alt";
  const container = document.createElement("div");
  container.className = "container";
  container.appendChild(editableSpan(data, "eyebrow", { tag: "span", className: "eyebrow", placeholder: "Petite ligne au-dessus du titre" }));
  container.appendChild(editableSpan(data, "title", { tag: "h2", placeholder: "Titre" }));
  container.appendChild(editableSpan(data, "text", { tag: "p", className: "lead", placeholder: "Texte" }));

  const grid = document.createElement("div");
  grid.className = "grid-4";
  (data.teasers || []).forEach((teaser) => {
    const a = document.createElement("a");
    a.className = "teaser-card";
    a.href = "#";
    const img = document.createElement("img");
    img.src = teaser._previewUrl || sitePath(teaser.image) || "";
    img.alt = teaser.alt || "";
    a.appendChild(img);
    attachImageOverlay(a, img, teaser, teaser);
    a.appendChild(editableSpan(teaser, "label", { tag: "span", className: "teaser-label" }));
    grid.appendChild(a);
  });
  container.appendChild(grid);
  sectionEl.appendChild(container);
  return sectionEl;
}

function buildEditablePortfolioGalerie() {
  const sectionEl = document.createElement("section");
  const container = document.createElement("div");
  container.className = "container";
  container.innerHTML = `<p class="admin-hint" style="padding:32px 0">Cette section affiche automatiquement toutes les photos du portfolio (gérées dans l'onglet « Portfolio »), avec les filtres par catégorie. Rien à configurer ici.</p>`;
  sectionEl.appendChild(container);
  return sectionEl;
}

function buildEditableTarifs(data, rerender) {
  data.plans = data.plans || [];
  const sectionEl = document.createElement("section");
  sectionEl.style.paddingTop = "24px";
  const container = document.createElement("div");
  container.className = "container";
  const grid = document.createElement("div");
  grid.className = "pricing-grid";

  data.plans.forEach((plan, idx) => {
    const card = document.createElement("div");
    card.className = plan.highlight ? "price-card highlight" : "price-card";

    const toolbar = document.createElement("div");
    toolbar.className = "admin-plan-toolbar";
    toolbar.innerHTML = `
      <button type="button" class="admin-icon-btn f-up" title="Monter" ${idx === 0 ? "disabled" : ""}>↑</button>
      <button type="button" class="admin-icon-btn f-down" title="Descendre" ${idx === data.plans.length - 1 ? "disabled" : ""}>↓</button>
      <button type="button" class="admin-icon-btn f-highlight ${plan.highlight ? "active" : ""}" title="Mettre en avant">★</button>
      <button type="button" class="admin-icon-btn danger f-delete" title="Supprimer">🗑</button>
    `;
    toolbar.querySelector(".f-up").addEventListener("click", () => {
      if (idx === 0) return;
      swapAdjacent(data.plans, idx, idx - 1);
      rerender();
    });
    toolbar.querySelector(".f-down").addEventListener("click", () => {
      if (idx === data.plans.length - 1) return;
      swapAdjacent(data.plans, idx, idx + 1);
      rerender();
    });
    toolbar.querySelector(".f-highlight").addEventListener("click", () => {
      plan.highlight = !plan.highlight;
      rerender();
    });
    toolbar.querySelector(".f-delete").addEventListener("click", () => {
      if (!confirm("Supprimer cette formule ?")) return;
      data.plans.splice(idx, 1);
      rerender();
    });
    card.appendChild(toolbar);

    const head = document.createElement("div");
    head.className = "price-card-head";
    head.appendChild(editableSpan(plan, "title", { tag: "h3", placeholder: "Nom de la formule" }));
    head.appendChild(editableSpan(plan, "badge", { tag: "span", className: "badge", placeholder: "Badge" }));
    card.appendChild(head);

    const priceTag = document.createElement("div");
    priceTag.className = "price-tag";
    priceTag.appendChild(editableSpan(plan, "price", { className: "price-valeur", placeholder: "Prix" }));
    priceTag.appendChild(document.createTextNode(" "));
    priceTag.appendChild(editableSpan(plan, "price_suffix", { placeholder: "complément" }));
    card.appendChild(priceTag);

    card.appendChild(editableSpan(plan, "subtitle", { tag: "p", className: "price-card-sub", placeholder: "Précision sous le prix (optionnel)" }));

    const ul = document.createElement("ul");
    plan.features = plan.features || [];
    plan.features.forEach((feat, fIdx) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.className = "admin-editable";
      span.contentEditable = "true";
      span.textContent = feat;
      span.addEventListener("input", () => (plan.features[fIdx] = span.textContent));
      span.addEventListener("blur", () => {
        plan.features[fIdx] = span.textContent.trim();
        span.textContent = plan.features[fIdx];
      });
      span.addEventListener("keydown", (e) => {
        if (e.key === "Enter") e.preventDefault();
      });
      li.appendChild(span);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "admin-feature-remove";
      removeBtn.title = "Supprimer cette caractéristique";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        plan.features.splice(fIdx, 1);
        rerender();
      });
      li.appendChild(removeBtn);
      ul.appendChild(li);
    });

    const addFeatLi = document.createElement("li");
    addFeatLi.className = "admin-add-feature";
    const addFeatBtn = document.createElement("button");
    addFeatBtn.type = "button";
    addFeatBtn.textContent = "+ Ajouter une caractéristique";
    addFeatBtn.addEventListener("click", () => {
      plan.features.push("Nouvelle caractéristique");
      rerender();
    });
    addFeatLi.appendChild(addFeatBtn);
    ul.appendChild(addFeatLi);
    card.appendChild(ul);

    const cta = editableSpan(plan, "cta_label", { tag: "a", className: plan.highlight ? "btn btn-primary" : "btn btn-contour", placeholder: "Texte du bouton" });
    cta.href = "#";
    card.appendChild(cta);

    grid.appendChild(card);
  });

  container.appendChild(grid);

  const addPlanBtn = document.createElement("button");
  addPlanBtn.type = "button";
  addPlanBtn.className = "btn-outline btn-small";
  addPlanBtn.style.marginTop = "24px";
  addPlanBtn.textContent = "+ Ajouter une formule";
  addPlanBtn.addEventListener("click", () => {
    data.plans.push({ title: "Nouvelle formule", price: "", price_suffix: "", highlight: false, badge: "", features: [], cta_label: "Choisir cette formule" });
    rerender();
  });
  container.appendChild(addPlanBtn);

  const noteBox = document.createElement("div");
  noteBox.className = "note-box";
  noteBox.style.marginTop = "24px";
  const noteP = editableSpan(data, "note", { tag: "p", placeholder: "Note commune (sous les formules)" });
  noteP.style.margin = "0";
  noteBox.appendChild(noteP);
  container.appendChild(noteBox);

  sectionEl.appendChild(container);
  return sectionEl;
}

function buildEditableCta(data) {
  const wrap = document.createElement("div");
  wrap.className = "cta-band";
  const inner = document.createElement("div");
  inner.className = "cta-band-inner";
  const texte = document.createElement("div");
  texte.appendChild(editableSpan(data, "title", { tag: "h2", placeholder: "Titre" }));
  texte.appendChild(editableSpan(data, "text", { tag: "p", placeholder: "Texte" }));
  inner.appendChild(texte);

  const row = document.createElement("div");
  row.style.display = "inline-flex";
  row.style.alignItems = "center";
  row.style.gap = "4px";
  const btn = editableSpan(data, "button_label", { tag: "a", className: "btn btn-primary", placeholder: "Texte du bouton" });
  btn.href = "#";
  row.appendChild(btn);
  row.appendChild(buildSettingsPopover([{ label: "Lien du bouton", obj: data, key: "button_href" }]));
  inner.appendChild(row);
  wrap.appendChild(inner);
  return wrap;
}

function buildEditableContact(data) {
  const sectionEl = document.createElement("section");
  sectionEl.style.paddingTop = "24px";
  const container = document.createElement("div");
  container.className = "container contact-grid";

  const left = document.createElement("div");
  left.appendChild(editableSpan(data, "coordonnees_title", { tag: "h3", placeholder: "Titre de la colonne coordonnées" }));
  const list = document.createElement("ul");
  list.className = "contact-info-list";

  if (state.contact) {
    const c = state.contact.data;

    const row = (labelText, obj, key, extra) => {
      const li = document.createElement("li");
      li.appendChild(document.createTextNode(labelText));
      li.appendChild(document.createElement("br"));
      li.appendChild(editableSpan(obj, key, { tag: "span" }));
      if (extra) li.appendChild(extra);
      list.appendChild(li);
    };

    row("Email", c, "email");
    row("Instagram", c, "instagram_handle", buildSettingsPopover([{ label: "Lien Instagram complet", obj: c, key: "instagram_url" }]));
    row("Zone d'intervention", c, "zone");
    row("Délai de réponse", c, "response_delay");
  }
  left.appendChild(list);

  const right = document.createElement("div");
  right.appendChild(editableSpan(data, "formulaire_title", { tag: "h3", placeholder: "Titre de la colonne formulaire" }));
  const formNote = document.createElement("p");
  formNote.className = "admin-hint";
  formNote.textContent = "Le formulaire ci-dessous est affiché tel qu'il apparaîtra sur le site (sa structure n'est pas modifiable ici).";
  right.appendChild(formNote);
  const formPreview = document.createElement("div");
  formPreview.className = "admin-form-preview";
  formPreview.innerHTML = `
    <div><label>Nom</label><input type="text" disabled /></div>
    <div><label>Email</label><input type="email" disabled /></div>
    <div><label>Type de séance</label><select disabled><option>Formule découverte</option></select></div>
    <div><label>Message</label><textarea disabled rows="3" placeholder="Dites-m'en un peu plus sur votre projet..."></textarea></div>
    <div class="consent-row"><input type="checkbox" disabled /><label>J'accepte que mes données soient utilisées pour me répondre, conformément à la politique de confidentialité.</label></div>
    <button type="button" class="btn btn-primary" disabled>Envoyer</button>
  `;
  right.appendChild(formPreview);

  container.appendChild(left);
  container.appendChild(right);
  sectionEl.appendChild(container);
  return sectionEl;
}

function buildEditableTexteJuridique(data, rerender) {
  data.blocks = data.blocks || [];
  const sectionEl = document.createElement("section");
  sectionEl.style.paddingTop = "0";
  const container = document.createElement("div");
  container.className = "container legal-content";

  data.blocks.forEach((block, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "admin-legal-block";

    const toolbar = document.createElement("div");
    toolbar.className = "admin-legal-block-toolbar";
    const typeLabel = block.type === "heading" ? "Titre" : block.type === "liste" ? "Liste" : "Paragraphe";
    toolbar.innerHTML = `
      <span class="admin-section-type-badge">${typeLabel}</span>
      <button type="button" class="admin-icon-btn f-up" title="Monter" ${idx === 0 ? "disabled" : ""}>↑</button>
      <button type="button" class="admin-icon-btn f-down" title="Descendre" ${idx === data.blocks.length - 1 ? "disabled" : ""}>↓</button>
      <button type="button" class="admin-icon-btn danger f-delete" title="Supprimer">🗑</button>
    `;
    toolbar.querySelector(".f-up").addEventListener("click", () => {
      if (idx === 0) return;
      swapAdjacent(data.blocks, idx, idx - 1);
      rerender();
    });
    toolbar.querySelector(".f-down").addEventListener("click", () => {
      if (idx === data.blocks.length - 1) return;
      swapAdjacent(data.blocks, idx, idx + 1);
      rerender();
    });
    toolbar.querySelector(".f-delete").addEventListener("click", () => {
      if (!confirm("Supprimer ce bloc ?")) return;
      data.blocks.splice(idx, 1);
      rerender();
    });
    wrap.appendChild(toolbar);

    if (block.type === "heading") {
      wrap.appendChild(editableSpan(block, "text", { tag: "h2", placeholder: "Titre de section" }));
    } else if (block.type === "liste") {
      const ul = document.createElement("ul");
      block.items = block.items || [];
      block.items.forEach((item, iIdx) => {
        const li = document.createElement("li");
        const span = document.createElement("span");
        span.className = "admin-editable";
        span.contentEditable = "true";
        span.textContent = item;
        span.addEventListener("input", () => (block.items[iIdx] = span.textContent));
        span.addEventListener("blur", () => {
          block.items[iIdx] = span.textContent.trim();
          span.textContent = block.items[iIdx];
        });
        span.addEventListener("keydown", (e) => {
          if (e.key === "Enter") e.preventDefault();
        });
        li.appendChild(span);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "admin-feature-remove";
        removeBtn.title = "Supprimer cet élément";
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", () => {
          block.items.splice(iIdx, 1);
          rerender();
        });
        li.appendChild(removeBtn);
        ul.appendChild(li);
      });

      const addLi = document.createElement("li");
      addLi.className = "admin-add-feature";
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "+ Ajouter un élément";
      addBtn.addEventListener("click", () => {
        block.items.push("Nouvel élément");
        rerender();
      });
      addLi.appendChild(addBtn);
      ul.appendChild(addLi);
      wrap.appendChild(ul);
    } else {
      wrap.appendChild(editableSpan(block, "text", { tag: "p", placeholder: "Paragraphe" }));
    }

    container.appendChild(wrap);
  });

  const addRow = document.createElement("div");
  addRow.className = "admin-add-block-row";
  addRow.innerHTML = `
    <button type="button" class="btn-outline btn-small" data-type="heading">+ Titre</button>
    <button type="button" class="btn-outline btn-small" data-type="paragraph">+ Paragraphe</button>
    <button type="button" class="btn-outline btn-small" data-type="liste">+ Liste</button>
  `;
  addRow.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const newBlock = type === "liste" ? { type, items: ["Nouvel élément"] } : { type, text: "" };
      data.blocks.push(newBlock);
      rerender();
    });
  });
  container.appendChild(addRow);

  sectionEl.appendChild(container);
  return sectionEl;
}

// Photo éditable dans un cadre fixe (changer la photo, texte alternatif,
// cadrage via ⚙). Sert aux Polaroïds de l'accueil et à l'en-tête des tarifs.
function editablePhotoFrame(obj, legend, height) {
  const frame = document.createElement("div");
  frame.style.position = "relative";
  frame.style.height = `${height}px`;
  frame.style.borderRadius = "4px";
  frame.style.overflow = "hidden";
  frame.style.background = "#000";

  const img = document.createElement("img");
  img.src = obj._previewUrl || sitePath(obj.image) || "";
  img.alt = obj.alt || "";
  img.style.cssText = `width:100%;height:100%;object-fit:cover;object-position:${obj.position || "50% 50%"};display:block`;
  frame.appendChild(img);
  attachImageOverlay(frame, img, obj, obj);

  const caption = document.createElement("div");
  caption.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:0.85rem;color:var(--couleur-texte-attenue)";
  caption.textContent = legend;
  caption.appendChild(buildSettingsPopover([{ label: "Cadrage de la photo (ex : 50% 30% — horizontal puis vertical)", obj, key: "position" }]));

  const wrap = document.createElement("div");
  wrap.appendChild(frame);
  wrap.appendChild(caption);
  return wrap;
}

function buildEditablePolaroids(data) {
  data.panels = data.panels || [];
  const defauts = [
    { univers: "particuliers", label: "Particuliers", href: "services.html?pour=particuliers" },
    { univers: "commerces", label: "Commerces", href: "services.html?pour=commerces" },
  ];
  while (data.panels.length < 2) data.panels.push({ ...defauts[data.panels.length], title: "", image: "", alt: "", position: "50% 50%" });

  const sectionEl = document.createElement("section");
  sectionEl.className = "polaroids";
  const grille = document.createElement("div");
  grille.className = "container";
  grille.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:40px;align-items:center;padding-top:40px;padding-bottom:40px";

  const texte = document.createElement("div");
  texte.appendChild(editableSpan(data, "eyebrow", { tag: "span", className: "eyebrow", placeholder: "Titre lu par Google (ex. Photographe à Ath)" }));
  texte.appendChild(editableSpan(data, "title", { tag: "p", className: "polaroids-accroche", placeholder: "Accroche" }));
  texte.appendChild(editableSpan(data, "text", { tag: "p", className: "polaroids-intro", placeholder: "Courte présentation (optionnelle)" }));
  grille.appendChild(texte);

  const table = document.createElement("div");
  table.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:20px";
  data.panels.slice(0, 2).forEach((p, i) => {
    const carte = document.createElement("div");
    carte.style.cssText = "background:#f3efe7;color:#2a2622;padding:12px 12px 10px";
    carte.appendChild(editablePhotoFrame(p, `Photo « ${p.label || defauts[i].label} »`, 230));
    const legende = document.createElement("div");
    legende.style.cssText = "display:grid;gap:4px;margin-top:6px";
    legende.appendChild(editableSpan(p, "label", { tag: "span", className: "polaroid-main", placeholder: "Légende manuscrite" }));
    const sous = document.createElement("span");
    sous.appendChild(editableSpan(p, "title", { tag: "span", className: "polaroid-sous", placeholder: "Petite ligne sous la légende" }));
    sous.appendChild(buildSettingsPopover([{ label: "Page ouverte au clic", obj: p, key: "href" }]));
    legende.appendChild(sous);
    carte.appendChild(legende);
    table.appendChild(carte);
  });
  const colonne = document.createElement("div");
  colonne.appendChild(table);
  colonne.appendChild(editableSpan(data, "hint", { tag: "p", className: "polaroids-indice-admin", placeholder: "Petite phrase manuscrite (ex. ↑ choisissez votre photo)" }));
  grille.appendChild(colonne);
  sectionEl.appendChild(grille);

  const hint = document.createElement("p");
  hint.className = "admin-hint container";
  hint.textContent = "Sur le site, les photos sont présentées comme deux Polaroïds posés de travers. Au clic, la photo sort du Polaroïd et glisse vers la page tarifs : pour une transition parfaite, mets la même photo que dans l'en-tête des tarifs. Utilise des photos en pleine définition.";
  sectionEl.appendChild(hint);
  return sectionEl;
}

function buildEditableContactBref(data) {
  const sectionEl = document.createElement("section");
  sectionEl.className = "contact-bref";
  const container = document.createElement("div");
  container.className = "container contact-bref-grid";

  const left = document.createElement("div");
  left.appendChild(editableSpan(data, "eyebrow", { tag: "span", className: "eyebrow", placeholder: "Petite ligne au-dessus du titre" }));
  left.appendChild(editableSpan(data, "title", { tag: "h2", placeholder: "Titre" }));
  left.appendChild(editableSpan(data, "text", { tag: "p", placeholder: "Texte" }));
  const row = document.createElement("div");
  row.style.cssText = "display:inline-flex;align-items:center;gap:4px";
  const btn = editableSpan(data, "button_label", { tag: "a", className: "btn btn-primary", placeholder: "Texte du bouton" });
  btn.href = "#";
  row.appendChild(btn);
  row.appendChild(buildSettingsPopover([{ label: "Lien du bouton", obj: data, key: "button_href" }]));
  left.appendChild(row);

  const right = document.createElement("div");
  const c = (state.contact && state.contact.data) || {};
  right.innerHTML = `
    <dl>
      <dt>Email</dt><dd>${escapeHtml(c.email || "")}</dd>
      <dt>Instagram</dt><dd>${escapeHtml(c.instagram_handle || "")}</dd>
      <dt>Zone</dt><dd>${escapeHtml(c.zone || "")}</dd>
    </dl>
    <p class="admin-hint" style="margin-top:14px">Ces coordonnées se modifient sur la page Contact (section « Coordonnées + formulaire »).</p>
  `;

  container.appendChild(left);
  container.appendChild(right);
  sectionEl.appendChild(container);
  return sectionEl;
}

function buildEditableOngletsTarifs(data) {
  data.tabs = data.tabs || [];
  const sectionEl = document.createElement("section");
  sectionEl.className = "univers-entete";
  const container = document.createElement("div");
  container.className = "container";
  container.style.paddingTop = "32px";
  container.style.paddingBottom = "32px";

  container.appendChild(editableSpan(data, "eyebrow", { tag: "span", className: "eyebrow", placeholder: "Petite ligne au-dessus du titre" }));
  container.appendChild(editableSpan(data, "title", { tag: "p", className: "univers-entete-titre", placeholder: "Titre de la page" }));

  const hint = document.createElement("p");
  hint.className = "admin-hint";
  hint.textContent = "Une photo et une phrase d'introduction par univers. Le visiteur voit celles de l'univers choisi (Particulier / Commerce en haut du site). Pour une transition parfaite depuis l'accueil, mets la même photo et le même cadrage que sur l'accueil.";
  container.appendChild(hint);

  const NOMS = { particuliers: "Particuliers", commerces: "Commerces" };
  const grid = document.createElement("div");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:24px;margin-top:16px";
  data.tabs.forEach((t) => {
    const col = document.createElement("div");
    const titre = document.createElement("p");
    titre.className = "eyebrow";
    titre.textContent = NOMS[t.id] || t.label || t.id;
    col.appendChild(titre);
    col.appendChild(editablePhotoFrame(t, "Photo de l'en-tête", 200));
    col.appendChild(editableSpan(t, "text", { tag: "p", className: "univers-entete-intro", placeholder: "Phrase d'introduction" }));
    grid.appendChild(col);
  });
  container.appendChild(grid);
  sectionEl.appendChild(container);
  return sectionEl;
}

// FAQ : chaque question s'affiche ouverte pour pouvoir modifier la réponse
// (sur le site, elles sont repliées et s'ouvrent au clic).
function buildEditableFaq(data, rerender) {
  data.items = data.items || [];
  const section = document.createElement("section");
  section.className = "faq";
  const container = document.createElement("div");
  container.className = "container faq-inner";

  const entete = document.createElement("div");
  entete.className = "faq-entete";
  entete.appendChild(editableSpan(data, "eyebrow", { className: "eyebrow", placeholder: "Surtitre (optionnel)" }));
  entete.appendChild(editableSpan(data, "title", { tag: "h2", placeholder: "Titre" }));
  container.appendChild(entete);

  const liste = document.createElement("div");
  liste.className = "faq-liste";
  data.items.forEach((item, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "faq-item admin-legal-block";

    const toolbar = document.createElement("div");
    toolbar.className = "admin-legal-block-toolbar";
    toolbar.innerHTML = `
      <span class="admin-section-type-badge">Question</span>
      <button type="button" class="admin-icon-btn f-up" title="Monter" ${idx === 0 ? "disabled" : ""}>↑</button>
      <button type="button" class="admin-icon-btn f-down" title="Descendre" ${idx === data.items.length - 1 ? "disabled" : ""}>↓</button>
      <button type="button" class="admin-icon-btn danger f-delete" title="Supprimer">🗑</button>
    `;
    toolbar.querySelector(".f-up").addEventListener("click", () => {
      if (idx === 0) return;
      swapAdjacent(data.items, idx, idx - 1);
      rerender();
    });
    toolbar.querySelector(".f-down").addEventListener("click", () => {
      if (idx === data.items.length - 1) return;
      swapAdjacent(data.items, idx, idx + 1);
      rerender();
    });
    toolbar.querySelector(".f-delete").addEventListener("click", () => {
      if (!confirm("Supprimer cette question ?")) return;
      data.items.splice(idx, 1);
      rerender();
    });
    wrap.appendChild(toolbar);

    wrap.appendChild(editableSpan(item, "question", { tag: "div", className: "faq-question", placeholder: "Question" }));
    wrap.appendChild(editableSpan(item, "answer", { tag: "p", placeholder: "Réponse" }));
    liste.appendChild(wrap);
  });
  container.appendChild(liste);

  const addRow = document.createElement("div");
  addRow.className = "admin-add-block-row";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-outline btn-small";
  addBtn.textContent = "+ Ajouter une question";
  addBtn.addEventListener("click", () => {
    data.items.push({ question: "", answer: "" });
    rerender();
  });
  addRow.appendChild(addBtn);
  container.appendChild(addRow);

  section.appendChild(container);
  return section;
}

const EDITABLE_BUILDERS = {
  hero: buildEditableHero,
  texte_image: buildEditableTexteImage,
  texte: buildEditableTexte,
  galerie_categories: buildEditableGalerieCategories,
  portfolio_galerie: buildEditablePortfolioGalerie,
  tarifs: buildEditableTarifs,
  cta: buildEditableCta,
  contact: buildEditableContact,
  texte_juridique: buildEditableTexteJuridique,
  polaroids: buildEditablePolaroids,
  contact_bref: buildEditableContactBref,
  onglets_tarifs: buildEditableOngletsTarifs,
  faq: buildEditableFaq,
};

// Sélecteur « Onglet » dans la barre d'outils d'une section, quand la page
// contient une section à onglets (page tarifs).
function buildTabSelect(section, sections) {
  // L'accueil (Polaroïds) est commun aux deux univers ; l'en-tête des
  // tarifs gère déjà les deux.
  if (sections.some((s) => s.type === "polaroids") || section.type === "onglets_tarifs") return null;
  const select = document.createElement("select");
  select.className = "admin-tab-select";
  select.title = "Pour quels visiteurs cette section s'affiche (choix Particulier / Commerce en haut du site)";
  const options = [
    { id: "", label: "Visible pour tous" },
    { id: "particuliers", label: "Particuliers seulement" },
    { id: "commerces", label: "Commerces seulement" },
  ];
  options.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = o.label;
    if ((section.tab || "") === o.id) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => {
    if (select.value) section.tab = select.value;
    else delete section.tab;
  });
  return select;
}

// ---------- Barre d'insertion entre deux sections ----------

function buildInsertBar(sections, atIndex, rerender) {
  const bar = document.createElement("div");
  bar.className = "admin-insert-bar";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "admin-insert-btn";
  btn.textContent = "+ Ajouter une section";
  bar.appendChild(btn);

  const picker = document.createElement("div");
  picker.className = "admin-insert-picker";
  picker.hidden = true;
  SECTION_TYPES.forEach((t) => {
    const optBtn = document.createElement("button");
    optBtn.type = "button";
    optBtn.textContent = t.label;
    optBtn.addEventListener("click", () => {
      sections.splice(atIndex, 0, { id: `s${Date.now()}`, type: t.value, data: t.defaultData() });
      rerender();
    });
    picker.appendChild(optBtn);
  });
  bar.appendChild(picker);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    picker.hidden = !picker.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!bar.contains(e.target)) picker.hidden = true;
  });

  return bar;
}

// ---------- Carte de section (toolbar + contenu) ----------

function buildSectionWrap(section, index, sections, rerender) {
  const wrap = document.createElement("div");
  wrap.className = "admin-section-wrap";

  const toolbar = document.createElement("div");
  toolbar.className = "admin-section-toolbar";
  toolbar.innerHTML = `
    <span class="admin-drag-handle" title="Glisser pour réordonner">⠿⠿</span>
    <span class="admin-section-type-badge">${escapeHtml(sectionTypeLabel(section.type))}</span>
    <button type="button" class="admin-icon-btn f-up" title="Monter" ${index === 0 ? "disabled" : ""}>↑</button>
    <button type="button" class="admin-icon-btn f-down" title="Descendre" ${index === sections.length - 1 ? "disabled" : ""}>↓</button>
    <button type="button" class="admin-icon-btn danger f-delete" title="Supprimer">🗑</button>
  `;
  const tabSelect = buildTabSelect(section, sections);
  if (tabSelect) toolbar.querySelector(".admin-section-type-badge").after(tabSelect);
  toolbar.querySelector(".f-up").addEventListener("click", () => {
    if (index === 0) return;
    swapAdjacent(sections, index, index - 1);
    rerender();
  });
  toolbar.querySelector(".f-down").addEventListener("click", () => {
    if (index === sections.length - 1) return;
    swapAdjacent(sections, index, index + 1);
    rerender();
  });
  toolbar.querySelector(".f-delete").addEventListener("click", () => {
    if (!confirm("Supprimer cette section ?")) return;
    sections.splice(index, 1);
    rerender();
  });

  const builder = EDITABLE_BUILDERS[section.type];
  const content = builder
    ? builder(section.data, rerender)
    : (() => {
        const fallback = document.createElement("p");
        fallback.className = "admin-hint";
        fallback.textContent = `Type de section inconnu : ${section.type}`;
        return fallback;
      })();

  wrap.appendChild(toolbar);
  wrap.appendChild(content);
  return wrap;
}

// ---------- Glisser-déposer des sections (poignée uniquement, pour ne
// jamais entrer en conflit avec la sélection de texte éditable) ----------

function enableSectionDragReorder(root, sections, rerender) {
  const wraps = Array.from(root.querySelectorAll(":scope > .admin-section-wrap"));
  let dragIndex = null;

  wraps.forEach((wrap, i) => {
    const handle = wrap.querySelector(".admin-drag-handle");
    if (handle) {
      handle.draggable = true;
      handle.addEventListener("dragstart", (e) => {
        dragIndex = i;
        wrap.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      handle.addEventListener("dragend", () => wrap.classList.remove("dragging"));
    }
    wrap.addEventListener("dragover", (e) => {
      if (dragIndex === null) return;
      e.preventDefault();
      wrap.classList.add("drag-over");
    });
    wrap.addEventListener("dragleave", () => wrap.classList.remove("drag-over"));
    wrap.addEventListener("drop", (e) => {
      e.preventDefault();
      wrap.classList.remove("drag-over");
      if (dragIndex === null || dragIndex === i) {
        dragIndex = null;
        return;
      }
      reorderArray(sections, dragIndex, i);
      dragIndex = null;
      rerender();
    });
  });
}

// ---------- Point d'entrée ----------

function renderEditableSections(root, sections) {
  const rerender = () => renderEditableSections(root, sections);
  root.innerHTML = "";

  root.appendChild(buildInsertBar(sections, 0, rerender));
  sections.forEach((section, index) => {
    root.appendChild(buildSectionWrap(section, index, sections, rerender));
    root.appendChild(buildInsertBar(sections, index + 1, rerender));
  });

  enableSectionDragReorder(root, sections, rerender);

  // En mode édition, aucun lien ne doit naviguer (ils servent juste de
  // support visuel pour le texte qu'ils portent, rendu éditable ci-dessus) —
  // sauf à l'intérieur de la superposition photo, où le clic doit atteindre
  // normalement le bouton « Changer la photo » et son input fichier natif.
  root.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (e.target.closest(".admin-image-overlay")) return;
      e.preventDefault();
    });
  });
}
