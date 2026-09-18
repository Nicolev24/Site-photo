# Proxy OAuth pour l'admin du site (Decap CMS)

Ce dossier contient le petit service nécessaire pour que la page `/admin`
(qui permet de modifier le site sans toucher au code) puisse se connecter
avec ton compte GitHub en toute sécurité.

## Pourquoi c'est nécessaire

Le site est hébergé sur GitHub Pages, qui ne peut servir que des fichiers
statiques (pas de code qui tourne côté serveur). Or la connexion avec
GitHub nécessite un secret qui ne doit jamais être visible dans le
navigateur. Ce petit "proxy" tourne donc à part, gratuitement, sur
Cloudflare Workers, et s'occupe uniquement de cette connexion.

## Étapes de mise en place (à faire une seule fois)

### 1. Créer une app OAuth GitHub

1. Va sur https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Remplis :
   - **Application name** : `Site Photo Admin` (ou ce que tu veux)
   - **Homepage URL** : `https://nicolasleveugle.be/admin/`
   - **Authorization callback URL** : `https://TON-WORKER.workers.dev/callback`
     (tu obtiens cette URL à l'étape suivante — tu pourras revenir la modifier ici après)
3. Clique **Register application**
4. Note le **Client ID** affiché
5. Clique **Generate a new client secret** et note le **Client Secret** (affiché une seule fois !)

### 2. Déployer le proxy sur Cloudflare Workers

1. Crée un compte gratuit sur https://dash.cloudflare.com/sign-up (aucune carte bancaire requise)
2. Dans le tableau de bord : **Workers & Pages** → **Create** → **Create Worker**
3. Donne-lui un nom (ex: `site-photo-cms-auth`) → **Deploy** (ça déploie un Worker vide pour l'instant)
4. Clique **Edit code**, supprime tout le contenu par défaut, et colle le contenu du fichier
   [`worker.js`](./worker.js) de ce dossier
5. Clique **Deploy**
6. Retourne sur la page du Worker → **Settings** → **Variables and Secrets**
7. Ajoute 2 secrets (type "Secret", pas "Text") :
   - `GITHUB_CLIENT_ID` → le Client ID noté à l'étape 1
   - `GITHUB_CLIENT_SECRET` → le Client Secret noté à l'étape 1
8. Sauvegarde. Note l'URL de ton Worker, affichée en haut de la page
   (ex: `https://site-photo-cms-auth.TON-PSEUDO.workers.dev`)

### 3. Relier les deux bouts

1. Retourne sur ton app OAuth GitHub (étape 1) et complète/corrige
   l'**Authorization callback URL** avec l'URL exacte de ton Worker + `/callback`
   (ex: `https://site-photo-cms-auth.tonpseudo.workers.dev/callback`)
2. Donne-moi l'URL de ton Worker (sans `/callback`) — je mets à jour
   `admin/config.yml` (`base_url`) avec cette valeur et je pousse le changement

### 4. Utiliser l'admin

Une fois tout relié, va sur **https://nicolasleveugle.be/admin/**, connecte-toi
avec ton compte GitHub (le même que celui du repo), et modifie le contenu.
Chaque sauvegarde crée un commit sur `main` — le site se redéploie
automatiquement comme d'habitude, en général en moins d'une minute.

Seul un compte GitHub ayant accès en écriture à ce repo peut se connecter
à l'admin — personne d'autre ne peut y accéder.
