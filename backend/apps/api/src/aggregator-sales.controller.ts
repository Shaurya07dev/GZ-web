import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { listAggregatorSales, advanceShipment, markRemitted, listRemittancesDue, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const advanceSchema = z.object({ to: z.enum(["dispatched", "delivered"]), courierRef: z.string().optional() }).strict();
type AdvanceBody = z.infer<typeof advanceSchema>;

@Controller("v1/aggregator/sales")
export class AggregatorSalesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // TODO(Phase 1): aggregatorId from the authenticated request on every method here.
  @Roles("aggregator")
  @Get()
  list() {
    return listAggregatorSales(this.db, "TODO-authenticated-user-id");
  }

  @Roles("aggregator")
  @Patch(":id/shipment")
  shipment(@Param("id") id: string, @Body(new ZodValidationPipe(advanceSchema)) body: AdvanceBody) {
    return advanceShipment(this.db, id, body.to, body.courierRef);
  }

  @Roles("aggregator")
  @Post(":id/remit")
  remit(@Param("id") id: string) {
    return markRemitted(this.db, id);
  }

  @Roles("aggregator")
  @Get("remittances-due")
  remittancesDue() {
    return listRemittancesDue(this.db, "TODO-authenticated-user-id");
  }
}
