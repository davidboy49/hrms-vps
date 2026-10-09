#!/usr/bin/env bash
# Update the VPS to the latest code: back up, pull, rebuild, restart. New database migrations run when the app starts.
# If the backup fails the script stops here and nothing is changed.
set -euo pipefail

cd "$(dirname "$0")/.."
./deploy/backup.sh
git pull --ff-only
# baked into the image and shown to Admin and HR in the sidebar
export GIT_SHA="$(git rev-parse --short HEAD)" BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
# the build cache grows by a few GB per deploy; cap it so the disk never fills up with it (builds stay fast with 3 GB)
docker builder prune -f --keep-storage 3GB >/dev/null
docker compose ps
