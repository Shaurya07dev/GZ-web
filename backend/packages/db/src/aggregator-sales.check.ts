// Integration check for aggregator-sales.ts, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/aggregator-sales.check.ts

import assert from "node:assert/strict";
import { DEFAULT_RATE_SEED } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { reserveHolding, recordAggregatorSale } from "./aggregator-flow.ts";
import { listAggregatorSales, advanceShipment, markRemitted, listRemittancesDue, AggregatorSalesError } from "./aggregator-sales.ts";
import { PostgresRateConfigStore } from "./postgres/rate-config-store.ts";
import { users } from "./schema/identity.ts";
import { artworks } from "./schema/artwork.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-aggsale-artist", role: "artist", name: "Aggsale Artist", email: "aggsale-artist@example.com" }).returning({ id: users.id });
  const [aggregator] = await db.insert(users).values({ firebaseUid: "fb-aggsale-aggregator", role: "aggregator", name: "Aggsale Aggregator", email: "aggsale-aggregator@example.com" }).returning({ id: users.id });
  const [approver] = await db.insert(users).values({ firebaseUid: "fb-aggsale-approver", role: "admin", name: "Aggsale Approver", email: "aggsale-approver@example.com" }).returning({ id: users.id });
  if (!artist || !aggregator || !approver) throw new Error("seed failed");

  const [artwork] = await db.insert(artworks).values({ productCode: "GZ-AGGSALE-1", artistId: artist.id, title: "Aggsale Piece", description: "d", category: "painting", medium: "oil", artistPricePaise: 80_000_00, listingType: "aggregator_only", editableUntil: new Date(Date.now() + 7 * 86_400_000) }).returning({ id: artworks.id });
  if (!artwork) throw new Error("seed failed");

  const rateStore = new PostgresRateConfigStore(db);
  const versionId = await rateStore.propose({ rates: DEFAULT_RATE_SEED, effectiveFrom: new Date("2020-01-01"), proposedBy: artist.id, reason: "aggregator-sales.check.ts seed" });
  await rateStore.approve({ versionId, approvedBy: approver.id });

  const { holdingId } = await reserveHolding({ db, aggregatorId: aggregator.id, artworkId: artwork.id });
  const { saleId } = await recordAggregatorSale({ db, holdingId, soldPricePaise: 90_000_00, buyerName: "Buyer", buyerEmail: "buyer@example.com", deliveryMode: "courier", paymentRoute: "cash_at_premises" });

  const sales = await listAggregatorSales(db, aggregator.id);
  assert.equal(sales.length, 1);
  assert.equal(sales[0]?.shipmentStatus, "preparing");

  // Cash sale shows up as remittance-due until marked remitted.
  const dueBefore = await listRemittancesDue(db, aggregator.id);
  assert.equal(dueBefore.length, 1);

  await advanceShipment(db, saleId, "dispatched", "COURIER-REF-1");
  const afterDispatch = await listAggregatorSales(db, aggregator.id);
  assert.equal(afterDispatch[0]?.shipmentStatus, "dispatched");
  assert.equal(afterDispatch[0]?.courierRef, "COURIER-REF-1");

  // Skipping straight to delivered without dispatch would be illegal — but
  // we already dispatched, so this should succeed.
  await advanceShipment(db, saleId, "delivered");
  const afterDelivery = await listAggregatorSales(db, aggregator.id);
  assert.equal(afterDelivery[0]?.shipmentStatus, "delivered");

  await assert.rejects(() => advanceShipment(db, saleId, "dispatched"), /Illegal AggregatorSaleShipment transition/);

  await markRemitted(db, saleId);
  const dueAfter = await listRemittancesDue(db, aggregator.id);
  assert.equal(dueAfter.length, 0, "remitted sale drops off the remittance-due list");

  await assert.rejects(() => markRemitted(db, saleId), AggregatorSalesError, "cannot remit twice");

  console.log("packages/db/aggregator-sales.ts: verified against real Postgres");
} finally {
  await close();
}
