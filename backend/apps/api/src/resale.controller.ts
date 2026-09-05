import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { listMyResaleListings, createResaleListing, withdrawResaleListing, completeResaleSale, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const createSchema = z.object({ artworkId: z.string().uuid(), listedPricePaise: z.number().int().positive() }).strict();
type CreateBody = z.infer<typeof createSchema>;

@Controller("v1/account/resale")
export class ResaleController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // TODO(Phase 1): sellerId from the authenticated request.
  @Roles("customer")
  @Get()
  list() {
    return listMyResaleListings(this.db, "TODO-authenticated-user-id");
  }

  @Roles("customer")
  @Post()
  create(@Body(new ZodValidationPipe(createSchema)) body: CreateBody) {
    return createResaleListing(this.db, "TODO-authenticated-user-id", body.artworkId, body.listedPricePaise);
  }

  @Roles("customer")
  @Post(":id/withdraw")
  withdraw(@Param("id") id: string) {
    return withdrawResaleListing(this.db, "TODO-authenticated-user-id", id);
  }

  @Roles("customer")
  @Post(":id/complete")
  complete(@Param("id") id: string) {
    return completeResaleSale(this.db, "TODO-authenticated-user-id", id);
  }
}
