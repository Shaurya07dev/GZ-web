import { Body, Controller, Get, Inject, Param, Patch } from "@nestjs/common";
import { z } from "zod";
import { orderStatusValues } from "@galleryzone/contracts";
import { listOrdersAdmin, getOrderAdmin, getAddressAdmin, advanceOrderStatus, getOrder, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { Emails } from "./mail/emails.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const statusPatchSchema = z.object({ to: z.enum([...orderStatusValues]) }).strict();
type StatusPatchBody = z.infer<typeof statusPatchSchema>;

@Controller("v1/admin")
export class AdminOrdersController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
  ) {}

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
    // Until now a buyer heard nothing between paying and the parcel arriving.
    // Read back rather than trust the patch: the order carries who to tell,
    // and the decorated view already resolves the artwork's artist.
    const order = await getOrder(this.db, id);
    if (order) {
      void this.emails
        .orderStatus({
          orderId: id,
          customerId: order.customerId,
          artistId: order.artwork?.artistId ?? null,
          title: order.artwork?.title ?? "your artwork",
          status: body.to,
        })
        .catch(this.emails.swallow("order status mail"));
    }
    return { orderId: id, status: body.to };
  }
}
