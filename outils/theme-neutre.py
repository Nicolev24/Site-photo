"""Génère css/theme-site-auto.css : les touches dorées de css/style.css passées
dans les tons du nouveau site (encre en mode jour, blanc cassé en mode nuit).

À relancer si css/style.css change :  python3 outils/theme-neutre.py
"""
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
css = (RACINE / "css/style.css").read_text()
css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)

OR_RGBA = re.compile(r"rgba\(\s*174,\s*140,\s*91,\s*([\d.]+)\s*\)")
REMPLACEMENTS = [
    (re.compile(r"#ae8c5b", re.I), "var(--couleur-accent)"),
    (re.compile(r"#806847", re.I), "var(--couleur-accent-fonce)"),
    (re.compile(r"#f3efe7", re.I), "#fbfbfa"),  # papier des Polaroïds : blanc, comme l'accueil
    (re.compile(r"#d9d3c8", re.I), "#d8d8dc"),
]


def convertir(valeur):
    v = OR_RGBA.sub(lambda m: f"rgba(var(--accent-rvb), {m.group(1)})", valeur)
    for motif, rempl in REMPLACEMENTS:
        v = motif.sub(rempl, v)
    return v


def blocs(texte):
    """(entête, contenu) pour chaque bloc de premier niveau."""
    i, n = 0, len(texte)
    while i < n:
        j = texte.find("{", i)
        if j == -1:
            return
        tete = texte[i:j].strip()
        prof, k = 1, j + 1
        while k < n and prof:
            if texte[k] == "{":
                prof += 1
            elif texte[k] == "}":
                prof -= 1
            k += 1
        yield tete, texte[j + 1 : k - 1]
        i = k


def regles(texte, prefixe=':is(html[data-theme="jour"], html[data-theme="nuit"], .admin-live-editor)'):
    sortie = []
    for tete, corps in blocs(texte):
        if tete.startswith("@media") or tete.startswith("@supports"):
            dedans = regles(corps, prefixe)
            if dedans:
                sortie.append(f"{tete} {{\n" + "\n".join("  " + l for l in "\n".join(dedans).split("\n")) + "\n}")
            continue
        if tete.startswith("@"):
            continue  # @font-face, @keyframes…
        if tete.startswith(":root") or "theme-clair" in tete:
            continue  # les couleurs de base et l'ancien thème clair de l'admin : gérés ailleurs
        decl = []
        for d in corps.split(";"):
            d = d.strip()
            if not d or ":" not in d:
                continue
            nouv = convertir(d)
            if nouv != d:
                decl.append(nouv)
        if decl:
            sel = ",\n".join(f"{prefixe} {s.strip()}" for s in tete.split(","))
            sortie.append(sel + " {\n" + "".join(f"  {d};\n" for d in decl) + "}")
    return sortie


r = regles(css)
entete = """/* Fichier généré par outils/theme-neutre.py — ne pas modifier à la main.
   Les touches dorées de css/style.css, dans les tons du nouveau site. */
html[data-theme="jour"] { --accent-rvb: 18, 18, 20; }
html[data-theme="nuit"] { --accent-rvb: 233, 233, 236; }
.admin-live-editor { --accent-rvb: 18, 18, 20; }

"""
(RACINE / "css/theme-site-auto.css").write_text(entete + "\n\n".join(r) + "\n")
print(len(r), "règles")
