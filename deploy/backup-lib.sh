#!/usr/bin/env bash
# Helpers shared by backup.sh and its tests. Source it; it does nothing on its own.

# Reads backup file names (db-YYYYMMDD-HHMMSS.dump) on stdin and prints the ones that can go:
#   - everything older than KEEP_DAYS (default 14), and
#   - for days before the last FULL_DAYS (default 2: today and yesterday), everything except the newest backup of that day.
# So a busy day of deploys leaves one backup behind, not one per deploy, while the pre-deploy safety net stays for two full days.
thin_names() {
  local keep_days="${1:-14}" full_days="${2:-2}" old recent
  old="$(date -d "$keep_days days ago" +%Y%m%d)"
  recent="$(date -d "$((full_days - 1)) days ago" +%Y%m%d)"
  sort | awk -v old="$old" -v recent="$recent" '
    { names[NR] = $0; match($0, /[0-9]{8}/); d[NR] = substr($0, RSTART, 8); last[d[NR]] = NR }
    END { for (i = 1; i <= NR; i++) { if (d[i] < old) print names[i]; else if (d[i] < recent && last[d[i]] != i) print names[i] } }'
}
