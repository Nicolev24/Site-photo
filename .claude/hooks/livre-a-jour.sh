#!/bin/bash
# Rappel : si le site a été modifié sans mettre à jour le livre (.claude/skills/site), on le dit avant de terminer.
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
entree=$(cat)
case "$entree" in *'"stop_hook_active": true'*|*'"stop_hook_active":true'*) exit 0 ;; esac
modifies=$( { git diff --name-only origin/main 2>/dev/null; git status --porcelain | cut -c4-; git log --since=30.minutes --name-only --pretty=format: 2>/dev/null; } | sort -u | grep -v '^$')
site=$(echo "$modifies" | grep -E '^(css/|js/|content/|admin/|galerie/|galerie-admin/|worker/|outils/|index\.html|[a-z-]+\.html)' | head -1)
livre=$(echo "$modifies" | grep -c '^\.claude/skills/site/')
if [ -n "$site" ] && [ "$livre" = "0" ]; then
  echo "Le site a changé mais pas le livre. Mets à jour le chapitre concerné de .claude/skills/site/ (et sa date), puis termine." >&2
  exit 2
fi
exit 0
