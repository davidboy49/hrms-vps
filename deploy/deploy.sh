#!/usr/bin/env bash
# What the automatic deploy runs on the VPS (see .github/workflows/deploy.yml). Safe to run by hand too.
# 1. makes sure the server is on main, 2. backs up first when the update changes the database,
# 3. runs update.sh, 4. waits until the app reports healthy, otherwise fails loudly.
set -euo pipefail

cd "$(dirname "$0")/.."

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ]; then
  echo "Refusing to deploy: this server is on '$branch', not main. Run: git checkout main" >&2
  exit 1
fi

git fetch --quiet origin main
before="$(git rev-parse --short HEAD)"
after="$(git rev-parse --short origin/main)"
if [ "$before" = "$after" ]; then
  echo "Already up to date ($before). Rebuilding anyway to make sure the containers match."
else
  echo "Deploying $before -> $after"
  git --no-pager log --oneline "HEAD..origin/main"
fi

# a new migration changes the database, so keep a copy first; stop if the backup fails
if git diff --name-only HEAD origin/main | grep -q '^prisma/migrations/'; then
  echo "This update changes the database, backing up first..."
  ./deploy/backup.sh
fi

./deploy/update.sh

echo "Waiting for the app to become healthy..."
cid="$(docker compose ps -q app)"
for _ in $(seq 1 30); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
    echo "Deploy ok: app is $status at $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 5
done
echo "Deploy FAILED: app is '$status'. Last log lines:" >&2
docker compose logs app --tail=40 >&2 || true
exit 1
