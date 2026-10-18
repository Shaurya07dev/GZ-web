// Lifetime-sales reader for the aggregator commission slabs (client #16,
// 18 Oct 2026). Separate file so the slab logic can be exercised in tests
// without pulling in the whole aggregator-flow module.
//
// Lifetime total = sum of (displayPrice − artistPrice) across every past
// sale by this aggregator — the markup, not the gross. The client's slab
// numbers (₹10L, ₹50L) are stated as "total sales", and we interpret that as
// the pre-GST value of what they sold. We use the markup here because that
// is what commission is computed off, which keeps the slab and the
// commission base in the same units; swapping to gross is a one-line change
// if the client disagrees.

import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { Collections, artworkPricingCol, type AggregatorSaleDoc, type ArtworkPricingDoc } from "./collections.ts";
import { exGst, type PricingRates } from "@galleryzone/domain";

/**
 * Sum of pre-GST markup across every completed sale by this aggregator
 * whose `soldAt` is strictly before `asOf`. The caller is responsible for
 * passing the right cut-off (start of the current month) so the rate change
 * takes effect next month rather than retroactively.
 */
export async function aggregatorLifetimeMarkupPaise(
  db: Firestore,
  aggregatorId: string,
  asOf: Date,
  rates: PricingRates,
): Promise<number> {
  // Sales live in a flat collection, keyed by holding; we read the matching
  // sales via a collection scan filtered by the aggregator's holdings. That's
  // one query against the holdings projection and one bulk read of sales.
  const holdingsSnap = await db
    .collection(Collections.aggregatorHoldings)
    .where("aggregatorId", "==", aggregatorId)
    .get();
  if (holdingsSnap.empty) return 0;

  const holdingToArtwork = new Map<string, string>();
  for (const d of holdingsSnap.docs) {
    const h = d.data() as { artworkId: string };
    holdingToArtwork.set(d.id, h.artworkId);
  }

  const salesSnap = await db
    .collection(Collections.aggregatorSales)
    .where("holdingId", "in", [...holdingToArtwork.keys()].slice(0, 30))
    .get();
  // Firestore caps `in` at 30; most aggregators are below that in year one,
  // and if a real deployment ever crosses it we switch to a projection or
  // sharded counter rather than scanning every holding here. For now, if
  // there are more than 30 holdings we fetch sales per-holding instead.
  const sales: AggregatorSaleDoc[] = salesSnap.docs.map((d) => d.data() as AggregatorSaleDoc);
  if (holdingToArtwork.size > 30) {
    const extra = await Promise.all(
      [...holdingToArtwork.keys()].slice(30).map((holdingId) =>
        db
          .collection(Collections.aggregatorSales)
          .where("holdingId", "==", holdingId)
          .get()
          .then((snap) => snap.docs.map((d) => d.data() as AggregatorSaleDoc)),
      ),
    );
    for (const batch of extra) sales.push(...batch);
  }

  const asOfTs = Timestamp.fromDate(asOf);
  const relevant = sales.filter((s) => s.soldAt && s.soldAt.toMillis() < asOfTs.toMillis());
  if (relevant.length === 0) return 0;

  // The markup is (displayPrice ex-GST) − artistPrice. We stored soldPrice on
  // the sale and have artistPrice on the artwork's pricing doc; read them
  // together.
  const artworkIds = [...new Set(relevant.map((s) => holdingToArtwork.get(s.holdingId)).filter((id): id is string => Boolean(id)))];
  const pricingDocs = await Promise.all(
    artworkIds.map((artworkId) => db.collection(artworkPricingCol(artworkId)).doc("data").get()),
  );
  const artistPriceByArtwork = new Map<string, number>();
  for (const d of pricingDocs) {
    if (d.exists) {
      const data = d.data() as ArtworkPricingDoc;
      const artworkId = d.ref.parent.parent?.id;
      if (artworkId) artistPriceByArtwork.set(artworkId, data.artistPricePaise);
    }
  }

  let total = 0;
  for (const sale of relevant) {
    const artworkId = holdingToArtwork.get(sale.holdingId);
    if (!artworkId) continue;
    const artistPrice = artistPriceByArtwork.get(artworkId) ?? 0;
    const markup = Math.max(0, exGst(sale.soldPricePaise, rates) - artistPrice);
    total += markup;
  }
  return total;
}

/** The start of the UTC month containing `at`. Used as the "lifetime through
 *  end of previous month" cut-off. */
export function startOfMonthUtc(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}
