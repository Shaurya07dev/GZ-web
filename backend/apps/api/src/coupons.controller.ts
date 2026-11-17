// Coupons — admin CRUD + public apply.
//
// Admin side is `/v1/admin/coupons*` and requires the admin role. Public
// apply is `/v1/coupons/apply` and only validates — it never increments
// usedCount. The actual claim happens inside checkout when the payment
// captures (packages/db/src/checkout.ts markOrderPaid).

import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import { z } from "zod";
import {
  CouponError,
  createCoupon,
  listCoupons,
  setCouponStatus,
  validateCoupon,
  Collections,
  artworkPricingCol,
  type ArtworkDoc,
  type ArtworkPricingDoc,
  type Db,
} from "@galleryzone/db";
import { FirestoreRateConfigStore } from "@galleryzone/db";
import { loadActiveRates } from "@galleryzone/config";
import { displayPriceOf } from "@galleryzone/domain";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const createSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{3,24}$/, "3–24 letters/digits only"),
    kind: z.enum(["percent", "flat"]),
    value: z.number().int().positive(),
    minOrderPaise: z.number().int().nonnegative().nullable(),
    maxDiscountPaise: z.number().int().positive().nullable(),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime(),
    usageCap: z.number().int().positive().nullable(),
    perUserCap: z.number().int().positive().nullable(),
    scope: z.enum(["marketplace", "aggregator", "both"]),
    artistIds: z.array(z.string().trim().min(1).max(200)).max(50).nullable(),
  })
  .strict()
  .refine((v) => (v.kind === "percent" ? v.value <= 100 : true), {
    message: "Percent coupons must be 1-100",
  })
  .refine((v) => new Date(v.validUntil).getTime() > new Date(v.validFrom).getTime(), {
    message: "validUntil must be after validFrom",
  });
type CreateInput = z.infer<typeof createSchema>;

const statusSchema = z.object({ status: z.enum(["active", "paused", "expired"]) }).strict();

const applySchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{3,24}$/, "3–24 letters/digits only"),
    artworkId: z.string().trim().min(1).max(200),
  })
  .strict();

@Controller("v1")
export class CouponsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  private rates() {
    return loadActiveRates(new FirestoreRateConfigStore(this.db));
  }

  @Roles("admin")
  @Post("admin/coupons")
  async create(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createSchema)) body: CreateInput,
  ) {
    try {
      const coupon = await createCoupon(
        this.db,
        {
          code: body.code,
          kind: body.kind,
          value: body.value,
          minOrderPaise: body.minOrderPaise,
          maxDiscountPaise: body.maxDiscountPaise,
          validFrom: new Date(body.validFrom),
          validUntil: new Date(body.validUntil),
          usageCap: body.usageCap,
          perUserCap: body.perUserCap,
          scope: body.scope,
          artistIds: body.artistIds,
        },
        req.authUser.uid,
      );
      return { coupon };
    } catch (error) {
      if (error instanceof CouponError) {
        throw new BadRequestException({
          type: "about:blank",
          title: error.message,
          status: 400,
          code: error.code,
        });
      }
      throw error;
    }
  }

  @Roles("admin")
  @Get("admin/coupons")
  async list() {
    return { coupons: await listCoupons(this.db) };
  }

  @Roles("admin")
  @Patch("admin/coupons/:code")
  async updateStatus(
    @Param("code") code: string,
    @Body(new ZodValidationPipe(statusSchema)) body: { status: "active" | "paused" | "expired" },
  ) {
    try {
      const coupon = await setCouponStatus(this.db, code, body.status);
      return { coupon };
    } catch (error) {
      if (error instanceof CouponError) {
        throw new BadRequestException({
          type: "about:blank",
          title: error.message,
          status: 400,
          code: error.code,
        });
      }
      throw error;
    }
  }

  /**
   * Validate a code against a specific artwork. Returns the discount the
   * buyer will see, or an error with a specific code the UI can show.
   * Does NOT reserve the slot — the claim happens at payment capture.
   */
  @Roles("customer", "artist", "admin")
  @Post("coupons/apply")
  async apply(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(applySchema)) body: z.infer<typeof applySchema>,
  ) {
    const [pricingSnap, artworkSnap] = await Promise.all([
      this.db.collection(artworkPricingCol(body.artworkId)).doc("data").get(),
      this.db.collection(Collections.artworks).doc(body.artworkId).get(),
    ]);
    if (!pricingSnap.exists || !artworkSnap.exists) {
      throw new BadRequestException({
        type: "about:blank",
        title: "No such artwork.",
        status: 400,
        code: "no_artwork",
      });
    }
    const pricing = pricingSnap.data() as ArtworkPricingDoc;
    const artwork = artworkSnap.data() as ArtworkDoc;
    const rates = await this.rates();
    // The subtotal a coupon's minOrder is compared against — the artwork's
    // GST-inclusive display price. We deliberately do NOT include courier
    // delivery, because the admin's "₹5,000+ gets 10% off" intuition is
    // about the piece, not the parcel.
    const subtotalPaise =
      artwork.listing?.displayPricePaise ?? displayPriceOf(pricing.artistPricePaise, rates);

    try {
      const { discountPaise, coupon } = await validateCoupon(this.db, {
        code: body.code,
        subtotalPaise,
        context: {
          channel: "marketplace",
          artistId: pricing.artistId,
          userId: req.authUser.uid,
        },
      });
      return {
        code: coupon.code,
        discountPaise,
        kind: coupon.kind,
        value: coupon.value,
      };
    } catch (error) {
      if (error instanceof CouponError) {
        throw new BadRequestException({
          type: "about:blank",
          title: error.message,
          status: 400,
          code: error.code,
        });
      }
      throw error;
    }
  }
}
