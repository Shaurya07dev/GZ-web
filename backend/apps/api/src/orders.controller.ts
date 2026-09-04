// Checkout — plan.md's Marketplace/Orders surface. @galleryzone/db's
// createOrder()/confirmSimulatedPayment() do the real work (see that
// file's own header for why confirmSimulatedPayment is explicitly a
// pre-Razorpay placeholder); this controller is deliberately thin.
//
// Gated by RolesGuard like every other non-public route — reachable only
// once Firebase auth exists (Phase 1). Verified directly against
// packages/db/checkout.check.ts in the meantime (see that file), since the
// guard makes HTTP-level verification impossible before then by design.

import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { createOrder, confirmSimulatedPayment, type Db } from "@galleryzone/db";
import { createOrderInputSchema, type CreateOrderInput } from "@galleryzone/contracts";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

@Controller("v1/orders")
export class OrdersController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer")
  @Post()
  async create(@Body(new ZodValidationPipe(createOrderInputSchema)) body: CreateOrderInput) {
    // TODO(Phase 1): customerId comes from the authenticated request, never the body.
    const result = await createOrder({
      db: this.db,
      customerId: "TODO-authenticated-user-id",
      artworkId: body.artworkId,
      addressId: body.addressId,
      idempotencyKey: body.idempotencyKey,
    });
    return result;
  }

  // Pre-Razorpay only — see checkout.ts's own warning. Narrower role than
  // a customer completing their own checkout would eventually need,
  // because this is a stand-in for a webhook, not a customer action.
  @Roles("platform_admin")
  @Post(":id/simulate-payment")
  async simulatePayment(@Param("id") id: string) {
    return confirmSimulatedPayment(this.db, id);
  }
}
