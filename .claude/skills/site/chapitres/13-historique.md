# Décisions et essais passés

*Mis à jour : 17 novembre 2026* — pour ne pas reproposer ce qui a déjà été refusé.

| Quand | Essai | Résultat |
|---|---|---|
| nov. 2026 | Accueils successifs : diptyque, Polaroïds sur photo « cinéma », etc. (branches `accueil-*`, `refonte-*`) | remplacés |
| nov. 2026 | Accueil « de la lentille à la photo » : Leica 3D en direct (Three.js, `labo/appareil/`) puis modèles scannés Nikon/Olympus | refusé : « trop faux, ça se voit que c'est de la 3D » |
| nov. 2026 | Même idée en **film calculé** (Blender Cycles, 216 images, `labo/accueil/sequence/`) joué au défilement | beau sur PC mais flou/saccadé, lourd (~17 Mo), long à recalculer → abandonné pour les Polaroïds |
| 17 nov. 2026 | Téléphone : chapitres d'images fixes | refusé (pas d'effet waouh) |
| 17 nov. 2026 | Téléphone : vidéo qui se lance seule | refusé d'office |
| 17 nov. 2026 | Téléphone : « plonger dans l'objectif » (zoom + `clip-path` au défilement) | refusé : **accroche** au défilement |
| 17 nov. 2026 | Polaroïds : 7 photos avec légendes et pastille | « trop chargé » → **3 photos, sans légende** |
| 17 nov. 2026 | Polaroïds bougés en JS au défilement | accrochait → **animation par le navigateur** (scroll-driven) |
| 17 nov. 2026 | Ouverture qui finit sur un vide / grande photo de Nicolas en plein écran | → fondu sur « Derrière l'objectif », photo **entière et centrée** |
| 17 nov. 2026 | Mode nuit `#111113` puis `#232326` | → **`#1c1c1f`** |
| 17 nov. 2026 | Galerie : passer d'un coup aux couleurs chaudes | → liste aux couleurs du site, galeries « même maison, lumière chaude » |
| 17 nov. 2026 | « À propos » | → **« Qui suis-je »** + nouvelle page **« Mon travail »** |

**L'ancien accueil** (avant le 17 novembre 2026) se retrouve dans l'historique Git : `git show 9c97649:index.html` (dernier commit avant le nouveau site `44c0a0a`).

---
[← Table des matières](../SKILL.md)
