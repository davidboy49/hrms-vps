#!/usr/bin/env bash
# Backup of the database and the photos. Run from cron every night, and before every deploy. See deploy/README.md.
# The database is saved every time. The photos are big and rarely change, so they are saved at most once a day and only when something changed.
# Keeps 14 days in BACKUP_DIR and in Cloudflare R2, thinned to one database backup per day after the first two days.
set -euo pipefail

cd "$(dirname "$0")/.."
. ./deploy/backup-lib.sh
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

# photos: the whole storage volume, but only when something changed and not more than once a day (BACKUP_PHOTOS=force to override)
PHOTO_VOLUME="${BACKUP_PHOTO_VOLUME:-$(docker volume ls -q | grep -E '(^|_)miniodata$' | head -n1)}"
PHOTO_MIN_AGE_H="${BACKUP_PHOTO_MIN_AGE_H:-20}"
sig="$(docker run --rm -v "$PHOTO_VOLUME":/data:ro alpine sh -c 'cd /data && find . -type f -exec stat -c "%n %s %Y" {} + | sort | sha256sum | cut -d" " -f1')"
last_sig="$(cat "$BACKUP_DIR/.photos.sig" 2>/dev/null || true)"
newest_photo="$(ls -t "$BACKUP_DIR"/photos-*.tar.gz 2>/dev/null | head -1 || true)"
photo_age_h=999999
if [ -n "$newest_photo" ]; then photo_age_h=$(( ($(date +%s) - $(stat -c %Y "$newest_photo")) / 3600 )); fi
if [ "${BACKUP_PHOTOS:-auto}" = "force" ] || { [ "$sig" != "$last_sig" ] && [ "$photo_age_h" -ge "$PHOTO_MIN_AGE_H" ]; }; then
  docker run --rm -v "$PHOTO_VOLUME":/data:ro -v "$BACKUP_DIR":/out alpine tar czf "/out/photos-$STAMP.tar.gz" -C /data .
  echo "$sig" > "$BACKUP_DIR/.photos.sig"
  echo "photos saved"
else
  echo "photos skipped (unchanged, or saved less than $PHOTO_MIN_AGE_H hours ago)"
fi

# a dump that is empty or tiny means something went wrong
test "$(stat -c %s "$BACKUP_DIR/db-$STAMP.dump")" -gt 1000

# local clean-up: thin the database dumps (one a day after two full days, nothing past 14 days), drop old photo archives
find "$BACKUP_DIR" -type f -name 'photos-*.tar.gz' -mtime +14 -delete
(cd "$BACKUP_DIR" && ls | grep '^db-' | thin_names 14 2 | xargs -r rm -f) || true
# off-server copy to Cloudflare R2 (rclone remote "r2", see ~/.config/rclone/rclone.conf), thinned the same way
if [ -z "${BACKUP_SKIP_OFFSITE:-}" ] && command -v rclone >/dev/null && rclone listremotes | grep -q '^r2:$'; then
  R2="r2:${R2_BUCKET:-peopledesk-backups}"
  rclone copy "$BACKUP_DIR" "$R2" --include "db-$STAMP.*" --include "photos-$STAMP.*" --s3-no-check-bucket
  rclone delete "$R2" --min-age 14d --s3-no-check-bucket
  rclone lsf "$R2" --s3-no-check-bucket | grep '^db-' | thin_names 14 2 | while read -r name; do rclone deletefile "$R2/$name" --s3-no-check-bucket || true; done
  echo "offsite ok: $R2"
fi

echo "backup ok: $BACKUP_DIR ($STAMP)"
beat up "ok $STAMP"
