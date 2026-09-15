// Checkout — plan.md's Marketplace/Orders surface. @galleryzone/db's
// createOrder()/confirmSimulatedPayment() do the real work (see that
// file's own header for why confirmSimulatedPayment is explicitly a
// pre-Razorpay placeholder); this controller is deliberately thin.

import { Body, ConflictException, Controller, ForbiddenException, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { createOrder, confirmSimulatedPayment, getOrder, CheckoutError, type Db } from "@galleryzone/db";
import { createOrderInputSchema, type CreateOrderInput } from "@galleryzone/contracts";
import type { AppEnv } from "@galleryzone/config";
import { IllegalTransitionError } from "@galleryzone/domain";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { ReadCache } from "./read-cache.ts";
import { Emails } from "./mail/emails.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

@Controller("v1/orders")
export class OrdersController {
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
    try {
      return await createOrder({
        db: this.db,
        customerId: req.authUser.uid,
        artworkId: body.artworkId,
        addressId: body.addressId,
        idempotencyKey: body.idempotencyKey,
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

  // Pre-Razorpay only — see checkout.ts's own warning. This is a stand-in
  // for the payment webhook, so it's normally an operator action
  // (platform_admin). While PAYMENTS_MODE=simulated the order's OWN
  // customer may call it too, so the web checkout works end to end before
  // Razorpay lands; flipping the env to "razorpay" closes that door
  // without a code change.
  @Roles("customer", "platform_admin")
  @Post(":id/simulate-payment")
  async simulatePayment(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const isOperator = req.authUser.grants.includes("platform_admin");
    if (!isOperator) {
      if (this.env.paymentsMode !== "simulated") {
        throw new ForbiddenException({ type: "about:blank", title: "Simulated payment is disabled", status: 403, code: "payments_not_simulated" });
      }
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
