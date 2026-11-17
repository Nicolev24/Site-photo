# Refaire un site pour un client

*Mis à jour : 17 novembre 2026*

Ce site sert de **modèle** : statique, rapide, bien référencé, modifiable par le client sans développeur, hébergement gratuit.

## Ce qu'on demande au client
Nom commercial, ville et zone servie, métier/services et prix, 10 à 20 belles photos (ou séance photo de Nicolas), logo (sinon nom en Cormorant), 2-3 couleurs de marque, coordonnées (e-mail, téléphone/WhatsApp, Instagram, adresse, horaires), nom de domaine, avis Google.

## Étapes
1. **Nouveau dépôt** (copie de ce dépôt, sans `labo/`, `galerie/`, `galerie-admin/`, `worker/` si pas d'espace client) ; GitHub Pages sur `main` ; `CNAME` = domaine du client (chez son registrar : enregistrements A vers GitHub Pages + CNAME `www`).
2. **Contenu** : `content/contact.json`, `navigation.json`, `site.json` (pages, retirer `statistiques_cloudflare` ou mettre le sien), `pages/*.json` (textes, SEO de chaque page). Retirer Particulier/Commerce si un seul public (`js/univers.js`, barre en haut).
3. **Couleurs** : changer la palette dans `css/theme-site.css` et `css/accueil.css` (garder le principe : jamais blanc ni noir purs, une couleur d'accent maximum) ; adapter `theme-color` des pages ; régénérer `css/theme-site-auto.css` (`python3 outils/theme-neutre.py`) si on garde `style.css`.
4. **Accueil** : remplacer textes (`index.html`, `TEXTES`), photos des Polaroïds (`POLAS` + `<img>`), photo du « Qui suis-je » ; le principe (pile qui s'ouvre au défilement) marche pour tout métier « à photos » (restaurant, salon, artisan…).
5. **Référencement** : `index.html` (titre, description, `canonical`, JSON-LD : type `LocalBusiness`/`Restaurant`…, adresse, zone, prix), `sitemap.xml`, `robots.txt` ; supprimer la balise Search Console de Nicolas et ajouter celle du client ; fiche Google Business du client.
6. **Admin** : se connecter une première fois à `/admin/` avec un jeton GitHub du dépôt du client et choisir le mot de passe (écrit `admin/auth.json`). Lui montrer où cliquer.
7. **Formulaire** : e-mail du client dans `content/contact.json` (formsubmit.co demande une confirmation par e-mail au premier envoi).
8. **Espace client** (seulement s'il en faut un) : nouveau Worker + bucket R2 + KV au nom du client, secrets, adresse `API_BASE` dans `galerie/app.js` et `galerie-admin/app.js`.
9. **Tester et publier** (chapitre 11), puis donner au client : adresse du site, de l'admin, comment modifier un texte et une photo.

## Pièges connus
- Mettre à jour le menu à **deux endroits** (`index.html` et `navigation.json`).
- Toujours vérifier que les tailles d'images existent avant de les citer.
- Augmenter les `?v=` après chaque modification CSS/JS.

---
[← Table des matières](../SKILL.md)
