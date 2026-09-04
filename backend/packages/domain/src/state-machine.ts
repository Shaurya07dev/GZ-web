// Generic state-machine primitive plus every concrete transition table found
// in the frontend inventory pass (artwork/order/holding/KYC/GST/insurance/
// withdrawal/settlement/deactivation/penalty/transfer/physical-COA/resale/
// connection). Pure, zero I/O, per the plan's packages/domain contract.
//
// Each table below is deliberately narrower than the theoretical union of
// every status the mock frontend ever assigns a field — it only allows the
// transitions actually implemented in the mock services (see the research
// pass), because those are the transitions this backend has to reproduce
// exactly, not a hypothetical superset.

export class IllegalTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`Illegal ${entity} transition: ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export interface StateMachine<S extends string> {
  readonly entity: string;
  readonly transitions: Readonly<Record<S, readonly S[]>>;
  canTransition(from: S, to: S): boolean;
  /** Throws IllegalTransitionError if the move isn't in the table. */
  assertTransition(from: S, to: S): void;
}

export function createStateMachine<S extends string>(
  entity: string,
  transitions: Readonly<Record<S, readonly S[]>>,
): StateMachine<S> {
  return {
    entity,
    transitions,
    canTransition(from, to) {
      return (transitions[from] ?? []).includes(to);
    },
    assertTransition(from, to) {
      if (!this.canTransition(from, to)) {
        throw new IllegalTransitionError(entity, from, to);
      }
    },
  };
}

// --- Artwork -----------------------------------------------------------------
// Mirrors frontend-web/types/artwork.ts's ArtworkStatus plus the actual
// mock-service transitions (artistDashboardService.submitArtwork/
// updateArtwork/markSoldElsewhere, adminService.approveArtwork/
// rejectArtwork/delistArtwork). The frontend mock auto-approves on submit —
// this backend adds the real moderation gate the plan flags as a gap, so
// pending_approval -> marketplace only happens via an explicit admin
// approveArtwork call, never automatically.

export type ArtworkStatus =
  | "draft"
  | "pending_approval"
  | "marketplace"
  | "reserved"
  | "with_aggregator"
  | "sold"
  | "settlement_complete"
  | "delivered"
  | "completed"
  | "returned"
  | "sold_externally";

export const artworkStateMachine = createStateMachine<ArtworkStatus>("Artwork", {
  draft: ["pending_approval", "sold_externally"],
  pending_approval: ["marketplace", "returned"],
  marketplace: ["reserved", "with_aggregator", "sold", "sold_externally", "returned"],
  reserved: ["sold", "marketplace"],
  with_aggregator: ["sold", "marketplace", "returned"],
  sold: ["settlement_complete"],
  settlement_complete: ["delivered"],
  delivered: ["completed"],
  completed: [],
  returned: ["pending_approval", "sold_externally"],
  sold_externally: [],
});

// --- Order (frontend gap — mock never drives this past pending/paid) -------

export type OrderStatus = "pending" | "paid" | "confirmed" | "packed" | "transit" | "delivered" | "cancelled";

export const orderStateMachine = createStateMachine<OrderStatus>("Order", {
  pending: ["paid", "cancelled"],
  paid: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["transit"],
  transit: ["delivered"],
  delivered: [],
  cancelled: [],
});

// --- Aggregator holding ------------------------------------------------------

export type HoldingStatus = "reserved" | "sold_pending_settlement" | "returned";

export const holdingStateMachine = createStateMachine<HoldingStatus>("AggregatorHolding", {
  reserved: ["sold_pending_settlement", "returned"],
  sold_pending_settlement: [],
  returned: [],
});

// --- Aggregator sale shipment -------------------------------------------------

export type ShipmentStatus = "preparing" | "dispatched" | "delivered";

export const shipmentStateMachine = createStateMachine<ShipmentStatus>("AggregatorSaleShipment", {
  preparing: ["dispatched"],
  dispatched: ["delivered"],
  delivered: [],
});

// --- KYC / GST / Insurance — same 4-value vocabulary, 3 separate machines --
// (kept as three instances, not one shared one, matching the frontend's own
// admin-status-badge.tsx philosophy: same words, different domains, and
// they can legitimately be in different states for the same artist at once.)

export type ReviewStatus = "not_submitted" | "submitted" | "approved" | "rejected";

function reviewQueueMachine(entity: string): StateMachine<ReviewStatus> {
  return createStateMachine<ReviewStatus>(entity, {
    not_submitted: ["submitted"],
    submitted: ["approved", "rejected"],
    approved: ["submitted"], // e.g. insurance re-submission with a changed number
    rejected: ["submitted"],
  });
}

export const kycStateMachine = reviewQueueMachine("Kyc");
export const gstStateMachine = reviewQueueMachine("Gst");
export const insuranceStateMachine = reviewQueueMachine("Insurance");

// --- Withdrawal ----------------------------------------------------------------

export type WithdrawalStatus = "pending" | "completed" | "rejected" | "failed";

export const withdrawalStateMachine = createStateMachine<WithdrawalStatus>("Withdrawal", {
  pending: ["completed", "rejected", "failed"],
  completed: [],
  rejected: [],
  failed: ["pending"], // admin retry
});

// --- Settlement ------------------------------------------------------------

export type SettlementStatus = "pending" | "processed" | "failed";

export const settlementStateMachine = createStateMachine<SettlementStatus>("Settlement", {
  pending: ["processed", "failed"],
  processed: [],
  failed: ["pending"], // adminService.retrySettlement, only from failed
});

// --- Deactivation request ----------------------------------------------------

export type DeactivationStatus = "pending" | "approved" | "rejected";

export const deactivationStateMachine = createStateMachine<DeactivationStatus>("DeactivationRequest", {
  pending: ["approved", "rejected"],
  approved: [],
  rejected: [],
});

// --- External-sale penalty ----------------------------------------------------

export type PenaltyStatus = "pending_review" | "approved" | "waived";

export const penaltyStateMachine = createStateMachine<PenaltyStatus>("ExternalSalePenalty", {
  pending_review: ["approved", "waived"],
  approved: [],
  waived: [],
});

// --- Ownership / display transfer ---------------------------------------------

export type TransferStatus = "pending" | "accepted" | "cancelled";

export const transferStateMachine = createStateMachine<TransferStatus>("OwnershipTransfer", {
  pending: ["accepted", "cancelled"],
  accepted: [],
  cancelled: [],
});

// --- Physical COA dispatch -----------------------------------------------------

export type PhysicalCoaStatus = "requested" | "dispatched";

export const physicalCoaStateMachine = createStateMachine<PhysicalCoaStatus>("PhysicalCoaRequest", {
  requested: ["dispatched"],
  dispatched: [],
});

// --- Resale listing -----------------------------------------------------------

export type ResaleListingStatus = "active" | "sold" | "withdrawn";

export const resaleListingStateMachine = createStateMachine<ResaleListingStatus>("ResaleListing", {
  active: ["sold", "withdrawn"],
  sold: [],
  withdrawn: [],
});

// --- Artist network connection -------------------------------------------------

export type ConnectionStatus = "pending" | "accepted" | "declined";

export const connectionStateMachine = createStateMachine<ConnectionStatus>("ArtistConnection", {
  pending: ["accepted", "declined"],
  accepted: [],
  declined: ["pending"], // re-requested after a decline
});
