import type { ResaleListing } from "@/types/resale";
import { http } from "@/lib/api";
import { paiseToRupees } from "@/lib/api-mappers";

export interface CreateResaleListingInput {
  artworkId: string;
  listedPrice: number;
}

interface ResaleDto {
  id: string;
  artworkId: string;
  listedPricePaise: number;
  status: ResaleListing["status"];
  listedAt: { _seconds: number } | string | null;
}

function toListing(d: ResaleDto): ResaleListing {
  const listedAt = typeof d.listedAt === "string" ? d.listedAt : d.listedAt ? new Date(d.listedAt._seconds * 1000).toISOString() : new Date(0).toISOString();
  return { id: d.id, artworkId: d.artworkId, listedPrice: paiseToRupees(d.listedPricePaise), status: d.status, listedAt };
}

async function refetch(id: string): Promise<ResaleListing> {
  const all = await customerResaleService.listListings();
  const found = all.find((l) => l.id === id);
  if (!found) throw new Error("Listing not found");
  return found;
}

// Resale listings on the API. Completing a sale credits the seller's
// wallet server-side; the money leaves through the wallet's withdrawal.
export const customerResaleService = {
  listListings: async (): Promise<ResaleListing[]> => {
    const rows = await http.get<ResaleDto[]>("/v1/account/resale");
    return rows.map(toListing).sort((a, b) => b.listedAt.localeCompare(a.listedAt));
  },

  createListing: async (input: CreateResaleListingInput): Promise<ResaleListing> => {
    if (input.listedPrice <= 0) throw new Error("Enter a listing price");
    const { id } = await http.post<{ id: string }>("/v1/account/resale", { artworkId: input.artworkId, listedPricePaise: Math.round(input.listedPrice * 100) });
    return refetch(id);
  },

  completeSale: async (id: string): Promise<ResaleListing> => {
    await http.post(`/v1/account/resale/${encodeURIComponent(id)}/complete`);
    return refetch(id);
  },

  withdrawListing: async (id: string): Promise<ResaleListing> => {
    await http.post(`/v1/account/resale/${encodeURIComponent(id)}/withdraw`);
    return refetch(id);
  },
};
