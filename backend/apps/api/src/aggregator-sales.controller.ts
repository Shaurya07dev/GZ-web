import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { listAggregatorSales, advanceShipment, markRemitted, listRemittancesDue, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const advanceSchema = z.object({ to: z.enum(["dispatched", "delivered"]), courierRef: z.string().optional() }).strict();
type AdvanceBody = z.infer<typeof advanceSchema>;

@Controller("v1/aggregator/sales")
export class AggregatorSalesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("aggregator")
  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return listAggregatorSales(this.db, req.authUser.uid);
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
  remittancesDue(@Req() req: AuthenticatedRequest) {
    return listRemittancesDue(this.db, req.authUser.uid);
  }
}
