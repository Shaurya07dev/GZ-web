// Resale — PARITY scope (seller-list-only, no buyer browse/purchase flow;
// see schema/community.ts's own header and the plan's Scope calls
// section). completeSale() credits the seller's customer_wallet directly
// (no ledger posting function existed for this path in settlement.ts —
// resale is customer-to-customer, outside the marketplace/aggregator
// channel model those postings assume — so this writes a ledger entry
// pair inline rather than stretching a mismatched helper to fit).

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { resaleListingStateMachine } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { resaleListings } from "./schema/community.ts";
import { postLedgerEntries } from "./ledger-repository.ts";

export class ResaleError extends Error {}

export async function listMyResaleListings(db: Db, sellerId: string) {
  return db.select().from(resaleListings).where(eq(resaleListings.sellerId, sellerId));
}

export async function createResaleListing(db: Db, sellerId: string, artworkId: string, listedPricePaise: number): Promise<{ id: string }> {
  const [row] = await db.insert(resaleListings).values({ sellerId, artworkId, listedPricePaise, status: "active" }).returning({ id: resaleListings.id });
  if (!row) throw new ResaleError("insert into resale_listings returned no row");
  return row;
}

export async function withdrawResaleListing(db: Db, sellerId: string, listingId: string): Promise<void> {
  const [listing] = await db.select({ status: resaleListings.status }).from(resaleListings).where(and(eq(resaleListings.id, listingId), eq(resaleListings.sellerId, sellerId)));
  if (!listing) throw new ResaleError(`No resale listing ${listingId} for seller ${sellerId}`);
  resaleListingStateMachine.assertTransition(listing.status, "withdrawn");
  await db.update(resaleListings).set({ status: "withdrawn" }).where(eq(resaleListings.id, listingId));
}

export async function completeResaleSale(db: Db, sellerId: string, listingId: string): Promise<{ transactionId: string }> {
  const [listing] = await db.select().from(resaleListings).where(and(eq(resaleListings.id, listingId), eq(resaleListings.sellerId, sellerId)));
  if (!listing) throw new ResaleError(`No resale listing ${listingId} for seller ${sellerId}`);
  resaleListingStateMachine.assertTransition(listing.status, "sold");

  const { transactionId } = await postLedgerEntries(db, {
    postings: [
      { accountType: "razorpay_escrow", amountPaise: listing.listedPricePaise, reason: "resale_capture" },
      { accountType: "customer_wallet", ownerId: sellerId, amountPaise: -listing.listedPricePaise, reason: "resale_credit" },
    ],
    idempotencyPrefix: `resale:${listingId}:${randomUUID()}`,
  });

  await db.update(resaleListings).set({ status: "sold" }).where(eq(resaleListings.id, listingId));
  return { transactionId };
}
