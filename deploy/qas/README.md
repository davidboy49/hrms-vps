# QAS: the test copy (https://hrs-qas.neakra.com)

A second, separate PeopleDesk on the same server for trying changes before they reach production.
Own database, own photo storage, own secrets, fake data, an orange **QAS** banner on every page.
Telegram can never send from here (`TELEGRAM_API_BASE` points nowhere). It shares nothing with production.

Everything lives in `~/hrms-qas` (`.env` with the secrets, `repo/` with its own checkout). Production in `~/hrms-vps` is not touched.

## Day to day

```bash
deploy/qas/update-qas.sh                 # build and start QAS from main
deploy/qas/update-qas.sh my-branch       # or from any branch or tag, e.g. before opening a pull request
deploy/qas/update-qas.sh --seed          # demo data + demo accounts (first time, or to reset their passwords)
deploy/qas/update-qas.sh --reset         # wipe QAS and start clean
```

Migrations run when the app starts, so **QAS is where a new migration runs first**. Look at `docker logs hrmsqas-app-1`.
A build needs about 1 GB of memory for 2 to 3 minutes; avoid doing it at the same time as a production deploy.

Sign in with the details in `~/hrms-qas/.env`: `admin` / `QAS_ADMIN_PASSWORD`, and `hr.demo`, `manager.demo`, `staff.demo` / `QAS_DEMO_PASSWORD`.

## How it is protected
1. **Cloudflare proxy + Cloudflare Access** (Zero Trust → Access → Applications → `hrs-qas.neakra.com`): only people you allow can even load the page.
2. **nginx only answers Cloudflare** (`$from_cloudflare`), so the Access gate cannot be skipped by calling the server's address directly.
3. **Fake data and strong random passwords**; no production secret is shared with it.

## One-time setup (already done on this server)
```bash
deploy/qas/update-qas.sh --init
sudo deploy/qas/gen-cloudflare-nginx.sh               # writes the Cloudflare address lists for nginx
sudo cp deploy/qas/nginx/hrs-qas.http.conf /etc/nginx/sites-available/hrs-qas && sudo ln -s ../sites-available/hrs-qas /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/html -d hrs-qas.neakra.com --deploy-hook "systemctl reload nginx"
sudo cp deploy/qas/nginx/hrs-qas.conf /etc/nginx/sites-available/hrs-qas && sudo nginx -t && sudo systemctl reload nginx
deploy/qas/update-qas.sh && deploy/qas/update-qas.sh --seed
```
In Cloudflare: turn the orange cloud on for the `hrs-qas` record, SSL/TLS mode **Full (strict)**, then add the Access application.

## Good to know
- Production can use the same two nginx files (`include snippets/cloudflare-real-ip.conf;` in its server block). Without them nginx sees Cloudflare's address for every visitor, so the app's per-address login limits and the audit log record Cloudflare, not the person.
- Free disk: QAS uses a few hundred MB plus its images. `docker image prune -f` is run on every update.
