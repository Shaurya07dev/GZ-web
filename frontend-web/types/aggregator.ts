export interface AggregatorHolding {
  id: string; // assignment id
  artworkId: string;
  advancePercent: 5 | 3;
  advanceAmount: number;
  // Paid with the advance before taking possession (MOU §7). The money-flow
  // sheet returns it only if the piece sells — an unsold piece going back to
  // GalleryZone refunds the advance alone. Optional because fixture holdings
  // predate the field.
  deliveryDeposit?: number;
  displayPrice: number; // aggregator-editable; floor = artwork.customerPrice
  assignedAt: string; // ISO
  expiresAt: string; // assignedAt + 30 days
  // "returned" is kept rather than deleted: the artwork's cycle month is
  // counted from how many aggregators have already had it, so the history is
  // what decides the next aggregator's price and advance.
  status: "reserved" | "sold_pending_settlement" | "returned";
  // Aggregator MOU §6: the aggregator gets ONE opportunity to set the selling
  // price. Stamped the first time they set it; after that the price is locked.
  // Optional because fixture holdings predate the field — undefined and null
  // both mean "not set yet".
  displayPriceSetAt?: string | null;
  // Which month of the artwork's five-month aggregator cycle this placement is.
  // A piece that doesn't sell moves to a DIFFERENT aggregator each month, at a
  // lower price and a different advance rate, so the month is a property of the
  // artwork's journey rather than of any one aggregator. Optional because
  // fixture holdings predate the field; absent means month 1.
  cycleMonth?: number;
  /** Set when the piece went back to GalleryZone unsold. */
  returnedAt?: string | null;
  // True when this placement runs past the usual thirty days because what would
  // have been left of the artist's 180 days was too short to hand to anyone
  // else. The last aggregator keeps it rather than the piece making one more
  // journey for a fortnight.
  windowExtended?: boolean;
  // Distinguishes an aggregator-initiated reservation (Browse → Reserve) from
  // GalleryZone proactively placing inventory at this aggregator's premises
  // (MOU §4). Drives the My Inventory filter tabs.
  assignmentSource: "self_reserved" | "gz_assigned";
}

export interface RecordSalePayload {
  artworkId: string;
  soldPrice: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  deliveryAddress: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  deliveryMode: "courier" | "self_pickup";
  paymentRoute: "direct_to_galleryzone" | "cash_at_premises";
}

// Persisted result of recordSale() — buyer/price/delivery details Orders &
// Sales, Customers, Shipping, Wallet crediting, and Settlements need.
export interface AggregatorSale {
  id: string;
  holdingId: string;
  artworkId: string;
  soldPrice: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  deliveryAddress: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  deliveryMode: "courier" | "self_pickup";
  // The aggregator collects "on behalf of GalleryZone", never for themselves.
  // Either the buyer paid GalleryZone directly (transfer or UPI, using the
  // details on the checkout page), or the aggregator took cash — in which case
  // they owe GalleryZone the WHOLE sale price and their commission is settled
  // separately afterwards. They never net it off at the counter.
  paymentRoute?: "direct_to_galleryzone" | "cash_at_premises";
  /** Set when the aggregator has transferred cash they collected. */
  remittedAt?: string | null;
  soldAt: string; // ISO
  shipmentStatus: "preparing" | "dispatched" | "delivered";
  dispatchedAt: string | null;
  deliveredAt: string | null;
  courierRef: string | null; // null when deliveryMode === "self_pickup"
}

// The aggregator's own physical premises (not the Artist Dashboard's
// "Gallery Spaces" page, which lists artworks placed at an aggregator).
export interface GallerySpace {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  capacity: number; // max pieces this location can display at once
  coordinatorName: string; // MOU §10: "nominate one Galleryzone coordinator"
}
