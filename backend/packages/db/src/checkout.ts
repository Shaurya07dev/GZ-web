// Marketplace checkout orchestration. Lives here (not packages/domain)
// because it's inherently impure — it reads the artwork's real price,
// resolves the currently-active rate version, and writes order/payment
// rows — but every actual money/rate CALCULATION inside it delegates to
// packages/domain, never recomputes anything itself.
//
// Two-step, matching how real payment capture actually works and how
// Razorpay Route will slot in at Phase 2: createOrder() records intent at
// "pending" with nothing charged yet; confirmSimulatedPayment() is the
// PRE-RAZORPAY placeholder for what a webhook-verified capture will do —
// moves the order to "paid" and posts the real ledger entries. It is
// explicitly named "Simulated" and documented as such so nobody mistakes
// it for a production payment path; Phase 2 replaces its body with real
// webhook signature verification, not its callers.

import { eq } from "drizzle-orm";
import {
  checkoutTotal,
  displayPriceOf,
  gstIncludedIn,
  marketplaceCheckoutPostings,
  orderStateMachine,
  type PricingRates,
} from "@galleryzone/domain";
import { loadActiveRates } from "@galleryzone/config";
import type { Db } from "./client.ts";
import { PostgresRateConfigStore } from "./postgres/rate-config-store.ts";
import { postLedgerEntries } from "./ledger-repository.ts";
import { artworks } from "./schema/artwork.ts";
import { orders, orderStatusEvents, payments } from "./schema/order.ts";

export class CheckoutError extends Error {}

export interface CreateOrderInput {
  db: Db;
  customerId: string;
  artworkId: string;
  addressId: string;
  idempotencyKey: string;
}

export interface CreateOrderResult {
  orderId: string;
  totalPaise: number;
}

export async function createOrder({ db, customerId, artworkId, addressId, idempotencyKey }: CreateOrderInput): Promise<CreateOrderResult> {
  const [artwork] = await db
    .select({ artistPricePaise: artworks.artistPricePaise })
    .from(artworks)
    .where(eq(artworks.id, artworkId));
  if (!artwork) throw new CheckoutError(`No artwork ${artworkId}`);

  const rateStore = new PostgresRateConfigStore(db);
  const activeVersion = await rateStore.getActiveVersion(new Date());
  if (!activeVersion) {
    // A fresh database has DEFAULT_RATE_SEED to fall back on for pure
    // calculations, but orders.rate_config_version_id is a NOT NULL FK —
    // an order can't legally exist without pointing at a real, approved
    // rate_config_versions row. This is deliberate: it forces Phase 0's
    // deploy process to seed one approved version before checkout can run
    // at all, rather than silently letting orders reference a rate that
    // was never actually approved by anyone.
    throw new CheckoutError(
      "No approved rate_config_versions row exists yet — seed one via the admin rules console before checkout can run.",
    );
  }
  const rates: PricingRates = activeVersion.rates;

  const displayPrice = displayPriceOf(artwork.artistPricePaise, rates);
  const checkout = checkoutTotal(displayPrice, rates);
  const gstPaise = gstIncludedIn(displayPrice, rates);

  const [order] = await db
    .insert(orders)
    .values({
      artworkId,
      customerId,
      addressId,
      displayPricePaise: checkout.displayPrice,
      gstPaise,
      deliveryChargePaise: checkout.deliveryCharge,
      convenienceFeePaise: checkout.convenienceFee,
      totalPaise: checkout.total,
      status: "pending",
      rateConfigVersionId: activeVersion.id,
    })
    .returning({ id: orders.id });
  if (!order) throw new CheckoutError("insert into orders returned no row");

  await db.insert(orderStatusEvents).values({ orderId: order.id, status: "pending" });
  await db.insert(payments).values({
    orderId: order.id,
    provider: "razorpay",
    method: "simulated",
    amountPaise: checkout.total,
    idempotencyKey,
    status: "pending",
  });

  return { orderId: order.id, totalPaise: checkout.total };
}

/**
 * PRE-RAZORPAY PLACEHOLDER. Simulates a successful payment capture: moves
 * the order pending -> paid and posts the real marketplace-channel ledger
 * entries. Phase 2 replaces this function's body with real Razorpay
 * webhook handling (signature verification, idempotent-by-webhook-id) —
 * callers (and the order/ledger shape it produces) don't change.
 */
export async function confirmSimulatedPayment(db: Db, orderId: string): Promise<{ transactionId: string }> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new CheckoutError(`No order ${orderId}`);

  orderStateMachine.assertTransition(order.status, "paid");

  const [artwork] = await db
    .select({ artistId: artworks.artistId, artistPricePaise: artworks.artistPricePaise })
    .from(artworks)
    .where(eq(artworks.id, order.artworkId));
  if (!artwork) throw new CheckoutError(`No artwork ${order.artworkId}`);

  const rateStore = new PostgresRateConfigStore(db);
  const version = await rateStore.getActiveVersion(order.createdAt);
  if (!version) throw new CheckoutError("Order references a rate_config_version that is no longer resolvable");

  const postings = marketplaceCheckoutPostings({
    artistId: artwork.artistId,
    artistPricePaise: artwork.artistPricePaise,
    rates: version.rates,
  });

  const { transactionId } = await postLedgerEntries(db, {
    postings,
    idempotencyPrefix: `order:${orderId}`,
    relatedOrderId: orderId,
  });

  await db.update(orders).set({ status: "paid" }).where(eq(orders.id, orderId));
  await db.insert(orderStatusEvents).values({ orderId, status: "paid" });
  await db.update(payments).set({ status: "captured" }).where(eq(payments.orderId, orderId));

  return { transactionId };
}
