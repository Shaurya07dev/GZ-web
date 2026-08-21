export interface Address {
  id: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

// When an aggregator sells a piece in person, the buyer exists only as a name
// and an email on that sale. This is the bridge: an unclaimed record keyed by
// email that turns into a real collection entry the moment that person signs
// up with the same address. Email is the join key because there is no backend
// to issue an account for them at the point of sale.
export interface BuyerInvite {
  id: string;
  email: string;
  name: string;
  artworkId: string;
  artworkTitle: string;
  soldPrice: number;
  soldAt: string;
  source: "aggregator_sale";
  claimedAt: string | null;
}

export interface CustomerProfile {
  name: string;
  email: string;
  phone: string;
}
