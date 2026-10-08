#!/usr/bin/env bash
# Called from cron. Reads CRON_SECRET from .env so the token never sits in the crontab.
set -euo pipefail
cd "$(dirname "$0")/.."
SECRET="$(grep -E '^CRON_SECRET=' .env | cut -d= -f2-)"
curl -fsS -H "Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/cron/missing-checkout >/dev/null
