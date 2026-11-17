# Les photos

*Mis à jour : 17 novembre 2026*

- **Originaux** : `images/<dossier>/<nom>.jpg` (`mariages/`, `commerces/`, `portfolio/…`, `uploads/` pour l'admin). Jamais modifiés.
- **Versions allégées** : `images/tailles/<dossier>/<nom>-<largeur>.webp`, largeurs **480, 800, 1200, 1600, 2400** (seulement celles plus petites que l'original). Faites par `outils/optimiser-images.mjs` (robot après chaque envoi) ; liste dans `content/images.json` (`tailles`, largeur, hauteur).
- Dans une page JSON : donner le chemin de l'original (`images/mariages/x.jpg`) ; `render.js` choisit les tailles (`srcset`).
- À la main (accueil, galerie d'exemple) : `images/tailles/mariages/x-800.webp` avec `srcset` 480/800(/1200). **Vérifier que la taille existe** (`ls images/tailles/...`) : certaines photos n'ont pas 1600.
- Lancer à la main : `cd outils && npm ci && node optimiser-images.mjs`.
- Images 3D de l'ancien essai (Leica) : `labo/accueil/sequence/1000/` (non utilisées sur le site).

---
[← Table des matières](../SKILL.md)
