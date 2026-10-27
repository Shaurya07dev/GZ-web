// Books the artist → aggregator leg through ShipRocket after a reservation
// finalizes. Extracted from aggregator.controller.ts so both the legacy
// reserve endpoint and the new reservation-intent finalize path can call it
// without duplicating the party-resolution logic.
//
// Separate function so the reserve handler stays readable, and so a failed
// booking logs clearly without masking the reservation's success.

import { Timestamp } from "firebase-admin/firestore";
import { Collections, type ArtworkDoc, type Db, type ProfileDoc, type UserDoc } from "@galleryzone/db";
import { bookShipment, isShiprocketConfigured } from "./shiprocket.ts";

export async function bookInboundShipment(db: Db, holdingId: string, artworkId: string, aggregatorId: string): Promise<void> {
  if (!isShiprocketConfigured()) {
    // Dev / preview without credentials — the ShipRocket wrapper's own stub
    // handles this case (returns demo- id). Returning here would skip the
    // write-back below; we still want the holding to carry the demo stage.
  }
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
