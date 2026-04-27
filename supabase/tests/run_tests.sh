#!/usr/bin/env bash
# ============================================================================
# RPC E2E test runner
#
# 素の Postgres に対して supabase/migrations/* を順に当て、
# create_couple / join_couple の動作を検証する。
#
# 環境変数:
#   PGSUPERUSER   - postgres スーパーユーザー名 (default: postgres)
#   PGTESTDB      - テスト用 DB 名         (default: warikan_test)
#
# 使い方:
#   bash supabase/tests/run_tests.sh
# ============================================================================
set -euo pipefail

PGSUPERUSER="${PGSUPERUSER:-postgres}"
PGTESTDB="${PGTESTDB:-warikan_test}"
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

run_psql() {
  # postgres スーパーユーザーのソケット (peer 認証) で接続。
  # ローカル開発で `sudo service postgresql start` した想定。
  if [ "$(id -u)" -eq 0 ]; then
    su - "$PGSUPERUSER" -c "psql $(printf '%q ' "$@")"
  else
    sudo -u "$PGSUPERUSER" psql "$@"
  fi
}

echo "==> reset $PGTESTDB"
run_psql -d postgres -v ON_ERROR_STOP=1 <<SQL
drop database if exists $PGTESTDB;
create database $PGTESTDB;
SQL

echo "==> apply auth stub"
run_psql -d "$PGTESTDB" -v ON_ERROR_STOP=1 -f "$DIR/auth_stub.sql"

echo "==> apply migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "    - $(basename "$f")"
  run_psql -d "$PGTESTDB" -v ON_ERROR_STOP=1 -f "$f"
done

echo "==> run RPC tests"
run_psql -d "$PGTESTDB" -v ON_ERROR_STOP=1 -f "$DIR/create_couple.test.sql"
