#!/usr/bin/env bash
#
# DESPLIEGUE — compila en local y publica SOLO lo compilado en la rama `produccion`.
#
# Por qué una rama aparte y no `dist/` en `main`: `main` queda solo-fuente y revisable (el ritual de
# `git diff` antes de push sigue sirviendo); `produccion` lleva los estáticos en su raíz. El host
# (Hostinger) hace `git pull` de `produccion` por cron — no necesita Node, igual de tonto que Linaje.
#
#   bash deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

RAMA="produccion"
WT=".deploy-produccion"

echo "· compilando…"
npm run build >/dev/null

SHA="$(git rev-parse --short HEAD)"

# Preparar un worktree apuntando a `produccion` (creándola huérfana la primera vez).
git worktree remove --force "$WT" 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$RAMA"; then
    git worktree add --force "$WT" "$RAMA" >/dev/null
elif git ls-remote --exit-code --heads origin "$RAMA" >/dev/null 2>&1; then
    git fetch origin "$RAMA" >/dev/null
    git worktree add --force "$WT" "$RAMA" >/dev/null
else
    echo "· primera vez: creando rama huérfana '$RAMA' (sin historia compartida con main)"
    git worktree add --force --detach "$WT" >/dev/null
    ( cd "$WT" && git checkout --orphan "$RAMA" >/dev/null 2>&1 && git rm -rf . >/dev/null 2>&1 || true )
fi

# Vaciar el worktree (menos su .git) y volcar dist/ en la RAÍZ (incluidos los ocultos: .htaccess).
find "$WT" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -r dist/. "$WT"/

(
    cd "$WT"
    git add -A
    if git diff --cached --quiet; then
        echo "· sin cambios: produccion ya está al día"
    else
        git commit -m "deploy: $SHA" >/dev/null
        git push -u origin "$RAMA"
        echo "· desplegado $SHA → origin/$RAMA"
    fi
)

git worktree remove --force "$WT"
