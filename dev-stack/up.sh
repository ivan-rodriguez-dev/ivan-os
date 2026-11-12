#!/usr/bin/env bash
# Starts the local Supabase-compatible stack and applies the migrations.
# Optional: GOTRUE_BIN=/path/to/gotrue GOTRUE_MIGRATIONS=/path/to/migrations
#           runs the auth server from a local binary instead of the Docker image.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source ./stack.env; set +a
mkdir -p .run

if [[ -n "${GOTRUE_BIN:-}" ]]; then
  docker compose --env-file stack.env up -d db rest mail
else
  docker compose --env-file stack.env --profile auth-image up -d
fi

echo "waiting for database..."
for _ in $(seq 1 60); do
  if PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -p "$DB_PORT" -U supabase_admin -d postgres -qtc 'select 1' >/dev/null 2>&1; then break; fi
  sleep 2
done

PGPASSWORD=$POSTGRES_PASSWORD psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$DB_PORT" -U supabase_admin -d postgres -q <<SQL
alter role authenticator with password '$POSTGRES_PASSWORD';
alter role supabase_auth_admin with password '$POSTGRES_PASSWORD';
SQL
docker compose --env-file stack.env restart rest >/dev/null

if [[ -n "${GOTRUE_BIN:-}" ]]; then
  pkill -f "$GOTRUE_BIN" 2>/dev/null || true
  ( set -a; source ./auth.env
    GOTRUE_API_PORT=$AUTH_PORT
    GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:$POSTGRES_PASSWORD@127.0.0.1:$DB_PORT/postgres"
    GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=$MAIL_SMTP_PORT
    GOTRUE_DB_MIGRATIONS_PATH="${GOTRUE_MIGRATIONS:?set GOTRUE_MIGRATIONS}"
    set +a
    "$GOTRUE_BIN" migrate > .run/auth-migrate.log 2>&1
    nohup "$GOTRUE_BIN" serve > .run/auth.log 2>&1 & )
fi

pkill -f "dev-stack/gateway.mjs" 2>/dev/null || true
nohup node "$PWD/gateway.mjs" > .run/gateway.log 2>&1 &

echo "waiting for auth..."
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$API_PORT/auth/v1/health" >/dev/null; then break; fi
  sleep 2
done
curl -sf "http://127.0.0.1:$API_PORT/auth/v1/health" >/dev/null || { echo "auth did not start; see dev-stack/.run/auth.log"; exit 1; }

./migrate.sh

cat <<MSG

Local stack ready.
  API      http://127.0.0.1:$API_PORT
  Mailpit  http://127.0.0.1:$MAIL_UI_PORT
  Postgres 127.0.0.1:$DB_PORT

.env.local for the app:
  VITE_SUPABASE_URL=http://127.0.0.1:$API_PORT
  VITE_SUPABASE_ANON_KEY=$ANON_KEY
MSG
