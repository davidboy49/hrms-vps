#!/usr/bin/env bash
# Nightly backup of the database and the photos. Run from cron, see deploy/README.md.
# Keeps the last 14 days in BACKUP_DIR. Copy that folder off this server too (Cloudflare R2, another VPS, your PC).
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-/var/backups/peopledesk}"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Alerts, so a failed or missing backup is never silent: Telegram (the LOGWATCH_* bot in .env) and, if you set BACKUP_HEARTBEAT_URL in .env,
# an Uptime Kuma "push" monitor that raises its own alarm when no heartbeat arrives (see deploy/RUNBOOK.md).
envval() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }
TG_TOKEN="$(envval LOGWATCH_BOT_TOKEN)"
TG_CHAT="$(envval LOGWATCH_CHAT_ID)"
BEAT="${BACKUP_HEARTBEAT_URL:-$(envval BACKUP_HEARTBEAT_URL)}"
BEAT="${BEAT%%\?*}"
TG_API="${TELEGRAM_API_BASE:-https://api.telegram.org}"
tell() { if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then curl -s --max-time 10 "$TG_API/bot$TG_TOKEN/sendMessage" --data-urlencode "chat_id=$TG_CHAT" --data-urlencode "text=$1" >/dev/null || true; fi; }
beat() { if [ -n "$BEAT" ]; then curl -s --max-time 10 -G "$BEAT" --data-urlencode "status=$1" --data-urlencode "msg=$2" >/dev/null || true; fi; }
trap 'rc=$?; echo "backup FAILED (exit $rc) at line $LINENO"; tell "❌ HRMS backup FAILED on $(hostname) at $STAMP. See ~/peopledesk-backup.log"; beat down "failed at line $LINENO"; exit $rc' ERR

mkdir -p "$BACKUP_DIR"

# database: a compressed custom-format dump that pg_restore can load
docker compose exec -T db pg_dump -U peopledesk -Fc peopledesk > "$BACKUP_DIR/db-$STAMP.dump"

# photos: the whole storage volume
docker run --rm -v "$(docker volume ls -q | grep -E '(^|_)miniodata$' | head -n1)":/data:ro -v "$BACKUP_DIR":/out alpine \
  tar czf "/out/photos-$STAMP.tar.gz" -C /data .

# a dump that is empty or tiny means something went wrong
test "$(stat -c %s "$BACKUP_DIR/db-$STAMP.dump")" -gt 1000

find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'photos-*.tar.gz' \) -mtime +14 -delete
# off-server copy to Cloudflare R2 (rclone remote "r2", see ~/.config/rclone/rclone.conf); keeps 14 days there too
if command -v rclone >/dev/null && rclone listremotes | grep -q '^r2:$'; then
  rclone copy "$BACKUP_DIR" "r2:${R2_BUCKET:-peopledesk-backups}" --include "*-$STAMP.*" --s3-no-check-bucket
  rclone delete "r2:${R2_BUCKET:-peopledesk-backups}" --min-age 14d --s3-no-check-bucket
  echo "offsite ok: r2:${R2_BUCKET:-peopledesk-backups}"
fi

echo "backup ok: $BACKUP_DIR ($STAMP)"
beat up "ok $STAMP"
