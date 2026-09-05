// Admin settlements queue. settlements is a read model over ledger_entries
// (see the schema file's own comment) — nothing here recomputes money,
// it only lists/retries rows already written by checkout.ts/aggregator-
// flow.ts.

import { eq } from "drizzle-orm";
import { settlementStateMachine } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { settlements } from "./schema/ledger.ts";

export class SettlementError extends Error {}

export async function listSettlements(db: Db) {
  return db.select().from(settlements);
}

/** Only legal from "failed" — matches the mock's own retrySettlement rule. */
export async function retrySettlement(db: Db, settlementId: string): Promise<void> {
  const [row] = await db.select({ status: settlements.status }).from(settlements).where(eq(settlements.id, settlementId));
  if (!row) throw new SettlementError(`No settlement ${settlementId}`);
  settlementStateMachine.assertTransition(row.status, "pending");
  await db.update(settlements).set({ status: "pending" }).where(eq(settlements.id, settlementId));
}
