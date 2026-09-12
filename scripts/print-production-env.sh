#!/usr/bin/env bash
# Run after Supabase Postgres is created. Paste output into Vercel → Settings → Environment Variables.
set -euo pipefail

gen() { openssl rand -base64 32 2>/dev/null | tr -d '\n' || head -c 32 /dev/urandom | base64; }
gen_hex() { openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | xxd -p -c 256; }

echo "DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
echo "AUTH_SECRET=$(gen)"
echo "AUTH_USERNAME=amfs"
echo "AUTH_PASSWORD=$(gen | head -c 20)ChangeMe!"
echo "CRON_SECRET=$(gen_hex)"
echo "MAINTAINER_EMAIL=you@example.com"
echo "RESEND_API_KEY="
echo "RESEND_FROM=HydroIQ Alerts <onboarding@resend.dev>"
echo "SAM_API_KEY="
echo ""
echo "Replace DATABASE_URL with Supabase → Project Settings → Database → URI (Transaction pooler or Direct)."
echo "In prisma/schema.prisma set provider = \"postgresql\" before first Vercel deploy."
