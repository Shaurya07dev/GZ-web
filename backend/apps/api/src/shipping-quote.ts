// Shared shipping-quote resolver used by:
//   * orders.controller.ts  — /v1/orders/quote and POST /v1/orders
//   * payments/payments.controller.ts — /v1/orders/:id/payment/session, so that
//     a pending order is re-quoted against current Shiprocket rates every time
//     the buyer clicks "Complete payment" (client-flagged 13 Nov 2026: an old
//     pending order showed the fresh ₹286 review but opened Razorpay at the
//     old ₹164 — the frozen snapshot has to stop being the source of truth
//     on resume).

import {
  Collections,
  type AddressDoc,
  type ArtworkDoc,
  type Db,
  type ProfileDoc,
} from "@galleryzone/db";
import { getShippingRate, isShiprocketConfigured } from "./shiprocket.ts";

export interface ShippingQuoteSnapshot {
  carrier: string;
  ratePaise: number;
  courierCompanyId: number;
  estimatedDeliveryDays: number | null;
}

export type ShippingQuoteFailureReason =
  | "no_pickup_pincode"
  | "no_drop_pincode"
  | "not_serviceable"
  | "shiprocket_error";

export interface ShippingQuoteResolution {
  quote: ShippingQuoteSnapshot | undefined;
  reason: ShippingQuoteFailureReason | undefined;
}

/**
 * Resolve the four inputs Shiprocket's serviceability endpoint needs
 * (pickup pincode, drop pincode, parcel weight, declared value) and return
 * the cheapest courier's quote.
 *
 * Bails on the first missing piece rather than guessing a default: a wrong
 * pincode would return a plausible-looking but wrong rate, and a wrong rate
 * silently debits the wrong amount at checkout.
 *
 * Returns `{ quote: undefined, reason: undefined }` when Shiprocket isn't
 * configured at all — a local-dev/offline fallback. Live, callers should
 * refuse to proceed on an undefined quote (see orders.controller).
 */
export async function resolveShippingQuote(
  db: Db,
  input: { artworkId: string; addressId: string; customerId: string },
): Promise<ShippingQuoteResolution> {
  if (!isShiprocketConfigured()) {
    return { quote: undefined, reason: undefined };
  }
  const [artworkSnap, addressSnap] = await Promise.all([
    db.collection(Collections.artworks).doc(input.artworkId).get(),
    db.collection(Collections.addresses).doc(input.addressId).get(),
  ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  const address = addressSnap.data() as (AddressDoc & { userId?: string }) | undefined;
  if (!artwork || !address || address.userId !== input.customerId) {
    return { quote: undefined, reason: undefined };
  }

  const artistProfileSnap = await db
    .collection(`users/${artwork.artistId}/profile`)
    .doc("data")
    .get();
  const artistProfile = artistProfileSnap.data() as ProfileDoc | undefined;
  const pickupPincode = artistProfile?.pickupPincode?.trim();
  const dropPincode = address.pincode?.trim();
  if (!pickupPincode) return { quote: undefined, reason: "no_pickup_pincode" };
  if (!dropPincode) return { quote: undefined, reason: "no_drop_pincode" };

  const weightKg = artwork.physical?.weightKg ?? 2;
  const valueInr = artwork.listing?.displayPricePaise
    ? Math.max(1, Math.round(artwork.listing.displayPricePaise / 100))
    : 1;

  const quote = await getShippingRate({ pickupPincode, dropPincode, weightKg, valueInr });
  if (!quote) return { quote: undefined, reason: "not_serviceable" };
  return {
    quote: {
      carrier: quote.carrier,
      ratePaise: quote.ratePaise,
      courierCompanyId: quote.courierCompanyId,
      estimatedDeliveryDays: quote.estimatedDeliveryDays,
    },
    reason: undefined,
  };
}
