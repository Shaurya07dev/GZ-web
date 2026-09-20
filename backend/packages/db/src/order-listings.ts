// Order listing reads — Firestore version.

import type { Firestore } from "firebase-admin/firestore";
import { Collections, artworkPricingCol, orderStatusEventsCol, type ArtworkDoc, type ArtworkPricingDoc, type OrderDoc, type OrderStatusEventDoc, type PaymentDoc } from "./collections.ts";

export interface OrderView extends OrderDoc {
  id: string;
  /** What was bought — enough for a row/card without a second read. */
  artwork: { title: string; artistName: string; artistId: string; thumbnailUrl: string | null; productCode: string } | null;
  /** Latest capture attempt, if any — never the gateway's raw payload. */
  payment: { method: string | null; providerPaymentId: string | null; status: string } | null;
  statusHistory: { status: string; changedAt: string }[];
}

export async function decorate(db: Firestore, id: string, order: OrderDoc): Promise<OrderView> {
  const [paySnap, eventsSnap, artworkSnap] = await Promise.all([
    db.collection(Collections.payments).where("orderId", "==", id).limit(1).get(),
    db.collection(orderStatusEventsCol(id)).orderBy("changedAt", "asc").get(),
    db.collection(Collections.artworks).doc(order.artworkId).get(),
  ]);
  const pay = paySnap.docs[0]?.data() as PaymentDoc | undefined;
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  return {
    id,
    ...order,
    artwork: artwork
      ? {
          title: artwork.title,
          artistName: artwork.listing?.artistName ?? "",
          artistId: artwork.artistId,
          thumbnailUrl: artwork.listing?.coverThumbnailUrl ?? artwork.listing?.coverImageUrl ?? null,
          productCode: artwork.productCode,
        }
      : null,
    payment: pay ? { method: pay.method, providerPaymentId: pay.providerPaymentId, status: pay.status } : null,
    statusHistory: eventsSnap.docs.map((d) => {
      const e = d.data() as OrderStatusEventDoc;
      return { status: e.status, changedAt: e.changedAt?.toDate().toISOString() ?? new Date(0).toISOString() };
    }),
  };
}

export async function listCustomerOrders(db: Firestore, customerId: string): Promise<OrderView[]> {
  const snap = await db.collection(Collections.orders).where("customerId", "==", customerId).orderBy("createdAt", "desc").get();
  return Promise.all(snap.docs.map((d) => decorate(db, d.id, d.data() as OrderDoc)));
}

/** Orders for artworks this artist made, newest first. */
export async function listArtistOrders(db: Firestore, artistId: string): Promise<(OrderView & { artistNetPaise: number })[]> {
  const artworksSnap = await db.collection(Collections.artworks).where("artistId", "==", artistId).select().get();
  const ids = artworksSnap.docs.map((d) => d.id);
  if (!ids.length) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const snaps = await Promise.all(chunks.map((chunk) => db.collection(Collections.orders).where("artworkId", "in", chunk).get()));
  const rows = await Promise.all(
    snaps.flatMap((s) => s.docs).map(async (d) => {
      const order = d.data() as OrderDoc;
      const pricingSnap = await db.collection(artworkPricingCol(order.artworkId)).doc("data").get();
      const pricing = pricingSnap.data() as ArtworkPricingDoc | undefined;
      const view = await decorate(db, d.id, order);
      // Marketplace channel: the artist's price is paid in full (domain artistSettlementOf).
      return { ...view, artistNetPaise: pricing?.artistPricePaise ?? 0 };
    }),
  );
  return rows.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export async function getOrder(db: Firestore, orderId: string): Promise<OrderView | null> {
  const snap = await db.collection(Collections.orders).doc(orderId).get();
  return snap.exists ? decorate(db, snap.id, snap.data() as OrderDoc) : null;
}

export async function listArtistArtworks(db: Firestore, artistId: string): Promise<((ArtworkDoc & { id: string; artistPricePaise: number }))[]> {
  // Sorted in memory for the same reason as listArtistArtworksOwned — see artist-artworks.ts.
  const snap = await db.collection(Collections.artworks).where("artistId", "==", artistId).get();
  const docs = [...snap.docs].sort(
    (a, b) => ((b.data() as ArtworkDoc).createdAt?.toMillis?.() ?? 0) - ((a.data() as ArtworkDoc).createdAt?.toMillis?.() ?? 0),
  );
  return Promise.all(
    docs.map(async (d) => {
      const pricingSnap = await db.collection(artworkPricingCol(d.id)).doc("data").get();
      const pricing = pricingSnap.data() as ArtworkPricingDoc | undefined;
      return { id: d.id, ...(d.data() as ArtworkDoc), artistPricePaise: pricing?.artistPricePaise ?? 0 };
    }),
  );
}
