// Checkout — plan.md's Marketplace/Orders surface. @galleryzone/db's
// createOrder()/confirmSimulatedPayment() do the real work (see that
// file's own header for why confirmSimulatedPayment is explicitly a
// pre-gateway placeholder); this controller is deliberately thin.

import { Body, ConflictException, Controller, ForbiddenException, Inject, Logger, NotFoundException, Param, Post, Req } from "@nestjs/common";
import {
  createOrder,
  confirmSimulatedPayment,
  getOrder,
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
import { IllegalTransitionError } from "@galleryzone/domain";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { ReadCache } from "./read-cache.ts";
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

  @Roles("customer")
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(createOrderInputSchema)) body: CreateOrderInput) {
    // customerId comes from the verified token, never the body.

    // Audit #3: before creating the order, ask ShipRocket for a real quote
    // for this specific pickup→drop + weight + value. If the call fails or
    // no courier is serviceable, we fall back to the flat
    // `rates.deliveryChargePaise` and the order carries `shippingQuote:
    // null` so the UI can mark it as estimated. Resolution happens here (not
    // inside createOrder) because the db package can't depend on an HTTP
    // integration without pulling the whole gateway into unit tests.
    const deliveryQuote = await this.resolveShippingQuote(body.artworkId, body.addressId, req.authUser.uid).catch((err) => {
      this.logger.warn(`ShipRocket rate quote failed: ${String(err)} — falling back to flat rate`);
      return undefined;
    });

    try {
      return await createOrder({
        db: this.db,
        customerId: req.authUser.uid,
        artworkId: body.artworkId,
        addressId: body.addressId,
        idempotencyKey: body.idempotencyKey,
        deliveryQuote,
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

  /**
   * Resolve the four inputs ShipRocket's serviceability endpoint needs:
   * pickup pincode (artist's studio), drop pincode (buyer's address),
   * parcel weight, and declared value. Returns undefined when any input is
   * missing or ShipRocket isn't configured — createOrder falls back cleanly.
   *
   * Deliberately bails on the first missing piece rather than guessing a
   * default: a wrong pincode would return a plausible-looking but wrong
   * rate, and silent wrong rates are worse than the honest flat fallback.
   */
  private async resolveShippingQuote(
    artworkId: string,
    addressId: string,
    customerId: string,
  ): Promise<ShippingQuoteSnapshot | undefined> {
    if (!isShiprocketConfigured()) return undefined;
    const [artworkSnap, addressSnap] = await Promise.all([
      this.db.collection(Collections.artworks).doc(artworkId).get(),
      this.db.collection(Collections.addresses).doc(addressId).get(),
    ]);
    const artwork = artworkSnap.data() as ArtworkDoc | undefined;
    const address = addressSnap.data() as (AddressDoc & { userId?: string }) | undefined;
    if (!artwork || !address || address.userId !== customerId) return undefined;

    const artistProfileSnap = await this.db
      .collection(`users/${artwork.artistId}/profile`)
      .doc("data")
      .get();
    const artistProfile = artistProfileSnap.data() as ProfileDoc | undefined;
    const pickupPincode = artistProfile?.pickupPincode?.trim();
    const dropPincode = address.pincode?.trim();
    if (!pickupPincode || !dropPincode) return undefined;

    const weightKg = artwork.physical?.weightKg ?? 2;
    const valueInr = artwork.listing?.displayPricePaise
      ? Math.max(1, Math.round(artwork.listing.displayPricePaise / 100))
      : 1;

    const quote = await getShippingRate({ pickupPincode, dropPincode, weightKg, valueInr });
    if (!quote) return undefined;
    return {
      carrier: quote.carrier,
      ratePaise: quote.ratePaise,
      courierCompanyId: quote.courierCompanyId,
      estimatedDeliveryDays: quote.estimatedDeliveryDays,
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
