# Deploying HydroIQ (production)

HydroIQ is designed for **Vercel** + **Postgres** (Supabase or any managed Postgres). SQLite is for local development only.

## 1. Database (Postgres)

1. Create a Postgres database and copy the connection string.
2. In `prisma/schema.prisma`, set `provider = "postgresql"` (keep the same models).
3. Set `DATABASE_URL` in Vercel to the Postgres URL (include `?sslmode=require` if your host requires TLS).
4. Apply schema:

```bash
npx prisma migrate deploy
```

For a brand-new database, the initial migration lives in `prisma/migrations/`. If you change providers locally, run `npx prisma migrate dev` once to realign.

## 2. Vercel environment variables


| Variable                          | Required        | Notes                                                                 |
| --------------------------------- | --------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                    | Yes             | Postgres URL in production                                            |
| `AUTH_SECRET`                     | Yes             | Long random string (32+ chars)                                        |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Yes             | **Change defaults** before go-live                                    |
| `CRON_SECRET`                     | Yes             | Random bearer token; Vercel Cron sends `Authorization: Bearer …`      |
| `MAINTAINER_EMAIL`                | Yes             | Builder email for ingestion failures                                  |
| `RESEND_API_KEY`                  | Recommended     | Enables email alerts                                                  |
| `RESEND_FROM`                     | If using Resend | Verified sender, e.g. `HydroIQ <alerts@yourdomain.com>`               |
| `SAM_API_KEY`                     | Optional        | Official SAM.gov opportunities API; USAspending still runs without it |




## 3. Cron

`vercel.json` schedules daily ingest at **12:00 UTC** → `GET /api/cron/ingest`.

After deploy, confirm in Vercel → Cron that the job runs and returns `200`. The route allows up to **300s** (`maxDuration`).

## 4. Smoke tests

```bash
# Ingest (same auth as cron)
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_APP.vercel.app/api/cron/ingest"

# Maintainer alert path (no data breakage)
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_APP.vercel.app/api/cron/test-alert"
```

Log in as admin → **Settings** → confirm source runs for ECHO, TCEQ (Texas Open Data), SRF (TWDB + MN PFA PDFs), e-AMLIS (OSMRE GeoMine), and MPCA WIMN.

## 5. Build command

Default `npm run build` runs `prisma generate`, `prisma db push` (SQLite-friendly), and `next build`.

For Postgres CI/production, prefer:

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

Set that in Vercel project settings when `DATABASE_URL` points to Postgres.

## 6. Data sources at ship


| Source                     | Public record                                            |
| -------------------------- | -------------------------------------------------------- |
| EPA ECHO CWA / SDWA / RCRA | echodata.epa.gov                                         |
| Superfund SEMS             | data.epa.gov DMAP                                        |
| SAM.gov + USAspending      | sam.gov / api.usaspending.gov                            |
| TCEQ                       | data.texas.gov administrative orders + EPIC docket links |
| SRF                        | TWDB DWSRF PPL PDF + MN MPFA annual report Exhibit A     |
| MPCA                       | WIMN site-activities API (browser UA)                    |
| e-AMLIS                    | OSMRE GeoMine AML Awards + curated backlog               |


Every lead row stores a `sourceRecordUrl` the operator can open from the lead detail screen.