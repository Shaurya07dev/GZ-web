// Admin console for aggregator reservations.
//
// Replaces the "admin has zero information regarding artwork reservation,
// amount booked, delivery being charged on admin portal, how much amount
// moved the escrow" client-flagged gap (28 Nov 2026). Shows every active
// reservation in one view with the full money flow visible.
//
// Routes:
//   GET /v1/admin/reservations          — table of active reservations
//
// Future: per-row actions (force-refund, extend, etc.) land here when the
// product lead has approved the UX.

import { Controller, Get, Inject } from "@nestjs/common";
import {
  Collections,
  type AggregatorHoldingDoc,
  type ArtworkDoc,
  type Db,
  type ReservationIntentDoc,
  type UserDoc,
} from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";

export interface AdminReservationRow {
  holdingId: string;
  aggregatorId: string;
  aggregatorName: string;
  artistName: string;
  artworkId: string;
  artworkTitle: string;
  status: AggregatorHoldingDoc["status"];
  cycleMonth: number;
  advancePaise: number;
  deliveryDepositPaise: number;
  displayPricePaise: number;
  /** Total money sitting in escrow against this reservation. */
  escrowedPaise: number;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  assignedAt: string;
  expiresAt: string;
  daysLeft: number;
}

@Controller("v1/admin/reservations")
export class AdminReservationsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin")
  @Get()
  async list(): Promise<{ rows: AdminReservationRow[] }> {
    // Pull every active (reserved OR sold_pending_settlement) holding.
    // Returned holdings are history — not shown here.
    const holdingsSnap = await this.db
      .collection(Collections.aggregatorHoldings)
      .where("status", "in", ["reserved", "sold_pending_settlement"])
      .get();
    if (holdingsSnap.empty) return { rows: [] };

    // Batch-fetch the related docs. Admin page typically shows ≤ a few
    // dozen rows at a time; individual reads are fine at that scale.
    const rows = await Promise.all(
      holdingsSnap.docs.map(async (hDoc) => {
        const holding = hDoc.data() as AggregatorHoldingDoc;
        const [artworkSnap, aggregatorSnap, intentSnap] = await Promise.all([
          this.db.collection(Collections.artworks).doc(holding.artworkId).get(),
          this.db.collection(Collections.users).doc(holding.aggregatorId).get(),
          this.db
            .collection(Collections.reservationIntents)
            .where("holdingId", "==", hDoc.id)
            .limit(1)
            .get(),
        ]);
        const artwork = artworkSnap.data() as ArtworkDoc | undefined;
        const aggregator = aggregatorSnap.data() as UserDoc | undefined;
        const intent = intentSnap.docs[0]?.data() as
          | ReservationIntentDoc
          | undefined;

        // Artist name: artwork.artistId → users doc. Separate fetch
        // since we only want it when the artwork exists.
        let artistName = "Unknown artist";
        if (artwork?.artistId) {
          const artistSnap = await this.db
            .collection(Collections.users)
            .doc(artwork.artistId)
            .get();
          artistName = (artistSnap.data() as UserDoc | undefined)?.name ?? artistName;
        }

        const deliveryDeposit = holding.deliveryDepositPaise ?? 0;
        const escrowed = holding.advanceAmountPaise + deliveryDeposit;
        const expiresMs = holding.expiresAt.toDate().getTime();
        const daysLeft = Math.max(
          0,
          Math.ceil((expiresMs - Date.now()) / 86_400_000),
        );

        return {
          holdingId: hDoc.id,
          aggregatorId: holding.aggregatorId,
          aggregatorName: aggregator?.name ?? "Unknown aggregator",
          artistName,
          artworkId: holding.artworkId,
          artworkTitle: artwork?.title ?? "(artwork missing)",
          status: holding.status,
          cycleMonth: holding.cycleMonth,
          advancePaise: holding.advanceAmountPaise,
          deliveryDepositPaise: deliveryDeposit,
          displayPricePaise: holding.displayPricePaise,
          escrowedPaise: escrowed,
          providerPaymentId: intent?.providerPaymentId ?? null,
          providerOrderId: intent?.providerOrderId ?? null,
          assignedAt: holding.assignedAt.toDate().toISOString(),
          expiresAt: holding.expiresAt.toDate().toISOString(),
          daysLeft,
        } satisfies AdminReservationRow;
      }),
    );

    // Newest first — the admin usually wants to see what JUST happened.
    rows.sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
    return { rows };
  }
}
