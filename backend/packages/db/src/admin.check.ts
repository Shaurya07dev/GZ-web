// Integration check for wallets.ts + admin.ts, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/admin.check.ts

import assert from "node:assert/strict";
import { DEFAULT_RATE_SEED, marketplaceCheckoutPostings } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { postLedgerEntries } from "./ledger-repository.ts";
import { getWalletBalance, listWalletTransactions } from "./wallets.ts";
import { getAdminKpis, listCategories, createCategory, updateCategory, deleteCategory, AdminError } from "./admin.ts";
import { submitArtwork } from "./artist-artworks.ts";
import { users } from "./schema/identity.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-admin-check-artist", role: "artist", name: "Admin Check Artist", email: "admin-check-artist@example.com" }).returning({ id: users.id });
  if (!artist) throw new Error("seed failed");

  // --- Wallets --------------------------------------------------------------
  const zeroBalance = await getWalletBalance(db, "artist_payable", artist.id);
  assert.equal(zeroBalance.balancePaise, 0);

  const postings = marketplaceCheckoutPostings({ artistId: artist.id, artistPricePaise: 100_000_00, rates: DEFAULT_RATE_SEED });
  await postLedgerEntries(db, { postings, idempotencyPrefix: `wallet-check-${artist.id}` });

  const funded = await getWalletBalance(db, "artist_payable", artist.id);
  assert.equal(funded.balancePaise, 100_000_00, "wallet balance reads as a positive number the artist actually receives");

  const transactions = await listWalletTransactions(db, "artist_payable", artist.id);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0]?.amountPaise, 100_000_00);

  // --- Admin KPIs -------------------------------------------------------------
  await submitArtwork({ db, artistId: artist.id, title: "KPI Test Piece", description: "d", category: "painting", medium: "oil", artistPricePaise: 10_000_00, listingType: "marketplace_only", rates: DEFAULT_RATE_SEED });
  const kpis = await getAdminKpis(db);
  assert.equal(kpis.totalUsers, 1);
  assert.equal(kpis.totalArtworks, 1);
  assert.equal(kpis.pendingApprovalArtworks, 1, "the freshly submitted artwork is pending approval, per the real moderation gate");

  // --- Categories -------------------------------------------------------------
  const emptyCategories = await listCategories(db);
  assert.equal(emptyCategories.length, 0);
  const { id: categoryId } = await createCategory(db, "Sculpture", "sculpture");
  await updateCategory(db, categoryId, "Sculpture & Installation");
  const afterUpdate = await listCategories(db);
  assert.equal(afterUpdate[0]?.name, "Sculpture & Installation");

  // Deleting an in-use category is refused ("painting" has 1 artwork).
  const { id: paintingCategoryId } = await createCategory(db, "painting", "painting");
  await assert.rejects(() => deleteCategory(db, paintingCategoryId), AdminError);

  // Deleting an unused category succeeds.
  await deleteCategory(db, categoryId);
  const afterDelete = await listCategories(db);
  assert.equal(afterDelete.length, 1, "only the still-in-use category remains");

  console.log("packages/db/wallets.ts + admin.ts: verified against real Postgres");
} finally {
  await close();
}
