# Le site en bref

*Mis à jour : 17 novembre 2026*

- **Hébergement** : GitHub Pages, dépôt `Nicolev24/Site-photo`, branche **`main` = le site en ligne** (`CNAME` → `nicolasleveugle.be`). Un envoi sur `main` est en ligne en ~1 minute.
- **Technique** : HTML/CSS/JS statique, aucun framework, aucune étape de construction. Polices hébergées en local (`fonts/`) : Cormorant Garamond (titres), Jost (texte).
- **Deux sortes de pages** :
  - l'**accueil** (`index.html`) est écrit en HTML + `js/accueil.js` (pile de Polaroïds) ;
  - toutes les **autres pages** sont construites par `js/render.js` + `js/sections-renderer.js` à partir des fichiers `content/pages/<page>.json` (modifiables dans l'admin).
- **Après chaque envoi sur `main`**, le robot `.github/workflows/images.yml` :
  1. prépare les tailles allégées des photos (`outils/optimiser-images.mjs` → `images/tailles/`, `content/images.json`) ;
  2. réécrit la version texte pour Google et la fiche entreprise (`outils/version-texte.mjs`).
  Il fait lui-même un commit « github-actions[bot] » : **toujours partir de la dernière version de `main`** avant de travailler.
- **Admin du site** : `/admin/` (mot de passe → modifie les JSON via l'API GitHub). Voir chapitre 6.
- **Espace client** : `/galerie/` + serveur Cloudflare Worker `galerie-api` (photos dans R2). Admin des galeries : `/galerie-admin/`. Voir chapitre 8.
- **Formulaire de contact** : envoyé par `formsubmit.co` vers l'e-mail de `content/contact.json` (`js/sections-renderer.js`, `ENVOI_FORMULAIRE`).
- **Statistiques** : Cloudflare Web Analytics (jeton dans `content/site.json` → `statistiques_cloudflare`), lues dans l'admin via le Worker (`/api/admin/stats`).
- **Maquettes** : le dossier `labo/` contient les essais (jamais indexés, `noindex`). Rien de `labo/` n'est relié au site.

---
[← Table des matières](../SKILL.md)
