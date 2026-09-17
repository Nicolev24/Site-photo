# Site vitrine — Nicolas Leveugle Photographie

Site statique (HTML/CSS/JS, sans framework) : 4 pages — accueil, portfolio, services & tarifs, contact.

## Structure

```
index.html        Accueil
portfolio.html     Portfolio filtrable par catégorie
services.html       Formules & tarifs
contact.html        Coordonnées + formulaire
css/style.css        Tous les styles
js/main.js            Menu mobile + filtre du portfolio
images/                Toutes les photos (actuellement des placeholders SVG)
```

## À faire avant mise en ligne

1. **Remplacer les photos placeholders** dans `images/` (mêmes noms de fichiers, ou changez les chemins `src` dans les pages HTML). Les cadrages attendus :
   - `images/hero.svg` — grande photo de couverture (paysage)
   - `images/photographe.svg` — portrait du photographe (page d'accueil)
   - `images/teaser-*.svg` — une photo représentative par catégorie (accueil)
   - `images/portfolio/<categorie>/img1-4.svg` — 4 photos par catégorie dans le portfolio (vous pouvez en ajouter plus en dupliquant les blocs `.gallery-item` dans `portfolio.html`)

2. **Vérifier les tarifs** dans `services.html` si vos formules évoluent.

Le formulaire de contact fonctionne sans backend : il ouvre le client mail du visiteur avec le message pré-rempli. Si vous hébergez le site sur Netlify, vous pouvez le remplacer par [Netlify Forms](https://docs.netlify.com/forms/setup/) pour un envoi direct sans ouvrir de client mail.

## Déploiement

Le site est 100% statique : aucun build nécessaire. Vous pouvez le déployer tel quel sur Netlify, Vercel, GitHub Pages ou tout hébergeur simple (glisser-déposer le dossier suffit sur Netlify).
