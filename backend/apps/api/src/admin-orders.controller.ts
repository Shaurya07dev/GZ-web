import { Body, Controller, Get, Inject, Param, Patch } from "@nestjs/common";
import { z } from "zod";
import { orderStatusValues } from "@galleryzone/contracts";
import { listOrdersAdmin, getOrderAdmin, getAddressAdmin, advanceOrderStatus, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const statusPatchSchema = z.object({ to: z.enum([...orderStatusValues]) }).strict();
type StatusPatchBody = z.infer<typeof statusPatchSchema>;

@Controller("v1/admin")
export class AdminOrdersController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin")
  @Get("orders")
  list() {
    return listOrdersAdmin(this.db);
  }

  @Roles("admin")
  @Get("orders/:id")
  get(@Param("id") id: string) {
    return getOrderAdmin(this.db, id);
  }

  @Roles("admin")
  @Get("addresses/:id")
  getAddress(@Param("id") id: string) {
    return getAddressAdmin(this.db, id);
  }

  @Roles("admin")
  @Patch("orders/:id/status")
  async advanceStatus(@Param("id") id: string, @Body(new ZodValidationPipe(statusPatchSchema)) body: StatusPatchBody) {
    await advanceOrderStatus(this.db, id, body.to);
    return { orderId: id, status: body.to };
  }
}
