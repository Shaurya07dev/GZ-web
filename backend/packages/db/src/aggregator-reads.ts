// Aggregator portal reads + the return path. The reserve/sale writes live
// in aggregator-flow.ts; this module gives the portal what it needs to
// render: which pieces can be reserved right now and on what terms, what
// this aggregator holds, and a way to hand a piece back.
//
// Offer terms are computed by the same domain functions reserveHolding()
// uses, so the card and the reservation can never disagree.

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  aggregatorAdvanceForMonth,
  aggregatorOfferPriceOf,
  aggregatorReturnPostings,
  holdingStateMachine,
  placementWindow,
  withGst,
  type PricingRates,
} from "@galleryzone/domain";
import { Collections, artworkPricingCol, type AggregatorHoldingDoc, type ArtworkDoc, type ArtworkPricingDoc } from "./collections.ts";
import { postLedgerEntries } from "./ledger-repository.ts";
import { appendArtworkStatus, latestStatusOf, refreshListing } from "./listing-projection.ts";
import { getPublicArtwork, type PublicArtworkView } from "./public-artworks.ts";

export class AggregatorReadError extends Error {}

const AGGREGATOR_LISTING_TYPES = new Set(["aggregator_only", "marketplace_and_aggregator"]);
const ACTIVE_HOLDING = new Set(["reserved", "sold_pending_settlement"]);

export interface AggregatorOffer {
  artworkId: string;
  month: number;
  offerPricePaise: number;
  standardPricePaise: number;
  monthlyReductionPaise: number;
  marketplacePricePaise: number;
  advancePaise: number;
  advanceRate: number;
  advanceBasePaise: number;
  advanceBasis: "display_price" | "artist_price";
  daysLeftInListing: number;
  deliveryChargePaise: number;
  payablePaise: number;
  previousAggregatorChangedPrice: boolean;
}

async function holdingsFor(db: Firestore, artworkId: string): Promise<(AggregatorHoldingDoc & { id: string })[]> {
  const snap = await db.collection(Collections.aggregatorHoldings).where("artworkId", "==", artworkId).orderBy("assignedAt").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AggregatorHoldingDoc) }));
}

/** This month's terms for a piece — never exposes artistPricePaise itself. */
export async function computeOffer(db: Firestore, artworkId: string, rates: PricingRates): Promise<AggregatorOffer | null> {
  const pricing = (await db.collection(artworkPricingCol(artworkId)).doc("data").get()).data() as ArtworkPricingDoc | undefined;
  if (!pricing) return null;
  const prior = await holdingsFor(db, artworkId);
  const month = prior.length + 1;
  const now = new Date();
  const cycleStartedAt = prior[0]?.assignedAt.toDate() ?? now;
  const offerPrice = withGst(aggregatorOfferPriceOf(pricing.artistPricePaise, month, rates), rates);
  const standardPrice = withGst(aggregatorOfferPriceOf(pricing.artistPricePaise, 1, rates), rates);
  const advance = aggregatorAdvanceForMonth({ month, displayPrice: offerPrice, artistPrice: pricing.artistPricePaise, rates, previousAggregatorChangedPrice: false });
  const window = placementWindow({ cycleStartedAt, assignedAt: now, rates });
  const listingEnd = new Date(cycleStartedAt.getTime() + rates.aggregatorListingDays * 86_400_000);
  const artwork = (await db.collection(Collections.artworks).doc(artworkId).get()).data() as ArtworkDoc | undefined;
  return {
    artworkId,
    month,
    offerPricePaise: offerPrice,
    standardPricePaise: standardPrice,
    monthlyReductionPaise: Math.max(0, standardPrice - offerPrice),
    marketplacePricePaise: artwork?.listing?.displayPricePaise ?? offerPrice,
    advancePaise: advance.advance,
    advanceRate: advance.rate,
    advanceBasePaise: advance.base,
    advanceBasis: advance.basis,
    daysLeftInListing: Math.max(0, Math.ceil((listingEnd.getTime() - now.getTime()) / 86_400_000)),
    deliveryChargePaise: advance.deliveryCharge,
    payablePaise: advance.payable,
    previousAggregatorChangedPrice: false,
    ...(window.extended ? {} : {}),
  };
}

export interface ReservableArtwork extends PublicArtworkView {
  offer: AggregatorOffer;
}

/** Pieces an aggregator may reserve now: live, aggregator-listed, not held by anyone, cycle not exhausted. */
export async function listAggregatorInventory(db: Firestore, rates: PricingRates): Promise<ReservableArtwork[]> {
  const snap = await db.collection(Collections.artworks).where("listing.status", "==", "marketplace").get();
  const candidates = snap.docs.filter((d) => AGGREGATOR_LISTING_TYPES.has((d.data() as ArtworkDoc).listingType));
  const out: ReservableArtwork[] = [];
  for (const d of candidates) {
    const holdings = await holdingsFor(db, d.id);
    if (holdings.some((h) => ACTIVE_HOLDING.has(h.status))) continue;
    if (holdings.length >= rates.aggregatorCycleMonths) continue;
    const [view, offer] = await Promise.all([getPublicArtwork(db, d.id), computeOffer(db, d.id, rates)]);
    if (!view || !offer || offer.daysLeftInListing < rates.aggregatorPlacementDays) continue;
    out.push({ ...view, offer });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface AggregatorHoldingView {
  id: string;
  artworkId: string;
  artwork: PublicArtworkView | null;
  cycleMonth: number;
  advancePercent: number;
  advancePaise: number;
  deliveryDepositPaise: number | null;
  displayPricePaise: number;
  assignmentSource: AggregatorHoldingDoc["assignmentSource"];
  assignedAt: string;
  expiresAt: string;
  windowExtended: boolean;
  status: AggregatorHoldingDoc["status"];
  returnedAt: string | null;
}

async function toHoldingView(db: Firestore, id: string, h: AggregatorHoldingDoc): Promise<AggregatorHoldingView> {
  return {
    id,
    artworkId: h.artworkId,
    artwork: await getPublicArtwork(db, h.artworkId),
    cycleMonth: h.cycleMonth,
    advancePercent: h.advancePercent,
    advancePaise: h.advanceAmountPaise,
    deliveryDepositPaise: h.deliveryDepositPaise,
    displayPricePaise: h.displayPricePaise,
    assignmentSource: h.assignmentSource,
    assignedAt: h.assignedAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    expiresAt: h.expiresAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    windowExtended: h.windowExtended,
    status: h.status,
    returnedAt: h.returnedAt?.toDate().toISOString() ?? null,
  };
}

export async function listAggregatorHoldings(db: Firestore, aggregatorId: string): Promise<AggregatorHoldingView[]> {
  const snap = await db.collection(Collections.aggregatorHoldings).where("aggregatorId", "==", aggregatorId).get();
  const views = await Promise.all(snap.docs.map((d) => toHoldingView(db, d.id, d.data() as AggregatorHoldingDoc)));
  return views.sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
}

export async function getAggregatorHolding(db: Firestore, aggregatorId: string, holdingId: string): Promise<AggregatorHoldingView | null> {
  const snap = await db.collection(Collections.aggregatorHoldings).doc(holdingId).get();
  const h = snap.data() as AggregatorHoldingDoc | undefined;
  if (!h || h.aggregatorId !== aggregatorId) return null;
  return toHoldingView(db, holdingId, h);
}

/** Aggregator MOU §6: one price change per holding, never below the offer price. */
export async function setHoldingDisplayPrice(db: Firestore, aggregatorId: string, holdingId: string, displayPricePaise: number): Promise<void> {
  const ref = db.collection(Collections.aggregatorHoldings).doc(holdingId);
  const h = (await ref.get()).data() as (AggregatorHoldingDoc & { priceChangedAt?: FirebaseFirestore.Timestamp | null }) | undefined;
  if (!h || h.aggregatorId !== aggregatorId) throw new AggregatorReadError(`No holding ${holdingId}`);
  if (h.status !== "reserved") throw new AggregatorReadError("Only a reserved piece can be re-priced");
  if (h.priceChangedAt) throw new AggregatorReadError("The price on this piece has already been set once");
  if (displayPricePaise < h.displayPricePaise) throw new AggregatorReadError("The selling price can't go below GalleryZone's offer price");
  await ref.update({ displayPricePaise, priceChangedAt: FieldValue.serverTimestamp() });
}

/** Unsold return: advance refunded to the aggregator's payable, delivery deposit forfeited, artwork back on the marketplace. */
export async function returnHolding(db: Firestore, aggregatorId: string, holdingId: string): Promise<void> {
  const ref = db.collection(Collections.aggregatorHoldings).doc(holdingId);
  const h = (await ref.get()).data() as AggregatorHoldingDoc | undefined;
  if (!h || h.aggregatorId !== aggregatorId) throw new AggregatorReadError(`No holding ${holdingId}`);
  holdingStateMachine.assertTransition(h.status, "returned");
  await postLedgerEntries(db, {
    postings: aggregatorReturnPostings({ aggregatorId, advancePaise: h.advanceAmountPaise }),
    idempotencyPrefix: `holding:${holdingId}:return`,
    relatedHoldingId: holdingId,
  });
  await ref.update({ status: "returned", returnedAt: Timestamp.now() });
  const status = await latestStatusOf(db, h.artworkId);
  if (status === "with_aggregator") await appendArtworkStatus(db, h.artworkId, { status: "marketplace", changedBy: aggregatorId, reason: `holding:${holdingId}:returned` });
  await refreshListing(db, h.artworkId);
}
