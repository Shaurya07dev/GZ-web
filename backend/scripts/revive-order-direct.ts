// Direct revive — doesn't touch packages/db at all. Reads the order,
// confirms with Razorpay that money was captured, then directly updates
// the Firestore docs to the paid state. Written as a fallback when the
// full revive script keeps hitting Firebase init issues on the operator's
// machine.
//
// What it DOES do:
//   * Verify payment captured on Razorpay
//   * Update orders/{id} → status=paid, refundReason=null
//   * Append a "paid" status event
//   * Update payments/{id} → status=captured + payment details
//   * Flip the artwork to sold (listing.onMarketplace=false,
//     listing.status=sold)
//   * Append a "sold" artwork status event
//
// What it DOES NOT do (you'll do these manually after):
//   * Post the artist settlement (use admin UI → Settlements → create for order)
//   * Send order-paid emails (already sent by Razorpay directly to buyer)
//   * Book Shiprocket outbound (do via Shiprocket dashboard — order ref
//     will be `order-{orderId}`)
//
// USAGE:
//   cd backend
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
//     RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... \
//     npx tsx scripts/revive-order-direct.ts --id ORDER_ID \
//       --provider-order-id RAZORPAY_ORDER_ID
//
// Dry-run by default; add --i-understand to commit the writes.

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { parseArgs } from "node:util";

function parse() {
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      "provider-order-id": { type: "string" },
      "i-understand": { type: "boolean", default: false },
    },
  });
  if (!values.id) throw new Error("--id <orderId> is required");
  return {
    id: values.id,
    providerOrderIdOverride: values["provider-order-id"] ?? null,
    confirmed: Boolean(values["i-understand"]),
  };
}

function bootstrapFirebase() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    initializeApp({ credential: cert(JSON.parse(raw)) });
    return;
  }
  initializeApp({ credential: applicationDefault() });
}

interface RazorpayPayment {
  id: string;
  status: string;
  method?: string;
  fee?: number;
  tax?: number;
}

async function razorpayPayments(providerOrderId: string): Promise<RazorpayPayment[]> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET required");
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/orders/${providerOrderId}/payments`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Razorpay ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { items?: RazorpayPayment[] };
  return body.items ?? [];
}

async function main() {
  const args = parse();
  bootstrapFirebase();
  const db = getFirestore();

  console.log(`\nDirect-revive ${args.id}\n`);

  // 1. Order
  const orderRef = db.collection("orders").doc(args.id);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new Error(`No orders/${args.id}`);
  const order = orderSnap.data()!;
  console.log(`Current status: ${order.status}`);
  console.log(`Total: ₹${(order.totalPaise / 100).toFixed(2)}`);
  console.log(`Artwork: ${order.artworkId}`);
  if (["paid", "confirmed", "packed", "transit", "delivered"].includes(order.status as string)) {
    console.log("✅ Already settled.");
    return;
  }

  // 2. Payment doc
  const paySnap = await db.collection("payments").where("orderId", "==", args.id).limit(1).get();
  if (paySnap.empty) throw new Error("No payment doc");
  const payRef = paySnap.docs[0]!.ref;
  const payment = paySnap.docs[0]!.data();
  const providerOrderId =
    args.providerOrderIdOverride ?? (payment.providerOrderId as string | undefined);
  if (!providerOrderId) throw new Error("No providerOrderId (pass --provider-order-id)");
  console.log(`Razorpay order id: ${providerOrderId}${args.providerOrderIdOverride ? " (via --provider-order-id)" : ""}`);

  // 3. Razorpay check
  const payments = await razorpayPayments(providerOrderId);
  console.log(`Razorpay says ${payments.length} payment(s):`);
  for (const p of payments) {
    console.log(`  ${p.id}  status=${p.status}  method=${p.method ?? "?"}  fee=${p.fee ?? 0}  tax=${p.tax ?? 0}`);
  }
  const captured = payments.find((p) => p.status === "captured");
  if (!captured) throw new Error("No captured payment on Razorpay side — refusing to settle");
  console.log(`\n✅ Payment ${captured.id} captured. Safe to revive.`);

  if (!args.confirmed) {
    console.log("\n[DRY-RUN] Re-run with --i-understand to actually settle.");
    process.exitCode = 2;
    return;
  }

  // 4. Write: flip the order, append status event, update payment, mark
  //    artwork sold, append artwork status event.
  const now = Timestamp.now();
  const batch = db.batch();

  batch.update(orderRef, {
    status: "paid",
    refundReason: null,
  });
  batch.set(db.collection(`orders/${args.id}/statusEvents`).doc(), {
    status: "paid",
    changedAt: now,
  });
  batch.update(payRef, {
    status: "captured",
    method: captured.method ? `razorpay_${captured.method}` : "razorpay",
    providerPaymentId: captured.id,
    providerOrderId, // ensure it matches the one that actually settled
    gatewayFeeActualPaise: captured.fee ?? FieldValue.delete(),
    gatewayFeeGstActualPaise: captured.tax ?? FieldValue.delete(),
  });

  // Mark artwork sold
  const artRef = db.collection("artworks").doc(order.artworkId);
  const artSnap = await artRef.get();
  if (artSnap.exists) {
    batch.update(artRef, {
      "listing.status": "sold",
      "listing.onMarketplace": false,
    });
    batch.set(db.collection(`artworks/${order.artworkId}/statusEvents`).doc(), {
      status: "sold",
      changedAt: now,
      changedBy: null,
      reason: `order:${args.id}`,
    });
  }

  await batch.commit();
  console.log("\n✅ Committed. Order is now paid, artwork marked sold.");
  console.log("\nFOLLOW-UPS (do manually):");
  console.log("  1. Settlement — Admin UI → Settlements → create one for this order");
  console.log(`  2. Shiprocket — book outbound from the Shiprocket dashboard with order ref: order-${args.id}`);
  console.log("  3. Buyer email — the Razorpay email was already sent; no additional email fires from this script");
}

main().catch((error) => {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
