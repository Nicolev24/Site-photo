# Tester et publier

*Mis à jour : 17 novembre 2026*

## Avant de modifier
- `git fetch origin main` et partir de `main` à jour (le robot y fait ses propres commits).
- Un gros changement visuel : d'abord une **maquette dans `labo/`** (`noindex`), Nicolas regarde, puis publication (chapitre 12).

## Tester localement
- Serveur : `python3 -m http.server 8973` à la racine (en arrière-plan), puis Playwright (déjà installé : `require('playwright')`).
- À vérifier à chaque fois : téléphone (`devices['iPhone 13']`, `devices['iPhone SE']`) **et** ordinateur (1440×900, 1920×1080), **jour et nuit** (`localStorage.setItem('theme','nuit')` via `addInitScript`), menu ouvert, aucune erreur `pageerror`, aucune réponse ≥ 400, aucun débordement en largeur, images chargées, un seul `h1`.
- Messages « cloudflareinsights » en local : normaux (statistiques bloquées hors du vrai domaine).
- Une page JSON servie à `/nexistepas` en local ne montre pas `404.html` (GitHub Pages oui) : tester `/404.html` directement.

## Publier
- Augmenter les `?v=N` des fichiers CSS/JS modifiés dans les pages qui les chargent (sinon les navigateurs gardent l'ancienne version).
- Commit en français clair, puis `git push origin <branche>` et `git push origin <branche>:main` (avance rapide uniquement : `git merge-base --is-ancestor origin/main HEAD`).
- Vérifier la mise en ligne : boucle `curl -s https://nicolasleveugle.be/<page>?x=$i | grep -q '<nouveau marqueur>'` toutes les 10 s.
- Dire à Nicolas : le lien, ce qui a changé (en mots simples), ce qui a été vérifié, ce qui n'a pas pu l'être (admin/galerie réelle demandent ses mots de passe), et « recharge la page si l'ancienne version s'affiche ».

## Le livre lui-même
- Un rappel automatique (`.claude/settings.json` → `.claude/hooks/livre-a-jour.sh`) empêche de terminer si le site a changé sans le livre.
- À chaque modification du livre sur `main`, le robot `.github/workflows/livre-site.yml` refait `site.zip`, à l'adresse fixe `https://github.com/Nicolev24/Site-photo/releases/download/livre-site/site.zip` (à importer dans l'appli Claude : Réglages > Capacités > Compétences ; l'import dans l'appli reste manuel).

---
[← Table des matières](../SKILL.md)
