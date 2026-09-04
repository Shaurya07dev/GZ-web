export * from "./schema/rate-config.ts";
export * from "./schema/identity.ts";
export * from "./schema/artwork.ts";
export * from "./schema/order.ts";
export * from "./schema/ledger.ts";
export * from "./schema/aggregator.ts";
export * from "./schema/audit.ts";

// Still not modeled here (later phases, or scope calls the plan flags as
// open with the client): messaging threads, ratings/reviews, resale
// listings, support tickets, artist-network connections. Each is a small
// table once its scope question is answered (see the plan's "Scope calls"
// section) — deferred rather than guessed.
