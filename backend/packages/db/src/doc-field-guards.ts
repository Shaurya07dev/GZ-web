// Field-presence guards for every GST document the platform issues.
//
// The four stamping modules (invoices, delivery-challans, purchase-bills,
// aggregator-commission-invoices) each build a party block out of a
// user's profile. Without a guard, a half-complete profile silently
// freezes empty strings into the snapshot — the PDF is then forever
// legally defective (Rule 46 requires the party's full address).
//
// These helpers do the pre-stamp check: if any required field is
// missing, they throw with the specific field name named in the
// message so ops can tell the user exactly what to fill in. Each
// stamper passes its own Error constructor so the caller can catch
// per doc type.

import type { AddressDoc, ProfileDoc } from "./collections.ts";

type ErrorCtor = new (message: string) => Error;

/**
 * Required pickup-address fields on a user profile. These are the
 * street / city / state / pincode that have to print on every GST
 * document the user is a party on. `pickupLine2` is intentionally
 * optional — many artists work from flats without a second line.
 */
const REQUIRED_PICKUP_FIELDS: Array<{
  key: keyof ProfileDoc;
  label: string;
}> = [
  { key: "pickupLine1", label: "pickup address line 1" },
  { key: "pickupCity", label: "pickup city" },
  { key: "pickupState", label: "pickup state" },
  { key: "pickupPincode", label: "pickup pincode" },
];

/**
 * Throws if any required pickup-address field is blank / whitespace
 * on the supplied profile. `role` is the user-facing label ("Artist",
 * "Aggregator") used in the error message. `ErrorClass` is the
 * stamper's own error constructor (InvoiceError, PurchaseBillError,
 * etc.) so the thrown type matches the module's existing contract.
 */
export function assertCompletePickupProfile(
  role: string,
  profile: ProfileDoc | undefined,
  ErrorClass: ErrorCtor,
): asserts profile is ProfileDoc {
  if (!profile) {
    throw new ErrorClass(
      `${role} profile is missing — nothing to stamp this document against.`,
    );
  }
  const missing = REQUIRED_PICKUP_FIELDS.filter(
    ({ key }) => !((profile[key] as string | null | undefined) ?? "").trim(),
  ).map(({ label }) => label);
  if (missing.length > 0) {
    throw new ErrorClass(
      `${role} profile is missing ${missing.join(", ")}. Complete the pickup address in the profile before issuing this document.`,
    );
  }
}

/**
 * Throws if any required buyer-address field is blank. Buyer
 * addresses live on AddressDoc, not ProfileDoc — different type,
 * different field names — hence a sibling helper rather than one
 * polymorphic function.
 */
export function assertCompleteBuyerAddress(
  address: AddressDoc | undefined,
  ErrorClass: ErrorCtor,
): asserts address is AddressDoc {
  if (!address) {
    throw new ErrorClass(
      "Buyer delivery address is missing — nothing to stamp this document against.",
    );
  }
  const missing: string[] = [];
  if (!(address.line1 ?? "").trim()) missing.push("line 1");
  if (!(address.city ?? "").trim()) missing.push("city");
  if (!(address.state ?? "").trim()) missing.push("state");
  if (!(address.pincode ?? "").trim()) missing.push("pincode");
  if (missing.length > 0) {
    throw new ErrorClass(
      `Buyer address is missing ${missing.join(", ")}. The buyer re-entered the address incomplete; ask them to re-save delivery details before issuing this invoice.`,
    );
  }
}

/**
 * Render-side fallback. If a field was SOMEHOW persisted blank
 * (legacy snapshot before these guards, or a bypass), the renderer
 * calls this so the PDF visibly flags it ("— MISSING —") rather
 * than shipping blank paper. Ops sees this in a visual review and
 * can re-issue the document with a fixed profile.
 *
 * `value` of null is treated as "legitimately absent" (e.g.
 * addressLine2) and returns null so the renderer omits the line
 * entirely. Only empty-strings get the visible marker.
 */
export function textOrMissing(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return "— MISSING —";
  return trimmed;
}
