// Aggregator/consignment endpoints. @galleryzone/db's reserveHolding()/
// recordAggregatorSale() do the real work — verified directly in
// packages/db/aggregator-flow.check.ts against real Postgres, since
// RolesGuard makes HTTP-level verification impossible before Phase 1
// auth exists (same reasoning as orders.controller.ts).

import { Body, Controller, Inject, Param, Post, Req } from "@nestjs/common";
import { reserveHolding, recordAggregatorSale, type Db } from "@galleryzone/db";
import { reserveHoldingInputSchema, recordAggregatorSaleInputSchema, type ReserveHoldingInput, type RecordAggregatorSaleInput } from "@galleryzone/contracts";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

@Controller("v1/aggregator/holdings")
export class AggregatorController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("aggregator")
  @Post()
  async reserve(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(reserveHoldingInputSchema)) body: ReserveHoldingInput) {
    return reserveHolding({ db: this.db, aggregatorId: req.authUser.uid, artworkId: body.artworkId });
  }

  @Roles("aggregator")
  @Post(":id/sale")
  async recordSale(@Param("id") id: string, @Body(new ZodValidationPipe(recordAggregatorSaleInputSchema)) body: RecordAggregatorSaleInput) {
    return recordAggregatorSale({
      db: this.db,
      holdingId: id,
      soldPricePaise: body.soldPricePaise,
      buyerName: body.buyerName,
      buyerEmail: body.buyerEmail,
      buyerPhone: body.buyerPhone,
      deliveryAddress: body.deliveryAddress,
      deliveryMode: body.deliveryMode,
      paymentRoute: body.paymentRoute,
    });
  }
}
