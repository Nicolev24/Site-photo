# Conditions de Nicolas

Source de vérité des règles fixées par Nicolas. Ajouter les nouvelles en haut, avec la date.

**17 novembre 2026**
- **Nouveaux tarifs (validés par Nicolas, cohérence avec l'app de gestion)** : particuliers découverte 120 €, complète 240 € ; commerces séance photo 250 €, site vitrine 1 page 1 000 €, pack Photo + Site 1 150 € (au lieu de 1 250 €). Prix dans `content/pages/services.json` (et les `<head>` de `services.html`) ; `outils/version-texte.mjs` recopie la version texte et la fiche Google (accueil).
- Le site entier suit le style de l'accueil (jour/nuit, en-tête et menu identiques partout, plus de doré). Admin accordé au site.
- Mode nuit ni noir ni trop clair : `#1c1c1f`. Mode jour pas blanc pur : `#ededf0`.
- Une seule icône jour/nuit (lune en jour, soleil en nuit).
- Espace client : la liste « Vos shootings » = couleurs du site ; les galeries gardent une **touche chaude** (ivoire, doré discret).
- Accueil = pile de Polaroïds sur téléphone **et** ordinateur ; le film 3D de l'appareil photo est abandonné.
- Appliquer les **règles de webdesign** : pas de page chargée, un point d'attention, de l'espace, pas de vide inutile, mobile d'abord.
- Effets au défilement : **fluides, à la vitesse du doigt** (« même vitesse que le reste de la page »), jamais saccadés.
- Éviter les longs calculs (rendus 3D) quand une solution simple existe ; dire combien de temps ça prend avant de lancer.
- Pour économiser : lire **ce livre** plutôt que tout le code ; ne pas refaire de tests longs quand Nicolas dit qu'il vérifie lui-même.

**Plus anciennes (toujours valables)**
- Réponses **en français simple**, sans jargon ; Nicolas n'est pas développeur.
- Pour un changement important : maquette dans `labo/` d'abord ; **rien ne change en ligne tant que Nicolas n'a pas dit « validé »** (ou « mets en ligne »).
- Garder le contenu modifiable dans l'admin (`content/*.json`, `render.js`, `sections-renderer.js`), le système Particulier/Commerce et le référencement.
- Galerie client : ne pas la changer sans son accord.
- Jamais de mot de passe, jeton ou clé dans la conversation (utiliser le formulaire sécurisé de la session).

---
[← Table des matières](../SKILL.md)
