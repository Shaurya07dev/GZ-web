import type { Order } from "@/types/order";
import type { Settlement } from "@/types/admin";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { getArtworkById } from "@/lib/mock-data/helpers";
import {
  artworksCol,
  artistActivityCol,
  artistWalletCol,
  artistWalletTransactionsCol,
  artistSettlementsCol,
  artistPricesCol,
  CURRENT_ARTIST_ID,
  CURRENT_ARTIST_NAME,
  ordersCol,
} from "@/lib/mock-collections";

// GST rate and flat delivery charge are pinned here as the single source of
// truth — features/checkout/checkout-review-step.tsx mirrors this exact
// math for the pre-confirm price preview, so the two must stay in sync.
export const CHECKOUT_GST_RATE = 0.05;
export const CHECKOUT_DELIVERY_CHARGE = 250;

export interface CreateOrderPayload {
  artworkId: string;
  addressId: string;
}

// A sale settles into the artist's wallet immediately in this mock (no
// pending/clearing period modeled) — only wired for the demo artist, since
// she's the only artist this app has a wallet for.
function settleIntoArtistWallet(
  artwork: { id: string; title: string; artistId: string },
  orderId: string,
) {
  if (artwork.artistId !== CURRENT_ARTIST_ID) return;

  const artistPrice = artistPricesCol.get()[artwork.id];
  const settlementAmount = Math.round((artistPrice ?? 0) * 0.98); // ~2% platform+aggregator pass-through in this mock
  if (settlementAmount <= 0) return;

  const wallet = artistWalletCol.get();
  artistWalletCol.set({
    ...wallet,
    balance: wallet.balance + settlementAmount,
  });

  const transactions = artistWalletTransactionsCol.get();
  artistWalletTransactionsCol.set([
    {
      id: `wt-${crypto.randomUUID().slice(0, 8)}`,
      type: "settlement" as const,
      label: `Settlement: "${artwork.title}"`,
      amount: settlementAmount,
      date: new Date().toISOString().slice(0, 10),
      status: "completed" as const,
    },
    ...transactions,
  ]);

  const now = new Date().toISOString();
  const settlement: Settlement = {
    id: `settle-${crypto.randomUUID().slice(0, 8)}`,
    orderId,
    artworkTitle: artwork.title,
    artistName: CURRENT_ARTIST_NAME,
    artistAmount: settlementAmount,
    aggregatorCommission: 0,
    platformRevenue: Math.round((artistPrice ?? 0) * 0.02),
    status: "processed",
    createdAt: now,
    processedAt: now,
  };
  artistSettlementsCol.set([settlement, ...artistSettlementsCol.get()]);

  artistActivityCol.set([
    {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      kind: "settlement" as const,
      title: "Settlement received",
      detail: `₹${settlementAmount.toLocaleString("en-IN")} credited for "${artwork.title}"`,
      time: "Just now",
    },
    ...artistActivityCol.get(),
  ]);
}

export const orderService = {
  list: (): Promise<Order[]> => mockDelay(ordersCol.get()),

  get: (id: string): Promise<Order | undefined> =>
    mockDelay(ordersCol.get().find((o) => o.id === id)),

  create: (payload: CreateOrderPayload): Promise<Order> => {
    const artwork = getArtworkById(payload.artworkId);
    if (!artwork) return mockError("Artwork not found");
    if (artwork.status !== "marketplace") {
      return mockError("This artwork is no longer available for purchase");
    }

    const gstAmount =
      Math.round(artwork.customerPrice * CHECKOUT_GST_RATE * 100) / 100;
    const now = new Date().toISOString();
    const order: Order = {
      id: `order-${crypto.randomUUID()}`,
      artworkId: payload.artworkId,
      addressId: payload.addressId,
      amount: artwork.customerPrice,
      gstAmount,
      deliveryCharge: CHECKOUT_DELIVERY_CHARGE,
      status: "pending",
      createdAt: now,
      statusHistory: [{ status: "pending", changedAt: now }],
    };
    ordersCol.set([order, ...ordersCol.get()]);

    // Sold artworks come off the open marketplace — matches the pipeline's
    // Stage 9 ("Sale & Ownership Transfer"): a sold one-of-a-kind original
    // can't be bought twice.
    const artworks = artworksCol.get();
    artworksCol.set(
      artworks.map((a) =>
        a.id === artwork.id
          ? {
              ...a,
              status: "sold" as const,
              statusHistory: [
                ...a.statusHistory,
                { status: "sold" as const, changedAt: now },
              ],
            }
          : a,
      ),
    );

    settleIntoArtistWallet(artwork, order.id);

    return mockDelay(order);
  },
};
