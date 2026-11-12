#!/usr/bin/env bash
# Applies supabase/migrations/*.sql in order to the local stack (once each).
set -euo pipefail
cd "$(dirname "$0")"
set -a; source ./stack.env; set +a
export PGPASSWORD=$POSTGRES_PASSWORD
PSQL=(psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$DB_PORT" -U supabase_admin -d postgres -q)

"${PSQL[@]}" -c "create table if not exists public._local_migrations (name text primary key, applied_at timestamptz not null default now()); revoke all on public._local_migrations from anon, authenticated;" 2>/dev/null
for f in ../supabase/migrations/*.sql; do
  name=$(basename "$f")
  if [[ $("${PSQL[@]}" -tAc "select 1 from public._local_migrations where name = '$name'") == "1" ]]; then
    echo "skip   $name"
    continue
  fi
  "${PSQL[@]}" --single-transaction -f "$f" -c "insert into public._local_migrations (name) values ('$name')"
  echo "apply  $name"
done
"${PSQL[@]}" -c "notify pgrst, 'reload schema'"
