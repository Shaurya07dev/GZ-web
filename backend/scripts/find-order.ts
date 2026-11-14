// Finds a customer's recent orders when you don't remember the order ID.
// Looks up the user by email, then lists their last N orders newest-first.
//
// USAGE:
//   cd backend
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     npx tsx scripts/find-order.ts --email buyer@example.com
//
//   # or by phone if you don't have the email:
//   GOOGLE_APPLICATION_CREDENTIALS=... npx tsx scripts/find-order.ts --phone +919876543210
//
//   # see more than the last 10:
//   ... --email ... --limit 25

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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

function iso(ts: unknown): string {
  if (!ts) return "—";
  if (typeof ts === "string") return ts;
  if (typeof ts === "object" && ts !== null && "toDate" in ts) {
    return (ts as { toDate(): Date }).toDate().toISOString();
  }
  return String(ts);
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      phone: { type: "string" },
      limit: { type: "string", default: "10" },
    },
  });
  if (!values.email && !values.phone) {
    throw new Error("Provide --email buyer@example.com  OR  --phone +91...");
  }
  const limit = Math.max(1, Math.min(100, Number(values.limit)));

  bootstrapFirebase();
  const auth = getAuth();
  const db = getFirestore();

  const user = values.email
    ? await auth.getUserByEmail(values.email).catch(() => null)
    : await auth.getUserByPhoneNumber(values.phone!).catch(() => null);
  if (!user) {
    console.log(`No auth user with that ${values.email ? "email" : "phone"}.`);
    return;
  }
  console.log(`\nUser: ${user.email ?? user.phoneNumber} (uid=${user.uid})\n`);

  const snap = await db
    .collection("orders")
    .where("customerId", "==", user.uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  if (snap.empty) {
    console.log("No orders for this user.");
    return;
  }

  console.log(`Last ${snap.size} order(s), newest first:\n`);
  console.log("ORDER ID         STATUS       CREATED                   TOTAL      ARTWORK");
  console.log("─".repeat(100));
  for (const d of snap.docs) {
    const o = d.data();
    const total = `₹${(o.totalPaise / 100).toFixed(2)}`.padEnd(10);
    const status = (o.status as string).padEnd(12);
    const id = d.id.padEnd(16);
    const when = iso(o.createdAt).slice(0, 19).replace("T", " ").padEnd(24);
    console.log(`${id} ${status} ${when} ${total} ${o.artworkId ?? "—"}`);
  }
  console.log("\nTake the suspect order ID from the first column, then:");
  console.log(`  npx tsx scripts/inspect-order.ts --id <that-id>`);
}

main().catch((error) => {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
