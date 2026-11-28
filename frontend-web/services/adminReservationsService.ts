// Admin API for active aggregator reservations — the money-flow visibility
// screen client flagged as missing on 28 Nov 2026. Backed by
// backend/apps/api/src/admin-reservations.controller.ts.

import { http } from "@/lib/api";

export interface AdminReservationRow {
  holdingId: string;
  aggregatorId: string;
  aggregatorName: string;
  artistName: string;
  artworkId: string;
  artworkTitle: string;
  status: "reserved" | "sold_pending_settlement";
  cycleMonth: number;
  advancePaise: number;
  deliveryDepositPaise: number;
  displayPricePaise: number;
  escrowedPaise: number;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  assignedAt: string;
  expiresAt: string;
  daysLeft: number;
}

export const adminReservationsService = {
  list: (): Promise<{ rows: AdminReservationRow[] }> =>
    http.get<{ rows: AdminReservationRow[] }>("/v1/admin/reservations"),
};
