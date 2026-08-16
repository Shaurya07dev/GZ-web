export type ResaleListingStatus = "active" | "sold" | "withdrawn";

export interface ResaleListing {
  id: string;
  artworkId: string;
  listedPrice: number;
  status: ResaleListingStatus;
  listedAt: string; // ISO
}
