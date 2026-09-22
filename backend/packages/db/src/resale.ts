// Resale — PARITY scope (seller-list-only), Firestore version.
// completeSale() posts a real balanced ledger pair — resale is customer-
// to-customer, outside the marketplace/aggregator postings
// settlement.ts already has, so this writes the pair inline.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { resaleListingStateMachine } from "@galleryzone/domain";
import { postLedgerEntries } from "./ledger-repository.ts";
import { Collections, type ResaleListingDoc } from "./collections.ts";
import { getCurrentOwner } from "./ownership.ts";

export class ResaleError extends Error {}

export async function listMyResaleListings(db: Firestore, sellerId: string): Promise<(ResaleListingDoc & { id: string })[]> {
  const snap = await db.collection(Collections.resaleListings).where("sellerId", "==", sellerId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ResaleListingDoc) }));
}

export async function createResaleListing(db: Firestore, sellerId: string, artworkId: string, listedPricePaise: number): Promise<{ id: string }> {
  // Nothing used to check the seller owned the piece, so any collector could
  // list somebody else's artwork — and, on complete, credit their own wallet
  // for it. Ownership is the provenance record's projection, so ask that.
  const owner = await getCurrentOwner(db, artworkId).catch(() => null);
  if (!owner || owner.userId !== sellerId) {
    throw new ResaleError(`Artwork ${artworkId} is not yours to list`);
  }
  // One live listing per piece, for the same reason an original can only be
  // in one checkout at a time.
  const existing = await db.collection(Collections.resaleListings).where("artworkId", "==", artworkId).where("status", "==", "active").limit(1).get();
  if (!existing.empty) throw new ResaleError(`Artwork ${artworkId} is already listed for resale`);

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
