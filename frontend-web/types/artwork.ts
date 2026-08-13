export type ArtworkStatus =
  | "draft" | "pending_approval" | "marketplace" | "reserved"
  | "preparing_dispatch" | "in_transit" | "with_aggregator" | "sold"
  | "settlement_complete" | "delivered" | "completed" | "returned";

export type ListingType = "marketplace_only" | "marketplace_and_aggregator";

export interface ArtworkImage {
  url: string;
  thumbnailUrl: string;
  sortOrder: number;
  altText: string;
}

export interface SocialProofLink {
  platform: "instagram" | "youtube" | "x" | "tiktok";
  url: string;
}

export interface ArtworkStatusEvent {
  status: ArtworkStatus;
  changedAt: string; // ISO date
}

// Matches the GET /marketplace list-item shape documented in the SAD (§3.4)
export interface ArtworkSummary {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  verifiedArtist: boolean;
  category: string;
  medium: string;
  customerPrice: number;
  thumbnailUrl: string;
  insured: boolean;
  status: ArtworkStatus;
  listingType: ListingType;
}

export interface Artwork extends ArtworkSummary {
  description: string;
  dimensions: string | null;
  yearCreated: number | null;
  images: ArtworkImage[]; // up to 8, sortOrder 0 = cover
  coaCertificateNumber: string;
  coaIssueDate: string;
  socialProofLinks: SocialProofLink[];
  statusHistory: ArtworkStatusEvent[];
}

export interface ArtworkFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  medium?: string;
  query?: string;
  sortBy?: "newest" | "price_asc" | "price_desc";
}
