# L'admin et le contenu

*Mis à jour : 17 novembre 2026*

## Connexion
- Adresse : `https://nicolasleveugle.be/admin/` (`noindex`, interdit dans `robots.txt`).
- Nicolas tape **son mot de passe** : il déchiffre `admin/auth.json` (jeton GitHub chiffré AES-GCM + PBKDF2, 600 000 itérations) dans le navigateur. Le jeton sert ensuite à écrire dans le dépôt via l'API GitHub. Dépôt public → la sécurité dépend de la force du mot de passe. « Mot de passe oublié » : se reconnecter avec un jeton GitHub et en choisir un nouveau.
- **Ne jamais** demander un mot de passe ou un jeton dans la conversation.

## Ce qu'il peut modifier
- **Pages** (liste = `content/site.json`) : sections ajoutées, déplacées, modifiées dans l'éditeur visuel (`admin/editor.js`, rendu identique au site en mode jour). Types de sections : `SECTION_TYPES` en tête de `admin/app.js` (ouverture grande photo, présentation Polaroïd, texte + deux photos, bande de photos, Instagram, formules/tarifs, aperçu des formules, étapes, FAQ, contact, canaux, bandeau de confiance, citation, conseils, texte juridique…). Le HTML de chaque type : `js/sections-renderer.js`.
- **Menu** (`content/navigation.json`), **coordonnées** (`content/contact.json` : email, Instagram, WhatsApp, zone, délai de réponse, lien avis Google), **SEO** de chaque page (titre, description, image de partage).
- **Photos** : envoyées dans `images/` (le robot fait les tailles, chapitre 10).
- **Statistiques** du site (via le Worker).
- Chaque enregistrement = un commit sur `main` → en ligne ~1 min, puis passage du robot.

## À savoir
- L'**accueil** n'est pas dans l'admin (textes dans le code, chapitre 4). La page « Accueil » de l'admin modifie un ancien contenu non affiché. À proposer plus tard : relier l'accueil à l'admin.
- La **couleur d'accent** (`appearance.json`) n'a plus d'effet.
- `admin/preview.html` : aperçu d'un brouillon (même style que le site).
- Thème de l'admin : jour/nuit propre à l'admin (`localStorage` `admin-theme`, attribut `data-theme="dark"`), couleurs accordées au site.

## Apparence (18 novembre 2026)
- Admin accordé au site : barre latérale claire (anthracite en nuit), titres Cormorant en capitales, boutons pilule, jour/nuit. Dernier bloc de `admin/theme-pro.css`.
- L'éditeur affiche la page **en situation** : barre du site (nom, menu, Réserver) construite par `admin/app.js` (`#editeur-entete`) + la page dans le style du site, en jour ou en nuit selon le thème de l'admin.
- Les fichiers de l'admin ont un `?v=` dans `admin/index.html` et `galerie-admin/index.html` : **l'augmenter à chaque changement**, sinon le navigateur de Nicolas garde l'ancienne apparence.
- Pour tester l'intérieur sans mot de passe : Playwright avec jeton factice dans `localStorage` (`site-photo-admin-token`) et `route` qui sert les fichiers locaux à la place de `api.github.com`.

---
[← Table des matières](../SKILL.md)
