#!/usr/bin/env bash
# Проверка SQL-миграций на локальном PostgreSQL (не на Supabase!):
# создаёт пустую базу, имитирует окружение Supabase (роли anon/authenticated, auth.uid()),
# применяет все миграции и прогоняет сценарий кланов от лица трёх игроков.
#
#   PGURL=postgres://postgres@localhost:5432/postgres bash supabase/tests/run.sh
#
# Каждая строка вывода — «шаг | результат»; ожидаемые результаты описаны в clans_scenario.sql.
set -euo pipefail
cd "$(dirname "$0")/.."
PGURL=${PGURL:-postgres://postgres@localhost:5432/postgres}
DB=kaelmor_sql_test
psql "$PGURL" -qc "drop database if exists $DB" -c "create database $DB"
TEST_URL="${PGURL%/*}/$DB"
psql "$TEST_URL" -q -c "drop role if exists anon" -c "drop role if exists authenticated" 2>/dev/null || true
for f in tests/00_supabase_stub.sql migrations/*.sql; do
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 | grep -E "ERROR" && exit 1 || true
done
psql "$TEST_URL" -q -At -F ' | ' -f tests/clans_scenario.sql
