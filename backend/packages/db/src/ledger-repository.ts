// Turns packages/domain/settlement.ts's Posting[] into real Firestore
// documents inside ONE Firestore transaction — the Postgres version's
// equivalent used a DB transaction + a CONSTRAINT TRIGGER that verified
// the balance server-side; Firestore has neither triggers nor a
// cross-document CHECK constraint, so the guarantees here are:
//
//   1. assertBalanced() (re-run here, not just trusted from
//      packages/domain, since there's no DB-level backstop anymore) — the
//      postings must sum to zero before a single write is attempted.
//   2. Firestore's transaction atomicity — every write in the batch
//      commits together or not at all, so a mid-write failure can never
//      leave a half-posted, unbalanced set of entries.
//   3. Idempotency via `tx.create()` (not `set()`) keyed on
//      idempotencyKey as the DOCUMENT ID — a replayed write with the same
//      key throws ALREADY_EXISTS instead of silently double-posting,
//      which is what the Postgres version's UNIQUE constraint did.

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { Posting } from "@galleryzone/domain";
import { Collections, type LedgerAccountDoc, type LedgerEntryDoc } from "./collections.ts";

export class LedgerError extends Error {}

function assertBalanced(postings: Posting[]): void {
  const sum = postings.reduce((total, p) => total + p.amountPaise, 0);
  if (sum !== 0) {
    throw new LedgerError(`Postings do not sum to zero (got ${sum}) — refusing to write any of them`);
  }
}

async function getOrCreateAccountId(
  db: Firestore,
  tx: Transaction,
  accountType: Posting["accountType"],
  ownerId: string | undefined,
): Promise<string> {
  const col = db.collection(Collections.ledgerAccounts);
  let query = col.where("type", "==", accountType);
  query = ownerId ? query.where("ownerId", "==", ownerId) : query.where("ownerId", "==", null);
  const snapshot = await tx.get(query);
  if (!snapshot.empty) return snapshot.docs[0]!.id;

  const ref = col.doc();
  const doc: LedgerAccountDoc = { type: accountType, ownerId: ownerId ?? null };
  tx.set(ref, doc);
  return ref.id;
}

export interface PostLedgerEntriesInput {
  postings: Posting[];
  /** Prefix for each posting's idempotency key — must be unique per business event (e.g. an order id). */
  idempotencyPrefix: string;
  relatedOrderId?: string;
  relatedHoldingId?: string;
}

export async function postLedgerEntries(db: Firestore, input: PostLedgerEntriesInput): Promise<{ transactionId: string }> {
  assertBalanced(input.postings);
  const transactionId = db.collection(Collections.ledgerAccounts).doc().id; // any collection works — just need a random ID generator

  await db.runTransaction(async (tx) => {
    // Firestore transactions require ALL reads before ANY writes — resolve
    // every account first, then issue every entry write.
    const accountIds = await Promise.all(
      input.postings.map((posting) => getOrCreateAccountId(db, tx, posting.accountType, posting.ownerId)),
    );

    input.postings.forEach((posting, index) => {
      const idempotencyKey = `${input.idempotencyPrefix}:${index}`;
      const ref = db.collection(Collections.ledgerEntries).doc(idempotencyKey);
      const doc: LedgerEntryDoc = {
        transactionId,
        accountId: accountIds[index]!,
        amountPaise: posting.amountPaise,
        reason: posting.reason,
        relatedOrderId: input.relatedOrderId ?? null,
        relatedHoldingId: input.relatedHoldingId ?? null,
        idempotencyKey,
        createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
      };
      tx.create(ref, doc);
    });
  });

  return { transactionId };
}
