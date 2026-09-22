import { Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { listMyResaleListings, createResaleListing, withdrawResaleListing, completeResaleSale, ResaleError, type Db } from "@galleryzone/db";
import { IllegalTransitionError } from "@galleryzone/domain";
import { firestoreId } from "@galleryzone/contracts";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const createSchema = z.object({ artworkId: firestoreId, listedPricePaise: z.number().int().positive() }).strict();
type CreateBody = z.infer<typeof createSchema>;

// ResaleError was caught nowhere, so every one of these reached the UI as a 500.
function rethrow(error: unknown): never {
  if (error instanceof ResaleError) {
    if (error.message.startsWith("No resale listing")) {
      throw new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });
    }
    throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "resale_rejected" });
  }
  if (error instanceof IllegalTransitionError) {
    throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "illegal_transition" });
  }
  throw error;
}

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
  async create(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(createSchema)) body: CreateBody) {
    try {
      return await createResaleListing(this.db, req.authUser.uid, body.artworkId, body.listedPricePaise);
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("customer")
  @Post(":id/withdraw")
  async withdraw(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    try {
      return await withdrawResaleListing(this.db, req.authUser.uid, id);
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("customer")
  @Post(":id/complete")
  async complete(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    try {
      return await completeResaleSale(this.db, req.authUser.uid, id);
    } catch (error) {
      rethrow(error);
    }
  }
}
