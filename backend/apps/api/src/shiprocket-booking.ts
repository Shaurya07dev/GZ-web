// Shiprocket bookings. Each exported function books ONE leg:
//   - bookInboundShipment     → artist studio → aggregator gallery
//   - bookOutboundOrderShipment → artist studio → marketplace buyer
//   (aggregator in-gallery sale pickup+dropoff is booked by
//    packages/db/src/aggregator-sales.ts directly, for historical reasons.)
//
// Each extracted so callers stay readable, and so a failed booking logs
// clearly without masking the parent operation's success.

import { Timestamp } from "firebase-admin/firestore";
import { Collections, type AddressDoc, type AggregatorHoldingDoc, type AggregatorSaleDoc, type ArtworkDoc, type Db, type OrderDoc, type ProfileDoc, type UserDoc } from "@galleryzone/db";
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

/**
 * Books the aggregator gallery → buyer leg for a sale recorded at the
 * gallery. Keyed by `sale-<saleId>` so the webhook controller routes
 * events back to the AggregatorSaleDoc the sale lives on. The pickup is
 * the aggregator's own gallery (profile.pickup*); the drop is the buyer
 * address the sale was recorded with.
 *
 * Only called for courier mode — self-pickup means the buyer collects at
 * the gallery and no Shiprocket is needed. 9 Nov 2026.
 */
export async function bookOutboundAggregatorSaleShipment(db: Db, saleId: string): Promise<void> {
  if (!isShiprocketConfigured()) throw new Error("ShipRocket is not configured; aggregator sale booking was not created");

  const saleSnap = await db.collection(Collections.aggregatorSales).doc(saleId).get();
  const sale = saleSnap.data() as AggregatorSaleDoc | undefined;
  if (!sale) throw new Error(`booking: no sale ${saleId}`);
  if (!sale.deliveryAddressLine1 || !sale.deliveryCity || !sale.deliveryState || !sale.deliveryPincode) {
    throw new Error(`booking: sale ${saleId} has no structured delivery address`);
  }

  const holdingSnap = await db.collection(Collections.aggregatorHoldings).doc(sale.holdingId).get();
  const holding = holdingSnap.data() as AggregatorHoldingDoc | undefined;
  if (!holding) throw new Error(`booking: no holding ${sale.holdingId}`);

  const [artworkSnap, aggProfileSnap, aggUserSnap] = await Promise.all([
    db.collection(Collections.artworks).doc(holding.artworkId).get(),
    db.collection(`users/${holding.aggregatorId}/profile`).doc("data").get(),
    db.collection(Collections.users).doc(holding.aggregatorId).get(),
  ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  const aggProfile = aggProfileSnap.data() as ProfileDoc | undefined;
  const aggUser = aggUserSnap.data() as UserDoc | undefined;
  if (!artwork) throw new Error(`booking: no artwork ${holding.artworkId}`);
  if (!aggProfile?.pickupLine1 || !aggProfile.pickupPincode) {
    throw new Error(`booking: aggregator ${holding.aggregatorId} has no pickup address`);
  }

  const booked = await bookShipment({
    orderReference: `sale-${saleId}`,
    pickup: {
      name: aggProfile.companyName ?? aggUser?.name ?? "GalleryZone Aggregator",
      phone: aggUser?.phone ?? "0000000000",
      line1: aggProfile.pickupLine1,
      line2: aggProfile.pickupLine2,
      city: aggProfile.pickupCity ?? "",
      state: aggProfile.pickupState ?? "",
      pincode: aggProfile.pickupPincode,
    },
    dropoff: {
      name: sale.buyerName,
      phone: sale.buyerPhone ?? "0000000000",
      line1: sale.deliveryAddressLine1,
      line2: sale.deliveryAddressLine2 ?? null,
      city: sale.deliveryCity,
      state: sale.deliveryState,
      pincode: sale.deliveryPincode,
    },
    weightKg: artwork.physical?.weightKg ?? 2,
    artworkTitle: artwork.title,
    valueInr: Math.max(1, Math.round(sale.soldPricePaise / 100)),
  });

  await db.collection(Collections.aggregatorSales).doc(saleId).set(
    {
      shiprocketStage: booked.stage,
      trackingId: booked.trackingId,
      carrier: booked.carrier,
      trackedAt: Timestamp.now(),
    },
    { merge: true },
  );
}

/**
 * Books the return leg (aggregator gallery → artist studio) when an
 * aggregator returns an unsold piece. Keyed by `holding-<holdingId>` so
 * it shares the same tracking row the inbound booking wrote — the
 * webhook controller already handles the inbound stage field, and a
 * return naturally overwrites it (the holding is leaving the aggregator
 * anyway). Fire-and-forget. 9 Nov 2026.
 */
export async function bookReturnShipment(db: Db, holdingId: string): Promise<void> {
  if (!isShiprocketConfigured()) throw new Error("ShipRocket is not configured; return booking was not created");

  const holdingSnap = await db.collection(Collections.aggregatorHoldings).doc(holdingId).get();
  const holding = holdingSnap.data() as AggregatorHoldingDoc | undefined;
  if (!holding) throw new Error(`booking: no holding ${holdingId}`);

  const [artworkSnap, aggProfileSnap, aggUserSnap] = await Promise.all([
    db.collection(Collections.artworks).doc(holding.artworkId).get(),
    db.collection(`users/${holding.aggregatorId}/profile`).doc("data").get(),
    db.collection(Collections.users).doc(holding.aggregatorId).get(),
  ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  const aggProfile = aggProfileSnap.data() as ProfileDoc | undefined;
  const aggUser = aggUserSnap.data() as UserDoc | undefined;
  if (!artwork) throw new Error(`booking: no artwork ${holding.artworkId}`);

  const [artistProfileSnap, artistUserSnap] = await Promise.all([
    db.collection(`users/${artwork.artistId}/profile`).doc("data").get(),
    db.collection(Collections.users).doc(artwork.artistId).get(),
  ]);
  const artistProfile = artistProfileSnap.data() as ProfileDoc | undefined;
  const artistUser = artistUserSnap.data() as UserDoc | undefined;

  if (!aggProfile?.pickupLine1 || !aggProfile.pickupPincode) {
    throw new Error(`booking: aggregator ${holding.aggregatorId} has no pickup address`);
  }
  if (!artistProfile?.pickupLine1 || !artistProfile.pickupPincode) {
    throw new Error(`booking: artist ${artwork.artistId} has no pickup address`);
  }

  // Keyed `return-<holdingId>` so the webhook controller can distinguish
  // it from the inbound and advance a return-specific state if we add
  // one later. For now it won't match any existing prefix and the
  // controller falls through — the AWB is still issued, the artist has
  // tracking in their inbox via email. Worth hardening later.
  const booked = await bookShipment({
    orderReference: `return-${holdingId}`,
    pickup: {
      name: aggProfile.companyName ?? aggUser?.name ?? "GalleryZone Aggregator",
      phone: aggUser?.phone ?? "0000000000",
      line1: aggProfile.pickupLine1,
      line2: aggProfile.pickupLine2,
      city: aggProfile.pickupCity ?? "",
      state: aggProfile.pickupState ?? "",
      pincode: aggProfile.pickupPincode,
    },
    dropoff: {
      name: artistUser?.name ?? "GalleryZone Artist",
      phone: artistUser?.phone ?? "0000000000",
      line1: artistProfile.pickupLine1,
      line2: artistProfile.pickupLine2,
      city: artistProfile.pickupCity ?? "",
      state: artistProfile.pickupState ?? "",
      pincode: artistProfile.pickupPincode,
    },
    weightKg: artwork.physical?.weightKg ?? 2,
    artworkTitle: artwork.title,
    valueInr: Math.max(1, Math.round(holding.displayPricePaise / 100)),
  });

  await db.collection(Collections.aggregatorHoldings).doc(holdingId).set(
    {
      returnShiprocketStage: booked.stage,
      returnTrackingId: booked.trackingId,
      returnCarrier: booked.carrier,
      returnTrackedAt: Timestamp.now(),
    },
    { merge: true },
  );
}
