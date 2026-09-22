// Grants an RBAC permission on top of a user's coarse role — in practice
// "platform_admin", which the rate-config console requires to propose and
// approve a pricing change. That grant had no way to be issued: grantRole()
// existed in @galleryzone/db but nothing called it, so the only route was
// hand-editing Firestore.
//
//   node --experimental-strip-types scripts/grant-role.ts <uid> [grant]
//   npm run grant:role -- <uid>                 # defaults to platform_admin
//
// A rate change needs TWO different platform_admins: the store refuses to
// let a proposer approve their own version. Run this for both accounts.
//
// Reads FIREBASE_PROJECT_ID and the service-account credential the same way
// the API does, from ../.env at the repo root or apps/api/.env.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, grantRole, Collections, type UserDoc } from "../packages/db/src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
}
loadDotEnv(resolve(root, "..", ".env"));
loadDotEnv(resolve(root, "apps", "api", ".env"));

const [uid, grant = "platform_admin"] = process.argv.slice(2);
if (!uid) {
  console.error("usage: node --experimental-strip-types scripts/grant-role.ts <uid> [grant]");
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error("FIREBASE_PROJECT_ID must be set");
  process.exit(1);
}

const { db } = createDb(projectId);

const snap = await db.collection(Collections.users).doc(uid).get();
const user = snap.data() as UserDoc | undefined;
if (!user) {
  console.error(`No user ${uid}. Pass the Firebase UID, not the email address.`);
  process.exit(1);
}

if ((user.roleGrants ?? []).includes(grant)) {
  console.log(`ok       ${user.email} already has "${grant}"`);
  process.exit(0);
}

await grantRole(db, uid, grant);
console.log(`granted  "${grant}" to ${user.email} (${user.role})`);
console.log("They need to sign out and back in for the new claim to reach the browser.");
