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

## Changer les textes et photos (depuis l'admin : page « Accueil »)
- **Admin → Accueil** modifie `content/accueil.json` : phrases et titres des étapes (particuliers et commerces), les 3 photos Polaroïd de chaque univers, « Derrière l'objectif » (titre, texte), fin de page. `js/accueil.js` lit ce fichier (`PERSO`) et remplace les valeurs par défaut du code (`TEXTES`, `POLAS`). Les photos y sont notées `dossier/nom` (sans `images/` ni extension).
- Ce qui reste dans le code : titre « La lumière d'abord. », « Photographe à Ath », liens, photo de Nicolas, formules de secours (`FORMULES`).
- Pour ajouter un champ : l'ajouter dans `content/accueil.json`, dans `ACCUEIL_CHAMPS`/le formulaire de `admin/app.js`, et le lire dans `js/accueil.js`.
- Après modification du code : augmenter `?v=` de `css/accueil.css` / `js/accueil.js` dans `index.html`.
- Le menu de l'accueil est écrit dans `index.html` (garder les mêmes liens que `content/navigation.json`).

---
[← Table des matières](../SKILL.md)
