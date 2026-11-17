# Carte du dépôt

*Mis à jour : 17 novembre 2026*

| Chemin | Contenu |
|---|---|
| `index.html` | accueil (Polaroïds), référencement complet + fiche entreprise JSON-LD |
| `moi.html`, `travail.html`, `services.html`, `contact.html`, `mentions-legales.html`, `confidentialite.html` | pages construites depuis `content/pages/*.json` (même gabarit) |
| `a-propos.html`, `portfolio.html` | anciennes adresses → renvoient vers `moi.html` / `travail.html` |
| `404.html` | page d'erreur (chemins absolus `/css/…` car servie à n'importe quelle adresse) |
| `css/style.css` | styles historiques de toutes les sections (ne pas réécrire : on surcharge) |
| `css/theme-site.css` | **palette jour/nuit du site**, titres, boutons, bouton lune/soleil |
| `css/theme-site-auto.css` | **généré** par `outils/theme-neutre.py` : les anciennes touches dorées de `style.css` passées en noir/blanc |
| `css/entete.css` | **en-tête et menu** des pages et de l'espace client (identiques à l'accueil) |
| `css/accueil.css`, `js/accueil.js` | accueil uniquement |
| `js/theme.js` | mode jour/nuit (clé `localStorage` `theme`), bouton lune/soleil + « Mode nuit » dans le menu téléphone |
| `js/render.js` | construit une page depuis son JSON, menu, pied, SEO, navigation sans rechargement |
| `js/sections-renderer.js` | le HTML de chaque type de section, formulaire de contact |
| `js/main.js` | menu téléphone, apparition au défilement, en-tête (verre, barre sur photo) |
| `js/univers.js` | Particulier / Commerce (chargé dans le `<head>`) |
| `content/` | contenu modifiable : `pages/*.json`, `navigation.json`, `contact.json`, `site.json`, `appearance.json`, `images.json` (généré) |
| `admin/` | admin du site (`app.js`, `editor.js`, `theme-pro.css`, `auth.json` = jeton GitHub chiffré) |
| `galerie/` | espace client (`app.js`, `style.css`, `theme.css`) |
| `galerie-admin/` | admin des galeries (parle au Worker) |
| `worker/` | serveur Cloudflare `galerie-api` (`src/index.js`, `wrangler.toml`) |
| `outils/` | `optimiser-images.mjs`, `version-texte.mjs`, `theme-neutre.py` |
| `images/` | photos originales ; `images/tailles/` = versions WebP générées |
| `labo/` | maquettes et essais (accueil 3D/film, galerie d'exemple `labo/galerie/`) — `noindex` |
| `sitemap.xml`, `robots.txt`, `site.webmanifest`, `icones/`, `favicon.ico` | Google et icônes |
| `.claude/skills/site/` | ce livre |

---
[← Table des matières](../SKILL.md)
