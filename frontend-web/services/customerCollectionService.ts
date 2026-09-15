import type { Artwork } from "@/types/artwork";
import type { Order } from "@/types/order";
import { http } from "@/lib/api";
import { toArtwork, toOrder, type ArtworkDto, type OrderDto } from "@/lib/api-mappers";

export interface CollectionItem {
  /** Null for a piece received by transfer — there is no GalleryZone order behind it. */
  order: Order | null;
  artwork: Artwork;
  /** How this piece entered the collection. */
  source: "marketplace_order" | "aggregator_sale" | "transfer";
  acquiredAt: string;
  paidPrice: number;
}

interface CollectionDto {
  items: { artwork: ArtworkDto; order: OrderDto | null; source: "marketplace_order" | "transfer"; acquiredAt: string; fromName: string }[];
}

// Ownership is its own ledger on the API (artworks/{id}/ownershipEvents):
// a purchase, a transfer accepted from another collector, or a piece
// bought in a partner gallery all end up here the same way.
export const customerCollectionService = {
  list: async (): Promise<CollectionItem[]> => {
    const { items } = await http.get<CollectionDto>("/v1/account/collection");
    return items.map((i) => {
      const order = i.order ? toOrder(i.order) : null;
      return {
        order,
        artwork: toArtwork(i.artwork),
        source: i.source,
        acquiredAt: i.acquiredAt,
        paidPrice: order ? order.amount + order.gstAmount + order.deliveryCharge : 0,
      };
    });
  },
};
