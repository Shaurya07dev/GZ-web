import type { Artwork, ArtworkSummary } from "@/types/artwork";

/** The card-sized view of a full artwork — the same fields the listing endpoint returns per row. */
export function toSummary(artwork: Artwork): ArtworkSummary {
  const { id, title, artistId, artistName, verifiedArtist, category, medium, customerPrice, thumbnailUrl, insured, status, listingType, rarityType } = artwork;
  return { id, title, artistId, artistName, verifiedArtist, category, medium, customerPrice, thumbnailUrl, insured, status, listingType, rarityType };
}
