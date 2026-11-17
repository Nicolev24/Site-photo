# Référencement Google

*Mis à jour : 17 novembre 2026*

À garder **à chaque modification** :
- `index.html` : balise de validation **Google Search Console** (`google-site-verification`, ne jamais supprimer), titre « Photographe à Ath – Mariage, portrait & commerce | Nicolas Leveugle », description, `og:*`, `canonical` `https://nicolasleveugle.be/`, **fiche entreprise JSON-LD** (`ProfessionalService` : Ath 7800, Wallonie, Bruxelles, formules et prix).
- Chaque page : un seul `<h1>`, `<title>` + description propres, `canonical` vers sa propre adresse, `og:image`.
- **Version texte** (`<noscript>` entre `<!-- version-texte:debut -->` et `<!-- version-texte:fin -->`) et **fiche entreprise** : réécrites automatiquement par `outils/version-texte.mjs` (robot après chaque envoi). L'accueil n'a pas de version texte (son contenu est déjà en HTML) mais sa fiche est mise à jour.
- `sitemap.xml` : accueil, `moi`, `travail`, `services`, `contact` (+ `?pour=commerces`), mentions, confidentialité. **L'ajouter quand on crée une page.**
- `robots.txt` : interdit `/admin/` et `/galerie-admin/`. `labo/`, galerie, admin, 404 : `noindex`.
- Anciennes adresses : redirection + `noindex` + `canonical` vers la nouvelle (`a-propos.html`, `portfolio.html`). Ne jamais supprimer une ancienne adresse connue de Google sans redirection.
- Mots-clés visés : photographe Ath, mariage, couple, portrait, commerce, Wallonie, Bruxelles.

---
[← Table des matières](../SKILL.md)
