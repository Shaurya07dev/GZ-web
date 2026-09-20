// Creates every composite index in firestore.indexes.json that does not
// already exist, using the same service account the API runs with — so a
// missing index is fixed from this repo rather than by clicking a console
// link in a stack trace.
//
//   node scripts/deploy-indexes.mjs            # create what's missing
//   node scripts/deploy-indexes.mjs --dry-run  # only report
//
// Reads GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_PROJECT_ID from the
// environment (or ../.env at the repo root). Index builds run in the
// background on Google's side; a freshly created one takes a minute or two
// before queries stop failing with FAILED_PRECONDITION.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
loadDotEnv(resolve(root, "..", ".env"));
loadDotEnv(resolve(root, "apps", "api", ".env"));

const projectId = process.env.FIREBASE_PROJECT_ID;
let keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!projectId || !keyFile) {
  console.error("FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS must be set");
  process.exit(1);
}
if (!existsSync(keyFile)) keyFile = resolve(root, "apps", "api", keyFile);
if (!existsSync(keyFile)) keyFile = resolve(root, keyFile);
if (!existsSync(keyFile)) {
  console.error(`service account file not found: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const wanted = JSON.parse(readFileSync(resolve(root, "firestore.indexes.json"), "utf8")).indexes;

const auth = new GoogleAuth({ keyFile, scopes: ["https://www.googleapis.com/auth/datastore"] });
const client = await auth.getClient();
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups`;

const signature = (collectionGroup, fields) =>
  `${collectionGroup}:` + fields.map((f) => `${f.fieldPath}/${f.order ?? f.arrayConfig}`).join(",");

const existing = new Set();
const list = await client.request({ url: `${base}/-/indexes` });
for (const idx of list.data.indexes ?? []) {
  const cg = idx.name.split("/collectionGroups/")[1].split("/")[0];
  existing.add(signature(cg, idx.fields.filter((f) => f.fieldPath !== "__name__")));
}

let created = 0;
for (const idx of wanted) {
  const sig = signature(idx.collectionGroup, idx.fields);
  if (existing.has(sig)) {
    console.log(`ok       ${sig}`);
    continue;
  }
  if (dryRun) {
    console.log(`missing  ${sig}`);
    continue;
  }
  try {
    await client.request({
      url: `${base}/${idx.collectionGroup}/indexes`,
      method: "POST",
      data: { queryScope: idx.queryScope ?? "COLLECTION", fields: idx.fields },
    });
    console.log(`created  ${sig}`);
    created += 1;
  } catch (error) {
    const msg = error?.response?.data?.error?.message ?? String(error);
    if (/already exists/i.test(msg)) console.log(`ok       ${sig} (already building)`);
    else {
      console.error(`FAILED   ${sig}: ${msg}`);
      process.exitCode = 1;
    }
  }
}
console.log(created ? `${created} index(es) queued — they take a minute or two to build.` : "Nothing to create.");
