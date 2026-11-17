# Particulier / Commerce

*Mis à jour : 17 novembre 2026*

Le site s'adresse à deux publics : **particuliers** (mariage, couple, portrait, événement) et **commerces** (séance photo commerce, site vitrine, pack photo + site).

- `js/univers.js` (chargé dans le `<head>` de toutes les pages) : retient le choix (`window.Univers.courant()`, `definir()`, `confirmer()`, `aChoisi()`), pose `data-univers` sur `<html>` avant l'affichage.
- Adresse : `?pour=particuliers|commerces` sur toutes les pages sauf l'accueil (`render.js`, `adresseAvecUnivers()`).
- Pages JSON : la barre fine « Vous êtes Particulier | Commerce » en haut ; les sections peuvent avoir un contenu par univers.
- Accueil : boutons `button[data-univers]` dans l'ouverture et les formules ; changent les textes (`TEXTES`), les Polaroïds (`POLAS`), les formules et les liens `data-lien-univers` (ajout de `?pour=`).
- Fiche Google et sitemap : chaque page qui change selon l'univers est listée aussi avec `?pour=commerces`.

---
[← Table des matières](../SKILL.md)
