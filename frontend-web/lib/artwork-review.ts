// Who reviewed a piece, for the admin "Reviewed" view of the artwork queue. The review is read off the piece's
// status history: an admin approving it (it goes to the marketplace) or returning it with a reason. A move by
// the artist or an aggregator, and an admin delisting a live piece, are not reviews. Pure, so
// artwork-review.check.ts can run it under plain node: types only are imported.

import type { ArtworkStatusEvent } from "@/types/artwork";

export interface ArtworkReview {
  adminName: string;
  decision: "approved" | "rejected";
  /** ISO time of the decision. */
  at: string;
}

/** The text the server writes when an admin delists a piece that is already live. */
const DELIST_REASON = "Delisted by admin";

/** The latest review decision in a piece's history (oldest event first), or null when no admin has decided yet. */
export function artworkReview(history: readonly ArtworkStatusEvent[]): ArtworkReview | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const event = history[i]!;
    if (event.changedByRole !== "admin") continue;
    const adminName = event.changedByName ?? "An admin";
    if (event.status === "marketplace") return { adminName, decision: "approved", at: event.changedAt };
    if (event.status === "returned" && event.reason && event.reason !== DELIST_REASON) {
      return { adminName, decision: "rejected", at: event.changedAt };
    }
  }
  return null;
}
