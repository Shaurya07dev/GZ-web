// Resale — PARITY scope (seller-list-only), Firestore version.
// completeSale() posts a real balanced ledger pair — resale is customer-
// to-customer, outside the marketplace/aggregator postings
// settlement.ts already has, so this writes the pair inline.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { resaleListingStateMachine } from "@galleryzone/domain";
import { postLedgerEntries } from "./ledger-repository.ts";
import { Collections, type ResaleListingDoc } from "./collections.ts";

export class ResaleError extends Error {}

export async function listMyResaleListings(db: Firestore, sellerId: string): Promise<(ResaleListingDoc & { id: string })[]> {
  const snap = await db.collection(Collections.resaleListings).where("sellerId", "==", sellerId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ResaleListingDoc) }));
}

export async function createResaleListing(db: Firestore, sellerId: string, artworkId: string, listedPricePaise: number): Promise<{ id: string }> {
  const ref = db.collection(Collections.resaleListings).doc();
  const doc: ResaleListingDoc = { sellerId, artworkId, listedPricePaise, status: "active", listedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp };
  await ref.set(doc);
  return { id: ref.id };
}

async function getOwnedListing(db: Firestore, sellerId: string, listingId: string): Promise<ResaleListingDoc> {
  const snap = await db.collection(Collections.resaleListings).doc(listingId).get();
  if (!snap.exists || (snap.data() as ResaleListingDoc).sellerId !== sellerId) {
    throw new ResaleError(`No resale listing ${listingId} for seller ${sellerId}`);
  }
  return snap.data() as ResaleListingDoc;
}

export async function withdrawResaleListing(db: Firestore, sellerId: string, listingId: string): Promise<void> {
  const listing = await getOwnedListing(db, sellerId, listingId);
  resaleListingStateMachine.assertTransition(listing.status, "withdrawn");
  await db.collection(Collections.resaleListings).doc(listingId).update({ status: "withdrawn" });
}

export async function completeResaleSale(db: Firestore, sellerId: string, listingId: string): Promise<{ transactionId: string }> {
  const listing = await getOwnedListing(db, sellerId, listingId);
  resaleListingStateMachine.assertTransition(listing.status, "sold");

  const { transactionId } = await postLedgerEntries(db, {
    postings: [
      { accountType: "razorpay_escrow", amountPaise: listing.listedPricePaise, reason: "resale_capture" },
      { accountType: "customer_wallet", ownerId: sellerId, amountPaise: -listing.listedPricePaise, reason: "resale_credit" },
    ],
    idempotencyPrefix: `resale:${listingId}`,
  });

  await db.collection(Collections.resaleListings).doc(listingId).update({ status: "sold" });
  return { transactionId };
}
