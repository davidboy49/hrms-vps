#!/usr/bin/env bash
# Run every 15 minutes from cron. Alerts on Telegram when the server itself needs attention, at most once every 6 hours, and says so when it is fine again:
#   - the disk is fuller than HEALTH_DISK_PCT percent (default 80)
#   - available memory is below HEALTH_MEM_MIN_MB (default 300)
#   - swap is fuller than HEALTH_SWAP_PCT percent (default 85)
#   - the 5-minute load is higher than HEALTH_LOAD_FACTOR times the number of CPUs (default 3)
#   - the app or database container is not healthy, or the app does not answer on localhost:3000 within 5 seconds
# Backups have their own watcher (backup-watch.sh). Needs LOGWATCH_BOT_TOKEN and LOGWATCH_CHAT_ID in the repo's .env.
set -u
cd "$(dirname "$0")/.."
DISK_PCT="${HEALTH_DISK_PCT:-80}"
MEM_MIN_MB="${HEALTH_MEM_MIN_MB:-300}"
SWAP_PCT="${HEALTH_SWAP_PCT:-85}"
LOAD_FACTOR="${HEALTH_LOAD_FACTOR:-3}"
APP_URL="${HEALTH_APP_URL:-http://127.0.0.1:3000/login}"
CONTAINERS="${HEALTH_CONTAINERS:-hrms-vps-app-1 hrms-vps-db-1}"
STATE="${HEALTH_WATCH_STATE:-$HOME/.health-watch-alerted}"
LOG="${HEALTH_WATCH_LOG:-$HOME/peopledesk-health.log}"
MEMINFO="${HEALTH_MEMINFO:-/proc/meminfo}"
LOADAVG="${HEALTH_LOADAVG:-/proc/loadavg}"

envval() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }
TG_TOKEN="$(envval LOGWATCH_BOT_TOKEN)"
TG_CHAT="$(envval LOGWATCH_CHAT_ID)"
TG_API="${TELEGRAM_API_BASE:-https://api.telegram.org}"
tell() { if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then curl -s --max-time 10 "$TG_API/bot$TG_TOKEN/sendMessage" --data-urlencode "chat_id=$TG_CHAT" --data-urlencode "text=$1" >/dev/null || true; fi; }

now="$(date +%s)"
problems=()
add() { problems+=("$1"); }
kb() { awk -v k="$1:" '$1 == k { print $2 }' "$MEMINFO"; }

# 1) disk
disk_pct="$(df --output=pcent / | tail -1 | tr -dc 0-9)"
if [ "${disk_pct:-0}" -ge "$DISK_PCT" ]; then add "the disk is ${disk_pct}% full ($(df -h --output=avail / | tail -1 | tr -d ' ') left)"; fi

# 2) memory and swap
avail_mb=$(( $(kb MemAvailable) / 1024 ))
if [ "$avail_mb" -lt "$MEM_MIN_MB" ]; then add "only ${avail_mb} MB of memory is available"; fi
swap_total=$(kb SwapTotal)
if [ "${swap_total:-0}" -gt 0 ]; then
  swap_used=$(( swap_total - $(kb SwapFree) ))
  swap_pct=$(( swap_used * 100 / swap_total ))
  if [ "$swap_pct" -ge "$SWAP_PCT" ]; then add "swap is ${swap_pct}% full ($(( swap_used / 1024 )) MB)"; fi
fi

# 3) load
cpus="$(nproc 2>/dev/null || echo 1)"
load5="$(awk '{print $2}' "$LOADAVG")"
if awk -v l="$load5" -v c="$cpus" -v f="$LOAD_FACTOR" 'BEGIN { exit !(l > c * f) }'; then add "the load is ${load5} on ${cpus} CPUs (5-minute average)"; fi

# 4) the app and the database
if command -v docker >/dev/null; then
  for c in $CONTAINERS; do
    st="$(docker inspect --format '{{if .State.Running}}{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}{{else}}stopped{{end}}' "$c" 2>/dev/null | tr -d '\n')"
    [ -n "$st" ] || st=missing
    case "$st" in healthy|running) ;; *) add "container $c is $st" ;; esac
  done
fi
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$APP_URL" || true)"
case "$code" in 2*|3*) ;; *) add "the app did not answer within 5 seconds (HTTP ${code:-none})" ;; esac

if [ "${#problems[@]}" -gt 0 ]; then
  problem="$(IFS=';'; printf '%s' "${problems[*]}" | sed 's/;/; /g')"
  echo "$(date -Is) health watch: $problem" >> "$LOG"
  if [ ! -e "$STATE" ] || [ $(( now - $(stat -c %Y "$STATE") )) -ge 21600 ]; then
    tell "⚠️ HRMS server $(hostname): $problem."
    touch "$STATE"
  fi
elif [ -e "$STATE" ]; then
  tell "✅ HRMS server $(hostname) is fine again (disk ${disk_pct}%, ${avail_mb} MB memory free, load ${load5})."
  rm -f "$STATE"
fi
