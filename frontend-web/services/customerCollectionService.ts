import type { Artwork } from "@/types/artwork";
import type { Order } from "@/types/order";
import { mockDelay } from "@/lib/mock-utils";
import { ordersCol } from "@/lib/mock-collections";
import { getArtworkById } from "@/lib/mock-data/helpers";
import { buyerInviteService } from "./buyerInviteService";

export interface CollectionItem {
  /** Null for a piece bought in person from an aggregator — there is no
   *  GalleryZone order behind it, only the aggregator's recorded sale. */
  order: Order | null;
  artwork: Artwork;
  /** How this piece entered the collection. */
  source: "marketplace_order" | "aggregator_sale";
  acquiredAt: string;
  paidPrice: number;
}

// Ownership isn't a separately-modeled event in this mock — a delivered
// order IS ownership (Onboarding Guide Stage 9's "sale & ownership
// transfer" collapses into the order reaching "delivered"). So the
// collector's collection is just their delivered orders, joined to the
// live artwork record for COA/NFC/provenance data.
export const customerCollectionService = {
  list: async (): Promise<CollectionItem[]> => {
    const fromOrders = ordersCol
      .get()
      .filter((order) => order.status === "delivered")
      .map((order) => {
        const artwork = getArtworkById(order.artworkId);
        return artwork
          ? {
              order,
              artwork,
              source: "marketplace_order" as const,
              acquiredAt: order.createdAt,
              paidPrice: order.amount,
            }
          : null;
      })
      .filter((item) => item !== null);

    // Pieces bought in person from an aggregator and since claimed by signing
    // up with the same email — no order exists for these.
    const claimed = await buyerInviteService.listClaimed();
    const fromAggregator = claimed
      .map((invite) => {
        const artwork = getArtworkById(invite.artworkId);
        return artwork
          ? {
              order: null,
              artwork,
              source: "aggregator_sale" as const,
              acquiredAt: invite.soldAt,
              paidPrice: invite.soldPrice,
            }
          : null;
      })
      .filter((item) => item !== null);

    return mockDelay(
      [...fromOrders, ...fromAggregator].sort((a, b) =>
        b.acquiredAt.localeCompare(a.acquiredAt),
      ),
    );
  },
};
