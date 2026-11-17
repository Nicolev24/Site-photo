# Les pages

*Mis à jour : 17 novembre 2026*

| Menu | Fichier | Contenu | Particularités |
|---|---|---|---|
| (logo) Accueil | `index.html` | HTML + `js/accueil.js` | pas de `render.js` ; voir chapitre 4 |
| Qui suis-je | `moi.html` | `content/pages/moi.json` | change selon Particulier/Commerce |
| Mon travail | `travail.html` | `content/pages/travail.json` | ouvre sur une grande photo : sur téléphone la barre du haut est incrustée dedans |
| Tarifs | `services.html` | `content/pages/services.json` | formules et prix (lus aussi par l'accueil et la fiche Google) |
| Contact | `contact.html` | `content/pages/contact.json` | formulaire (formsubmit.co), `?formule=` pré-remplit le choix |
| Espace client | `galerie/index.html` | API du Worker | voir chapitre 8 |
| (pied) Mentions légales, Confidentialité | `mentions-legales.html`, `confidentialite.html` | JSON | |

- **Menu et pied de page** : `content/navigation.json` (liens du menu, bouton « Réserver », liens du pied). L'accueil a son menu **écrit dans `index.html`** : le modifier aux deux endroits.
- **Liste des pages** (admin + robot Google) : `content/site.json` → `pages` (`slug` = nom du fichier sans `.html`). La page `index` y reste pour la fiche Google, mais **son contenu admin (`content/pages/index.json`) n'est plus affiché** (ancien accueil).
- **Navigation sans rechargement** : sur les pages JSON, `render.js` intercepte les liens internes et reconstruit la page (transition). L'accueil est **exclu** (`slugDe()` renvoie `null` pour `index`) : y aller recharge vraiment la page.
- **Anciennes adresses** : `a-propos.html` → `moi.html`, `portfolio.html` → `travail.html` (redirection + `noindex` + `canonical`).

## Ajouter une page (checklist)
1. Copier `services.html` en `<slug>.html` ; changer `<title>`, description, `og:*`, `canonical` ; vider le bloc entre `<!-- version-texte:debut -->` et `<!-- version-texte:fin -->`.
2. Créer `content/pages/<slug>.json` (`seo` + `sections`) — ou depuis l'admin (« Nouvelle page »).
3. L'ajouter à `content/site.json`, au menu (`content/navigation.json` **et** `index.html`), au `sitemap.xml` (+ `?pour=commerces` si elle change selon l'univers) et, si elle change selon l'univers, à la liste de `js/sections-renderer.js` (`/^(a-propos|moi|travail|services|contact)\.html/`).
4. Tester (chapitre 11).

---
[← Table des matières](../SKILL.md)
