import type { Settlement } from "@/types/admin";
import type { WalletTransaction } from "@/features/dashboard/dashboard-data";
import {
  artistActivityCol,
  artistPricesCol,
  artistSettlementsCol,
  artistWalletCol,
  artistWalletTransactionsCol,
  CURRENT_ARTIST_ID,
  CURRENT_ARTIST_NAME,
} from "@/lib/mock-collections";
import {
  artistPriceFrom,
  artistSettlementOf,
  isPayoutDue,
  payoutReleaseDate,
  type SaleChannel,
} from "@/lib/pricing";

// The artist's money, from sale to bank.
//
// The money-flow sheets set one rule for the timing: the artist is paid within
// 7 days of the artwork being DELIVERED — not of the sale. So a sale credits
// the pending balance and nothing else; delivery starts a 7-day clock; the
// money only becomes withdrawable when that clock runs out.
//
// Nothing here runs on a timer. Settlements are released lazily, whenever the
// wallet is read, which is the only moment the difference is observable and
// avoids inventing a scheduler this mock has no way to run.

/**
 * What the artist is owed for a piece. Most fixture artworks have no stored
 * artist price — for those it's worked backwards out of the listed price,
 * which is exact because the listed price was derived from it in the first
 * place.
 */
export function artistPriceOf(artwork: {
  id: string;
  customerPrice: number;
}): number {
  return artistPricesCol.get()[artwork.id] ?? artistPriceFrom(artwork.customerPrice);
}

function walletTransactionId(): string {
  return `wt-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Records a sale against the artist's wallet as PENDING money. Returns the
 * settlement, or null when the sale isn't the demo artist's (she's the only
 * artist this app has a wallet for).
 */
export function creditArtistSettlement({
  artwork,
  orderId,
  channel,
}: {
  artwork: { id: string; title: string; artistId: string; customerPrice: number };
  orderId: string;
  channel: SaleChannel;
}): Settlement | null {
  if (artwork.artistId !== CURRENT_ARTIST_ID) return null;

  const artistPrice = artistPriceOf(artwork);
  const settlement = artistSettlementOf(artistPrice, channel);
  if (settlement.net <= 0) return null;

  const wallet = artistWalletCol.get();
  artistWalletCol.set({
    ...wallet,
    pendingBalance: wallet.pendingBalance + settlement.net,
  });

  const now = new Date().toISOString();
  const transaction: WalletTransaction = {
    id: walletTransactionId(),
    type: "settlement",
    label: `Settlement: "${artwork.title}"`,
    amount: settlement.net,
    date: now.slice(0, 10),
    status: "pending",
  };
  artistWalletTransactionsCol.set([
    transaction,
    ...artistWalletTransactionsCol.get(),
  ]);

  const record: Settlement = {
    id: `settle-${crypto.randomUUID().slice(0, 8)}`,
    orderId,
    artworkTitle: artwork.title,
    artistName: CURRENT_ARTIST_NAME,
    artistAmount: settlement.net,
    aggregatorCommission: 0,
    platformRevenue: artwork.customerPrice - settlement.net,
    status: "pending",
    createdAt: now,
    processedAt: null,
    // Set when the piece is delivered — until then there is no clock running.
    releaseAfter: null,
    walletTransactionId: transaction.id,
  };
  artistSettlementsCol.set([record, ...artistSettlementsCol.get()]);

  artistActivityCol.set([
    {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      kind: "settlement" as const,
      title: "Sale recorded",
      detail: `₹${settlement.net.toLocaleString("en-IN")} for "${artwork.title}" — paid 7 days after delivery`,
      time: "Just now",
    },
    ...artistActivityCol.get(),
  ]);

  return record;
}

/**
 * Starts the 7-day clock on every pending settlement for an order. Called when
 * the artwork is actually delivered.
 */
export function markSettlementsDelivered(
  orderId: string,
  deliveredAt: string = new Date().toISOString(),
): void {
  artistSettlementsCol.set(
    artistSettlementsCol.get().map((settlement) =>
      settlement.orderId === orderId && settlement.status === "pending"
        ? { ...settlement, releaseAfter: payoutReleaseDate(deliveredAt).toISOString() }
        : settlement,
    ),
  );
}

/**
 * Moves any settlement whose 7 days are up out of the pending balance and into
 * the withdrawable one. Safe to call on every wallet read — it does nothing
 * when nothing is due.
 */
export function releaseDueArtistSettlements(now: number = Date.now()): void {
  const settlements = artistSettlementsCol.get();
  const due = settlements.filter(
    (settlement) =>
      settlement.status === "pending" &&
      settlement.releaseAfter != null &&
      new Date(settlement.releaseAfter).getTime() <= now,
  );
  if (due.length === 0) return;

  const releasedTotal = due.reduce((sum, s) => sum + s.artistAmount, 0);
  const releasedIds = new Set(due.map((s) => s.id));
  const releasedTransactionIds = new Set(
    due.map((s) => s.walletTransactionId).filter(Boolean),
  );
  const releasedAt = new Date(now).toISOString();

  const wallet = artistWalletCol.get();
  artistWalletCol.set({
    ...wallet,
    // Never let rounding or a double-read push the pending balance negative.
    pendingBalance: Math.max(0, wallet.pendingBalance - releasedTotal),
    balance: wallet.balance + releasedTotal,
  });

  artistSettlementsCol.set(
    settlements.map((settlement) =>
      releasedIds.has(settlement.id)
        ? { ...settlement, status: "processed" as const, processedAt: releasedAt }
        : settlement,
    ),
  );

  artistWalletTransactionsCol.set(
    artistWalletTransactionsCol.get().map((transaction) =>
      releasedTransactionIds.has(transaction.id)
        ? { ...transaction, status: "completed" as const }
        : transaction,
    ),
  );

  artistActivityCol.set([
    {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      kind: "settlement" as const,
      title: "Settlement released",
      detail: `₹${releasedTotal.toLocaleString("en-IN")} moved to your available balance`,
      time: "Just now",
    },
    ...artistActivityCol.get(),
  ]);
}

/** Pending settlements, newest first — what the wallet shows as "on the way". */
export function pendingArtistSettlements(): Settlement[] {
  return artistSettlementsCol.get().filter((s) => s.status === "pending");
}

/**
 * Demo shortcut: there is no courier and no backend, so nothing in this app
 * ever marks a customer order delivered. This backdates delivery far enough
 * that the 7 days have already elapsed, so the release can actually be seen.
 */
export function simulateDeliveryAndRelease(settlementId: string): void {
  const settlements = artistSettlementsCol.get();
  const target = settlements.find((s) => s.id === settlementId);
  if (!target || target.status !== "pending") return;

  const deliveredEightDaysAgo = new Date(
    Date.now() - 8 * 24 * 60 * 60 * 1000,
  ).toISOString();
  markSettlementsDelivered(target.orderId, deliveredEightDaysAgo);
  releaseDueArtistSettlements();
}

/** Exported for the wallet UI so it can show when money becomes available. */
export { isPayoutDue };
