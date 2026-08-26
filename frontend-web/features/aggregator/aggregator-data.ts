// Mirrors dashboard-data.ts's ARTIST constant pattern for the Aggregator
// Portal's sidebar profile card. There is no aggregator auth/session in
// this mock phase, so this is a single static "logged in as" fixture.
export const AGGREGATOR = {
  companyName: "Verandah Art House",
  contactPerson: "Meher Chatterjee",
  avatar: "/early-program/avatar-2.png",
};

import type { NotificationGroup } from "@/components/ui/notification-04";

// Aggregator-specific bell feed (features/aggregator/aggregator-shell.tsx),
// distinct from the generic artist-flavoured defaultGroups in
// components/ui/notification-04.tsx. Includes the monthly nominee-coordinator
// reminder promised on the Profile page (MOU §10) so it's visible somewhere,
// not just described in copy — there's no real monthly schedule behind it
// yet since this app has no backend/cron (see NEXT_SESSION_PROMPT.md).
export const AGGREGATOR_NOTIFICATION_GROUPS: NotificationGroup[] = [
  {
    id: "today",
    label: "Today",
    items: [
      {
        id: "nominee-reminder",
        source: { name: "GalleryZone", initials: "GZ" },
        title: "Time to review your nominee",
        subtitle: "Confirm your coordinator's details are still current",
        timestamp: "2h ago",
        unread: true,
      },
      {
        id: "new-order",
        source: { name: "GalleryZone", initials: "GZ" },
        title: "Display price confirmed",
        subtitle: "GalleryZone set the selling price on a reserved piece",
        timestamp: "5h ago",
        unread: true,
      },
    ],
  },
  {
    id: "earlier",
    label: "Earlier",
    items: [
      {
        id: "settlement-paid",
        source: { name: "GalleryZone", initials: "GZ" },
        title: "Advance credited",
        subtitle: "Your security deposit was refunded to your wallet",
        timestamp: "1d ago",
        unread: false,
      },
    ],
  },
];

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
