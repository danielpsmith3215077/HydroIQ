# HydroIQ — finish setup (after clone)

Repo: **[daniel-smith-code/HydroIQ](https://cursor.com/codebase/daniel-smith-code/HydroIQ)** (private by default).

## 1. Clone and run locally (one script)

```bash
origin repo clone daniel-smith-code/HydroIQ
cd HydroIQ
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh
npm run dev
```

Open [http://127.0.0.1:43180](http://127.0.0.1:43180). Log in with the username/password in `.env`.

**Unstyled page (plain HTML, blue links)?** The dev server lost sync with `.next` (common after `npm run build` while `npm run dev` is running). Stop the dev server, then:

```bash
rm -rf .next && npm run dev
```

Hard-refresh the browser (Cmd+Shift+R).

Optional: trigger first data pull while logged in → **Settings** → **Refresh sources** (or `POST /api/ingest`).

## 2. Supabase (production database)

1. [supabase.com](https://supabase.com) → New project (any name, e.g. `hydroiq`).
2. **Project Settings → Database** → copy the **URI** (use “Session mode” or direct connection for Prisma migrate).
3. Locally, for a one-time production schema check:

```bash
# Temporarily in .env:
# DATABASE_URL="postgresql://..."
# Edit prisma/schema.prisma → provider = "postgresql"
npx prisma migrate deploy
```

You can keep using SQLite locally; only Vercel needs Postgres.

## 3. Vercel (hosting + cron)

1. [vercel.com](https://vercel.com) → **Add New → Project** → Import **HydroIQ** (GitHub/Origin connection as you prefer).
2. Generate env vars (sample secrets):

```bash
./scripts/print-production-env.sh
```

3. Paste into **Vercel → Project → Settings → Environment Variables** (Production).
4. Set real `DATABASE_URL` from Supabase and a strong `AUTH_PASSWORD`.
5. Deploy. Build uses `prisma migrate deploy` automatically when `DATABASE_URL` is Postgres.

## 4. After first deploy

```bash
export CRON_SECRET="…from Vercel…"
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_APP.vercel.app/api/cron/test-alert"
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_APP.vercel.app/api/cron/ingest"
```

Confirm **Settings** in the app shows green source runs.

More detail: [DEPLOY.md](./DEPLOY.md).
