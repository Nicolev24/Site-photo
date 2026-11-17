# Le style : couleurs, polices, en-tête, menu

*Mis à jour : 17 novembre 2026*

## Palette (« studio » : noir et blanc, jamais de blanc pur ni de noir pur)
| | Jour | Nuit |
|---|---|---|
| Fond | `#ededf0` | `#1c1c1f` (anthracite, validé après 2 essais) |
| Fond alternatif | `#e4e4e8` | `#222225` |
| Cartes | `#f7f7f9` | `#252528` |
| Encre (texte) | `#121214` | `#e9e9ec` |
| Texte atténué | `rgba(18,18,20,.66)` | `rgba(233,233,236,.64)` |
| Traits | `rgba(18,18,20,.16)` | `rgba(233,233,236,.15)` |

- **Pas de doré** sur le site (l'accent `appearance.json` de l'admin est volontairement ignoré : `!important` dans `theme-site.css`). Le doré ne reste qu'en **petites touches dans les galeries clients** (chapitre 8).
- Polices : **Cormorant Garamond** (titres, en CAPITALES, fines), **Jost** (texte, petites capitales espacées pour les libellés).
- Boutons : **fins, contour, en pilule** (`border-radius: 999px`). « Réserver » dans la barre : 36 px de haut, partout identique.
- Mode jour/nuit : `js/theme.js` (clé `localStorage` **`theme`** = `jour`|`nuit`, posé avant l'affichage). **Une seule icône** : lune en jour, soleil en nuit. Sur téléphone, le bouton est dans le menu (« Mode nuit / Mode jour »), comme l'accueil.

## Fichiers
- `css/theme-site.css` : palette (`html[data-theme="jour|nuit"]`), titres, boutons, bouton lune/soleil, texte clair sur photo plein écran.
- `css/theme-site-auto.css` : **généré** — `python3 outils/theme-neutre.py` (relancer si `css/style.css` change).
- `css/entete.css` : barre (64 px ordinateur / 56 px téléphone, nom sur une ligne), menu téléphone **plein écran à la couleur du site**, « Menu »/« Fermer » en toutes lettres, barre **incrustée sur la photo** d'ouverture (`html.photo-en-tete`, calculé par `js/main.js`).
- Accueil : ses propres variables dans `css/accueil.css` (`--fond`, `--encre`…, mêmes valeurs).
- Admin : `admin/theme-pro.css` (dernier bloc « Accord avec le nouveau site »).
- Galerie : `galerie/theme.css` (chapitre 8).
- Ordre de chargement des pages JSON : `style.css` → `theme-site-auto.css` → `theme-site.css` → `entete.css` → `theme.js`.

## Règles de webdesign demandées par Nicolas
Un seul point d'attention par écran, de l'espace, hiérarchie claire ; pas de pages « chargées » ; mobile d'abord ; mouvements fluides à la vitesse du défilement ; cohérence totale entre pages (même barre, même menu, mêmes boutons) ; aucun espace vide inutile.

---
[← Table des matières](../SKILL.md)
