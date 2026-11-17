// One-shot: revive an order that was wrongly cancelled by the client-driven
// abandon flow after Razorpay had already captured the payment. Client
// incident 14 Nov 2026 pm — buyer paid, got Razorpay confirmation mail,
// but our UI showed "cancelled" because /abandon raced Razorpay's
// eventually-consistent order-status reading.
//
// This script:
//   1. Reads the order doc.
//   2. Reads the matching payment doc to get the Razorpay providerOrderId.
//   3. Hits Razorpay's /orders/:id/payments API to confirm a captured
//      payment exists for that providerOrderId. Refuses to proceed unless
//      Razorpay independently says the money is in.
//   4. Calls markOrderPaid() with the recovered providerPaymentId and the
//      Razorpay fee + gst from the captured payment. The new cancelled →
//      paid transition in orderStateMachine permits the revival; the
//      artwork gets marked sold, settlement posts, buyer+artist emails
//      fire, Shiprocket outbound booking kicks off — the whole paid
//      path runs exactly as if the webhook had arrived first.
//
// USAGE:
//   cd backend
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     RAZORPAY_KEY_ID=rzp_live_... \
//     RAZORPAY_KEY_SECRET=... \
//     npx tsx scripts/revive-cancelled-order.ts --id mhJOx9po
//
// SAFETY:
//   * Refuses on emulator project ids (contains "demo-").
//   * Refuses if no captured payment exists on Razorpay — never invents
//     a settlement.
//   * Refuses on paid / confirmed / already-settled orders.
//   * Prints a full dry-run report; actual settlement requires
//     --i-understand.

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseArgs } from "node:util";

interface RazorpayPayment {
  id: string;
  status: string;
  method?: string;
  fee?: number;
  tax?: number;
  order_id: string;
}

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

async function fetchRazorpayPayments(providerOrderId: string): Promise<RazorpayPayment[]> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET must be set so this script can confirm the payment with Razorpay before reviving the order.");
  }
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/orders/${providerOrderId}/payments`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`Razorpay /orders/${providerOrderId}/payments returned ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { items?: RazorpayPayment[] };
  return body.items ?? [];
}

async function main() {
  const args = parse();
  bootstrapFirebase();
  const db = getFirestore();

  const projectId = (db as unknown as { projectId?: string }).projectId;
  if (projectId && projectId.startsWith("demo-")) {
    throw new Error(`refusing to run against emulator project ${projectId}`);
  }

  console.log(`\nReviving order ${args.id} on project ${projectId ?? "(default)"}\n`);

  // 1. Order
  const orderSnap = await db.collection("orders").doc(args.id).get();
  if (!orderSnap.exists) throw new Error(`No orders/${args.id}`);
  const order = orderSnap.data()!;
  console.log(`Order status: ${order.status}`);
  console.log(`Order totalPaise: ${order.totalPaise} (₹${(order.totalPaise / 100).toFixed(2)})`);
  if (order.status === "paid" || order.status === "confirmed" || order.status === "packed" || order.status === "transit" || order.status === "delivered") {
    console.log("✅ Order is already settled. Nothing to revive.");
    return;
  }

  // 2. Payment
  const paySnap = await db.collection("payments").where("orderId", "==", args.id).limit(1).get();
  if (paySnap.empty) throw new Error("No payment doc for this order");
  const payment = paySnap.docs[0]!.data();
  // Override lets the operator paste the actual providerOrderId from
  // Razorpay dashboard when our DB has a stale/wrong one. Happens when
  // /payment/session was hit multiple times — each call creates a new
  // Razorpay order and overwrites our attached id; the buyer may have
  // paid against an earlier one. Razorpay's notes.gzOrderId still points
  // back to our order id, so routing on their side was fine; our local
  // record just lost which Razorpay order held the captured payment.
  const providerOrderId =
    args.providerOrderIdOverride ?? (payment.providerOrderId as string | undefined);
  if (!providerOrderId) throw new Error("Payment doc has no providerOrderId — the buyer never opened Razorpay for this order");
  console.log(`Razorpay providerOrderId: ${providerOrderId}${args.providerOrderIdOverride ? " (overridden via --provider-order-id)" : ""}`);

  // 3. Razorpay confirmation
  const payments = await fetchRazorpayPayments(providerOrderId);
  console.log(`Razorpay reports ${payments.length} payment attempt(s) under this order:`);
  for (const p of payments) {
    console.log(`  ${p.id}  status=${p.status}  method=${p.method ?? "?"}  fee=${p.fee ?? 0}  tax=${p.tax ?? 0}`);
  }
  const captured = payments.find((p) => p.status === "captured");
  if (!captured) {
    throw new Error(
      "No captured payment on Razorpay side. REFUSING to revive — without a Razorpay-side capture, marking this order paid would be settling money that was never actually received.",
    );
  }
  console.log(`\n✅ Razorpay confirms captured payment ${captured.id}. Revival is safe.`);

  // 4. Do or don't
  if (!args.confirmed) {
    console.log("\n[DRY-RUN] Re-run with --i-understand to actually revive the order and settle.");
    process.exitCode = 2;
    return;
  }

  // Dynamic import AFTER Firebase is initialised; importing packages/db at
  // the top of the file triggers a Firestore client instantiation before
  // initializeApp finishes, giving "Client is not yet ready to issue
  // requests". Loading lazily sidesteps that.
  const { markOrderPaid } = await import("../packages/db/src/index.ts");
  const capture = {
    method: captured.method ? `razorpay_${captured.method}` : "razorpay",
    providerPaymentId: captured.id,
    rawWebhookPayload: null,
    gatewayFeeActualPaise: captured.fee ?? null,
    gatewayFeeGstActualPaise: captured.tax ?? null,
  };
  const result = await markOrderPaid(db, args.id, capture);
  console.log(`\n✅ Settled. transactionId=${result.transactionId}`);
  console.log("markOrderPaid will have:");
  console.log("  * flipped the order to status=paid");
  console.log("  * marked the artwork as sold + rebuilt the marketplace projection");
  console.log("  * posted the artist settlement");
  console.log("  * sent the buyer + artist order-paid emails + in-app notifications");
  console.log("Shiprocket outbound booking is NOT fired by this script (it normally runs from payments.controller after settle). If you need the pickup booked, do it manually or trigger a fresh webhook replay.");
}

main().catch((error) => {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
