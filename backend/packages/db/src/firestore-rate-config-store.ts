// Firestore-backed RateConfigStore — replaces the Postgres version.
// Same interface (@galleryzone/config), same two-step propose/approve
// semantics, same "unapproved rows never leak" and "self-approval
// rejected" guarantees, now verified against the Firestore emulator
// instead of a Docker Postgres container (see
// firestore-rate-config-store.check.ts).

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import type { RateConfigStore, RateConfigVersion } from "@galleryzone/config";
import { normalizeRates, type PricingRates } from "@galleryzone/domain";
import { Collections, type RateConfigVersionDoc } from "./collections.ts";

export class FirestoreRateConfigStore implements RateConfigStore {
  private readonly db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  async propose({
    rates,
    effectiveFrom,
    proposedBy,
    reason,
  }: {
    rates: PricingRates;
    effectiveFrom: Date;
    proposedBy: string;
    reason: string;
  }): Promise<string> {
    const ref = this.db.collection(Collections.rateConfigVersions).doc();
    const doc: RateConfigVersionDoc = {
      rates,
      effectiveFrom: Timestamp.fromDate(effectiveFrom),
      proposedBy,
      proposedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
      approvedBy: null,
      approvedAt: null,
      approved: false,
      reason,
    };
    await ref.set(doc);
    return ref.id;
  }

  async approve({ versionId, approvedBy }: { versionId: string; approvedBy: string }): Promise<void> {
    const ref = this.db.collection(Collections.rateConfigVersions).doc(versionId);
    await this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new Error(`No rate_config version ${versionId}`);
      const existing = snapshot.data() as RateConfigVersionDoc;
      if (existing.approved) throw new Error(`${versionId} is already approved`);
      if (existing.proposedBy === approvedBy) {
        throw new Error("A rate change cannot be self-approved by its proposer");
      }
      tx.update(ref, { approvedBy, approvedAt: FieldValue.serverTimestamp(), approved: true });
    });
  }

  async getActiveVersion(asOf: Date): Promise<RateConfigVersion | null> {
    const snapshot = await this.db
      .collection(Collections.rateConfigVersions)
      .where("approved", "==", true)
      .where("effectiveFrom", "<=", Timestamp.fromDate(asOf))
      .orderBy("effectiveFrom", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0]!;
    const data = doc.data() as RateConfigVersionDoc;
    if (!data.approvedBy) return null;
    return {
      id: doc.id,
      effectiveFrom: data.effectiveFrom.toDate(),
      // Normalized on the way out: a version approved before a rate existed
      // must not hand `undefined` to a money calculation.
      rates: normalizeRates(data.rates as Partial<PricingRates>),
      approvedBy: data.approvedBy,
      reason: data.reason,
    };
  }
}
