import type { ResaleListing } from "@/types/resale";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { customerResaleListingsCol } from "@/lib/mock-collections";

export interface CreateResaleListingInput {
  artworkId: string;
  listedPrice: number;
}

// Own file, not folded into customerCollectionService.ts — a distinct
// actor-facing domain, same reasoning as the Aggregator track's separate
// aggregatorSupportService.ts / aggregatorMessagesService.ts. Listing
// another collector's offer or completing a resale (ownership transfer to a
// new buyer) isn't modeled in this demo — this is the seller-side listing
// flow only.
export const customerResaleService = {
  listListings: (): Promise<ResaleListing[]> =>
    mockDelay(customerResaleListingsCol.get()),

  createListing: (input: CreateResaleListingInput): Promise<ResaleListing> => {
    if (input.listedPrice <= 0) return mockError("Enter a listing price");

    const listing: ResaleListing = {
      id: `resale-${crypto.randomUUID().slice(0, 8)}`,
      artworkId: input.artworkId,
      listedPrice: input.listedPrice,
      status: "active",
      listedAt: new Date().toISOString(),
    };
    customerResaleListingsCol.set([
      listing,
      ...customerResaleListingsCol.get(),
    ]);
    return mockDelay(listing);
  },

  withdrawListing: (id: string): Promise<ResaleListing> => {
    const listings = customerResaleListingsCol.get();
    const existing = listings.find((l) => l.id === id);
    if (!existing) return mockError(`Listing "${id}" not found`);

    const updated: ResaleListing = { ...existing, status: "withdrawn" };
    customerResaleListingsCol.set(
      listings.map((l) => (l.id === id ? updated : l)),
    );
    return mockDelay(updated);
  },
};
