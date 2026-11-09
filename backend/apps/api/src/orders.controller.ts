// Checkout — plan.md's Marketplace/Orders surface. @galleryzone/db's
// createOrder()/confirmSimulatedPayment() do the real work (see that
// file's own header for why confirmSimulatedPayment is explicitly a
// pre-gateway placeholder); this controller is deliberately thin.

import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Inject, Logger, NotFoundException, Param, Post, Query, Req } from "@nestjs/common";
import {
  createOrder,
  confirmSimulatedPayment,
  FirestoreRateConfigStore,
  getOrder,
  getPublicArtwork,
  CheckoutError,
  Collections,
  type Db,
  type ArtworkDoc,
  type AddressDoc,
  type ProfileDoc,
  type ShippingQuoteSnapshot,
} from "@galleryzone/db";
import { createOrderInputSchema, type CreateOrderInput } from "@galleryzone/contracts";
import type { AppEnv } from "@galleryzone/config";
import { checkoutTotal, IllegalTransitionError } from "@galleryzone/domain";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { CacheKeys, ReadCache, TTL } from "./read-cache.ts";
import { Emails } from "./mail/emails.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { getShippingRate, isShiprocketConfigured } from "./shiprocket.ts";

@Controller("v1/orders")
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
    private readonly cache: ReadCache,
    private readonly emails: Emails,
  ) {}

  /**
   * Live checkout quote for a specific buyer address.
   *
   * The public `GET /v1/artworks/:id/quote` endpoint can't know the drop
   * pincode, so it falls back to the flat `rates.deliveryChargePaise`. The
   * review step shows that ₹25 "estimated" number regardless of which address
   * the buyer picks — client flagged this on 7 Nov 2026. This endpoint runs
   * the same Shiprocket quote `POST /v1/orders` will use, so the preview and
   * the order match to the paise.
   *
   * Auth: customer — the address has to belong to the caller.
   */
  @Roles("customer")
  @Get("quote")
  async addressedQuote(
    @Req() req: AuthenticatedRequest,
    @Query("artworkId") artworkId: string,
    @Query("addressId") addressId: string,
  ) {
    if (!artworkId || !addressId) {
      throw new BadRequestException({
        type: "about:blank",
        title: "artworkId and addressId are both required",
        status: 400,
        code: "missing_params",
      });
    }
    const artwork = await this.cache.getOrFill(
      CacheKeys.artwork(artworkId),
      TTL.artwork,
      () => getPublicArtwork(this.db, artworkId),
    );
    if (!artwork) {
      throw new NotFoundException({ type: "about:blank", title: "Artwork not found", status: 404, code: "not_found" });
    }
    const version = await new FirestoreRateConfigStore(this.db).getActiveVersion(new Date());
    if (!version) {
      throw new NotFoundException({ type: "about:blank", title: "Pricing rules are not configured yet", status: 404, code: "no_active_rates" });
    }

    const resolution = await this.resolveShippingQuote(artworkId, addressId, req.authUser.uid).catch((err) => {
      // Structured error log so Railway's log viewer can pick it out
      // when tracing a buyer's failed quote. The exception message is
      // the only hint we get at whether it was creds / network /
      // upstream 500 — surface it verbatim.
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error(JSON.stringify({ event: "shiprocket.quote.failed", artworkId, addressId, message, stack }));
      return { quote: undefined, reason: "shiprocket_error" as const };
    });
    const requireRealQuote = isShiprocketConfigured();
    if (requireRealQuote && !resolution.quote) {
      throw new BadRequestException({
        type: "about:blank",
        title: this.deliveryUnavailableMessage(resolution.reason),
        status: 400,
        code: "delivery_unavailable",
        reason: resolution.reason,
      });
    }

    const total = checkoutTotal(artwork.displayPricePaise, version.rates, resolution.quote?.ratePaise);
    return {
      artworkId,
      addressId,
      displayPricePaise: total.displayPrice,
      gstPaise: total.gstIncluded,
      gstRate: version.rates.gstRate,
      convenienceFeePaise: total.convenienceFee,
      convenienceGstPaise: total.convenienceGst,
      deliveryChargePaise: total.deliveryCharge,
      totalPaise: total.total,
      rateConfigVersionId: version.id,
      // Lets the UI show "Delivered by <carrier>" + ETA without a second call.
      carrier: resolution.quote?.carrier ?? null,
      estimatedDeliveryDays: resolution.quote?.estimatedDeliveryDays ?? null,
    };
  }

  @Roles("customer")
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(createOrderInputSchema)) body: CreateOrderInput) {
    // customerId comes from the verified token, never the body.

    // Audit #3 (D1, 2 Nov 2026): the delivery charge is ShipRocket's quote
    // for this specific pickup→drop + weight + value, nothing else. The
    // flat fallback that lived here used to invent a ₹25 charge from a
    // stale config key and ship real orders with made-up money, so when
    // ShipRocket is configured we now REFUSE the order instead of
    // guessing — the buyer sees a clear "delivery rate unavailable" and
    // retries once the artist's pincode / weight / ShipRocket is sorted.
    //
    // The flat fallback still works when ShipRocket isn't configured at
    // all (local demo, offline dev); production always has it configured,
    // so the only path through on live is the real quote.
    const requireRealQuote = isShiprocketConfigured();
    const resolution = await this.resolveShippingQuote(
      body.artworkId,
      body.addressId,
      req.authUser.uid,
    ).catch((err) => {
      this.logger.warn(`ShipRocket rate quote threw: ${String(err)}`);
      return { quote: undefined, reason: "shiprocket_error" as const };
    });

    if (requireRealQuote && !resolution.quote) {
      throw new BadRequestException({
        type: "about:blank",
        title: this.deliveryUnavailableMessage(resolution.reason),
        status: 400,
        code: "delivery_unavailable",
        reason: resolution.reason,
      });
    }

    try {
      return await createOrder({
        db: this.db,
        customerId: req.authUser.uid,
        artworkId: body.artworkId,
        addressId: body.addressId,
        idempotencyKey: body.idempotencyKey,
        deliveryQuote: resolution.quote,
      });
    } catch (error) {
      if (error instanceof CheckoutError) {
        // "No artwork" / "no approved rate config" — the caller can't fix the
        // latter, but a 409 with the message beats an opaque 500 either way.
        throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "checkout_rejected" });
      }
      throw error;
    }
  }

  /** The actionable message the buyer sees when ShipRocket can't quote. */
  private deliveryUnavailableMessage(
    reason: "no_pickup_pincode" | "no_drop_pincode" | "not_serviceable" | "shiprocket_error" | undefined,
  ): string {
    switch (reason) {
      case "no_pickup_pincode":
        return "The artist's pickup address is incomplete — delivery can't be quoted. Contact support so they can finish their profile.";
      case "no_drop_pincode":
        return "Please add a complete delivery address (pincode is required) and try again.";
      case "not_serviceable":
        return "No courier delivers to this address right now. Try a different address or contact support.";
      default:
        return "We couldn't get a delivery rate for this order. Try again in a minute; if it keeps failing, contact support.";
    }
  }

  /**
   * Resolve the four inputs ShipRocket's serviceability endpoint needs:
   * pickup pincode (artist's studio), drop pincode (buyer's address),
   * parcel weight, and declared value. Returns the quote and a specific
   * `reason` on failure so the caller can tell the buyer which half of
   * the trip is wrong.
   *
   * Deliberately bails on the first missing piece rather than guessing a
   * default: a wrong pincode would return a plausible-looking but wrong
   * rate, and a wrong rate silently debits the wrong amount.
   */
  private async resolveShippingQuote(
    artworkId: string,
    addressId: string,
    customerId: string,
  ): Promise<{
    quote: ShippingQuoteSnapshot | undefined;
    reason:
      | "no_pickup_pincode"
      | "no_drop_pincode"
      | "not_serviceable"
      | "shiprocket_error"
      | undefined;
  }> {
    if (!isShiprocketConfigured()) {
      // Local/offline dev: let createOrder's flat fallback kick in. On live
      // the caller refuses before reaching this.
      return { quote: undefined, reason: undefined };
    }
    const [artworkSnap, addressSnap] = await Promise.all([
      this.db.collection(Collections.artworks).doc(artworkId).get(),
      this.db.collection(Collections.addresses).doc(addressId).get(),
    ]);
    const artwork = artworkSnap.data() as ArtworkDoc | undefined;
    const address = addressSnap.data() as (AddressDoc & { userId?: string }) | undefined;
    if (!artwork || !address || address.userId !== customerId) {
      // Downstream createOrder throws its own 404 for these; no delivery
      // rate decision applies.
      return { quote: undefined, reason: undefined };
    }

    const artistProfileSnap = await this.db
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

  // Simulated mode only — see checkout.ts's own warning. This is a stand-in
  // for the payment webhook, so it's normally an operator action
  // (platform_admin). While PAYMENTS_MODE=simulated the order's OWN
  // customer may call it too, so the web checkout works end to end before
  // the gateway lands; flipping the env to "razorpay" closes that door
  // without a code change — for operators too: under razorpay only the
  // gateway may mark an order paid, or an operator could mint free sales.
  @Roles("customer", "platform_admin")
  @Post(":id/simulate-payment")
  async simulatePayment(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    if (this.env.paymentsMode !== "simulated") {
      throw new ForbiddenException({ type: "about:blank", title: "Simulated payment is disabled", status: 403, code: "payments_not_simulated" });
    }
    const isOperator = req.authUser.grants.includes("platform_admin");
    if (!isOperator) {
      const order = await getOrder(this.db, id);
      if (!order || order.customerId !== req.authUser.uid) {
        // 404, not 403: don't confirm to a stranger that the order id exists.
        throw new NotFoundException({ type: "about:blank", title: "Order not found", status: 404, code: "not_found" });
      }
    }
    try {
      const result = await confirmSimulatedPayment(this.db, id);
      // The piece just left the marketplace and changed owner.
      this.cache.clear();
      void this.emails.orderPaid({ orderId: id, customerId: result.customerId, artistId: result.artistId, title: result.artworkTitle, totalPaise: result.totalPaise, artistNetPaise: result.artistNetPaise }).catch(this.emails.swallow("order mail"));
      return { transactionId: result.transactionId };
    } catch (error) {
      if (error instanceof CheckoutError) {
        throw new NotFoundException({ type: "about:blank", title: error.message, status: 404, code: "not_found" });
      }
      if (error instanceof IllegalTransitionError) {
        throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "illegal_transition" });
      }
      throw error;
    }
  }
}
