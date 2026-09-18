# Site vitrine — Nicolas Leveugle Photographie

Site statique (HTML/CSS/JS, sans framework), hébergé sur GitHub Pages avec le domaine `nicolasleveugle.be`.

4 pages : accueil, portfolio, services & tarifs, contact.

## Structure

```
index.html, portfolio.html, services.html, contact.html   Les 4 pages
css/style.css          Tous les styles
js/main.js               Menu mobile + logique de filtre du portfolio
js/render.js              Charge le contenu depuis content/*.json et construit le DOM
content/*.json             Contenu éditable (voir ci-dessous)
images/                     Toutes les photos
admin/                        Interface d'administration maison
```

## Modifier le contenu

**Le plus simple : via l'admin.** Va sur `https://nicolasleveugle.be/admin/`
et connecte-toi avec un token d'accès personnel GitHub (la page explique
comment en créer un — aucun compte tiers requis). Tu peux ensuite modifier
textes/photos/tarifs directement depuis un formulaire ; chaque sauvegarde
republie le site automatiquement (~1 min).

C'est une page 100% codée pour ce site (`admin/app.js`), sans dépendance à
un CMS ou service externe : elle appelle directement l'API GitHub depuis
le navigateur pour lire/écrire les fichiers `content/*.json` et uploader
les photos. Le token reste uniquement dans le navigateur de la personne
connectée.

**Sinon, à la main**, tout le contenu éditable vit dans `content/` :
- `content/portfolio.json` — photos du portfolio (catégorie, image, description)
- `content/services.json` — les 3 formules et tarifs
- `content/contact.json` — email, Instagram, zone, délai de réponse
- `content/settings.json` — photo de couverture, texte d'intro, vignettes de catégories (accueil)

Modifier un de ces fichiers (ou déposer une nouvelle image dans `images/`)
et pousser sur `main` suffit — les pages HTML lisent ce contenu au chargement
via `js/render.js`, aucune étape de build n'est nécessaire.

Le formulaire de contact fonctionne sans backend : il ouvre le client mail
du visiteur avec le message pré-rempli.

## Déploiement

Le site est 100% statique (aucun build) et déployé automatiquement par
GitHub Pages à chaque push sur `main`.
