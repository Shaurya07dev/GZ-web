import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { listMyResaleListings, createResaleListing, withdrawResaleListing, completeResaleSale, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const createSchema = z.object({ artworkId: z.string().uuid(), listedPricePaise: z.number().int().positive() }).strict();
type CreateBody = z.infer<typeof createSchema>;

@Controller("v1/account/resale")
export class ResaleController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer")
  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return listMyResaleListings(this.db, req.authUser.uid);
  }

  @Roles("customer")
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(createSchema)) body: CreateBody) {
    return createResaleListing(this.db, req.authUser.uid, body.artworkId, body.listedPricePaise);
  }

  @Roles("customer")
  @Post(":id/withdraw")
  withdraw(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return withdrawResaleListing(this.db, req.authUser.uid, id);
  }

  @Roles("customer")
  @Post(":id/complete")
  complete(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return completeResaleSale(this.db, req.authUser.uid, id);
  }
}
