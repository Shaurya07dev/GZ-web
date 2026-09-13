// Public (customer-facing) artwork reads — the marketplace listing, one
// artwork, and one artist's listings. SECURITY-CRITICAL despite being
// public: this is exactly the surface the price-leak contract test
// (packages/contracts/artwork-dto.check.ts) protects. artistPricePaise is
// read from the pricing subcollection only to compute displayPricePaise
// and is never placed on the returned object — the DTO is built
// field-by-field, never by spreading a Firestore doc.

import type { Firestore } from "firebase-admin/firestore";
import { loadActiveRates } from "@galleryzone/config";
import { displayPriceOf, type ArtworkStatus, type PricingRates } from "@galleryzone/domain";
import {
  Collections,
  artworkPricingCol,
  artworkStatusEventsCol,
  type ArtworkDoc,
  type ArtworkPricingDoc,
  type ArtworkStatusEventDoc,
  type UserDoc,
} from "./collections.ts";
import { FirestoreRateConfigStore } from "./firestore-rate-config-store.ts";

/** Mirrors @galleryzone/contracts' CustomerArtworkDto (kept structurally identical; contracts can't be imported here without a cycle). */
export interface PublicArtworkView {
  id: string;
  productCode: string;
  artistId: string;
  artistName: string;
  title: string;
  description: string;
  category: string;
  medium: string;
  dimensions: string | null;
  yearCreated: number | null;
  images: { url: string; thumbnailUrl: string | null; altText: string | null; sortOrder: number }[];
  displayPricePaise: number;
  insured: boolean;
  status: ArtworkStatus;
  listingType: string;
  rarityType: string | null;
  coaCertificateNumber: string | null;
  coaIssuedAt: string | null;
  createdAt: string;
}

/** Artwork status is a projection of the latest statusEvents doc, never a field on the artwork. */
export async function latestArtworkStatus(db: Firestore, artworkId: string): Promise<ArtworkStatus> {
  const snap = await db.collection(artworkStatusEventsCol(artworkId)).orderBy("changedAt", "desc").limit(1).get();
  return (snap.docs[0]?.data() as ArtworkStatusEventDoc | undefined)?.status ?? "draft";
}

async function toPublicView(db: Firestore, id: string, artwork: ArtworkDoc, rates: PricingRates): Promise<PublicArtworkView> {
  const [pricingSnap, artistSnap, status] = await Promise.all([
    db.collection(artworkPricingCol(id)).doc("data").get(),
    db.collection(Collections.users).doc(artwork.artistId).get(),
    latestArtworkStatus(db, id),
  ]);
  const pricing = pricingSnap.data() as ArtworkPricingDoc | undefined;
  const artist = artistSnap.data() as UserDoc | undefined;

  return {
    id,
    productCode: artwork.productCode,
    artistId: artwork.artistId,
    artistName: artist?.name ?? "Unknown Artist",
    title: artwork.title,
    description: artwork.description,
    category: artwork.category,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    yearCreated: artwork.yearCreated,
    // TODO: join the images subcollection once the upload pipeline exists.
    images: [],
    displayPricePaise: displayPriceOf(pricing?.artistPricePaise ?? 0, rates),
    insured: artwork.insuranceStatus === "approved",
    status,
    listingType: artwork.listingType,
    rarityType: artwork.rarityType,
    coaCertificateNumber: artwork.coaCertificateNumber,
    coaIssuedAt: artwork.coaIssuedAt?.toDate().toISOString() ?? null,
    createdAt: artwork.createdAt?.toDate().toISOString() ?? new Date(0).toISOString(),
  };
}

// Statuses a shopper may see in a listing. Anything else (draft, pending
// moderation, returned, sold...) is a direct-link-only read.
const LISTABLE: ReadonlySet<ArtworkStatus> = new Set<ArtworkStatus>(["marketplace"]);

async function listPublic(db: Firestore, query: FirebaseFirestore.Query): Promise<PublicArtworkView[]> {
  const rates = await loadActiveRates(new FirestoreRateConfigStore(db));
  const snap = await query.get();
  const views = await Promise.all(snap.docs.map((doc) => toPublicView(db, doc.id, doc.data() as ArtworkDoc, rates)));
  return views.filter((v) => LISTABLE.has(v.status) && v.listingType !== "aggregator_only");
}

/** Marketplace listing: only pieces currently on the marketplace and sold online. */
export function listMarketplaceArtworks(db: Firestore): Promise<PublicArtworkView[]> {
  return listPublic(db, db.collection(Collections.artworks));
}

/** One artist's public listings (artist page rail). */
export function listArtistPublicArtworks(db: Firestore, artistId: string): Promise<PublicArtworkView[]> {
  return listPublic(db, db.collection(Collections.artworks).where("artistId", "==", artistId));
}

/** One artwork by id, any status — a passport/COA link must resolve after the piece is sold. Null if missing. */
export async function getPublicArtwork(db: Firestore, id: string): Promise<PublicArtworkView | null> {
  const snap = await db.collection(Collections.artworks).doc(id).get();
  if (!snap.exists) return null;
  const rates = await loadActiveRates(new FirestoreRateConfigStore(db));
  return toPublicView(db, id, snap.data() as ArtworkDoc, rates);
}
