#!/usr/bin/env bash
# Sends error lines from all containers to Telegram. Run by deploy/logwatch.service.
# Needs LOGWATCH_BOT_TOKEN and LOGWATCH_CHAT_ID in the repo's .env.
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
: "${LOGWATCH_BOT_TOKEN:?set LOGWATCH_BOT_TOKEN in .env}"
: "${LOGWATCH_CHAT_ID:?set LOGWATCH_CHAT_ID in .env}"
PATTERN="${LOGWATCH_PATTERN:-error|fail|exception|fatal|panic| 5[0-9][0-9] }"

docker compose logs -f --since 0s app caddy db minio 2>&1 \
  | grep --line-buffered -Ei "$PATTERN" \
  | while IFS= read -r line; do
      curl -s --max-time 10 "https://api.telegram.org/bot${LOGWATCH_BOT_TOKEN}/sendMessage" \
        --data-urlencode "chat_id=${LOGWATCH_CHAT_ID}" \
        --data-urlencode "text=${line:0:3500}" >/dev/null || true
      sleep 1
    done
