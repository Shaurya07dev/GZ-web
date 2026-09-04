-- Ledger-balance property, enforced in the database, not just in
-- packages/domain/settlement.ts's assertBalanced() helper — plan.md §6.5
-- and the plan's §17 gate ("nothing ships until ledger balances in
-- automated test") only means something in production if a bug in
-- application code can't silently write an unbalanced set of entries.
--
-- A CONSTRAINT TRIGGER, DEFERRABLE INITIALLY DEFERRED, checks the sum for
-- a transaction_id only once at COMMIT time — not after every individual
-- row — so a business event that legitimately posts multiple entries
-- inside one DB transaction (the normal case: see
-- packages/domain/settlement.ts's *Postings() functions, each of which
-- returns several rows meant to be inserted together) is checked once,
-- after all of them have landed, rather than failing on the first
-- half-inserted row.
CREATE OR REPLACE FUNCTION check_ledger_balance() RETURNS trigger AS $$
DECLARE
  running_total bigint;
BEGIN
  SELECT COALESCE(SUM(amount_paise), 0)
    INTO running_total
    FROM ledger_entries
    WHERE transaction_id = NEW.transaction_id;

  IF running_total <> 0 THEN
    RAISE EXCEPTION
      'ledger_entries for transaction % do not sum to zero (got % paise)',
      NEW.transaction_id, running_total;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_balance_check
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION check_ledger_balance();

-- Append-only enforcement at the DB GRANT level (plan's Security posture
-- section: "no UPDATE/DELETE grant on these tables for the app's DB
-- role") — application-code discipline alone is not trusted for
-- money/provenance/audit data. `gz_app` is the role Cloud Run's connection
-- pool authenticates as; it does not exist yet (created in Phase 0's
-- Terraform/Cloud SQL setup), so this migration only prepares the REVOKE
-- statements to run once that role exists — applying this file against a
-- database that doesn't yet have `gz_app` will fail on these lines, which
-- is why they're a separate, clearly-commented block rather than mixed
-- into the CREATE TABLE migration above.
--
-- REVOKE UPDATE, DELETE ON ledger_entries        FROM gz_app;
-- REVOKE UPDATE, DELETE ON ownership_events      FROM gz_app;
-- REVOKE UPDATE, DELETE ON artwork_status_events FROM gz_app;
-- REVOKE UPDATE, DELETE ON order_status_events   FROM gz_app;
-- REVOKE UPDATE, DELETE ON audit_log             FROM gz_app;
-- REVOKE UPDATE, DELETE ON rate_config_versions  FROM gz_app;
-- A correction to any of these tables is always a NEW row (a reversing
-- ledger entry, a new rate_config_versions row with a later effectiveFrom,
-- etc.) — never an edit to a posted one. Uncomment and apply once `gz_app`
-- exists.
