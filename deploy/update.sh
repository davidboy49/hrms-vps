#!/usr/bin/env bash
# Update the VPS to the latest code: pull, rebuild, restart. New database migrations run when the app starts.
set -euo pipefail

cd "$(dirname "$0")/.."
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
