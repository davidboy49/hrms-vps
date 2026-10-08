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
echo "backup ok: $BACKUP_DIR ($STAMP)"
