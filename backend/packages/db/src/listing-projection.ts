// The denormalised read model for an artwork — everything the marketplace
// needs to render a card, kept ON the artwork doc so a listing is one
// collection query instead of 1 + 3N reads (status event + pricing +
// artist per artwork). Writers call refreshListing() after any change that
// affects it; the sources of truth stay where they were (statusEvents,
// pricing/data, users, images). Nothing here is authoritative: a reindex
// rebuilds it from scratch (reindexAllListings).
//
// artistPricePaise is read here only to compute displayPricePaise. It is
// never written onto the artwork doc — the price-leak contract test still
// guards the public DTO.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { loadActiveRates } from "@galleryzone/config";
import { displayPriceOf, type ArtworkStatus, type PricingRates } from "@galleryzone/domain";
import {
  Collections,
  artworkImagesCol,
  artworkPricingCol,
  artworkStatusEventsCol,
  type ArtworkDoc,
  type ArtworkImageDoc,
  type ArtworkPricingDoc,
  type ArtworkStatusEventDoc,
  type ListingProjection,
  type PublicProfileDoc,
  type UserDoc,
} from "./collections.ts";
import { FirestoreRateConfigStore } from "./firestore-rate-config-store.ts";

export type { ListingProjection } from "./collections.ts";

export async function latestStatusOf(db: Firestore, artworkId: string): Promise<ArtworkStatus> {
  const snap = await db.collection(artworkStatusEventsCol(artworkId)).orderBy("changedAt", "desc").limit(1).get();
  return (snap.docs[0]?.data() as ArtworkStatusEventDoc | undefined)?.status ?? "draft";
}

/**
 * Appends a status event AND updates the projection in one batch, so the
 * two can't drift. Every status writer goes through here.
 */
export async function appendArtworkStatus(
  db: Firestore,
  artworkId: string,
  event: { status: ArtworkStatus; changedBy: string | null; reason: string | null },
): Promise<void> {
  const artworkRef = db.collection(Collections.artworks).doc(artworkId);
  const artwork = (await artworkRef.get()).data() as ArtworkDoc | undefined;
  const batch = db.batch();
  batch.set(db.collection(artworkStatusEventsCol(artworkId)).doc(), { ...event, changedAt: FieldValue.serverTimestamp() });
  if (artwork) {
    batch.update(artworkRef, {
      "listing.status": event.status,
      "listing.onMarketplace": isOnMarketplace(event.status, artwork.listingType),
      "listing.updatedAt": FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

/** "24 x 36 in" / "60 x 90 cm" → small (≤400 sq in) / medium (≤900) / large. Mirrors the frontend's original bucketing. */
export function sizeBandOf(dimensions: string | null): ListingProjection["sizeBand"] {
  if (!dimensions) return null;
  const match = dimensions.trim().match(/^([\d.]+)\s*x\s*([\d.]+)(?:\s*x\s*[\d.]+)?\s*(in|cm)$/i);
  if (!match) return null;
  const toInches = match[3]!.toLowerCase() === "cm" ? 1 / 2.54 : 1;
  const areaSqIn = Number(match[1]) * toInches * (Number(match[2]) * toInches);
  if (areaSqIn <= 400) return "small";
  if (areaSqIn <= 900) return "medium";
  return "large";
}

function isOnMarketplace(status: ArtworkStatus, listingType: ArtworkDoc["listingType"]): boolean {
  return status === "marketplace" && listingType !== "aggregator_only";
}

/** Rebuilds the whole projection for one artwork from its sources of truth. */
export async function refreshListing(db: Firestore, artworkId: string, rates?: PricingRates): Promise<ListingProjection | null> {
  const artworkRef = db.collection(Collections.artworks).doc(artworkId);
  const artworkSnap = await artworkRef.get();
  if (!artworkSnap.exists) return null;
  const artwork = artworkSnap.data() as ArtworkDoc;
  const activeRates = rates ?? (await loadActiveRates(new FirestoreRateConfigStore(db)));

  const [status, pricingSnap, artistSnap, profileSnap, imagesSnap] = await Promise.all([
    latestStatusOf(db, artworkId),
    db.collection(artworkPricingCol(artworkId)).doc("data").get(),
    db.collection(Collections.users).doc(artwork.artistId).get(),
    db.collection(Collections.publicProfiles).doc(artwork.artistId).get(),
    db.collection(artworkImagesCol(artworkId)).orderBy("sortOrder", "asc").get(),
  ]);
  const pricing = pricingSnap.data() as ArtworkPricingDoc | undefined;
  const artist = artistSnap.data() as UserDoc | undefined;
  const profile = profileSnap.data() as PublicProfileDoc | undefined;
  const cover = imagesSnap.docs[0]?.data() as ArtworkImageDoc | undefined;

  const listing = {
    status,
    onMarketplace: isOnMarketplace(status, artwork.listingType),
    displayPricePaise: displayPriceOf(pricing?.artistPricePaise ?? 0, activeRates),
    artistName: artist?.name ?? "Unknown Artist",
    artistLocation: profile?.location ?? null,
    sizeBand: sizeBandOf(artwork.dimensions),
    coverImageUrl: cover?.url ?? null,
    coverThumbnailUrl: cover?.thumbnailUrl ?? null,
    imageCount: imagesSnap.size,
    updatedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
  } satisfies ListingProjection;
  await artworkRef.update({ listing });
  return listing;
}

/** Every artwork of one artist — after a rename. */
export async function refreshArtistListings(db: Firestore, artistId: string): Promise<number> {
  const snap = await db.collection(Collections.artworks).where("artistId", "==", artistId).select().get();
  const rates = await loadActiveRates(new FirestoreRateConfigStore(db));
  for (const doc of snap.docs) await refreshListing(db, doc.id, rates);
  return snap.size;
}

/**
 * Full rebuild — after a rate-config change (every display price moves),
 * on first deploy of the projection, or whenever an admin wants to be sure.
 * Sequential on purpose: this is an admin job, not a request path.
 */
export async function reindexAllListings(db: Firestore): Promise<number> {
  const snap = await db.collection(Collections.artworks).select().get();
  const rates = await loadActiveRates(new FirestoreRateConfigStore(db));
  for (const doc of snap.docs) await refreshListing(db, doc.id, rates);
  return snap.size;
}
