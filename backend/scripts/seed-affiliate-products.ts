// Puts the Amazon affiliate products from affiliate-products.seed.json on the
// shelf (/art-supplies). The links came from the client's "Affiliate" WhatsApp
// group (2-3 Oct 2026); titles, brands and photos were read off each Amazon
// page with the API's own lookup (apps/api/src/amazon-product.ts).
//
//   npm run seed:affiliate             # adds what is missing
//   npm run seed:affiliate -- --dry    # says what it would add, writes nothing
//
// Safe to re-run: a product already on the shelf (same ASIN) is left exactly
// as it is, so an admin's edits to its category or visibility survive.
//
// Reads FIREBASE_PROJECT_ID and the service-account credential the same way
// the API does, from ../.env at the repo root or apps/api/.env.

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, seedAffiliateProducts, type AffiliateProductInput } from "../packages/db/src/index.ts";
import { lookupAmazonProduct, MAX_IMAGES } from "../apps/api/src/amazon-product.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
}
loadDotEnv(resolve(root, "..", ".env"));
loadDotEnv(resolve(root, "apps", "api", ".env"));

const seedPath = resolve(here, "affiliate-products.seed.json");
const products = JSON.parse(readFileSync(seedPath, "utf8")) as (AffiliateProductInput & { asin: string })[];

// Entries added from a short Amazon link only carry a URL + ASIN (title / brand /
// images blank). Resolve them through the API's own lookup before the write and
// save the enriched entries back into the seed file so the next run has them
// pre-populated rather than hitting Amazon again.
async function enrichMissing(): Promise<void> {
  const needsResolve = products.filter((p) => !p.title.trim());
  if (needsResolve.length === 0) return;
  console.log(`resolving ${needsResolve.length} new product(s) from Amazon…`);
  let resolved = 0;
  for (const entry of needsResolve) {
    const looked = await lookupAmazonProduct(entry.url).catch(() => null);
    if (!looked || !looked.title) {
      console.warn(`  ${entry.asin}: Amazon lookup returned no title; left as-is for the admin to fill in`);
      continue;
    }
    entry.title = looked.title;
    entry.brand = looked.brand ?? entry.brand ?? null;
    entry.images = (looked.images ?? []).slice(0, MAX_IMAGES);
    if (looked.categoryPath && looked.categoryPath.length && entry.category === "Art supplies") {
      // Fall back to a nicer category only when the seed file had the generic
      // placeholder; a hand-set category always wins.
      entry.category = looked.categoryPath[0]!;
    }
    resolved++;
  }
  if (resolved > 0) {
    writeFileSync(seedPath, JSON.stringify(products, null, 1) + "\n");
    console.log(`enriched ${resolved} entries, wrote them back to the seed file`);
  }
}

if (process.argv.includes("--dry")) {
  await enrichMissing();
  const byCategory = Object.groupBy(products, (p) => p.category);
  for (const [category, items] of Object.entries(byCategory)) console.log(`${String(items!.length).padStart(3)}  ${category}`);
  console.log(`${products.length} products in the seed file. Nothing written.`);
  process.exit(0);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error("FIREBASE_PROJECT_ID must be set");
  process.exit(1);
}

await enrichMissing();
const { db } = createDb(projectId);
const { created, skipped } = await seedAffiliateProducts(db, products);
console.log(`added ${created}, already on the shelf ${skipped}`);
