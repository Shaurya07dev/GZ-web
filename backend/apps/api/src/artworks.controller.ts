// The marketplace listing/detail endpoints — the highest-traffic read path
// in the whole system (plan's "What the backend must cover" section).
// Public: no auth required, but SECURITY-CRITICAL regardless — this is
// exactly the surface the price-leak contract test
// (packages/contracts/artwork-dto.check.ts) exists to protect.
// artistPricePaise is read from the DB to compute displayPricePaise, but
// is never placed on the response object — the response is built field-
// by-field from CustomerArtworkDto's own shape, not by spreading the row.

import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Db } from "@galleryzone/db";
import { artworks, users, PostgresRateConfigStore } from "@galleryzone/db";
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
    const rates = await loadActiveRates(new PostgresRateConfigStore(this.db));
    const rows = await this.db
      .select({
        id: artworks.id,
        productCode: artworks.productCode,
        artistId: artworks.artistId,
        artistName: users.name,
        title: artworks.title,
        description: artworks.description,
        category: artworks.category,
        medium: artworks.medium,
        dimensions: artworks.dimensions,
        yearCreated: artworks.yearCreated,
        artistPricePaise: artworks.artistPricePaise,
        listingType: artworks.listingType,
        rarityType: artworks.rarityType,
        coaCertificateNumber: artworks.coaCertificateNumber,
        insuranceStatus: artworks.insuranceStatus,
      })
      .from(artworks)
      .innerJoin(users, eq(artworks.artistId, users.id));

    return { artworks: rows.map((row) => toCustomerDto(row, rates)) };
  }

  @Public()
  @Get(":id")
  async get(@Param("id") id: string): Promise<CustomerArtworkDto> {
    const rates = await loadActiveRates(new PostgresRateConfigStore(this.db));
    const [row] = await this.db
      .select({
        id: artworks.id,
        productCode: artworks.productCode,
        artistId: artworks.artistId,
        artistName: users.name,
        title: artworks.title,
        description: artworks.description,
        category: artworks.category,
        medium: artworks.medium,
        dimensions: artworks.dimensions,
        yearCreated: artworks.yearCreated,
        artistPricePaise: artworks.artistPricePaise,
        listingType: artworks.listingType,
        rarityType: artworks.rarityType,
        coaCertificateNumber: artworks.coaCertificateNumber,
        insuranceStatus: artworks.insuranceStatus,
      })
      .from(artworks)
      .innerJoin(users, eq(artworks.artistId, users.id))
      .where(eq(artworks.id, id));

    if (!row) throw new NotFoundException({ type: "about:blank", title: "Artwork not found", status: 404, code: "not_found" });
    return toCustomerDto(row, rates);
  }
}

function toCustomerDto(
  row: {
    id: string;
    productCode: string;
    artistId: string;
    artistName: string;
    title: string;
    description: string;
    category: string;
    medium: string;
    dimensions: string | null;
    yearCreated: number | null;
    artistPricePaise: number;
    listingType: string;
    rarityType: string | null;
    coaCertificateNumber: string | null;
    insuranceStatus: string | null;
  },
  rates: Parameters<typeof displayPriceOf>[1],
): CustomerArtworkDto {
  return {
    id: row.id,
    productCode: row.productCode,
    artistId: row.artistId,
    artistName: row.artistName,
    title: row.title,
    description: row.description,
    category: row.category,
    medium: row.medium,
    dimensions: row.dimensions,
    yearCreated: row.yearCreated,
    // TODO(Phase 1): join artwork_images once the upload pipeline exists —
    // the mock frontend's own gap, see the plan's inventory of gaps.
    images: [],
    displayPricePaise: displayPriceOf(row.artistPricePaise, rates),
    insured: row.insuranceStatus === "approved",
    // TODO(Phase 1): derive from the latest artwork_status_events row once
    // the moderation/order flow writes to it — hardcoded "marketplace"
    // here is a placeholder for a listed piece, not a real status read.
    status: "marketplace",
    listingType: row.listingType,
    rarityType: row.rarityType,
    coaCertificateNumber: row.coaCertificateNumber,
  };
}
