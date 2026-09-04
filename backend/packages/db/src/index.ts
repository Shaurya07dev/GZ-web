export * from "./schema/rate-config.ts";

// Remaining schema (users/roles, artworks, orders, ledger_entries,
// ownership_events, artwork_status_events, holdings, audit_log, etc.) is
// Phase 1/2 work — see the plan's Data model / Money sections. This file
// intentionally only carries the rate_config table for now: it's the piece
// Phase 0 needs so packages/config has something real to point at.
