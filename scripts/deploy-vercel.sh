#!/usr/bin/env bash
# Deploy HydroIQ to Vercel with env from your shell or Cursor secrets.
set -euo pipefail
cd "$(dirname "$0")/.."

required=(DATABASE_URL AUTH_SECRET AUTH_USERNAME AUTH_PASSWORD CRON_SECRET VERCEL_TOKEN)
for v in "${required[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "Missing $v. Export it or add as a Cursor secret, then re-run."
    exit 1
  fi
done

MAINTAINER_EMAIL="${MAINTAINER_EMAIL:-you@example.com}"

echo "Applying migrations to Supabase…"
npx prisma migrate deploy

echo "Deploying to Vercel…"
npx vercel deploy --prod --yes --token "$VERCEL_TOKEN" \
  --env DATABASE_URL="$DATABASE_URL" \
  --env AUTH_SECRET="$AUTH_SECRET" \
  --env AUTH_USERNAME="$AUTH_USERNAME" \
  --env AUTH_PASSWORD="$AUTH_PASSWORD" \
  --env CRON_SECRET="$CRON_SECRET" \
  --env MAINTAINER_EMAIL="$MAINTAINER_EMAIL" \
  --env RESEND_API_KEY="${RESEND_API_KEY:-}" \
  --env RESEND_FROM="${RESEND_FROM:-HydroIQ Alerts <onboarding@resend.dev>}" \
  --env SAM_API_KEY="${SAM_API_KEY:-}"

echo "Done. Open the production URL above, log in, and run Settings → Refresh sources."
