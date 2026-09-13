// The marketplace listing/detail endpoints — the highest-traffic read path
// in the whole system. Public: no auth required, but SECURITY-CRITICAL
// regardless — this is exactly the surface the price-leak contract test
// (packages/contracts/artwork-dto.check.ts) exists to protect.
// artistPricePaise is read from the pricing subcollection to compute
// displayPricePaise, but is never placed on the response object — the
// response is built field-by-field from CustomerArtworkDto's own shape,
// never by spreading a Firestore doc.

import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import {
  Collections,
  FirestoreRateConfigStore,
  artworkPricingCol,
  type ArtworkDoc,
  type ArtworkPricingDoc,
  type Db,
  type UserDoc,
} from "@galleryzone/db";
import { loadActiveRates } from "@galleryzone/config";
import { displayPriceOf } from "@galleryzone/domain";
import type { CustomerArtworkDto } from "@galleryzone/contracts";
import { Public } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";

@Controller("v1/artworks")
export class ArtworksController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Public()
  @Get()
  async list(): Promise<{ artworks: CustomerArtworkDto[] }> {
    const rates = await loadActiveRates(new FirestoreRateConfigStore(this.db));
    const snap = await this.db.collection(Collections.artworks).get();
    const dtos = await Promise.all(snap.docs.map((doc) => this.toDto(doc.id, doc.data() as ArtworkDoc, rates)));
    return { artworks: dtos };
  }

  @Public()
  @Get(":id")
  async get(@Param("id") id: string): Promise<CustomerArtworkDto> {
    const rates = await loadActiveRates(new FirestoreRateConfigStore(this.db));
    const snap = await this.db.collection(Collections.artworks).doc(id).get();
    if (!snap.exists) throw new NotFoundException({ type: "about:blank", title: "Artwork not found", status: 404, code: "not_found" });
    return this.toDto(id, snap.data() as ArtworkDoc, rates);
  }

  private async toDto(id: string, artwork: ArtworkDoc, rates: Parameters<typeof displayPriceOf>[1]): Promise<CustomerArtworkDto> {
    const [pricingSnap, artistSnap] = await Promise.all([
      this.db.collection(artworkPricingCol(id)).doc("data").get(),
      this.db.collection(Collections.users).doc(artwork.artistId).get(),
    ]);
    const pricing = pricingSnap.data() as ArtworkPricingDoc | undefined;
    const artist = artistSnap.data() as UserDoc | undefined;

    return {
      id,
      productCode: artwork.productCode,
      artistId: artwork.artistId,
      artistName: artist?.name ?? "Unknown Artist",
      title: artwork.title,
      description: artwork.description,
      category: artwork.category,
      medium: artwork.medium,
      dimensions: artwork.dimensions,
      yearCreated: artwork.yearCreated,
      // TODO(Phase 1): join the images subcollection once the upload pipeline exists.
      images: [],
      displayPricePaise: displayPriceOf(pricing?.artistPricePaise ?? 0, rates),
      insured: artwork.insuranceStatus === "approved",
      // TODO(Phase 1): derive from the latest statusEvents doc once the
      // moderation/order flow writes to it.
      status: "marketplace",
      listingType: artwork.listingType,
      rarityType: artwork.rarityType,
      coaCertificateNumber: artwork.coaCertificateNumber,
    };
  }
}
