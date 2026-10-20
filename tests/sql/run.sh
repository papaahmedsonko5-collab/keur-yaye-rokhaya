#!/usr/bin/env bash
# Applique les migrations du dépôt sur une base Postgres JETABLE puis lance les tests SQL.
# Ne jamais pointer vers la production : la base indiquée est supprimée puis recréée.
# Connexion : variables PGHOST / PGPORT / PGUSER / PGPASSWORD habituelles. Base : KYR_TEST_DB (défaut kyr_test).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${KYR_TEST_DB:-kyr_test}"
case "${PGHOST:-localhost}" in
  *supabase.co*) echo "Refusé : tests SQL interdits sur un hôte Supabase." >&2; exit 1 ;;
esac

psql -v ON_ERROR_STOP=1 -q -d postgres -c "DROP DATABASE IF EXISTS \"$DB\"" -c "CREATE DATABASE \"$DB\""
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/sql/00_stubs.sql
for f in supabase/migrations/*.sql; do
  echo "migration : $f"
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
for f in tests/sql/*.test.sql; do
  echo "tests : $f"
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
