import type { ResaleListing } from "@/types/resale";
import { mockDelay, mockError } from "@/lib/mock-utils";
import {
  customerResaleListingsCol,
  customerWalletCol,
  customerWalletTransactionsCol,
} from "@/lib/mock-collections";
import { getArtworkById } from "@/lib/mock-data/helpers";

export interface CreateResaleListingInput {
  artworkId: string;
  listedPrice: number;
}

// Own file, not folded into customerCollectionService.ts — a distinct
// actor-facing domain, same reasoning as the Aggregator track's separate
// aggregatorSupportService.ts / aggregatorMessagesService.ts. Browsing other
// collectors' listings is not modeled; this is the seller's side.
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

  // A resale that completes has to pay the seller, which is what the bank
  // details on CustomerProfile are for. The proceeds land in the same balance
  // refunds do, and can be withdrawn from there.
  completeSale: (id: string): Promise<ResaleListing> => {
    const listings = customerResaleListingsCol.get();
    const existing = listings.find((l) => l.id === id);
    if (!existing) return mockError(`Listing "${id}" not found`);
    if (existing.status !== "active") {
      return mockError("This listing is no longer active");
    }

    const updated: ResaleListing = { ...existing, status: "sold" };
    customerResaleListingsCol.set(
      listings.map((l) => (l.id === id ? updated : l)),
    );

    const wallet = customerWalletCol.get();
    customerWalletCol.set({
      ...wallet,
      balance: wallet.balance + existing.listedPrice,
    });

    const artwork = getArtworkById(existing.artworkId);
    customerWalletTransactionsCol.set([
      {
        id: `wt-${crypto.randomUUID().slice(0, 8)}`,
        type: "settlement",
        label: `Resale: "${artwork?.title ?? "Artwork"}"`,
        amount: existing.listedPrice,
        date: new Date().toISOString().slice(0, 10),
        status: "completed",
      },
      ...customerWalletTransactionsCol.get(),
    ]);

    return mockDelay(updated);
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
