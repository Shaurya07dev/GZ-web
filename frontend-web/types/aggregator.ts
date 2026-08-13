export interface AggregatorHolding {
  id: string; // assignment id
  artworkId: string;
  advancePercent: 5 | 3;
  advanceAmount: number;
  displayPrice: number; // aggregator-editable; floor = artwork.customerPrice
  assignedAt: string; // ISO
  expiresAt: string; // assignedAt + 30 days
  status: "reserved" | "sold_pending_settlement";
}

export interface RecordSalePayload {
  artworkId: string;
  soldPrice: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  deliveryAddress: { line1: string; city: string; state: string; pincode: string };
  deliveryMode: "courier" | "self_pickup";
}
