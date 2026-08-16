import type { Artwork } from "@/types/artwork";
import type { Order } from "@/types/order";
import { mockDelay } from "@/lib/mock-utils";
import { ordersCol } from "@/lib/mock-collections";
import { getArtworkById } from "@/lib/mock-data/helpers";

export interface CollectionItem {
  order: Order;
  artwork: Artwork;
}

// Ownership isn't a separately-modeled event in this mock — a delivered
// order IS ownership (Onboarding Guide Stage 9's "sale & ownership
// transfer" collapses into the order reaching "delivered"). So the
// collector's collection is just their delivered orders, joined to the
// live artwork record for COA/NFC/provenance data.
export const customerCollectionService = {
  list: (): Promise<CollectionItem[]> => {
    const items = ordersCol
      .get()
      .filter((order) => order.status === "delivered")
      .map((order) => {
        const artwork = getArtworkById(order.artworkId);
        return artwork ? { order, artwork } : null;
      })
      .filter((item): item is CollectionItem => item !== null);
    return mockDelay(items);
  },
};
