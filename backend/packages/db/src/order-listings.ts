// Order listing reads — Firestore version.

import type { Firestore } from "firebase-admin/firestore";
import { Collections, artworkPricingCol, type ArtworkDoc, type ArtworkPricingDoc, type OrderDoc } from "./collections.ts";

export async function listCustomerOrders(db: Firestore, customerId: string): Promise<(OrderDoc & { id: string })[]> {
  const snap = await db.collection(Collections.orders).where("customerId", "==", customerId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
}

export async function getOrder(db: Firestore, orderId: string): Promise<(OrderDoc & { id: string }) | null> {
  const snap = await db.collection(Collections.orders).doc(orderId).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as OrderDoc) } : null;
}

export async function listArtistArtworks(db: Firestore, artistId: string): Promise<((ArtworkDoc & { id: string; artistPricePaise: number }))[]> {
  const snap = await db.collection(Collections.artworks).where("artistId", "==", artistId).orderBy("createdAt", "desc").get();
  return Promise.all(
    snap.docs.map(async (d) => {
      const pricingSnap = await db.collection(artworkPricingCol(d.id)).doc("data").get();
      const pricing = pricingSnap.data() as ArtworkPricingDoc | undefined;
      return { id: d.id, ...(d.data() as ArtworkDoc), artistPricePaise: pricing?.artistPricePaise ?? 0 };
    }),
  );
}
