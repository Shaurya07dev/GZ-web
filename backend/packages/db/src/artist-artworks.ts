// Artist-side artwork submission — Firestore version. A new artwork still
// starts at "pending_approval" (the real moderation gate the mock
// frontend was missing) — pending_approval -> marketplace only happens
// through an explicit approveArtwork() call.

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { artworkStateMachine, editWindowExpiresAt, type ArtworkStatus, type PricingRates } from "@galleryzone/domain";
import { Collections, artworkPricingCol, artworkStatusEventsCol, type ArtworkDoc, type ArtworkPricingDoc, type ArtworkStatusEventDoc, type ListingType } from "./collections.ts";

export class ArtistArtworkError extends Error {}

export interface SubmitArtworkInput {
  db: Firestore;
  artistId: string;
  title: string;
  description: string;
  category: string;
  medium: string;
  artistPricePaise: number;
  listingType: ListingType;
  dimensions?: string | undefined;
  yearCreated?: number | undefined;
  rates: PricingRates;
}

// Product code sequence — a Firestore counter doc rather than a row
// count, since Firestore has no cheap `count(*)` equivalent pre-aggregation
// query without reading every doc (this project's `count()` aggregation
// query works too, but a dedicated counter avoids an ever-growing full
// collection scan as artworks grows). Incremented via FieldValue.increment
// inside the same flow — not perfectly gapless under concurrent
// submissions (two submissions reading the counter before either commits
// could both compute the same next value), documented as the same kind
// of known race the Postgres version's row-count approach had, not a
// regression.
async function nextProductCode(db: Firestore): Promise<string> {
  const counterRef = db.collection("_counters").doc("artworks");
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
  return `GZ${String(result).padStart(6, "0")}`;
}

export async function submitArtwork(input: SubmitArtworkInput): Promise<{ artworkId: string; productCode: string }> {
  const productCode = await nextProductCode(input.db);
  const now = new Date();

  const artworkRef = input.db.collection(Collections.artworks).doc();
  const artworkDoc: ArtworkDoc = {
    productCode,
    artistId: input.artistId,
    title: input.title,
    description: input.description,
    category: input.category,
    medium: input.medium,
    dimensions: input.dimensions ?? null,
    yearCreated: input.yearCreated ?? null,
    artworkType: null,
    listingType: input.listingType,
    rarityType: null,
    coaCertificateNumber: null,
    nfcTagId: null,
    insuranceNumber: null,
    insuranceStatus: null,
    editableUntil: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp, // placeholder, overwritten below with a real computed value
    createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
  };
  await artworkRef.set(artworkDoc);
  // editWindowExpiresAt() needs a concrete Date, which serverTimestamp()
  // can't give us before the write resolves — set it as a genuine
  // client-computed Timestamp in a second write rather than fake a value
  // in the first.
  await artworkRef.update({ editableUntil: Timestamp.fromDate(editWindowExpiresAt(now, input.rates)) });

  const pricingDoc: ArtworkPricingDoc = { artistId: input.artistId, artistPricePaise: input.artistPricePaise };
  await input.db.collection(artworkPricingCol(artworkRef.id)).doc("data").set(pricingDoc);

  const statusEvent: ArtworkStatusEventDoc = { status: "pending_approval", changedBy: null, reason: null, changedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp };
  await input.db.collection(artworkStatusEventsCol(artworkRef.id)).add(statusEvent);

  return { artworkId: artworkRef.id, productCode };
}

async function latestArtworkStatus(db: Firestore, artworkId: string): Promise<ArtworkStatus> {
  const snap = await db.collection(artworkStatusEventsCol(artworkId)).orderBy("changedAt", "desc").limit(1).get();
  return (snap.docs[0]?.data() as ArtworkStatusEventDoc | undefined)?.status ?? "draft";
}

export async function approveArtwork(db: Firestore, artworkId: string): Promise<void> {
  const current = await latestArtworkStatus(db, artworkId);
  artworkStateMachine.assertTransition(current, "marketplace");
  await db.collection(artworkStatusEventsCol(artworkId)).add({ status: "marketplace", changedBy: null, reason: null, changedAt: FieldValue.serverTimestamp() });
}

export async function rejectArtwork(db: Firestore, artworkId: string, reason: string): Promise<void> {
  if (!reason) throw new ArtistArtworkError("A rejection requires a reason");
  const current = await latestArtworkStatus(db, artworkId);
  artworkStateMachine.assertTransition(current, "returned");
  await db.collection(artworkStatusEventsCol(artworkId)).add({ status: "returned", changedBy: null, reason, changedAt: FieldValue.serverTimestamp() });
}

/** How many artworks this artist has ever submitted — feeds the rating-card composite score's artwork-count factor. */
export async function countArtistArtworks(db: Firestore, artistId: string): Promise<number> {
  const snap = await db.collection(Collections.artworks).where("artistId", "==", artistId).count().get();
  return snap.data().count;
}
