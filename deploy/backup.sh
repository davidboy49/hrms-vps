#!/usr/bin/env bash
# Nightly backup of the database and the photos. Run from cron, see deploy/README.md.
# Keeps the last 14 days in BACKUP_DIR. Copy that folder off this server too (Cloudflare R2, another VPS, your PC).
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-/var/backups/peopledesk}"
STAMP="$(date +%Y%m%d-%H%M%S)"
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
