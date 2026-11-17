# Espace client et galeries

*Mis à jour : 17 novembre 2026*

## Pour le client
- Nicolas envoie un **lien** `galerie/index.html?g=<jeton>` + un **mot de passe** (ex. « Pivoine-Sable-48 »).
- Sur la couverture : « Je suis le client » (mot de passe → favoris ♥, galerie retrouvée ensuite dans « Vos shootings ») ou « Je suis invité » (voir et télécharger, sans cœurs).
- Grille en maçonnerie, visionneuse, favoris (enregistrés sur le serveur), sélection, téléchargement d'une photo / de la sélection / de tout (dossier ou une par une), mot d'accueil de Nicolas, lien « avis Google ».
- **« Espace client »** du menu (sans `?g=`) : liste « Vos shootings » de ce navigateur.

## Le serveur (Cloudflare Worker `galerie-api`)
- Code : `worker/src/index.js` ; config `worker/wrangler.toml` ; adresse `https://galerie-api.nicoleveugle.workers.dev`.
- Photos dans **R2** (`PHOTOS_BUCKET` = `galerie-photos`), limites de tentatives dans **KV** (`RATE_LIMIT_KV`).
- Secrets (dans Cloudflare, jamais dans le dépôt) : `ADMIN_PASSWORD`, `SESSION_SECRET`, `CF_ACCOUNT_ID`, `CF_API_TOKEN` (statistiques).
- Routes publiques : `/api/gallery/<jeton>` (+ `/accueil`, `/client`, `/favoris`, `/cover`, `/photo/<fichier>?variant=thumb|original`), `/api/espace`. Routes admin : `/api/admin/login`, `/stats`, `/galleries` (créer, modifier, photos, couverture HD, nouveau lien), `/mot-de-passe`.
- Déploiement : `cd worker && npx wrangler deploy` (compte Cloudflare de Nicolas).

## Admin des galeries
`/galerie-admin/` : mot de passe = `ADMIN_PASSWORD` du Worker. Créer une galerie (mot de passe client généré), envoyer les photos, choisir la couverture (+ version HD), régénérer le lien, voir les favoris du client, e-mail prêt à envoyer. Même thème que l'admin du site.

## Apparence (validée le 17 novembre 2026)
- `galerie/theme.css` (après `galerie/style.css` et `css/entete.css`) :
  - **liste « Vos shootings »** (classe `espace-neutre` posée dans le `<head>` quand il n'y a pas de `?g=`) : **exactement les couleurs du site** ;
  - **galeries** : même maison (barre, menu, titres en capitales, boutons pilule, jour/nuit) mais **lumière chaude** : ivoire « papier photo » `#efebe5`, nuit anthracite brun `#211e1b`, **doré en touches** (cœurs, « Tout télécharger », signature).
- Galerie d'exemple sans serveur (photos du site, fausses données) : `labo/galerie/` (reconstruite depuis `galerie/index.html`).

---
[← Table des matières](../SKILL.md)
