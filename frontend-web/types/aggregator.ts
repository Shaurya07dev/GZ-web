export interface AggregatorHolding {
  id: string; // assignment id
  artworkId: string;
  advancePercent: 5 | 3;
  advanceAmount: number;
  displayPrice: number; // aggregator-editable; floor = artwork.customerPrice
  assignedAt: string; // ISO
  expiresAt: string; // assignedAt + 30 days
  status: "reserved" | "sold_pending_settlement";
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
