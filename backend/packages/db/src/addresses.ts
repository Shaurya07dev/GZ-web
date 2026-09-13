// Customer address book — Firestore version. Setting a new address as
// default un-defaults any existing default for that user, done inside a
// Firestore transaction so there's never a moment with two defaults.

import type { Firestore, Transaction } from "firebase-admin/firestore";
import { Collections, type AddressDoc } from "./collections.ts";

export class AddressError extends Error {}

export interface AddressInput {
  line1: string;
  line2?: string | undefined;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean | undefined;
}

export type AddressPatch = { [K in keyof AddressInput]?: AddressInput[K] | undefined };

export async function listAddresses(db: Firestore, userId: string): Promise<(AddressDoc & { id: string })[]> {
  const snap = await db.collection(Collections.addresses).where("userId", "==", userId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AddressDoc) }));
}

async function unsetExistingDefault(db: Firestore, tx: Transaction, userId: string): Promise<void> {
  const snap = await tx.get(db.collection(Collections.addresses).where("userId", "==", userId).where("isDefault", "==", true));
  snap.docs.forEach((doc) => tx.update(doc.ref, { isDefault: false }));
}

export async function addAddress(db: Firestore, userId: string, input: AddressInput): Promise<{ id: string }> {
  const ref = db.collection(Collections.addresses).doc();
  await db.runTransaction(async (tx) => {
    if (input.isDefault) await unsetExistingDefault(db, tx, userId);
    const doc: AddressDoc = { userId, line1: input.line1, line2: input.line2 ?? null, city: input.city, state: input.state, pincode: input.pincode, isDefault: input.isDefault ?? false };
    tx.set(ref, doc);
  });
  return { id: ref.id };
}

export async function updateAddress(db: Firestore, userId: string, addressId: string, input: AddressPatch): Promise<void> {
  const ref = db.collection(Collections.addresses).doc(addressId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || (snap.data() as AddressDoc).userId !== userId) {
      throw new AddressError(`No address ${addressId} for user ${userId}`);
    }
    if (input.isDefault) await unsetExistingDefault(db, tx, userId);
    const patch: Record<string, string | boolean> = {};
    if (input.line1 !== undefined) patch.line1 = input.line1;
    if (input.line2 !== undefined) patch.line2 = input.line2;
    if (input.city !== undefined) patch.city = input.city;
    if (input.state !== undefined) patch.state = input.state;
    if (input.pincode !== undefined) patch.pincode = input.pincode;
    if (input.isDefault !== undefined) patch.isDefault = input.isDefault;
    tx.update(ref, patch);
  });
}

export async function deleteAddress(db: Firestore, userId: string, addressId: string): Promise<void> {
  const ref = db.collection(Collections.addresses).doc(addressId);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as AddressDoc).userId !== userId) {
    throw new AddressError(`No address ${addressId} for user ${userId}`);
  }
  await ref.delete();
}
