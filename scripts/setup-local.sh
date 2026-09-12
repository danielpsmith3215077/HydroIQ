#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -base64 32 | tr -d '\n')
    CRON=$(openssl rand -hex 24)
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s/replace-with-a-long-random-string/${SECRET}/" .env
      sed -i '' "s/replace-me/${CRON}/" .env
    else
      sed -i "s/replace-with-a-long-random-string/${SECRET}/" .env
      sed -i "s/replace-me/${CRON}/" .env
    fi
    echo "Created .env with generated AUTH_SECRET and CRON_SECRET."
  else
    echo "Created .env from .env.example — set AUTH_SECRET and CRON_SECRET manually."
  fi
fi

mkdir -p data
npm install
npx prisma generate
npx prisma db push
echo ""
echo "Ready. Start the app: npm run dev"
echo "Open http://127.0.0.1:43180 — login from AUTH_USERNAME / AUTH_PASSWORD in .env"
