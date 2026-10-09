#!/usr/bin/env bash
# Run hourly from cron. Alerts on Telegram if the newest database backup is older than BACKUP_MAX_AGE_H hours (default 26) or looks empty,
# at most once every 6 hours, and says so when backups are healthy again. It watches the result, not the schedule, so it catches a cron job
# that never ran just as well as one that failed. Needs LOGWATCH_BOT_TOKEN and LOGWATCH_CHAT_ID in the repo's .env.
set -u
cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-/var/backups/peopledesk}"
MAX_AGE_H="${BACKUP_MAX_AGE_H:-26}"
STATE="${BACKUP_WATCH_STATE:-$HOME/.backup-watch-alerted}"
LOG="${BACKUP_WATCH_LOG:-$HOME/peopledesk-backup.log}"

envval() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }
TG_TOKEN="$(envval LOGWATCH_BOT_TOKEN)"
TG_CHAT="$(envval LOGWATCH_CHAT_ID)"
TG_API="${TELEGRAM_API_BASE:-https://api.telegram.org}"
tell() { if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then curl -s --max-time 10 "$TG_API/bot$TG_TOKEN/sendMessage" --data-urlencode "chat_id=$TG_CHAT" --data-urlencode "text=$1" >/dev/null || true; fi; }

now="$(date +%s)"
newest="$(ls -t "$BACKUP_DIR"/db-*.dump 2>/dev/null | head -1 || true)"
problem=""
if [ -z "$newest" ]; then
  problem="no database backup found in $BACKUP_DIR"
else
  age_h=$(( (now - $(stat -c %Y "$newest")) / 3600 ))
  if [ "$age_h" -ge "$MAX_AGE_H" ]; then
    problem="the newest backup is ${age_h} hours old ($(basename "$newest"))"
  elif [ "$(stat -c %s "$newest")" -le 1000 ]; then
    problem="the newest backup looks empty ($(basename "$newest"))"
  fi
fi

if [ -n "$problem" ]; then
  echo "$(date -Is) backup watch: $problem" >> "$LOG"
  if [ ! -e "$STATE" ] || [ $(( now - $(stat -c %Y "$STATE") )) -ge 21600 ]; then
    tell "⚠️ HRMS backups on $(hostname): $problem. Check deploy/backup.sh and the cron job."
    touch "$STATE"
  fi
elif [ -e "$STATE" ]; then
  tell "✅ HRMS backups on $(hostname) are healthy again (newest: $(basename "$newest"))."
  rm -f "$STATE"
fi
