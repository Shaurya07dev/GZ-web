// One-shot: dump everything we know about one order so we can diagnose why
// the artwork might still be on the marketplace, whether Shiprocket booked,
// whether the artist got notified, whether payment actually settled.
//
// USAGE:
//   cd backend
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     npx tsx scripts/inspect-order.ts --id mhJOx9po
//
// Prints the order doc, payment doc, matching artwork + its listing
// projection, shipment status, and the artist's + customer's notifications
// for that order. Read-only — never writes.

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, type Timestamp } from "firebase-admin/firestore";
import { parseArgs } from "node:util";

function bootstrapFirebase() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    initializeApp({ credential: cert(JSON.parse(raw)) });
    return;
  }
  initializeApp({ credential: applicationDefault() });
}

function parse(): { id: string } {
  const { values } = parseArgs({ options: { id: { type: "string" } } });
  if (!values.id) throw new Error("--id <orderId> is required");
  return { id: values.id };
}

function iso(ts: unknown): string {
  if (!ts) return "—";
  if (typeof ts === "string") return ts;
  if (typeof ts === "object" && ts !== null && "toDate" in ts) {
    return (ts as { toDate(): Date }).toDate().toISOString();
  }
  return String(ts);
}

async function main() {
  const { id } = parse();
  bootstrapFirebase();
  const db = getFirestore();

  console.log(`\n=== Order ${id} ===\n`);

  // 1. Order doc
  const orderSnap = await db.collection("orders").doc(id).get();
  if (!orderSnap.exists) {
    console.log(`❌ No orders/${id} document. Either the id is wrong, or the order was deleted.`);
    return;
  }
  const order = orderSnap.data()!;
  console.log("ORDER:");
  console.log(`  status           : ${order.status}`);
  console.log(`  createdAt        : ${iso(order.createdAt)}`);
  console.log(`  customerId       : ${order.customerId}`);
  console.log(`  artistId         : ${order.artistId ?? "(not stored)"}`);
  console.log(`  artworkId        : ${order.artworkId}`);
  console.log(`  totalPaise       : ${order.totalPaise} (₹${(order.totalPaise / 100).toFixed(2)})`);
  console.log(`  shippingQuote    : ${order.shippingQuote ? `${order.shippingQuote.carrier} @ ₹${(order.shippingQuote.ratePaise / 100).toFixed(2)}` : "null (flat fallback)"}`);
  console.log(`  shiprocketStage  : ${order.shiprocketStage ?? "(null — not booked)"}`);
  console.log(`  shiprocketTrackingId : ${order.shiprocketTrackingId ?? "(null)"}`);
  console.log(`  shiprocketCarrier    : ${order.shiprocketCarrier ?? "(null)"}`);
  console.log(`  shiprocketTrackedAt  : ${iso(order.shiprocketTrackedAt)}`);

  // 2. Status history (what state transitions did it go through?)
  const statusSnap = await db.collection(`orders/${id}/statusEvents`).orderBy("changedAt").get();
  console.log(`\nSTATUS EVENTS (${statusSnap.size}):`);
  for (const d of statusSnap.docs) {
    const e = d.data();
    console.log(`  ${iso(e.changedAt)}  →  ${e.status}`);
  }

  // 3. Payment doc
  const paySnap = await db.collection("payments").where("orderId", "==", id).limit(1).get();
  if (paySnap.empty) {
    console.log("\n❌ No payment doc exists for this order. Something broke before /payment/session fired.");
  } else {
    const pay = paySnap.docs[0]!.data();
    console.log("\nPAYMENT:");
    console.log(`  status           : ${pay.status}`);
    console.log(`  method           : ${pay.method}`);
    console.log(`  providerOrderId  : ${pay.providerOrderId ?? "(not attached)"}`);
    console.log(`  providerPaymentId: ${pay.providerPaymentId ?? "(not captured)"}`);
    console.log(`  amountPaise      : ${pay.amountPaise} (₹${(pay.amountPaise / 100).toFixed(2)})`);
    console.log(`  createdAt        : ${iso(pay.createdAt)}`);
  }

  // 3b. Shipping readiness — artist pickup + buyer delivery. The common
  //     reason Shiprocket /orders/create/adhoc 422s is a missing field on
  //     one of these (artist's phone, pickup line1, drop pincode, etc).
  if (order.artistId) {
    const artistSnap = await db.collection("users").doc(order.artistId).get();
    const artistProfileSnap = await db
      .collection(`users/${order.artistId}/profile`)
      .doc("data")
      .get();
    const artistUser = artistSnap.data() ?? {};
    const artistProfile = artistProfileSnap.data() ?? {};
    console.log("\nARTIST (for Shiprocket pickup):");
    console.log(`  name           : ${artistUser.name ?? "⚠️ MISSING"}`);
    console.log(`  phone          : ${artistUser.phone ?? "⚠️ MISSING"}`);
    console.log(`  pickupLine1    : ${artistProfile.pickupLine1 ?? "⚠️ MISSING"}`);
    console.log(`  pickupCity     : ${artistProfile.pickupCity ?? "⚠️ MISSING"}`);
    console.log(`  pickupState    : ${artistProfile.pickupState ?? "⚠️ MISSING"}`);
    console.log(`  pickupPincode  : ${artistProfile.pickupPincode ?? "⚠️ MISSING"}`);
  }
  if (order.addressId) {
    const addrSnap = await db.collection("addresses").doc(order.addressId).get();
    const addr = addrSnap.data() ?? {};
    const buyerSnap = await db.collection("users").doc(order.customerId).get();
    const buyer = buyerSnap.data() ?? {};
    console.log("\nBUYER (for Shiprocket delivery):");
    console.log(`  name           : ${buyer.name ?? "⚠️ MISSING"}`);
    console.log(`  phone          : ${buyer.phone ?? "⚠️ MISSING"}`);
    console.log(`  addressLine1   : ${addr.line1 ?? "⚠️ MISSING"}`);
    console.log(`  addressCity    : ${addr.city ?? "⚠️ MISSING"}`);
    console.log(`  addressState   : ${addr.state ?? "⚠️ MISSING"}`);
    console.log(`  addressPincode : ${addr.pincode ?? "⚠️ MISSING"}`);
  }

  // 4. Artwork — is it still on the marketplace?
  const artSnap = await db.collection("artworks").doc(order.artworkId).get();
  if (artSnap.exists) {
    const art = artSnap.data()!;
    console.log("\nARTWORK:");
    console.log(`  title            : ${art.title}`);
    console.log(`  listingType      : ${art.listingType}`);
    console.log(`  listing.status   : ${art.listing?.status ?? "(no projection)"}`);
    console.log(`  listing.onMarketplace : ${art.listing?.onMarketplace}`);
    if (art.listing?.onMarketplace === true && order.status === "paid") {
      console.log("  ⚠️  PROBLEM: order is paid but artwork is still on marketplace. refreshListing() may have failed.");
    }
    if (art.listing?.onMarketplace === true && order.status !== "paid") {
      console.log(`  ℹ️  artwork correctly still on marketplace because order is "${order.status}", not paid. Nobody has actually bought it.`);
    }
  }

  // 5. Notifications sent on orderPaid
  const bellSnap = await db.collection(`users/${order.customerId}/notifications`).get();
  const orderBells = bellSnap.docs.filter((d) => {
    const data = d.data();
    const url = (data.url as string | null) ?? "";
    return url.includes(id);
  });
  console.log(`\nCUSTOMER IN-APP NOTIFICATIONS referencing this order: ${orderBells.length}`);
  for (const d of orderBells) {
    const n = d.data();
    console.log(`  ${iso(n.createdAt)}  ${n.title}  ${n.readAt ? "(read)" : "(unread)"}`);
  }

  if (order.artistId) {
    const artistBellSnap = await db.collection(`users/${order.artistId}/notifications`).get();
    const artistOrderBells = artistBellSnap.docs.filter((d) => {
      const data = d.data();
      const title = (data.title as string | null) ?? "";
      return title.toLowerCase().includes("sold") || title.toLowerCase().includes("sale");
    });
    console.log(`\nARTIST IN-APP NOTIFICATIONS about a sale: ${artistOrderBells.length}`);
    for (const d of artistOrderBells) {
      const n = d.data();
      console.log(`  ${iso(n.createdAt)}  ${n.title}  ${n.readAt ? "(read)" : "(unread)"}`);
    }
  }

  // 6. Diagnosis
  console.log("\n=== DIAGNOSIS ===");
  if (order.status === "paid") {
    const art = artSnap.exists ? artSnap.data()! : null;
    if (art?.listing?.onMarketplace === true) {
      console.log("🔴 Order IS paid but artwork is STILL on marketplace. refreshListing() path may have crashed.");
      console.log("   Fix: manually call refreshListing or set listing.onMarketplace=false on the artwork doc.");
    } else {
      console.log("✅ Order is paid, artwork correctly removed from marketplace.");
    }
    if (!order.shiprocketStage) {
      console.log("⚠️  Shiprocket shipment was never booked. Check Railway logs for 'shiprocket.outbound.failed'.");
    } else {
      console.log(`✅ Shipment booked — stage=${order.shiprocketStage}, AWB=${order.shiprocketTrackingId}.`);
    }
  } else if (order.status === "pending") {
    console.log("🔴 Order is still PENDING. Payment never actually settled.");
    console.log("   → Customer may have closed Razorpay without paying, OR the webhook didn't arrive.");
    console.log("   → Artwork correctly still on marketplace (nobody bought it yet).");
    console.log("   → No Shiprocket booking, no artist notification, no settlement — all gated on 'paid'.");
  } else if (order.status === "cancelled") {
    console.log(`ℹ️  Order was cancelled (${order.refundReason ?? "no reason recorded"}).`);
  } else {
    console.log(`ℹ️  Order is in state "${order.status}" — mid-fulfilment.`);
  }
  console.log("");
}

main().catch((error) => {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
