// Ce que les moteurs de recherche lisent directement dans les pages HTML.
//
// Le site construit ses pages avec JavaScript à partir de content/*.json.
// Google sait l'exécuter, mais pas tous les robots, et jamais aussi vite.
// Ce script écrit donc dans chaque page :
// - une « version texte » du contenu (titres, tarifs, FAQ, photos avec leur
//   description) dans un <noscript>, entre les marqueurs
//   <!-- version-texte:debut --> et <!-- version-texte:fin --> ;
// - sur l'accueil, la fiche d'identité de l'entreprise pour Google
//   (données structurées JSON-LD : photographe à Ath, zone, formules et prix).
// Les visiteurs ne voient aucune différence : avec JavaScript, le contenu
// <noscript> est ignoré puis remplacé par la page normale.
//
// Lancé par .github/workflows/images.yml après chaque modification (donc
// aussi après un enregistrement dans l'admin). À la main :
// cd outils && node version-texte.mjs

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://nicolasleveugle.be/";
const abs = (p) => path.join(RACINE, p);
const lireJson = async (p) => JSON.parse(await fs.readFile(abs(p), "utf8"));

// Zone desservie annoncée à Google (même zone que sur la fiche Google).
const ZONES = [
  { "@type": "City", name: "Ath" },
  { "@type": "AdministrativeArea", name: "Wallonie" },
  { "@type": "City", name: "Bruxelles" },
];

const UNIVERS = { particuliers: "Particuliers", commerces: "Commerces" };
const CATEGORIES = {
  portraits: "Portraits",
  couples: "Couples",
  entreprises: "Entreprises & commerces",
  evenements: "Événements",
};

const echapper = (v) =>
  String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function prixNumerique(prix) {
  const m = String(prix || "").replace(/\s/g, "").match(/^(\d+(?:[.,]\d+)?)€?$/);
  return m ? m[1].replace(",", ".") : null;
}

// ---------- Version texte d'une page ----------

function versionTexte(page, donnees) {
  const { contact, portfolio, images } = donnees;
  let h1Fait = false;
  const titre = (texte, niveau = 2) => {
    if (!texte) return "";
    if (!h1Fait) {
      h1Fait = true;
      return `<h1>${echapper(texte)}</h1>`;
    }
    return `<h${niveau}>${echapper(texte)}</h${niveau}>`;
  };
  const suffixe = (s) => (s.tab && UNIVERS[s.tab] ? ` — ${UNIVERS[s.tab]}` : "");
  const img = (src, alt) => {
    const info = images[src];
    const dims = info ? ` width="${info.l}" height="${info.h}"` : "";
    return `<img src="${echapper(src)}" alt="${echapper(alt)}"${dims} loading="lazy" />`;
  };

  const morceaux = [];
  for (const s of page.sections || []) {
    const d = s.data || {};
    switch (s.type) {
      case "diptyque":
        morceaux.push(titre(d.eyebrow, 1));
        if (d.title) morceaux.push(`<p>${echapper(d.title)}</p>`);
        if (d.text) morceaux.push(`<p>${echapper(d.text)}</p>`);
        for (const p of d.panels || []) {
          morceaux.push(`<h2><a href="${echapper(p.href)}">${echapper(p.label)} : ${echapper(p.title)}</a></h2>`);
          if (p.image) morceaux.push(img(p.image, p.alt));
        }
        break;
      case "onglets_tarifs":
        morceaux.push(titre(d.eyebrow, 1));
        if (d.title) morceaux.push(`<p>${echapper(d.title)}</p>`);
        for (const t of d.tabs || []) {
          morceaux.push(`<h2>${echapper(UNIVERS[t.id] || t.label)}</h2><p>${echapper(t.text)}</p>`);
          if (t.image) morceaux.push(img(t.image, t.alt));
        }
        break;
      case "texte":
        if (d.eyebrow) morceaux.push(`<p>${echapper(d.eyebrow)}</p>`);
        morceaux.push(titre(d.title));
        if (d.text) morceaux.push(`<p>${echapper(d.text)}</p>`);
        break;
      case "tarifs":
        morceaux.push(`<h2>Tarifs${echapper(suffixe(s))}</h2>`);
        for (const p of d.plans || []) {
          const prix = [p.price, p.price_suffix].filter(Boolean).join(" ");
          morceaux.push(`<h3>${echapper(p.title)} : ${echapper(prix)}</h3>`);
          if (p.subtitle) morceaux.push(`<p>${echapper(p.subtitle)}</p>`);
          morceaux.push(`<ul>${(p.features || []).map((f) => `<li>${echapper(f)}</li>`).join("")}</ul>`);
        }
        if (d.note) morceaux.push(`<p>${echapper(d.note)}</p>`);
        break;
      case "faq":
        morceaux.push(`<h2>${echapper((d.title || "Questions fréquentes") + suffixe(s))}</h2>`);
        for (const q of d.items || []) {
          if (q.question) morceaux.push(`<h3>${echapper(q.question)}</h3><p>${echapper(q.answer)}</p>`);
        }
        break;
      case "cta":
      case "contact_bref":
        morceaux.push(titre(d.title));
        if (d.text) morceaux.push(`<p>${echapper(d.text)}</p>`);
        if (d.button_label) morceaux.push(`<p><a href="${echapper(d.button_href || "contact.html")}">${echapper(d.button_label)}</a></p>`);
        break;
      case "contact":
        morceaux.push(titre(d.coordonnees_title || "Coordonnées"));
        break;
      case "portfolio_galerie":
        for (const [cat, libelle] of Object.entries(CATEGORIES)) {
          const photos = (portfolio.items || []).filter((i) => i.category === cat);
          if (!photos.length) continue;
          morceaux.push(`<h2>${echapper(libelle)}</h2>`);
          morceaux.push(photos.map((i) => img(i.image, i.alt)).join(""));
        }
        break;
      case "texte_juridique":
        for (const b of d.blocks || []) {
          if (b.type === "heading") morceaux.push(`<h2>${echapper(b.text)}</h2>`);
          else if (b.type === "liste") morceaux.push(`<ul>${(b.items || []).map((i) => `<li>${echapper(i)}</li>`).join("")}</ul>`);
          else morceaux.push(`<p>${echapper(b.text)}</p>`);
        }
        break;
      case "hero":
      case "texte_image":
        if (d.eyebrow) morceaux.push(`<p>${echapper(d.eyebrow)}</p>`);
        morceaux.push(titre([d.title_line1, d.title_line2, d.title].filter(Boolean).join(" ")));
        if (d.subtitle || d.text) morceaux.push(`<p>${echapper(d.subtitle || d.text)}</p>`);
        if (d.image) morceaux.push(img(d.image, d.alt));
        break;
      case "galerie_categories":
        morceaux.push(titre(d.title));
        if (d.text) morceaux.push(`<p>${echapper(d.text)}</p>`);
        break;
      default:
        break;
    }
    if (s.type === "contact" || s.type === "contact_bref") {
      morceaux.push(
        `<ul><li>Email : <a href="mailto:${echapper(contact.email)}">${echapper(contact.email)}</a></li>` +
          `<li>Instagram : <a href="${echapper(contact.instagram_url)}">${echapper(contact.instagram_handle)}</a></li>` +
          `<li>Zone : ${echapper(contact.zone)}</li></ul>`
      );
    }
  }
  return morceaux.filter(Boolean).join("\n");
}

// ---------- Fiche d'identité pour Google (accueil) ----------

async function donneesStructurees(donnees) {
  const { contact } = donnees;
  const accueil = await lireJson("content/pages/index.json");
  const services = await lireJson("content/pages/services.json").catch(() => ({ sections: [] }));

  const offres = [];
  for (const s of services.sections || []) {
    if (s.type !== "tarifs") continue;
    for (const p of (s.data && s.data.plans) || []) {
      const prix = prixNumerique(p.price);
      if (!prix) continue;
      offres.push({
        "@type": "Offer",
        name: p.title,
        category: UNIVERS[s.tab] || undefined,
        price: prix,
        priceCurrency: "EUR",
        url: `${SITE}services.html${s.tab === "commerces" ? "?pour=commerces" : ""}`,
      });
    }
  }
  const minimum = offres.length ? Math.min(...offres.map((o) => Number(o.price))) : null;

  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${SITE}#photographe`,
    name: "Nicolas Leveugle Photographie",
    // nom affiché sur la fiche Google Business
    alternateName: "Nicolas Leveugle",
    description: (accueil.seo && accueil.seo.description) || undefined,
    url: SITE,
    image: `${SITE}images/hero.jpg`,
    logo: `${SITE}icones/icon-512.png`,
    email: contact.email,
    address: { "@type": "PostalAddress", addressLocality: "Ath", postalCode: "7800", addressRegion: "Hainaut", addressCountry: "BE" },
    areaServed: ZONES,
    priceRange: minimum ? `À partir de ${minimum} €` : undefined,
    founder: { "@type": "Person", name: "Nicolas Leveugle", jobTitle: "Photographe" },
    knowsAbout: ["Photographie de mariage", "Portrait", "Photographie de couple", "Photographie d'événement", "Photographie commerciale"],
    sameAs: [contact.instagram_url].filter(Boolean),
    hasOfferCatalog: offres.length ? { "@type": "OfferCatalog", name: "Formules photo", itemListElement: offres } : undefined,
  };
}

// ---------- Écriture dans les pages ----------

const DEBUT = "<!-- version-texte:debut -->";
const FIN = "<!-- version-texte:fin -->";

function remplacerEntre(html, debut, fin, contenu, ancre) {
  const i = html.indexOf(debut);
  const j = html.indexOf(fin);
  if (i !== -1 && j > i) return html.slice(0, i) + debut + contenu + fin + html.slice(j + fin.length);
  if (!html.includes(ancre)) return null;
  return html.replace(ancre, ancre + debut + contenu + fin);
}

const donnees = {
  contact: await lireJson("content/contact.json"),
  portfolio: await lireJson("content/portfolio.json").catch(() => ({ items: [] })),
  images: (await lireJson("content/images.json").catch(() => ({ images: {} }))).images || {},
};
const site = await lireJson("content/site.json");

for (const { slug } of site.pages || []) {
  const fichier = `${slug}.html`;
  let html;
  try {
    html = await fs.readFile(abs(fichier), "utf8");
  } catch {
    continue;
  }
  const page = await lireJson(`content/pages/${slug}.json`);
  const texte = `<noscript>\n${versionTexte(page, donnees)}\n</noscript>`;
  let nouveau = remplacerEntre(html, DEBUT, FIN, texte, '<main id="sections-root">');
  if (nouveau == null) {
    console.log(`⚠ ${fichier} : <main id="sections-root"> introuvable, ignorée`);
    continue;
  }

  if (slug === "index") {
    const ld = JSON.stringify(await donneesStructurees(donnees), null, 2).replace(/</g, "\\u003c");
    const bloc = `<script type="application/ld+json">\n${ld}\n</script>`;
    nouveau = nouveau.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, bloc);
  }

  if (nouveau !== html) {
    await fs.writeFile(abs(fichier), nouveau);
    console.log(`${fichier} : version texte mise à jour`);
  }
}
