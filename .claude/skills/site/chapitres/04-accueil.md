# La page d'accueil (Polaroïds)

*Mis à jour : 17 novembre 2026 — version validée par Nicolas*

Fichiers : `index.html`, `css/accueil.css`, `js/accueil.js` (autonomes : n'utilisent pas `style.css`). Même version sur téléphone et ordinateur.

## Ce que voit le visiteur
1. **Ouverture** : titre « Photographe à Ath — La lumière d'abord. » en haut, **3 Polaroïds** au milieu (une photo devant, deux qui dépassent derrière), phrase + Particulier/Commerce + « Les formules » en bas. Ordinateur : texte à gauche, pile à droite.
2. **Au défilement** (l'écran reste en place) : la photo de devant monte à la vitesse du doigt, les deux autres s'écartent sur les côtés, le titre s'efface, puis **« Derrière l'objectif — Je suis Nicolas »** apparaît en fondu (photo entière centrée + texte + liens).
3. Ensuite : **les formules** (lues dans `content/pages/services.json`, selon l'univers) → **les 4 étapes** (01 et 03 à gauche, 02 et 04 alignées à droite) → 3 points forts → « À vous de passer devant l'objectif » (Réserver) → pied.

## Comment c'est fait
- Classes posées dans le `<head>` : `js`, `chapitres` (toujours), `large` (≥ 900 px), `calme` (mouvements réduits : pas de Polaroïds, tout est posé), `data-theme`.
- Le mouvement est fait **par le navigateur** (CSS `animation-timeline: --polas` sur `.polas`, `view-timeline`) : aucun retard au défilement. Secours JS (même calcul) si le navigateur ne connaît pas `animation-timeline`.
- Réglages : hauteur `.polas` 175svh (durée de l'ouverture) ; plages par photo posées par JS (`contain 0%→100%` devant, `10%→100%` derrière) ; sortie horizontale `--sortie-x` (95vw téléphone, 150vw ordinateur) ; titre `contain 35%→60%` ; « Je suis Nicolas » `contain 62%→100%`.
- Sur téléphone, `js/accueil.js` **déplace** des blocs : la section `.moi` dans la scène, la liste des étapes après les formules.
- **Ne jamais** animer un `clip-path` ou une grande image recalculée au défilement : ça accroche sur téléphone (essai abandonné, chapitre 13).

## Changer les textes et photos (écrits dans le code, pas dans l'admin)
- Titres et textes visibles : directement dans `index.html` (étapes, ouverture, fin).
- Textes qui changent selon Particulier/Commerce : `const TEXTES` (~ligne 43 de `js/accueil.js`).
- Photos des 3 Polaroïds : `const POLAS` (deux listes de 3 chemins `images/tailles/<chemin>-480|800.webp`, sans extension) **et** les `<img>` de `index.html` (version particuliers chargée d'emblée).
- Photo de Nicolas : section `.moi` de `index.html` (`images/tailles/nicolas-leveugle-portrait-*.webp`).
- Formules de secours si `services.json` est vide : `const FORMULES`.
- Après modification : augmenter `?v=` de `css/accueil.css` / `js/accueil.js` dans `index.html`.
- Le menu de l'accueil est écrit dans `index.html` (garder les mêmes liens que `content/navigation.json`).

---
[← Table des matières](../SKILL.md)
