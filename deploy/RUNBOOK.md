# Runbook

How to run, change and recover PeopleDesk (HRMS). Short on purpose: each section is something you do when something happens.
Install steps are in [README.md](README.md). Commands run on the VPS in the repo folder (`~/hrms-vps`) unless stated.

## What runs where

| Part | What it is |
| --- | --- |
| `app` | Next.js app, port 3000 on the server's loopback only |
| `db` | PostgreSQL 17, no published port (only other containers can reach it) |
| `rustfs` | Private photo storage (S3 compatible). The volume is still named `miniodata` on purpose |
| Host nginx | Terminates HTTPS and forwards to the app (`compose.override.yaml` turns Caddy off on this server) |
| `logwatch` (systemd) | Sends error lines from the container logs to Telegram |

Data lives in two Docker volumes: `hrms-vps_pgdata` (database) and `hrms-vps_miniodata` (photos).

## How a deploy works

1. Push to `main` on GitHub (`davidboy49/hrms-vps`).
2. GitHub Actions job **check** runs `tsc` and `eslint`. If it fails, nothing is deployed and Telegram gets a message.
3. Job **deploy** SSHes into the VPS. The key there is locked to `deploy/update.sh`, so it can run nothing else.
4. `update.sh` runs a **backup** first (if the backup fails, it stops), pulls, rebuilds the image, restarts. Database migrations run when the app starts.
5. A failed build leaves the old version running. A failed deploy also sends a Telegram message.

Pull requests run only the check. To deploy again without a new commit: `gh workflow run Deploy -R davidboy49/hrms-vps`.

The sidebar shows `version · commit · build time` to Admin and HR, so you can tell which build is live. `GET /api/health` returns `{"ok":true}` (200) when the app can reach the database, and 503 otherwise.

## Roll back a bad release

Preferred, keeps history: revert the commit and push.

```bash
git revert <bad-commit-sha>      # on any computer with the repo
git push origin main             # deploys the revert (about 4 minutes)
```

If the site is down and you cannot wait, on the VPS:

```bash
git log --oneline -10                       # pick the last good commit
git checkout <good-sha>
GIT_SHA=$(git rev-parse --short HEAD) docker compose up -d --build
```

Then fix `main` properly. Afterwards put the server back on `main` with `git checkout main`, otherwise `update.sh` cannot pull.

A rollback does **not** undo database migrations. If a migration changed or dropped data, restore from the backup taken just before that deploy (next section). The backup from every deploy is the newest `db-*.dump`.

## Back up and restore

Backups: `deploy/backup.sh` runs nightly at 19:00 (cron), before every deploy, and on demand. It writes to `/var/backups/peopledesk` (`db-<stamp>.dump`, `photos-<stamp>.tar.gz`), keeps 14 days, and copies to Cloudflare R2 (`r2:peopledesk-backups`) when rclone is set up. An `NotImplemented` line from rclone while deleting old files is harmless.

**Backup alerts (so a missed backup is never silent).**
- If `backup.sh` fails (including the copy to R2) it sends a Telegram message through the `LOGWATCH_BOT_TOKEN` / `LOGWATCH_CHAT_ID` bot in `.env`, and the deploy that triggered it stops, as before.
- `deploy/backup-watch.sh` runs hourly from cron and alerts if the newest database backup is more than 26 hours old or looks empty (at most one message every 6 hours, and an "all clear" when it recovers). It watches the result, so it also catches a cron job that never ran.
- The watcher also checks **space**: the off-server copy in R2 (reachable, newest copy under 26 h old, bucket under 2 GB; R2's free plan is 10 GB), the local backup folder (under 2 GB) and the server disk (under 85% full). Limits can be changed with `BACKUP_R2_MAX_MB`, `BACKUP_DIR_MAX_MB`, `BACKUP_DISK_MAX_PCT`, `BACKUP_R2_MAX_AGE_H`, `BACKUP_MAX_AGE_H`.
- **How much is kept.** The database is saved at every backup (every deploy and every night). After two full days only the newest backup of each day is kept, and nothing is kept past 14 days (locally and in R2). **Photos** are large and rarely change, so they are saved at most once every 20 hours and only if something changed (`BACKUP_PHOTOS=force ./deploy/backup.sh` saves them now). So a restore may have photos up to a day older than the database.
- **Disk space.** Docker's build cache is the main thing that fills the disk. `update.sh` caps it at 3 GB on every deploy. If the disk fills anyway: `docker builder prune -f --keep-storage 2GB`, `docker image prune -f`, and remove stopped test containers with `docker rm -v`.
- Optional Uptime Kuma heartbeat: in Kuma add a monitor of type **Push**, heartbeat interval **93600** seconds (26 h), copy its push URL, and put `BACKUP_HEARTBEAT_URL=<that url>` in `.env`. `backup.sh` then pings it after every successful backup (and reports "down" on failure), and Kuma raises its own alarm if nothing arrives.
- The crontab starts with `CRON_TZ=Asia/Phnom_Penh`, so `0 19 * * *` always means 19:00 in Phnom Penh. Check with `sudo journalctl -u cron --since today | grep ubuntu`.

**Restore test (done 2026-10-08, passed).** The newest dump restored with no errors into an empty throwaway PostgreSQL 17: 29 tables, row counts identical to the live database, and the photo archive listed 56 files. Repeat after big changes:

```bash
L=$(ls -t /var/backups/peopledesk/db-*.dump | head -1)
docker run -d --name restore-test -e POSTGRES_PASSWORD=scratch -e POSTGRES_USER=peopledesk -e POSTGRES_DB=restore postgres:17-alpine
sleep 8
docker exec -i restore-test pg_restore -U peopledesk -d restore --no-owner < "$L"
docker exec restore-test psql -U peopledesk -d restore -c 'select count(*) from "Employee"'
docker stop restore-test && docker rm restore-test
```

**Real restore (database).** This replaces live data with the backup. Pick the file first and keep a fresh backup of the current state.

```bash
./deploy/backup.sh                                   # save the current state first
docker compose stop app
docker compose exec -T db pg_restore -U peopledesk -d peopledesk --clean --if-exists --no-owner < /var/backups/peopledesk/db-<stamp>.dump
docker compose start app
```

**Real restore (photos).** Same stamp as the database file:

```bash
docker run --rm -v hrms-vps_miniodata:/data -v /var/backups/peopledesk:/in alpine sh -c 'cd /data && tar xzf /in/photos-<stamp>.tar.gz'
```

If the server is lost: install Docker, clone the repo, put `.env` back (see below), `docker compose up -d db rustfs`, restore as above from R2 (`rclone copy r2:peopledesk-backups /var/backups/peopledesk`), then `docker compose up -d`.

## Secrets and keys

| What | Where | Rotate by |
| --- | --- | --- |
| App and database secrets (`POSTGRES_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`, `ADMS_TOKEN`, storage keys) | `.env` on the VPS, **not in git** | Edit `.env`, `docker compose up -d`. Changing `AUTH_SECRET` signs everyone out. Changing `POSTGRES_PASSWORD` also needs `ALTER USER` inside the database |
| Telegram log alerts (`LOGWATCH_*`) | `.env` | Edit, `sudo systemctl restart logwatch` |
| Deploy key | private half in GitHub secret `VPS_SSH_KEY`, public half in `~/.ssh/authorized_keys` (locked to `update.sh`) | `ssh-keygen`, replace both |
| GitHub secrets | `VPS_HOST`, `VPS_USER`, `VPS_HOST_KEY`, `VPS_SSH_KEY`, `TG_BOT_TOKEN`, `TG_CHAT_ID` | `gh secret set <NAME> -R davidboy49/hrms-vps` |

Keep a copy of `.env` somewhere safe and private (password manager). Without it a rebuilt server cannot read the existing data.

## Reach the database from another computer

The database has no public port, and it should stay that way. Use an SSH tunnel so nothing is exposed. Host: the VPS. Database `peopledesk`, user `peopledesk`, password = `POSTGRES_PASSWORD` in `.env`.

Quick look without any setup, on the VPS: `docker compose exec db psql -U peopledesk peopledesk`.

For a desktop client (DBeaver, pgAdmin, TablePlus), the database container must listen on the server's loopback. This is **not enabled by default**; add it to `compose.override.yaml`, then `docker compose up -d db` (a few seconds of downtime):

```yaml
services:
  db:
    ports:
      - "127.0.0.1:5432:5432"
```

Then on your computer:

```bash
ssh -N -L 15432:127.0.0.1:5432 ubuntu@<vps-ip>
```

and connect your client to `127.0.0.1:15432`. Prefer a separate read-only database user for people who only look, so nobody works as the owner account:

```sql
CREATE ROLE reader LOGIN PASSWORD '<strong password>';
GRANT CONNECT ON DATABASE peopledesk TO reader;
GRANT USAGE ON SCHEMA public TO reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO reader;
```

Never open port 5432 in the firewall.

## When something is wrong

| Symptom | Check |
| --- | --- |
| Site down | `docker compose ps`, then `docker compose logs --tail 100 app`. `curl localhost:3000/api/health` |
| Deploy failed | Telegram message has the run link. Or `gh run list -R davidboy49/hrms-vps` then `gh run view <id> --log-failed` |
| Check failed | Same, the log shows the type or lint error. Fix and push; nothing was deployed |
| App restarts in a loop | Usually a failed migration: `docker compose logs app`. The old data is untouched; restore from the pre-deploy backup if needed |
| Disk full | `docker system df`, `du -sh /var/backups/peopledesk`; old images are pruned on each deploy |
| Live logs | `docker compose logs --tail 100 -f app` (or `db`, `rustfs`) |
