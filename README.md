# HydroIQ

Internal **lead intelligence and predictive procurement** tool for [Advanced Mobile Filtration Services (AMFS)](https://amfsfiltration.com/) in Fort Worth. It is a single-admin web app: open the link on iPhone, iPad, or desktop, review real public-record leads, edit the AMFS outreach draft, and mark it sent.

HydroIQ is not a multi-tenant SaaS product. The database is still org-scoped (`organizationId` on every table) so a later cutover to Supabase Postgres is additive.

## What it does

- Pulls **EPA ECHO** Clean Water Act significant noncompliance, **SDWIS** serious drinking-water violators, and **RCRA** corrective-action facilities (one ECHO family, three lead types).
- Adds **Superfund / SEMS**, **SAM.gov / USAspending** awards, the **military PFAS / AFFF watchlist**, **e-AMLIS** abandoned mine drainage, **TCEQ** enforcement pages, and **Texas / Minnesota SRF** portals.
- Drafts an AMFS-specific email (53-foot nanofiltration trailer, 420,000 gpd, 72-hour mobilization) with a **🔗 View Official Public Record** link. Nothing sends automatically.
- Bell notifications for new leads. Opening the bell clears the badge.
- Forecast engine:
  - **A** — three-plus consecutive periods of the same contaminant on a utility → upcoming infrastructure RFP (3–6 months).
  - **B** — PFAS military sites with no matching filtration award → pitch trailers as emergency mitigation.
  - **C** — large BOS / Civil Engineering umbrellas won by primes (AECOM, Jacobs, …) sitting on an ECHO water problem → subcontract outreach.
- Bid-range suggestion from comparable federal awards plus trailer throughput. Advisory only, with a visible warning if a typed bid sits above the suggested high.

Every lead traces to a public URL. The app does not invent facilities.

## Run locally

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Open [http://127.0.0.1:43180](http://127.0.0.1:43180).

Default admin (change in `.env`):

- Username: `amfs`
- Password: `HydroIQ2026`

The session cookie lasts 30 days.

The first visit pulls live EPA / federal data. That takes a minute. Use **Refresh sources** if the feed is still empty.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file for local (`file:../data/hydroiq.db`) or a Supabase Postgres URL later |
| `AUTH_SECRET` | JWT signing key |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Single admin |
| `MAINTAINER_EMAIL` | Failure alerts (builder, not the AMFS operator) |
| `RESEND_API_KEY` | Optional email delivery for those alerts |
| `SAM_API_KEY` | Optional. Without it, HydroIQ uses USAspending.gov (public) and SAM.gov public search |
| `CRON_SECRET` | Bearer token for `/api/cron/ingest` |

Daily ingest is declared in `vercel.json` (`GET /api/cron/ingest` at 12:00 UTC). Vercel Cron should send `Authorization: Bearer $CRON_SECRET`.

## Failure alerting

If ECHO, SAM, Superfund, or another source errors or comes back empty when it should not, HydroIQ logs a maintainer alert and emails `MAINTAINER_EMAIL` when Resend is configured. The operator still sees the last good leads and a calm “sources delayed” note — not a stack trace.

## Stack

Next.js 14 App Router, Tailwind CSS, Prisma + SQLite (Postgres-ready schema), Vercel Cron. Hardcoded AMFS copy, CAGE `8RVH1`, and solution links to [amfsfiltration.com/technology](https://amfsfiltration.com/technology/).
