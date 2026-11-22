// Delivery-challan snapshots + sequential challan numbering — Rule 55.
//
// When goods move WITHOUT a sale (artist→aggregator for display,
// aggregator→artist return, aggregator→aggregator rotation), CGST
// Section 31(7) + Rule 55 require a delivery challan in triplicate to
// travel with the parcel — a tax invoice doesn't apply because there's
// no supply yet.
//
// Numbering: GZ/DC/26-27/000001 — per fiscal year, monotonic, allocated
// inside a Firestore transaction against deliveryChallanCounters/{fy}.
// Once stamped the snapshot is frozen on the order / holding doc and
// never rewritten. Re-stamping is a no-op that returns the existing
// snapshot (idempotent) so the same shipment leg always reproduces the
// same challan number regardless of how many times downstream retries.

import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import {
  Collections,
  artworkPricingCol,
  userProfileCol,
  type AggregatorHoldingDoc,
  type ArtworkDoc,
  type ArtworkPricingDoc,
  type DeliveryChallanCounterDoc,
  type DeliveryChallanLine,
  type DeliveryChallanParty,
  type DeliveryChallanReason,
  type DeliveryChallanSnapshot,
  type DeliveryChallanTransportMode,
  type ProfileDoc,
  type UserDoc,
} from "./collections.ts";
import { DbError } from "./errors.ts";
import { fiscalYearOf } from "./invoices.ts";
import { findIndianState } from "./india-states.ts";
import { assertCompletePickupProfile } from "./doc-field-guards.ts";

export class DeliveryChallanError extends DbError {}

/** "GZ/DC/26-27/000001" — short-year form, zero-padded 6-digit sequence.
 *  The "DC" segment distinguishes it from the sales invoice numbering
 *  ("GZ/26-27/000001") so an accountant can separate the two series at a
 *  glance. */
export function formatChallanNumber(fiscalYear: string, seq: number): string {
  const short = fiscalYear.replace(/^FY\d{2}/, "");
  return `GZ/DC/${short}/${String(seq).padStart(6, "0")}`;
}

/** Which leg of the aggregator holding cycle this challan is for.
 *  Drives where the stamp lands on the holding doc (deliveryChallan vs
 *  returnDeliveryChallan) and which party is the consignee. */
export type ChallanLeg =
  | "inbound" // artist studio → aggregator venue (display / sale-on-approval)
  | "return"; // aggregator venue → artist studio (unsold return)

export interface StampHoldingChallanInput {
  holdingId: string;
  leg: ChallanLeg;
  /** The consignor is ALWAYS GalleryZone — this is the invoicing/issuing
   *  party. The caller passes GZ's identity (same seller block used on
   *  tax invoices, pulled from env.invoiceSeller). */
  consignor: DeliveryChallanParty;
  /** Logistics to print on the challan. The courier adds Part B (vehicle
   *  + AWB) on their side; we fill Part A at stamp time. */
  transport: {
    mode: DeliveryChallanTransportMode;
    transporterName: string;
    vehicleOrDocket: string;
  };
  /** Free-text hazard / handling instructions printed under the item
   *  table ("fragile, do not stack", etc.). Optional. */
  notes?: string | null;
  /** When to deem the piece "unsold and recall" — null on return legs.
   *  Defaults to 6 months out when omitted. */
  returnDeadline?: Date | null;
  /** Shorter current window (e.g. aggregator's 30-day placement).
   *  Shown next to the 6-month deadline so the artist/aggregator sees
   *  what's actually binding. Omit on return legs. */
  currentDeadline?: Date | null;
}

/**
 * Stamps (or returns the existing) delivery challan for a holding's
 * inbound or return shipment leg. Idempotent — safe to call from a
 * retried Shiprocket booking handler.
 *
 * Reads needed outside the transaction:
 *   - holding doc (artwork id, aggregator id)
 *   - artwork doc (title, medium, artistId, prices)
 *   - artist user doc + profile (name, pickup address = dispatched-
 *     from on inbound leg / consignee on return leg)
 *   - aggregator user doc + profile (name, drop address)
 *
 * Writes inside a transaction:
 *   - deliveryChallanCounters/{fy} ← nextSeq++
 *   - aggregatorHoldings/{holdingId}.{deliveryChallan|returnDeliveryChallan} ← snapshot
 */
export async function getOrCreateHoldingDeliveryChallan(
  db: Firestore,
  input: StampHoldingChallanInput,
): Promise<DeliveryChallanSnapshot> {
  const holdingRef = db.collection(Collections.aggregatorHoldings).doc(input.holdingId);

  // Fast path — already stamped. Keeps the counter transaction out of
  // the common case (Shiprocket booking retries).
  const existingSnap = await holdingRef.get();
  if (!existingSnap.exists) {
    throw new DeliveryChallanError(`No aggregator holding ${input.holdingId}`);
  }
  const holding = existingSnap.data() as AggregatorHoldingDoc;
  const field = input.leg === "inbound" ? "deliveryChallan" : "returnDeliveryChallan";
  const already = holding[field as "deliveryChallan" | "returnDeliveryChallan"];
  if (already) return already;

  // Pull every party + item reference in parallel. Each is best-effort
  // — missing docs raise a loud error rather than rendering a blank
  // challan, because a legally-required document with blank fields is
  // worse than failing the stamp and surfacing the problem.
  const [artworkSnap, artistUserSnap, aggregatorUserSnap] = await Promise.all([
    db.collection(Collections.artworks).doc(holding.artworkId).get(),
    // Artist id is on the artwork doc, not the holding. Deferred read.
    Promise.resolve(null),
    db.collection(Collections.users).doc(holding.aggregatorId).get(),
  ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  if (!artwork) {
    throw new DeliveryChallanError(
      `Artwork ${holding.artworkId} missing — cannot stamp challan`,
    );
  }
  const aggregatorUser = aggregatorUserSnap.data() as UserDoc | undefined;
  if (!aggregatorUser) {
    throw new DeliveryChallanError(
      `Aggregator user ${holding.aggregatorId} missing — cannot stamp challan`,
    );
  }

  // Now that we have the artwork, resolve the artist + pricing doc +
  // both party profiles. Still O(1) — one parallel round-trip.
  const artistId = artwork.artistId;
  const [
    artistUserSnap2,
    artistProfileSnap,
    aggregatorProfileSnap,
    pricingSnap,
  ] = await Promise.all([
    db.collection(Collections.users).doc(artistId).get(),
    db.collection(userProfileCol(artistId)).doc("data").get(),
    db.collection(userProfileCol(holding.aggregatorId)).doc("data").get(),
    db.collection(artworkPricingCol(holding.artworkId)).doc("data").get(),
  ]);
  const artistPricePaise = resolveArtistPricePaise(pricingSnap, holding);
  const artistUser = artistUserSnap2.data() as UserDoc | undefined;
  const artistProfile = artistProfileSnap.data() as ProfileDoc | undefined;
  const aggregatorProfile = aggregatorProfileSnap.data() as ProfileDoc | undefined;
  if (!artistUser || !artistProfile) {
    throw new DeliveryChallanError(
      `Artist ${artistId} missing or has no profile — cannot stamp challan`,
    );
  }
  if (!aggregatorProfile) {
    throw new DeliveryChallanError(
      `Aggregator ${holding.aggregatorId} has no profile — cannot stamp challan`,
    );
  }
  // Suppress the unused placeholder from the first parallel fetch.
  void artistUserSnap;

  const artistParty = partyFromArtistProfile(artistUser, artistProfile);
  const aggregatorParty = partyFromAggregatorProfile(aggregatorUser, aggregatorProfile);

  // Direction: inbound = pickup from artist, drop to aggregator.
  // return = pickup from aggregator, drop to artist.
  const dispatchedFrom = input.leg === "inbound" ? artistParty : aggregatorParty;
  const consignee = input.leg === "inbound" ? aggregatorParty : artistParty;

  const items: DeliveryChallanLine[] = [
    {
      artworkId: holding.artworkId,
      title: artwork.title,
      artistName: artistUser.name ?? "Artist",
      medium: artwork.medium ?? null,
      hsn: "9701",
      qty: 1,
      unit: "No.",
      artistValuePaise: artistPricePaise,
      provisionalValuePaise: holding.displayPricePaise,
    },
  ];

  const reason: DeliveryChallanReason =
    input.leg === "inbound" ? "exhibition_display" : "return_of_goods";

  const now = new Date();
  const fiscalYear = fiscalYearOf(now);
  const counterRef = db.collection(Collections.deliveryChallanCounters).doc(fiscalYear);

  // Compute deadline defaults. Inbound: 6 months from today. Return:
  // no further deadline — the piece is going back to the artist.
  const sixMonthsOut = new Date(now);
  sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);
  const returnDeadline =
    input.leg === "inbound"
      ? (input.returnDeadline ?? sixMonthsOut)
      : null;

  const number = await db.runTransaction(async (tx) => {
    // Re-check inside the tx — a parallel booking may have stamped it.
    const holdingInTx = (await tx.get(holdingRef)).data() as
      | AggregatorHoldingDoc
      | undefined;
    const alreadyInTx =
      holdingInTx?.[field as "deliveryChallan" | "returnDeliveryChallan"];
    if (alreadyInTx) return alreadyInTx.number;

    const counterSnap = await tx.get(counterRef);
    const seq =
      ((counterSnap.data() as DeliveryChallanCounterDoc | undefined)?.nextSeq ?? 1);
    const nextSeq = seq + 1;
    const challanNumber = formatChallanNumber(fiscalYear, seq);

    const snapshot: DeliveryChallanSnapshot = {
      number: challanNumber,
      fiscalYear,
      challanDate: Timestamp.fromDate(now),
      copyLabel: "Duplicate", // Shiprocket gets the transporter copy
      reason,
      returnDeadline: returnDeadline ? Timestamp.fromDate(returnDeadline) : null,
      currentDeadline: input.currentDeadline
        ? Timestamp.fromDate(input.currentDeadline)
        : null,
      ewayBill: {
        // ClearTax / Masters India integration (Phase 2) fills these.
        // Null → renderer prints "NA (Consignment ≤ ₹50k inter-state)".
        number: null,
        generatedAt: null,
        validUntil: null,
      },
      transport: input.transport,
      consignor: input.consignor,
      dispatchedFrom,
      consignee,
      items,
      notes: input.notes ?? null,
    };

    tx.set(counterRef, { fiscalYear, nextSeq }, { merge: true });
    tx.update(holdingRef, { [field]: snapshot });
    return challanNumber;
  });

  const refreshed = (await holdingRef.get()).data() as
    | AggregatorHoldingDoc
    | undefined;
  const stamped = refreshed?.[field as "deliveryChallan" | "returnDeliveryChallan"];
  if (!stamped) {
    throw new DeliveryChallanError(
      `Challan ${number} stamped but not readable back from holding ${input.holdingId}`,
    );
  }
  return stamped;
}

/** Address-only stamp input for the ARTIST-RETURN leg (artist is pulling
 *  their own unsold piece back from storage, no aggregator involved).
 *  Everything resolved from the holding doc + the artist's own return
 *  drop address stored on the holding at return-quote time. */
export interface StampArtistReturnChallanInput {
  holdingId: string;
  consignor: DeliveryChallanParty;
  transport: {
    mode: DeliveryChallanTransportMode;
    transporterName: string;
    vehicleOrDocket: string;
  };
  notes?: string | null;
}

/** Stamp a challan for the artist-return leg (holding goes back to the
 *  artist at end of 6-month listing). Uses the holding's own
 *  `returnDropAddress` as the consignee, aggregator as the dispatched-
 *  from. Idempotent on `returnDeliveryChallan`. */
export async function getOrCreateArtistReturnDeliveryChallan(
  db: Firestore,
  input: StampArtistReturnChallanInput,
): Promise<DeliveryChallanSnapshot> {
  const holdingRef = db.collection(Collections.aggregatorHoldings).doc(input.holdingId);
  const existingSnap = await holdingRef.get();
  if (!existingSnap.exists) {
    throw new DeliveryChallanError(`No aggregator holding ${input.holdingId}`);
  }
  const holding = existingSnap.data() as AggregatorHoldingDoc;
  if (holding.returnDeliveryChallan) return holding.returnDeliveryChallan;

  if (!holding.returnDropAddress) {
    throw new DeliveryChallanError(
      `Holding ${input.holdingId} has no returnDropAddress — artist must set it before challan can stamp`,
    );
  }

  const [
    artworkSnap,
    aggregatorUserSnap,
    aggregatorProfileSnap,
    pricingSnap,
  ] = await Promise.all([
    db.collection(Collections.artworks).doc(holding.artworkId).get(),
    db.collection(Collections.users).doc(holding.aggregatorId).get(),
    db.collection(userProfileCol(holding.aggregatorId)).doc("data").get(),
    db.collection(artworkPricingCol(holding.artworkId)).doc("data").get(),
  ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  const aggregatorUser = aggregatorUserSnap.data() as UserDoc | undefined;
  const aggregatorProfile = aggregatorProfileSnap.data() as ProfileDoc | undefined;
  if (!artwork || !aggregatorUser || !aggregatorProfile) {
    throw new DeliveryChallanError(
      `Missing artwork or aggregator data for holding ${input.holdingId}`,
    );
  }
  const artistPricePaise = resolveArtistPricePaise(pricingSnap, holding);

  const artistUserSnap = await db
    .collection(Collections.users)
    .doc(artwork.artistId)
    .get();
  const artistUser = artistUserSnap.data() as UserDoc | undefined;
  if (!artistUser) {
    throw new DeliveryChallanError(
      `Artist user ${artwork.artistId} missing — cannot stamp challan`,
    );
  }

  const dispatchedFrom = partyFromAggregatorProfile(
    aggregatorUser,
    aggregatorProfile,
  );
  const consignee = partyFromReturnDropAddress(
    artistUser.name ?? "Artist",
    holding.returnDropAddress,
  );

  const items: DeliveryChallanLine[] = [
    {
      artworkId: holding.artworkId,
      title: artwork.title,
      artistName: artistUser.name ?? "Artist",
      medium: artwork.medium ?? null,
      hsn: "9701",
      qty: 1,
      unit: "No.",
      artistValuePaise: artistPricePaise,
      provisionalValuePaise: holding.displayPricePaise,
    },
  ];

  const now = new Date();
  const fiscalYear = fiscalYearOf(now);
  const counterRef = db
    .collection(Collections.deliveryChallanCounters)
    .doc(fiscalYear);

  const number = await db.runTransaction(async (tx) => {
    const holdingInTx = (await tx.get(holdingRef)).data() as
      | AggregatorHoldingDoc
      | undefined;
    if (holdingInTx?.returnDeliveryChallan) {
      return holdingInTx.returnDeliveryChallan.number;
    }
    const counterSnap = await tx.get(counterRef);
    const seq =
      ((counterSnap.data() as DeliveryChallanCounterDoc | undefined)?.nextSeq ??
        1);
    const nextSeq = seq + 1;
    const challanNumber = formatChallanNumber(fiscalYear, seq);
    const snapshot: DeliveryChallanSnapshot = {
      number: challanNumber,
      fiscalYear,
      challanDate: Timestamp.fromDate(now),
      copyLabel: "Duplicate",
      reason: "return_of_goods",
      returnDeadline: null,
      currentDeadline: null,
      ewayBill: { number: null, generatedAt: null, validUntil: null },
      transport: input.transport,
      consignor: input.consignor,
      dispatchedFrom,
      consignee,
      items,
      notes: input.notes ?? null,
    };
    tx.set(counterRef, { fiscalYear, nextSeq }, { merge: true });
    tx.update(holdingRef, { returnDeliveryChallan: snapshot });
    return challanNumber;
  });

  const refreshed = (await holdingRef.get()).data() as
    | AggregatorHoldingDoc
    | undefined;
  if (!refreshed?.returnDeliveryChallan) {
    throw new DeliveryChallanError(
      `Challan ${number} stamped but not readable back from holding ${input.holdingId}`,
    );
  }
  return refreshed.returnDeliveryChallan;
}

// --- Price + party helpers --------------------------------------------

/** Pull the artist's own price (in paise) for the artwork from the
 *  `pricing` subcollection. Falls back to the holding's own
 *  `sellingPricePaise` (what the aggregator chose at reserve time) when
 *  the pricing doc is missing — that path only hits for very old
 *  holdings predating the subcollection split. */
function resolveArtistPricePaise(
  pricingSnap: FirebaseFirestore.DocumentSnapshot,
  holding: AggregatorHoldingDoc,
): number {
  const pricing = pricingSnap.data() as ArtworkPricingDoc | undefined;
  if (pricing?.artistPricePaise && pricing.artistPricePaise > 0) {
    return pricing.artistPricePaise;
  }
  if (holding.sellingPricePaise && holding.sellingPricePaise > 0) {
    return holding.sellingPricePaise;
  }
  // Last resort: display price divided by (1 + 5% GST + 30% markup) ≈ 0.73.
  // Exact enough for a delivery-challan declared value.
  return Math.round(holding.displayPricePaise / 1.365);
}

// --- Party builders ----------------------------------------------------

function partyFromArtistProfile(
  user: UserDoc,
  profile: ProfileDoc,
): DeliveryChallanParty {
  // Required fields are enforced upstream by assertCompletePickupProfile;
  // the ! assertions below are safe because the guard would have thrown.
  assertCompletePickupProfile("Artist", profile, DeliveryChallanError);
  const stateMeta = findIndianState(profile.pickupState);
  return {
    legalName: user.name ?? "Artist",
    addressLine1: profile.pickupLine1!,
    addressLine2: profile.pickupLine2 ?? null,
    city: profile.pickupCity!,
    state: profile.pickupState!,
    pincode: profile.pickupPincode!,
    stateCode: stateMeta?.code ?? null,
    gstin: profile.gstin?.trim() || null,
  };
}

function partyFromAggregatorProfile(
  user: UserDoc,
  profile: ProfileDoc,
): DeliveryChallanParty {
  assertCompletePickupProfile("Aggregator", profile, DeliveryChallanError);
  const stateMeta = findIndianState(profile.pickupState);
  return {
    legalName: user.name ?? "Aggregator",
    addressLine1: profile.pickupLine1!,
    addressLine2: profile.pickupLine2 ?? null,
    city: profile.pickupCity!,
    state: profile.pickupState!,
    pincode: profile.pickupPincode!,
    stateCode: stateMeta?.code ?? null,
    gstin: profile.gstin?.trim() || null,
  };
}

function partyFromReturnDropAddress(
  name: string,
  addr: NonNullable<AggregatorHoldingDoc["returnDropAddress"]>,
): DeliveryChallanParty {
  const stateMeta = findIndianState(addr.state);
  return {
    legalName: name,
    addressLine1: addr.line1,
    addressLine2: addr.line2 ?? null,
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
    stateCode: stateMeta?.code ?? null,
    gstin: null,
  };
}

