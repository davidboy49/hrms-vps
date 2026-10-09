#!/usr/bin/env bash
# Manage the QAS (test) environment. It lives in ~/hrms-qas, separate from production.
#
#   deploy/qas/update-qas.sh --init          first time: create ~/hrms-qas/.env with fresh random secrets
#   deploy/qas/update-qas.sh [ref]           build and start QAS from a branch or tag (default: main)
#   deploy/qas/update-qas.sh --seed          load the demo data and demo accounts (first time, or to reset passwords)
#   deploy/qas/update-qas.sh --reset         wipe QAS (database and photos) so it can be seeded again
#
# Production is never touched. Migrations run when the app starts, so QAS is where a new migration runs first.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/../.." && pwd)"
QAS_HOME="${QAS_HOME:-$HOME/hrms-qas}"
ENV_FILE="$QAS_HOME/.env"
REPO="$QAS_HOME/repo"
dc() { docker compose -f "$REPO/deploy/qas/compose.qas.yaml" --env-file "$ENV_FILE" "$@"; }
secret() { openssl rand -hex 24; }

case "${1:-}" in
  --init)
    mkdir -p "$QAS_HOME"
    [ -e "$ENV_FILE" ] && { echo "$ENV_FILE already exists; not overwriting"; exit 1; }
    umask 077
    cat > "$ENV_FILE" <<ENV
POSTGRES_PASSWORD=$(secret)
MINIO_ROOT_USER=qas
MINIO_ROOT_PASSWORD=$(secret)
AUTH_SECRET=$(secret)
CRON_SECRET=$(secret)
QAS_ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
QAS_DEMO_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
ENV
    echo "created $ENV_FILE (readable only by you)"
    ;;
  --seed)
    set -a; . "$ENV_FILE"; set +a
    dc exec -T -e SEED_ADMIN_PASSWORD="$QAS_ADMIN_PASSWORD" -e SEED_ADMIN_USERNAME=admin -e SEED_ADMIN_EMAIL=admin@qas.invalid app npx tsx prisma/seed.ts
    dc exec -T app node /app/seed-users.mjs
    echo
    echo "Sign-in details are in $ENV_FILE:  admin / QAS_ADMIN_PASSWORD   and   hr.demo, manager.demo, staff.demo / QAS_DEMO_PASSWORD"
    ;;
  --reset)
    read -r -p "This deletes ALL QAS data (database and photos). Type RESET to continue: " ans
    [ "$ans" = "RESET" ] || { echo "cancelled"; exit 1; }
    dc down -v
    echo "QAS wiped. Run update-qas.sh and then --seed."
    ;;
  *)
    REF="${1:-main}"
    [ -e "$ENV_FILE" ] || { echo "run '$0 --init' first"; exit 1; }
    if [ ! -d "$REPO/.git" ]; then
      git clone "$(git -C "$SRC" remote get-url origin)" "$REPO"
    fi
    git -C "$REPO" fetch --prune origin
    git -C "$REPO" checkout -q --detach "origin/$REF" 2>/dev/null || git -C "$REPO" checkout -q --detach "$REF"
    export GIT_SHA="qas-$(git -C "$REPO" rev-parse --short HEAD)" BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "Deploying $REF ($GIT_SHA) to QAS"
    dc up -d --build --remove-orphans
    docker image prune -f >/dev/null
    dc ps
    ;;
esac
