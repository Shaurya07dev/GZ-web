// Run: node --experimental-strip-types packages/db/src/moderation.check.ts
// GST/KYC decisions against a just-big-enough in-memory Firestore: the
// applicant can read the rejection reason, every decision has its own id
// (so its email is never deduped into an earlier one), and a blank reason
// or an out-of-order decision is refused without writing anything.

import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import { IllegalTransitionError } from "@galleryzone/domain";
import { ModerationError, decideGst, decideKyc } from "./moderation.ts";

type Data = Record<string, unknown>;

class FakeDb {
  readonly docs = new Map<string, Data>();
  auto = 0;
  collection(name: string) {
    return { doc: (id?: string) => new Ref(this, `${name}/${id ?? `auto${++this.auto}`}`) };
  }
  async runTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    // Writes are buffered and applied only if fn resolves, like Firestore.
    const tx = new Tx(this);
    const result = await fn(tx);
    for (const [path, data] of tx.writes) this.docs.set(path, data);
    return result;
  }
}

class Ref {
  readonly db: FakeDb;
  readonly path: string;
  constructor(db: FakeDb, path: string) {
    this.db = db;
    this.path = path;
  }
  get id() {
    return this.path.split("/").pop()!;
  }
  async get() {
    const data = this.db.docs.get(this.path);
    return { exists: data !== undefined, data: () => (data === undefined ? undefined : { ...data }) };
  }
}

class Tx {
  readonly writes = new Map<string, Data>();
  readonly db: FakeDb;
  constructor(db: FakeDb) {
    this.db = db;
  }
  get(ref: Ref) {
    assert.equal(this.writes.size, 0, "a Firestore transaction must finish all its reads before its first write");
    return ref.get();
  }
  set(ref: Ref, data: Data) {
    this.writes.set(ref.path, { ...data });
  }
  update(ref: Ref, patch: Data) {
    const current = this.db.docs.get(ref.path);
    assert.ok(current, `update of a missing document: ${ref.path}`);
    for (const v of Object.values(patch)) assert.notEqual(v, undefined, "Firestore rejects undefined field values");
    this.writes.set(ref.path, { ...current, ...patch });
  }
}

const fake = new FakeDb();
const db = fake as unknown as Firestore;
const profile = (uid: string) => fake.docs.get(`users/${uid}/profile/data`)!;
const audits = () => [...fake.docs].filter(([p]) => p.startsWith("auditLog/")).map(([, d]) => d);

fake.docs.set("users/a1/profile/data", { gstStatus: "submitted", aadhaarStatus: "submitted" });

// A blank reason is refused before anything is written.
await assert.rejects(decideGst({ db, adminId: "adm", userId: "a1", decision: "rejected", reason: "   " }), ModerationError);
assert.equal(profile("a1").gstStatus, "submitted");
assert.equal(audits().length, 0);

// Rejection: status, the applicant-visible reason and the audit entry land together.
const first = await decideGst({ db, adminId: "adm", userId: "a1", decision: "rejected", reason: "  Name on GSTIN does not match PAN " });
assert.equal(profile("a1").gstStatus, "rejected");
assert.equal(profile("a1").gstReviewNote, "Name on GSTIN does not match PAN");
assert.equal(audits().length, 1);
assert.equal(fake.docs.get(`auditLog/${first.decisionId}`)?.action, "gst.rejected");

// Deciding again without a resubmission is an illegal transition and writes nothing.
await assert.rejects(decideGst({ db, adminId: "adm", userId: "a1", decision: "approved" }), IllegalTransitionError);
assert.equal(audits().length, 1);

// Resubmit, reject again: a new decision id, so the second email is not swallowed as a duplicate.
profile("a1").gstStatus = "submitted";
const second = await decideGst({ db, adminId: "adm", userId: "a1", decision: "rejected", reason: "Certificate expired" });
assert.notEqual(second.decisionId, first.decisionId);
assert.equal(profile("a1").gstReviewNote, "Certificate expired");

// Approval clears the stale reason.
profile("a1").gstStatus = "submitted";
await decideGst({ db, adminId: "adm", userId: "a1", decision: "approved" });
assert.equal(profile("a1").gstStatus, "approved");
assert.equal(profile("a1").gstReviewNote, null);

// KYC follows the same rules on its own fields, leaving GST alone.
await decideKyc({ db, adminId: "adm", userId: "a1", decision: "rejected", reason: "Aadhaar photo unreadable" });
assert.equal(profile("a1").aadhaarStatus, "rejected");
assert.equal(profile("a1").aadhaarReviewNote, "Aadhaar photo unreadable");
assert.equal(profile("a1").gstStatus, "approved");

// No profile → refused.
await assert.rejects(decideGst({ db, adminId: "adm", userId: "ghost", decision: "approved" }), ModerationError);

console.log("packages/db/moderation.ts: reasons reach the applicant, one id per decision, blank/out-of-order decisions refused");
