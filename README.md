# PeopleDesk (VPS edition)

HR system: employees, attendance (QR and ZKTeco), schedules, leave, overtime, Telegram alerts, announcements, dashboard.
Next.js 16 (App Router), shadcn/ui, Tailwind, PostgreSQL with Prisma. Khmer first, English second.

This repo runs on one VPS with Docker Compose: the app, Postgres, private photo storage (MinIO) and Caddy for HTTPS.

**Install and operate it: see [deploy/README.md](deploy/README.md).**

## Run locally (no Docker)

```bash
npm install
npm run db:local        # terminal 1: starts a local PostgreSQL on port 5433 (keep it running)
npm run db:migrate      # terminal 2: creates the tables
npm run db:seed         # masterdata, 40 sample employees, 2 mock devices, admin user
npm run dev             # http://localhost:3000
```

Sign in with `admin@company.com` / `ChangeMe123!` and change the password under Settings > My account.
Photos save to `public/uploads` in development only.

## Roles

| Role | Can do |
| --- | --- |
| Admin | Everything, including users, settings, Telegram, audit log |
| HR | Employees, schedules, leave and overtime approval, masterdata, announcements |
| Manager | View employees, attendance, roster and requests |
| Employee | Scan QR, request leave and overtime |

## Notes

- Time zone is fixed to Asia/Phnom_Penh (`src/lib/format.ts`).
- Next.js 16 uses `src/proxy.ts` (formerly middleware) to require sign-in.
- ZKTeco push mode: point the device at `https://<your-domain>/iclock/cdata` (optionally `?token=` with `ADMS_TOKEN`).
- The user guide lives in `src/content/*.md`. After editing, run `python scripts/build-guide.py`.
