#!/usr/bin/env bash
# Run hourly from cron. Alerts on Telegram when something about the backups needs attention, at most once every 6 hours, and says so when it is fine again:
#   - the newest database backup is older than BACKUP_MAX_AGE_H hours (default 26) or looks empty
#   - the newest copy in Cloudflare R2 is older than BACKUP_R2_MAX_AGE_H hours (default 26), R2 cannot be reached, or the bucket holds more than BACKUP_R2_MAX_MB (default 2048; R2's free plan is 10 GB)
#   - the local backup folder is bigger than BACKUP_DIR_MAX_MB (default 2048)
#   - the server disk is fuller than BACKUP_DISK_MAX_PCT percent (default 85)
# It watches the results, not the schedule, so it also catches a cron job that never ran. Needs LOGWATCH_BOT_TOKEN and LOGWATCH_CHAT_ID in the repo's .env.
set -u
cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-/var/backups/peopledesk}"
MAX_AGE_H="${BACKUP_MAX_AGE_H:-26}"
R2_MAX_AGE_H="${BACKUP_R2_MAX_AGE_H:-26}"
R2_MAX_MB="${BACKUP_R2_MAX_MB:-2048}"
DIR_MAX_MB="${BACKUP_DIR_MAX_MB:-2048}"
DISK_MAX_PCT="${BACKUP_DISK_MAX_PCT:-85}"
R2_BUCKET="${R2_BUCKET:-peopledesk-backups}"
STATE="${BACKUP_WATCH_STATE:-$HOME/.backup-watch-alerted}"
LOG="${BACKUP_WATCH_LOG:-$HOME/peopledesk-backup.log}"

envval() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }
TG_TOKEN="$(envval LOGWATCH_BOT_TOKEN)"
TG_CHAT="$(envval LOGWATCH_CHAT_ID)"
TG_API="${TELEGRAM_API_BASE:-https://api.telegram.org}"
tell() { if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then curl -s --max-time 10 "$TG_API/bot$TG_TOKEN/sendMessage" --data-urlencode "chat_id=$TG_CHAT" --data-urlencode "text=$1" >/dev/null || true; fi; }

now="$(date +%s)"
problems=()
add() { problems+=("$1"); }
# "db-20261009-163850.dump" -> seconds since 1970 (the stamp is local time, like the server)
stamp_epoch() { local d="${1#db-}"; d="${d%.dump}"; date -d "${d:0:8} ${d:9:2}:${d:11:2}:${d:13:2}" +%s 2>/dev/null || echo 0; }

# 1) the newest local database backup
newest="$(ls -t "$BACKUP_DIR"/db-*.dump 2>/dev/null | head -1 || true)"
if [ -z "$newest" ]; then
  add "no database backup found in $BACKUP_DIR"
else
  age_h=$(( (now - $(stat -c %Y "$newest")) / 3600 ))
  if [ "$age_h" -ge "$MAX_AGE_H" ]; then add "the newest backup is ${age_h} hours old ($(basename "$newest"))"
  elif [ "$(stat -c %s "$newest")" -le 1000 ]; then add "the newest backup looks empty ($(basename "$newest"))"; fi
fi

# 2) space: the backup folder and the whole disk
dir_mb="$(du -sm "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo 0)"
if [ "${dir_mb:-0}" -ge "$DIR_MAX_MB" ]; then add "the backup folder uses ${dir_mb} MB (limit ${DIR_MAX_MB} MB)"; fi
disk_pct="$(df --output=pcent / | tail -1 | tr -dc 0-9)"
if [ "${disk_pct:-0}" -ge "$DISK_MAX_PCT" ]; then add "the server disk is ${disk_pct}% full ($(df -h --output=avail / | tail -1 | tr -d ' ') left)"; fi

# 3) the off-server copy in Cloudflare R2: reachable, fresh, and not growing past its free allowance
if [ -z "${BACKUP_SKIP_R2:-}" ] && command -v rclone >/dev/null && rclone listremotes 2>/dev/null | grep -q '^r2:$'; then
  r2_json="$(timeout 60 rclone size "r2:$R2_BUCKET" --json --s3-no-check-bucket 2>/dev/null || true)"
  r2_bytes="$(printf '%s' "$r2_json" | grep -o '"bytes":[0-9]*' | cut -d: -f2)"
  if [ -z "$r2_bytes" ]; then
    add "cannot read the R2 bucket $R2_BUCKET, so the off-server backups cannot be checked"
  else
    r2_mb=$(( r2_bytes / 1048576 ))
    if [ "$r2_mb" -ge "$R2_MAX_MB" ]; then add "the R2 bucket holds ${r2_mb} MB (limit ${R2_MAX_MB} MB)"; fi
    newest_r2="$(timeout 60 rclone lsf "r2:$R2_BUCKET" --s3-no-check-bucket 2>/dev/null | grep '^db-' | sort | tail -1 || true)"
    if [ -z "$newest_r2" ]; then
      add "R2 has no database backup"
    else
      r2_age=$(( (now - $(stamp_epoch "$newest_r2")) / 3600 ))
      if [ "$r2_age" -ge "$R2_MAX_AGE_H" ]; then add "the newest copy in R2 is ${r2_age} hours old ($newest_r2)"; fi
    fi
  fi
fi

if [ "${#problems[@]}" -gt 0 ]; then
  problem="$(IFS=';'; printf '%s' "${problems[*]}" | sed 's/;/; /g')"
  echo "$(date -Is) backup watch: $problem" >> "$LOG"
  if [ ! -e "$STATE" ] || [ $(( now - $(stat -c %Y "$STATE") )) -ge 21600 ]; then
    tell "⚠️ HRMS backups on $(hostname): $problem. See deploy/RUNBOOK.md."
    touch "$STATE"
  fi
elif [ -e "$STATE" ]; then
  tell "✅ HRMS backups on $(hostname) are fine again (disk ${disk_pct}% full, newest: $(basename "$newest"))."
  rm -f "$STATE"
fi
