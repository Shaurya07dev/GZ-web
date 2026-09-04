#!/usr/bin/env bash
# Applies both migrations against a real Postgres and verifies the
# ledger-balance CONSTRAINT TRIGGER actually rejects an unbalanced
# transaction and accepts a balanced one — not just that the SQL parses.
#
# Local usage: needs Docker. Spins up a throwaway postgres:16-alpine
# container, tests against it, tears it down.
# CI usage: GitHub Actions provides the container as a service (see
# .github/workflows/backend-checks.yml) — set PGHOST/PGPORT/PGPASSWORD
# and this script skips the docker run/rm steps.

set -euo pipefail
cd "$(dirname "$0")/.."

export PGPASSWORD="${PGPASSWORD:-test}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-55432}"
MANAGE_CONTAINER="${MANAGE_CONTAINER:-1}"
CONTAINER_NAME="gz-test-pg-$$"

cleanup() {
  if [ "$MANAGE_CONTAINER" = "1" ]; then
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [ "$MANAGE_CONTAINER" = "1" ]; then
  docker run -d --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD="$PGPASSWORD" -p "$PGPORT:5432" postgres:16-alpine >/dev/null
  for _ in $(seq 1 30); do
    docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
fi

# The 0000 migration's filename includes drizzle-kit's random slug and
# changes every time the schema is regenerated — glob for it rather than
# hardcoding, so this script doesn't silently go stale.
TABLES_MIGRATION=$(ls migrations/0000_*.sql | head -1)
psql -h "$PGHOST" -p "$PGPORT" -U postgres -d postgres -f "$TABLES_MIGRATION" >/dev/null
grep -v '^-- REVOKE' migrations/0001_ledger-integrity-and-append-only.sql \
  | psql -h "$PGHOST" -p "$PGPORT" -U postgres -d postgres >/dev/null

RESULT=$(psql -h "$PGHOST" -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO users (id, firebase_uid, role, name, email) VALUES
  ('33333333-3333-3333-3333-333333333333', 'fb-test-artist', 'artist', 'Test Artist', 'test-artist@example.com');
INSERT INTO ledger_accounts (id, type, owner_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'razorpay_escrow', NULL),
  ('22222222-2222-2222-2222-222222222222', 'artist_payable', '33333333-3333-3333-3333-333333333333');
INSERT INTO ledger_entries (transaction_id, account_id, amount_paise, reason, idempotency_key) VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 100000, 'test_capture', 'idem-1'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', -100000, 'test_settlement', 'idem-2');
COMMIT;
SELECT 'balanced_ok';
SQL
)
echo "$RESULT" | grep -q balanced_ok || { echo "FAIL: balanced transaction was rejected"; exit 1; }

set +e
UNBALANCED_OUTPUT=$(psql -h "$PGHOST" -p "$PGPORT" -U postgres -d postgres <<'SQL' 2>&1
BEGIN;
INSERT INTO ledger_entries (transaction_id, account_id, amount_paise, reason, idempotency_key) VALUES
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 100000, 'test_bug', 'idem-3');
COMMIT;
SQL
)
set -e
echo "$UNBALANCED_OUTPUT" | grep -q "do not sum to zero" || { echo "FAIL: unbalanced transaction was NOT rejected"; echo "$UNBALANCED_OUTPUT"; exit 1; }

echo "packages/db migrations: balanced transaction committed, unbalanced transaction rejected by the DB trigger — verified against a real Postgres 16"
