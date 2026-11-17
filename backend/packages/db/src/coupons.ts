// Admin-created marketplace + aggregator coupons.
//
// Design notes (16 Nov 2026):
//
//   * Doc id is the code, lowercased — case-insensitive lookups without a
//     second index. "DIWALI25" and "diwali25" are the same coupon.
//
//   * Discount is absorbed by platform_revenue in the ledger (see
//     marketplaceCheckoutPostings + aggregatorSalePostings). Artists and
//     aggregators always get their full settlement, regardless of coupon
//     size — the admin is spending GalleryZone's margin, not someone else's.
//
//   * Each successful redemption is written as a doc under
//     `coupons/{code}/redemptions/{refId}` inside the same transaction that
//     bumps `usedCount`. That gives us two things for free:
//       (a) atomic enforcement of usageCap / perUserCap (the TX re-reads
//           both the coupon and the user's prior redemptions — two concurrent
//           checkouts can't both sneak past a cap),
//       (b) refunds: delete the redemption doc + decrement usedCount in one
//           TX, idempotent on the refId.

import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { computeCouponDiscount, type CouponInput } from "@galleryzone/domain";
import {
  Collections,
  couponRedemptionsCol,
  type CouponDoc,
  type CouponRedemptionDoc,
} from "./collections.ts";
import { DbError } from "./errors.ts";

export class CouponError extends DbError {
  readonly code: CouponErrorCode;
  constructor(message: string, code: CouponErrorCode) {
    super(message);
    this.code = code;
  }
}

export type CouponErrorCode =
  | "not_found"
  | "paused"
  | "expired"
  | "not_yet_valid"
  | "usage_cap_reached"
  | "per_user_cap_reached"
  | "below_floor"
  | "wrong_scope"
  | "wrong_artist"
  | "invalid"
  | "already_exists";

export interface CouponView {
  code: string;
  kind: CouponDoc["kind"];
  value: number;
  minOrderPaise: number | null;
  maxDiscountPaise: number | null;
  validFrom: string;
  validUntil: string;
  usageCap: number | null;
  perUserCap: number | null;
  usedCount: number;
  scope: CouponDoc["scope"];
  artistIds: string[] | null;
  status: CouponDoc["status"];
  createdBy: string;
  createdAt: string;
}

function toView(id: string, doc: CouponDoc): CouponView {
  return {
    code: id,
    kind: doc.kind,
    value: doc.value,
    minOrderPaise: doc.minOrderPaise,
    maxDiscountPaise: doc.maxDiscountPaise,
    validFrom: doc.validFrom.toDate().toISOString(),
    validUntil: doc.validUntil.toDate().toISOString(),
    usageCap: doc.usageCap,
    perUserCap: doc.perUserCap,
    usedCount: doc.usedCount,
    scope: doc.scope,
    artistIds: doc.artistIds,
    status: doc.status,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toDate().toISOString(),
  };
}

export interface CreateCouponInput {
  code: string;
  kind: CouponDoc["kind"];
  value: number;
  minOrderPaise: number | null;
  maxDiscountPaise: number | null;
  validFrom: Date;
  validUntil: Date;
  usageCap: number | null;
  perUserCap: number | null;
  scope: CouponDoc["scope"];
  artistIds: string[] | null;
}

export async function createCoupon(
  db: Firestore,
  input: CreateCouponInput,
  adminId: string,
): Promise<CouponView> {
  const code = input.code.trim().toLowerCase();
  if (!/^[a-z0-9]{3,24}$/.test(code)) {
    throw new CouponError(
      "Coupon codes must be 3–24 characters, letters and digits only.",
      "invalid",
    );
  }
  const ref = db.collection(Collections.coupons).doc(code);
  const doc: CouponDoc = {
    code,
    kind: input.kind,
    value: input.value,
    minOrderPaise: input.minOrderPaise,
    maxDiscountPaise: input.maxDiscountPaise,
    validFrom: Timestamp.fromDate(input.validFrom),
    validUntil: Timestamp.fromDate(input.validUntil),
    usageCap: input.usageCap,
    perUserCap: input.perUserCap,
    usedCount: 0,
    scope: input.scope,
    artistIds: input.artistIds && input.artistIds.length > 0 ? input.artistIds : null,
    status: "active",
    createdBy: adminId,
    createdAt: Timestamp.now(),
  };
  try {
    await ref.create(doc);
  } catch (error) {
    if ((error as { code?: number } | null)?.code === 6) {
      throw new CouponError(`Coupon "${code}" already exists.`, "already_exists");
    }
    throw error;
  }
  return toView(code, doc);
}

export async function listCoupons(db: Firestore): Promise<CouponView[]> {
  const snap = await db.collection(Collections.coupons).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => toView(d.id, d.data() as CouponDoc));
}

export async function setCouponStatus(
  db: Firestore,
  code: string,
  status: CouponDoc["status"],
): Promise<CouponView> {
  const id = code.trim().toLowerCase();
  const ref = db.collection(Collections.coupons).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new CouponError("No such coupon.", "not_found");
  await ref.update({ status });
  const after = (await ref.get()).data() as CouponDoc;
  return toView(id, after);
}

export interface ValidateCouponContext {
  channel: "marketplace" | "aggregator";
  artistId: string;
  userId: string;
}

/**
 * Read + validate a coupon for a checkout attempt. Returns the discount in
 * paise AND the validated view. Throws CouponError with a specific code
 * when the coupon is unusable. Does NOT reserve the slot — reservation is
 * `redeemCouponTx` called at payment capture.
 */
export async function validateCoupon(
  db: Firestore,
  input: {
    code: string;
    subtotalPaise: number;
    context: ValidateCouponContext;
    now?: Date;
  },
): Promise<{ discountPaise: number; coupon: CouponView }> {
  const id = input.code.trim().toLowerCase();
  const snap = await db.collection(Collections.coupons).doc(id).get();
  const doc = snap.data() as CouponDoc | undefined;
  if (!doc) throw new CouponError("That code doesn't exist.", "not_found");
  assertUsable(doc, input.subtotalPaise, input.context, input.now ?? new Date());

  // Per-user cap — a count query against the redemptions subcollection
  // scoped to this user. Deliberately NOT inside a TX: validateCoupon is
  // the optimistic "does this look good" check, the atomic enforcement
  // is `redeemCouponTx` at payment capture. Two concurrent checkouts
  // from the same user race here harmlessly.
  if (doc.perUserCap !== null) {
    const priorSnap = await db
      .collection(couponRedemptionsCol(id))
      .where("userId", "==", input.context.userId)
      .get();
    if (priorSnap.size >= doc.perUserCap) {
      throw new CouponError("You've used that code already.", "per_user_cap_reached");
    }
  }

  const discountPaise = computeCouponDiscount({
    coupon: toCouponInput(doc),
    subtotalPaise: input.subtotalPaise,
  });
  return { discountPaise, coupon: toView(id, doc) };
}

function toCouponInput(doc: CouponDoc): CouponInput {
  return {
    kind: doc.kind,
    value: doc.value,
    maxDiscountPaise: doc.maxDiscountPaise,
  };
}

function assertUsable(
  doc: CouponDoc,
  subtotalPaise: number,
  context: ValidateCouponContext,
  now: Date,
): void {
  if (doc.status === "paused") throw new CouponError("That code is paused right now.", "paused");
  if (doc.status === "expired") throw new CouponError("That code has expired.", "expired");
  if (now.getTime() < doc.validFrom.toMillis()) {
    throw new CouponError("That code isn't live yet.", "not_yet_valid");
  }
  if (now.getTime() > doc.validUntil.toMillis()) {
    throw new CouponError("That code has expired.", "expired");
  }
  if (doc.usageCap !== null && doc.usedCount >= doc.usageCap) {
    throw new CouponError("That code has been fully redeemed.", "usage_cap_reached");
  }
  if (doc.minOrderPaise !== null && subtotalPaise < doc.minOrderPaise) {
    throw new CouponError("This piece is below the minimum order for that code.", "below_floor");
  }
  if (doc.scope !== "both" && doc.scope !== context.channel) {
    throw new CouponError(
      `That code works on ${scopeLabel(doc.scope)} only.`,
      "wrong_scope",
    );
  }
  if (doc.artistIds && doc.artistIds.length > 0 && !doc.artistIds.includes(context.artistId)) {
    throw new CouponError("That code doesn't apply to this artist.", "wrong_artist");
  }
}

function scopeLabel(scope: CouponDoc["scope"]): string {
  return scope === "marketplace" ? "marketplace purchases" : "aggregator sales";
}

/**
 * Claim one unit of a coupon's usage inside a Firestore transaction.
 * Called at payment-capture time. Writes a redemption doc keyed by
 * `refId` (orderId for marketplace, holdingId for aggregator) and bumps
 * `usedCount`. Idempotent: a replayed capture finds the redemption doc
 * already there and skips (zero-discount return — caller shouldn't
 * re-apply on top).
 *
 * The TX re-reads the coupon and the user's prior redemptions, so two
 * concurrent captures can't both slip past usageCap or perUserCap.
 */
export async function redeemCouponTx(
  db: Firestore,
  tx: Transaction,
  input: {
    code: string;
    refId: string;
    subtotalPaise: number;
    context: ValidateCouponContext;
    now?: Date;
  },
): Promise<{ discountPaise: number; alreadyRecorded: boolean }> {
  const id = input.code.trim().toLowerCase();
  const couponRef = db.collection(Collections.coupons).doc(id);
  const redemptionRef = db.collection(couponRedemptionsCol(id)).doc(input.refId);
  const [couponSnap, redemptionSnap] = await Promise.all([
    tx.get(couponRef),
    tx.get(redemptionRef),
  ]);
  const doc = couponSnap.data() as CouponDoc | undefined;
  if (!doc) throw new CouponError("That code doesn't exist.", "not_found");
  if (redemptionSnap.exists) {
    const existing = redemptionSnap.data() as CouponRedemptionDoc;
    return { discountPaise: existing.discountPaise, alreadyRecorded: true };
  }
  assertUsable(doc, input.subtotalPaise, input.context, input.now ?? new Date());

  // Per-user cap again, this time inside the TX so a second concurrent
  // redemption for the same user retries and sees the first one. The
  // query is scoped to the user and consumed inside the TX.
  if (doc.perUserCap !== null) {
    const priorSnap = await tx.get(
      db.collection(couponRedemptionsCol(id)).where("userId", "==", input.context.userId),
    );
    if (priorSnap.size >= doc.perUserCap) {
      throw new CouponError("You've used that code already.", "per_user_cap_reached");
    }
  }

  const discountPaise = computeCouponDiscount({
    coupon: toCouponInput(doc),
    subtotalPaise: input.subtotalPaise,
  });
  const redemption: CouponRedemptionDoc = {
    userId: input.context.userId,
    channel: input.context.channel,
    discountPaise,
    redeemedAt: Timestamp.now(),
    refId: input.refId,
  };
  tx.create(redemptionRef, redemption);
  tx.update(couponRef, { usedCount: FieldValue.increment(1) });
  return { discountPaise, alreadyRecorded: false };
}

/**
 * Reverse a redemption on refund. Idempotent: a double-call finds the
 * redemption doc already gone and returns 0.
 */
export async function releaseCouponRedemption(
  db: Firestore,
  input: { code: string; refId: string },
): Promise<number> {
  const id = input.code.trim().toLowerCase();
  const couponRef = db.collection(Collections.coupons).doc(id);
  const redemptionRef = db.collection(couponRedemptionsCol(id)).doc(input.refId);
  let released = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(redemptionRef);
    if (!snap.exists) return;
    const data = snap.data() as CouponRedemptionDoc;
    released = data.discountPaise;
    tx.delete(redemptionRef);
    tx.update(couponRef, { usedCount: FieldValue.increment(-1) });
  });
  return released;
}
