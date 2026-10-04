// Renames the gateway escrow ledger account from its old name to its new one.
//
// The account the gateway holds money in used to be called "razorpay_escrow";
// it is now "gateway_escrow", so the name no longer claims a provider we don't
// use.
//
// This is a one-document change, and that is the whole point: a ledger ENTRY
// stores `accountId`, never the account's name, so renaming the
// ledgerAccounts doc's `type` carries every historical posting with it. No
// entries are rewritten and no balance moves.
//
// Why it is still worth running: accounts are resolved by
// `where("type", "==", ...)`, so until the old doc is renamed the new code
// creates a SECOND escrow account and the escrow history reads as split in
// two. Balances and the double-entry invariant are unaffected either way
// (each entry's postings sum to zero regardless), and nothing in the app
// reads the escrow balance — only artist_payable and aggregator_payable are
// read — so this is tidiness, not a correctness fix.
//
//   npm run migrate:escrow -- --dry-run   # show what would change
//   npm run migrate:escrow                # apply
//
// Idempotent: a second run finds nothing to do.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const OLD = "razorpay_escrow";
const NEW = "gateway_escrow";
const dryRun = process.argv.includes("--dry-run");

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
}

const root = resolve(import.meta.dirname, "..");
loadDotEnv(resolve(root, "..", ".env"));
loadDotEnv(resolve(root, "apps", "api", ".env"));

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not set (see .env.example)");

// The configured path may have been written on another machine, so fall back
// to the service-account file sitting beside the API before giving up.
const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "";
const candidates = [configured, resolve(root, "apps", "api", configured), resolve(root, configured)].filter(Boolean);
const keyFile = candidates.find((c) => existsSync(c));
if (!keyFile) {
  throw new Error(
    `service account file not found. GOOGLE_APPLICATION_CREDENTIALS=${configured || "(unset)"} — ` +
      `set it to an absolute path, or to a path relative to backend/ or backend/apps/api/.`,
  );
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyFile, "utf8")) as Record<string, string>), projectId });
}
const db = getFirestore();

const accounts = await db.collection("ledgerAccounts").where("type", "==", OLD).get();
console.log(`ledgerAccounts with type="${OLD}": ${accounts.size}`);

if (accounts.empty) {
  console.log("nothing to migrate — no account carries the old name");
  process.exit(0);
}

// Report how much history each one carries, so the operator can see this is
// the account they expect before anything is written.
for (const doc of accounts.docs) {
  const entries = await db.collection("ledgerEntries").where("accountId", "==", doc.id).count().get();
  console.log(`  ${doc.id}: ${entries.data().count} ledger entries (these follow the rename untouched)`);
}

if (dryRun) {
  console.log("dry run — nothing written");
  process.exit(0);
}

const batch = db.batch();
for (const doc of accounts.docs) batch.update(doc.ref, { type: NEW });
await batch.commit();
console.log(`renamed ${accounts.size} account(s) from "${OLD}" to "${NEW}"`);
