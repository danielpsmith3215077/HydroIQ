# HydroIQ

**Repository:** [daniel-smith-code/HydroIQ](https://cursor.com/codebase/daniel-smith-code/HydroIQ) (private — change visibility on that page).

```bash
curl -fsSL https://downloads.cursor.com/origin/install.sh | sh
origin auth login
origin repo clone daniel-smith-code/HydroIQ
cd HydroIQ && npm run setup && npm run dev
```

Full checklist (Supabase + Vercel): **[SETUP.md](./SETUP.md)**. Origin CLI: [docs](https://cursor.com/docs/origin/cli).

Internal **lead intelligence and predictive procurement** tool for [Advanced Mobile Filtration Services (AMFS)](https://amfsfiltration.com/) in Fort Worth. It is a single-admin web app: open the link on iPhone, iPad, or desktop, review real public-record leads, edit the AMFS outreach draft, and mark it sent.

HydroIQ is not a multi-tenant SaaS product. The database is org-scoped (`organizationId` on every table) for a clean Supabase Postgres cutover.

## What it does

- Pulls **EPA ECHO** Clean Water Act SNC, **SDWIS** serious violators, and **RCRA** corrective action — **all U.S. states**.
- Adds **Superfund / SEMS**, **SAM.gov / USAspending**, **PFAS military watchlist**, **OSMRE GeoMine e-AMLIS**, **TCEQ** (Texas Open Data + EPIC dockets), **SRF** (TWDB DWSRF priority list PDF + Minnesota PFA awards), and **MPCA WIMN** (Minnesota water programs).
- Drafts AMFS-specific outreach with a **View Official Public Record** link. Nothing sends automatically.
- Bell notifications, forecast engines A/B/C, bid-range guidance from comparable federal awards.

Every lead traces to a public URL. The app does not invent facilities.

## Run locally

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Open [http://127.0.0.1:43180](http://127.0.0.1:43180).

Default admin (change in `.env` before production):

- Username: `amfs`
- Password: `HydroIQ2026`

First ingest can take several minutes (national ECHO + PDF parsing). Use **Refresh sources** on the feed or call `POST /api/ingest` while logged in.

## Production

See **[DEPLOY.md](./DEPLOY.md)** for Postgres, Vercel env vars, cron, and smoke tests (`/api/cron/test-alert`).

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite locally (`file:../data/hydroiq.db`) or Postgres in production |
| `AUTH_SECRET` | JWT signing key |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Single admin |
| `MAINTAINER_EMAIL` | Failure alerts (builder, not the AMFS operator) |
| `RESEND_API_KEY` / `RESEND_FROM` | Optional email delivery for alerts |
| `SAM_API_KEY` | Optional SAM.gov opportunities API |
| `CRON_SECRET` | Bearer token for `/api/cron/ingest` and `/api/cron/test-alert` |

Daily ingest: `vercel.json` → `GET /api/cron/ingest` at 12:00 UTC with `Authorization: Bearer $CRON_SECRET`.

## Failure alerting

If a source errors or returns empty when it should not, HydroIQ logs a maintainer alert and emails `MAINTAINER_EMAIL` when Resend is configured. The operator keeps last-good data and a calm “sources delayed” note.

## Stack

Next.js 14 App Router, Tailwind CSS, Prisma (SQLite local / Postgres production), Vercel Cron.
