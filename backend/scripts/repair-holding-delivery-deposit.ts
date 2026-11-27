// One-shot repair: holdings whose deliveryDepositPaise was stamped with
// the flat ₹25 due to the finalizeReservationIntent recompute bug
// (fixed in commit touching reservation-intents.ts @ 2026-11-28). For
// each affected holding, we copy the correct amount from the parent
// reservation-intent's `deliveryDepositPaise` field (which DID carry
// the live Shiprocket quote, because the fix in createReservationIntent
// landed first).
//
//   node --experimental-strip-types backend/scripts/repair-holding-delivery-deposit.ts        # dry run
//   node --experimental-strip-types backend/scripts/repair-holding-delivery-deposit.ts --apply

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Collections,
  createDb,
  type AggregatorHoldingDoc,
  type ReservationIntentDoc,
} from "../packages/db/src/index.ts";

const root = resolve(import.meta.dirname, "..");

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]!] === undefined) {
      process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
    }
  }
}
loadDotEnv(resolve(root, "..", ".env"));
loadDotEnv(resolve(root, "apps", "api", ".env"));

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not set");

const apply = process.argv.includes("--apply");
const db = createDb(projectId);

const holdingsSnap = await db.collection(Collections.aggregatorHoldings).get();
let repaired = 0;
let skipped = 0;
let noIntent = 0;
let already = 0;

for (const d of holdingsSnap.docs) {
  const h = d.data() as AggregatorHoldingDoc;
  // Look up the parent intent by (aggregatorId, artworkId) status=finalized.
  // There's no back-reference from holding → intent, so we search.
  const intentSnap = await db
    .collection(Collections.reservationIntents)
    .where("aggregatorId", "==", h.aggregatorId)
    .where("artworkId", "==", h.artworkId)
    .where("status", "==", "finalized")
    .get();
  if (intentSnap.empty) {
    noIntent++;
    continue;
  }
  // Pick the intent whose holdingId matches, or the latest one.
  const matching = intentSnap.docs.find(
    (i) => (i.data() as ReservationIntentDoc).holdingId === d.id,
  );
  const picked = matching ?? intentSnap.docs.sort(
    (a, b) =>
      (b.data() as ReservationIntentDoc).createdAt.toMillis() -
      (a.data() as ReservationIntentDoc).createdAt.toMillis(),
  )[0]!;
  const intent = picked.data() as ReservationIntentDoc;
  const correct = intent.deliveryDepositPaise;
  const current = h.deliveryDepositPaise ?? 0;
  if (correct == null || correct === current) {
    already++;
    continue;
  }
  console.log(
    `  holding ${d.id}  artwork=${h.artworkId}  current=₹${current / 100}  → correct=₹${correct / 100}`,
  );
  if (apply) {
    await d.ref.update({ deliveryDepositPaise: correct });
    repaired++;
  } else {
    skipped++;
  }
}

console.log(
  `\nDone. ${apply ? "Repaired" : "Would repair"} ${apply ? repaired : skipped} holdings. ${already} already correct. ${noIntent} had no finalized intent (legacy reservations, cannot repair).`,
);
if (!apply) {
  console.log(`\nRe-run with --apply to write.`);
}
