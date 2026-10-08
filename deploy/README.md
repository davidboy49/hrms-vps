# Running PeopleDesk on your own VPS

This runs PeopleDesk in Docker on one server: the app, Postgres, private photo storage (RustFS) and Caddy for HTTPS.
If you are moving from the Vercel and Neon version, that one keeps working while you set this up. Treat the VPS as a second copy until you switch over.

Server: Ubuntu 22.04 or 24.04, 2 vCPU, 4 GB RAM, SSD. Singapore is a good place for Cambodian users.

> These files have not been run yet (Docker is not installed on the development PC). Do the first install while Vercel is still live and expect to fix small things.

## 1. Prepare the server

```bash
# as root, or with sudo
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y git ufw
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443 && ufw --force enable
```

Use SSH keys and turn off password login. Docker publishes only ports 80 and 443; the database and storage are not reachable from outside.

## 2. Domain in Cloudflare

Add a DNS record `hr` (or any name) of type A pointing to the VPS address. Proxy on (orange cloud) is fine.
In Cloudflare SSL/TLS set the mode to **Full (strict)**.

## 3. Get the code and settings

```bash
git clone https://github.com/davidboy49/hrms-vps.git peopledesk && cd peopledesk
cp deploy/env.example .env
nano .env        # fill in every value; secrets: openssl rand -hex 24
```

`AUTH_SECRET`: if you will copy the data from Vercel, use the same value as on Vercel (so the saved Telegram token still decrypts).

## 4. Start

```bash
docker compose up -d --build
docker compose logs -f app      # wait for "Ready"; migrations run first
```

Open `https://your-domain`. Test with the real domain, not the IP address: the app forces HTTPS.

A brand new install has no users. Create the first admin once:

```bash
docker compose exec -e SEED_ADMIN_EMAIL=you@company.com -e SEED_ADMIN_PASSWORD='choose-a-long-password' app npx tsx prisma/seed.ts
```

Skip this step if you restore the Vercel data (section 5).

## 5. Copy the data from Vercel and Neon

Do this once to test, and again right before you switch, so nothing is lost.

Database (use the **unpooled** Neon URL, run on the VPS or your PC):

```bash
pg_dump "NEON_UNPOOLED_URL" --no-owner --no-acl -Fc -f neon.dump
docker compose cp neon.dump db:/tmp/neon.dump
docker compose exec db pg_restore -U peopledesk -d peopledesk --clean --if-exists --no-owner /tmp/neon.dump
docker compose restart app
```

Photos: employee photos and the logo are the same `s3:<key>` references, so copy the files with the MinIO client (`mc`, it works with any S3 store):

```bash
# on the VPS, with the Neon bucket details from your .env.local
docker run --rm --network host -it --entrypoint sh minio/mc -c '
  mc alias set neon NEON_ENDPOINT NEON_KEY NEON_SECRET &&
  mc alias set vps http://127.0.0.1:9000 MINIO_USER MINIO_PASSWORD &&
  mc mirror neon/uploads vps/uploads'
```

(The storage port is not published by default. For this one copy, add `ports: ["127.0.0.1:9000:9000"]` to the `rustfs` service, run the command, then remove it.)

## 6. Scheduled job (missing check-out report)

Vercel Cron does not exist here. Add this on the VPS (`crontab -e`). The time is UTC: 11:30 UTC is 18:30 in Phnom Penh.

```
30 11 * * 1-6 curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain/api/cron/missing-checkout >/dev/null
0 19 * * * /home/YOU/peopledesk/deploy/backup.sh >> /var/log/peopledesk-backup.log 2>&1
```

While Vercel is still live, the Vercel cron also runs. Both sending to the same Telegram group means double messages, so switch Telegram off in the copy you are not using.

## 7. Backups

`deploy/backup.sh` writes a database dump and a photos archive to `/var/backups/peopledesk` and keeps 14 days. Copy that folder off the server, for example with `rclone` to Cloudflare R2.

Test a restore once, on a spare database, before you rely on it:

```bash
docker compose exec -T db pg_restore -U peopledesk -d peopledesk --clean --if-exists --no-owner < /var/backups/peopledesk/db-YYYYMMDD-HHMMSS.dump
```

## 8. Updating

```bash
./deploy/update.sh
```

This pulls the latest code, rebuilds and restarts. Database migrations run on start.

## Automatic deploy (GitHub Actions)

Every pull request is checked (lint and build). Every merge to `main` is checked again and then deployed: GitHub connects to the server over SSH and runs `deploy/deploy.sh`, which backs up first if the update changes the database, runs `update.sh`, and waits until the app is healthy. A failed check stops the deploy, and a failed deploy turns the run red (GitHub emails you). The "CI and deploy" workflow can also be started by hand from the Actions tab.

One-time setup:

1. On the server, make a key just for this (no passphrase). Add it to the user that owns the repo, **limited to one command** so a stolen key can do nothing else:

```bash
ssh-keygen -t ed25519 -N "" -C github-deploy -f ~/.ssh/github_deploy
echo "command=\"cd $HOME/hrms-vps && ./deploy/deploy.sh\",restrict $(cat ~/.ssh/github_deploy.pub)" >> ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy        # the private key, for the secret below
ssh-keyscan -t ed25519 localhost 2>/dev/null | sed 's/^localhost/YOUR_SERVER_IP_OR_NAME/'   # for VPS_KNOWN_HOSTS
```

2. In GitHub: repository **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `VPS_HOST` | the server's address (the one you SSH to; it must be reachable from the internet) |
| `VPS_USER` | the user, for example `ubuntu` |
| `VPS_PORT` | optional, only if SSH is not on 22 |
| `VPS_SSH_KEY` | the whole private key printed above, including the BEGIN and END lines |
| `VPS_KNOWN_HOSTS` | the line printed by `ssh-keyscan` (it pins the server, so nobody can pretend to be it) |

3. The server's repo must be on `main` and `./deploy/backup.sh` must work for that user (see section 7). Test by hand first: `./deploy/deploy.sh`.
4. Optional but recommended: **Settings → Branches → protect `main`** and require the "check" job, so nothing reaches the server without passing the checks.

If a deploy goes wrong: revert the bad merge on GitHub (the "Revert" button on the merged pull request) and merge the revert, and the same pipeline deploys the old code again. Database changes are not undone by a revert; if you must go back, restore the pre-update backup from `/var/backups/peopledesk` (made automatically when an update changes the database).

## Logs and alerts

**Live log viewer (Dozzle).** `docker compose up -d dozzle` starts it. It shows the logs of every container with search, and is only reachable from the server itself. From your own computer:

```bash
ssh -L 8080:127.0.0.1:8080 user@your-vps
```

then open http://localhost:8080. (It reads the Docker socket, so keep it off the public internet.)

**Telegram error alerts.**

1. In Telegram, message `@BotFather`, send `/newbot` and copy the token.
2. Send any message to your new bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the `chat` `id`.
3. Put them in the repo's `.env`: `LOGWATCH_BOT_TOKEN=` and `LOGWATCH_CHAT_ID=`.
4. Install the service (edit the two paths in the unit file first if the repo is not in `/opt/hrms-vps`):

```bash
sudo cp deploy/logwatch.service /etc/systemd/system/
sudo systemctl enable --now logwatch
sudo systemctl status logwatch
```

It sends lines containing error, fail, exception, fatal, panic or an HTTP 5xx. To match more (or less), set `LOGWATCH_PATTERN` in `.env` (an extended regex). Messages are limited to about one per second, so a burst of errors cannot flood the chat. Docker keeps only the last 3 x 10 MB of logs per container.

## 9. Switching over from Vercel

1. Announce a short break outside working hours.
2. Repeat section 5 for a fresh copy of the data.
3. Point your domain at the VPS (or change the staff link and QR codes to the new address).
4. Printed QR codes contain the web address. If the address changes, print new ones.
5. Keep Vercel for a week as a fallback, then remove its cron and Telegram settings.

## Notes

- Visitor addresses: `deploy/Caddyfile` trusts Cloudflare's address list. If you do not use the Cloudflare proxy, nothing breaks, the real address is still used.
- ZKTeco devices that push to `/iclock` use plain HTTP on many models; talk to me before enabling that on the VPS.
- Everything is stored in Docker volumes `pgdata` (database), `miniodata` (photos) and `caddy_data` (certificates).
