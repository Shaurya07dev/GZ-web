// Mirrors dashboard-data.ts's ARTIST constant pattern for the Aggregator
// Portal's sidebar profile card. There is no aggregator auth/session in
// this mock phase, so this is a single static "logged in as" fixture.
export const AGGREGATOR = {
  companyName: "Verandah Art House",
  contactPerson: "Meher Chatterjee",
  avatar: "/early-program/avatar-2.png",
};

// Fixed "today" anchor matching lib/mock-data/artworks.ts and
// lib/mock-data/aggregator-holdings.ts's own internal TODAY constant
// (2026-08-11T00:00:00.000Z). Every expiresAt/assignedAt value in the
// aggregator fixtures was generated as an offset from that exact instant,
// not from wherever the real system clock happens to be when this runs —
// using real wall-clock Date.now() for "days remaining" / "time ago" math
// would make the countdown/activity displays silently drift out of the
// carefully-seeded "expires in 2 days" .. "expires in 25 days" spread as
// real time passes. Every aggregator component that needs a "now" for
// relative-time display should import this rather than call `new Date()`.
export const MOCK_TODAY = new Date("2026-08-11T00:00:00.000Z");
