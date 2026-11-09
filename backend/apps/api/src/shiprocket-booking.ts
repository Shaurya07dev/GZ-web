// Shiprocket bookings. Each exported function books ONE leg:
//   - bookInboundShipment     → artist studio → aggregator gallery
//   - bookOutboundOrderShipment → artist studio → marketplace buyer
//   (aggregator in-gallery sale pickup+dropoff is booked by
//    packages/db/src/aggregator-sales.ts directly, for historical reasons.)
//
// Each extracted so callers stay readable, and so a failed booking logs
// clearly without masking the parent operation's success.

import { Timestamp } from "firebase-admin/firestore";
import { Collections, type AddressDoc, type ArtworkDoc, type Db, type OrderDoc, type ProfileDoc, type UserDoc } from "@galleryzone/db";
import { bookShipment, isShiprocketConfigured } from "./shiprocket.ts";

export async function bookInboundShipment(db: Db, holdingId: string, artworkId: string, aggregatorId: string): Promise<void> {
  // Without credentials there is nothing to book (the wrapper no longer fakes a
  // demo id), so stop before reading anything. Callers log this; the
  // reservation itself still stands.
  if (!isShiprocketConfigured()) throw new Error("ShipRocket is not configured; inbound booking was not created");
  // Resolve the three parties: artwork → artist, artist profile → studio
  // address, aggregator profile → gallery address.
  const [artworkSnap, aggProfileSnap, aggUserSnap] = await Promise.all([
    db.collection(Collections.artworks).doc(artworkId).get(),
    db.collection(`users/${aggregatorId}/profile`).doc("data").get(),
    db.collection(Collections.users).doc(aggregatorId).get(),
  ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  if (!artwork) throw new Error(`booking: no artwork ${artworkId}`);
  const [artistProfileSnap, artistUserSnap] = await Promise.all([
    db.collection(`users/${artwork.artistId}/profile`).doc("data").get(),
    db.collection(Collections.users).doc(artwork.artistId).get(),
  ]);
  const artistProfile = artistProfileSnap.data() as ProfileDoc | undefined;
  const artistUser = artistUserSnap.data() as UserDoc | undefined;
  const aggProfile = aggProfileSnap.data() as ProfileDoc | undefined;
  const aggUser = aggUserSnap.data() as UserDoc | undefined;
  if (!artistProfile?.pickupLine1 || !artistProfile.pickupPincode) {
    throw new Error(`booking: artist ${artwork.artistId} has no pickup address`);
  }
  const booked = await bookShipment({
    orderReference: `holding-${holdingId}`,
    pickup: {
      name: artistUser?.name ?? "GalleryZone Artist",
      phone: artistUser?.phone ?? "0000000000",
      line1: artistProfile.pickupLine1,
      line2: artistProfile.pickupLine2,
      city: artistProfile.pickupCity ?? "",
      state: artistProfile.pickupState ?? "",
      pincode: artistProfile.pickupPincode,
    },
    dropoff: {
      name: aggProfile?.companyName ?? aggUser?.name ?? "Aggregator",
      phone: aggUser?.phone ?? "0000000000",
      line1: aggProfile?.pickupLine1 ?? "",
      line2: aggProfile?.pickupLine2,
      city: aggProfile?.pickupCity ?? "",
      state: aggProfile?.pickupState ?? "",
      pincode: aggProfile?.pickupPincode ?? "",
    },
    weightKg: artwork.physical?.weightKg ?? 2,
    artworkTitle: artwork.title,
    valueInr: Math.round(artwork.listing?.displayPricePaise ? artwork.listing.displayPricePaise / 100 : 1),
  });
  // Mirror what the webhook writes, so the UI tracker lights up immediately
  // (the AWB is already issued by this point; the webhook will push stage
  // transitions as the courier moves the parcel).
  await db
    .collection(Collections.aggregatorHoldings)
    .doc(holdingId)
    .set(
      {
        inboundShiprocketStage: booked.stage,
        inboundTrackingId: booked.trackingId,
        inboundCarrier: booked.carrier,
        inboundTrackedAt: Timestamp.now(),
      },
      { merge: true },
    );
}

/**
 * Books the artist → buyer leg for a marketplace purchase once the
 * customer payment has settled. Previously, admin had to create the
 * Shiprocket shipment by hand from the dashboard and then click
 * "Mark as packed / shipped / delivered" on the admin order page. This
 * runs the same bookShipment() call used for the inbound leg, keyed by
 * `order-<orderId>` so the courier-webhook controller can route events
 * back to the Order doc.
 *
 * Fire-and-forget by the caller: a Shiprocket outage must never fail
 * the payment settlement. 9 Nov 2026.
 */
export async function bookOutboundOrderShipment(db: Db, orderId: string): Promise<void> {
  if (!isShiprocketConfigured()) throw new Error("ShipRocket is not configured; outbound order booking was not created");

  const orderSnap = await db.collection(Collections.orders).doc(orderId).get();
  const order = orderSnap.data() as OrderDoc | undefined;
  if (!order) throw new Error(`booking: no order ${orderId}`);

  const [artworkSnap, addressSnap, buyerSnap] = await Promise.all([
    db.collection(Collections.artworks).doc(order.artworkId).get(),
    db.collection(Collections.addresses).doc(order.addressId).get(),
    db.collection(Collections.users).doc(order.customerId).get(),
  ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  const address = addressSnap.data() as (AddressDoc & { userId?: string }) | undefined;
  const buyer = buyerSnap.data() as UserDoc | undefined;
  if (!artwork) throw new Error(`booking: no artwork ${order.artworkId}`);
  if (!address) throw new Error(`booking: no address ${order.addressId}`);

  const [artistProfileSnap, artistUserSnap] = await Promise.all([
    db.collection(`users/${artwork.artistId}/profile`).doc("data").get(),
    db.collection(Collections.users).doc(artwork.artistId).get(),
  ]);
  const artistProfile = artistProfileSnap.data() as ProfileDoc | undefined;
  const artistUser = artistUserSnap.data() as UserDoc | undefined;
  if (!artistProfile?.pickupLine1 || !artistProfile.pickupPincode) {
    throw new Error(`booking: artist ${artwork.artistId} has no pickup address`);
  }

  const booked = await bookShipment({
    orderReference: `order-${orderId}`,
    pickup: {
      name: artistUser?.name ?? "GalleryZone Artist",
      phone: artistUser?.phone ?? "0000000000",
      line1: artistProfile.pickupLine1,
      line2: artistProfile.pickupLine2,
      city: artistProfile.pickupCity ?? "",
      state: artistProfile.pickupState ?? "",
      pincode: artistProfile.pickupPincode,
    },
    dropoff: {
      name: buyer?.name ?? "GalleryZone Buyer",
      phone: buyer?.phone ?? "0000000000",
      line1: address.line1,
      line2: address.line2 ?? null,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    },
    weightKg: artwork.physical?.weightKg ?? 2,
    artworkTitle: artwork.title,
    valueInr: Math.max(1, Math.round(order.totalPaise / 100)),
  });

  // Same mirror pattern as the inbound booking — the webhook will push
  // stage transitions as the courier moves the parcel.
  await db.collection(Collections.orders).doc(orderId).set(
    {
      shiprocketStage: booked.stage,
      shiprocketTrackingId: booked.trackingId,
      shiprocketCarrier: booked.carrier,
      shiprocketTrackedAt: Timestamp.now(),
    },
    { merge: true },
  );
}
