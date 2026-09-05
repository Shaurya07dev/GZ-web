// Customer address book — straightforward CRUD, one wrinkle: setting a new
// address as default un-defaults any existing default for that user in
// the same transaction, so there's never a moment (or a bug) where a user
// has two defaults or, after a failed partial write, zero.

import { and, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { addresses } from "./schema/identity.ts";

export class AddressError extends Error {}

export interface AddressInput {
  line1: string;
  line2?: string | undefined;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean | undefined;
}

// A hand-written partial rather than Partial<AddressInput>: under
// exactOptionalPropertyTypes, Partial<T>'s `?:` means "may be absent," not
// "may be explicitly undefined" — but a Zod .partial() schema (what every
// caller actually has, e.g. apps/api's PATCH body) produces exactly
// `T | undefined` per field. This type matches what callers really pass.
export type AddressPatch = { [K in keyof AddressInput]?: AddressInput[K] | undefined };

export async function listAddresses(db: Db, userId: string) {
  return db.select().from(addresses).where(eq(addresses.userId, userId));
}

export async function addAddress(db: Db, userId: string, input: AddressInput): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
    }
    const [row] = await tx
      .insert(addresses)
      .values({ userId, line1: input.line1, line2: input.line2 ?? null, city: input.city, state: input.state, pincode: input.pincode, isDefault: input.isDefault ?? false })
      .returning({ id: addresses.id });
    if (!row) throw new AddressError("insert into addresses returned no row");
    return row;
  });
}

export async function updateAddress(db: Db, userId: string, addressId: string, input: AddressPatch): Promise<void> {
  // exactOptionalPropertyTypes rejects passing an explicit `undefined` for
  // a field drizzle's column type doesn't itself allow undefined for
  // (`string | null`, not `string | null | undefined`) — a plain object
  // spread of a Partial<> can carry `undefined` values, so build the patch
  // by only including keys that were actually provided.
  const patch: Record<string, string | boolean> = {};
  if (input.line1 !== undefined) patch.line1 = input.line1;
  if (input.line2 !== undefined) patch.line2 = input.line2;
  if (input.city !== undefined) patch.city = input.city;
  if (input.state !== undefined) patch.state = input.state;
  if (input.pincode !== undefined) patch.pincode = input.pincode;
  if (input.isDefault !== undefined) patch.isDefault = input.isDefault;

  await db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
    }
    const result = await tx.update(addresses).set(patch).where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));
    if (result.count === 0) throw new AddressError(`No address ${addressId} for user ${userId}`);
  });
}

export async function deleteAddress(db: Db, userId: string, addressId: string): Promise<void> {
  const result = await db.delete(addresses).where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));
  if (result.count === 0) throw new AddressError(`No address ${addressId} for user ${userId}`);
}
