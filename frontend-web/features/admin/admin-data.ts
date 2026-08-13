// Mirrors dashboard-data.ts's ARTIST / aggregator-data.ts's AGGREGATOR /
// lib/mock-data/customer.ts's mockCustomer pattern for the Admin Console's
// sidebar profile card. There is no real admin auth/session anywhere in this
// app, so this is a single static "signed in as" fixture.
export const ADMIN = {
  name: "Ops Console",
  email: "ops@galleryzone.art",
  avatar: "/early-program/avatar-1.png",
};

// Fixed "today" anchor matching every other mock-data file's own internal
// TODAY constant (2026-08-11T00:00:00.000Z) — see
// features/aggregator/aggregator-data.ts's MOCK_TODAY for the full rationale.
// Every date in lib/mock-data/admin.ts and lib/mock-data/admin-analytics.ts
// was generated as an offset from this exact instant, not from wherever the
// real system clock happens to be, so relative-time displays ("submitted 3
// days ago", "waiting 12 days") stay exactly as seeded instead of drifting as
// real time passes. Any admin component needing a "now" for relative-time
// math must import this rather than calling `new Date()` / `Date.now()`.
export const ADMIN_TODAY = new Date("2026-08-11T00:00:00.000Z");
