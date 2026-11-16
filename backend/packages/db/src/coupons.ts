// Admin-created marketplace coupons — create / list / pause / validate / apply.
// Pure DB plumbing; the discount math is `computeCouponDiscount` in
// packages/domain so settlement.check.ts can exercise it without Firestore.
//
// Design notes (16 Nov 2026):
//
//   * Doc id is the code, lowercased. Entering "DIWALI25" or "diwali25" both
//     hit the same row. The `code` field mirrors the id so dumping rows reads
//     naturally.
//
//   * Discount is absorbed by platform_revenue at checkout time — see
//     marketplaceCheckoutPostings. Artists and aggregators never see a cut
//     to their payout, regardless of the coupon's size.
//
//   * `usedCount` is incremented inside the same checkout transaction that
//     posts the sale. Reserving at `/v1/coupons/apply` time would need a
//     separate release path on abandoned carts; we keep it simpler by
//     claiming at payment capture. Trade-off: two buyers racing on the
//     last redemption of a capped coupon both see "valid" at apply but the
//     slower of the two gets refused at checkout. Acceptable for MVP.

import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { computeCouponDiscount, type CouponInput } from "@galleryzone/domain";
import { Collections, type CouponDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class CouponError extends DbError {
  constructor(message: string, readonly code: CouponErrorCode) {
    super(message);
  }
}

export type CouponErrorCode =
  | "not_found"
  | "paused"
  | "expired"
  | "not_yet_valid"
  | "usage_cap_reached"
  | "below_floor"
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
  usedCount: number;
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
    usedCount: doc.usedCount,
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
      "already_exists",
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
    usedCount: 0,
    status: "active",
    createdBy: adminId,
    createdAt: Timestamp.now(),
  };
  try {
    await ref.create(doc);
  } catch (error) {
    // Firestore ALREADY_EXISTS when the code is taken.
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

/**
 * Read + validate a coupon for a checkout attempt. Returns the discount in
 * paise AND the raw doc, so the caller can both quote the amount and claim
 * it atomically at payment-capture time without re-reading. Throws
 * CouponError with a specific code when the coupon is unusable.
 */
export async function validateCoupon(
  db: Firestore,
  input: { code: string; subtotalPaise: number; now?: Date },
): Promise<{ discountPaise: number; coupon: CouponView }> {
  const id = input.code.trim().toLowerCase();
  const snap = await db.collection(Collections.coupons).doc(id).get();
  const doc = snap.data() as CouponDoc | undefined;
  if (!doc) throw new CouponError("That code doesn't exist.", "not_found");
  const view = toView(id, doc);
  assertUsable(doc, input.subtotalPaise, input.now ?? new Date());
  const discountPaise = computeCouponDiscount({ coupon: toCouponInput(doc), subtotalPaise: input.subtotalPaise });
  return { discountPaise, coupon: view };
}

function toCouponInput(doc: CouponDoc): CouponInput {
  return {
    kind: doc.kind,
    value: doc.value,
    maxDiscountPaise: doc.maxDiscountPaise,
  };
}

function assertUsable(doc: CouponDoc, subtotalPaise: number, now: Date): void {
  if (doc.status === "paused") throw new CouponError("That code is paused right now.", "paused");
  if (doc.status === "expired") throw new CouponError("That code has expired.", "expired");
  if (now.getTime() < doc.validFrom.toMillis()) throw new CouponError("That code isn't live yet.", "not_yet_valid");
  if (now.getTime() > doc.validUntil.toMillis()) throw new CouponError("That code has expired.", "expired");
  if (doc.usageCap !== null && doc.usedCount >= doc.usageCap) {
    throw new CouponError("That code has been fully redeemed.", "usage_cap_reached");
  }
  if (doc.minOrderPaise !== null && subtotalPaise < doc.minOrderPaise) {
    throw new CouponError(
      `This piece is below the minimum order for that code.`,
      "below_floor",
    );
  }
}

/**
 * Claim one unit of a coupon's usage inside a Firestore transaction.
 * Called from the checkout payment-capture path. Re-reads the coupon
 * transactionally so two concurrent captures can't both slip through a
 * usageCap boundary. Throws CouponError when the claim can't be made.
 */
export async function claimCouponUsage(
  db: Firestore,
  tx: Transaction,
  input: { code: string; subtotalPaise: number; now?: Date },
): Promise<number> {
  const id = input.code.trim().toLowerCase();
  const ref = db.collection(Collections.coupons).doc(id);
  const snap = await tx.get(ref);
  const doc = snap.data() as CouponDoc | undefined;
  if (!doc) throw new CouponError("That code doesn't exist.", "not_found");
  assertUsable(doc, input.subtotalPaise, input.now ?? new Date());
  tx.update(ref, { usedCount: FieldValue.increment(1) });
  return computeCouponDiscount({ coupon: toCouponInput(doc), subtotalPaise: input.subtotalPaise });
}
