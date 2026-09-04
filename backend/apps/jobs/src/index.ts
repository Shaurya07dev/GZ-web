// Cloud Tasks/Scheduler-triggered workers (plan.md §13): consignment
// window sweep, settlement initiation, payout dispatch, daily ledger
// reconciliation, COA/invoice PDF generation, image derivatives,
// reserved-artwork TTL release, notification outbox. All Phase 2+ work —
// each job needs the ledger/state-machine tables from packages/db (Phase 1)
// before it has anything real to operate on.

export {};
