// Shopping cart on the API — one doc per uid, read/write only by the owner.
//
//   GET    /v1/me/cart                    → the current cart
//   POST   /v1/me/cart/items {artworkId}  → add; idempotent, enforces max
//   DELETE /v1/me/cart/items/:artworkId   → remove
//   DELETE /v1/me/cart                    → clear all
//
// Added 31 Oct 2026 as part of the mobile-parity work: the web used to keep
// the cart in localStorage, mobile had no cart at all. One source of truth
// in Firestore means the cart follows the user across devices and the
// abandoned-cart email has a real record to sweep from.

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import {
  CartError,
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  type Db,
} from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const addSchema = z.object({ artworkId: z.string().min(1).max(80) }).strict();
type AddBody = z.infer<typeof addSchema>;

const cartFull = (message: string) =>
  new BadRequestException({
    type: "about:blank",
    title: message,
    status: 400,
    code: "cart_full",
  });

@Controller("v1/me/cart")
export class CartController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer", "artist", "aggregator", "admin")
  @Get()
  read(@Req() req: AuthenticatedRequest) {
    return getCart(this.db, req.authUser.uid);
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Post("items")
  async add(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(addSchema)) body: AddBody,
  ) {
    try {
      return await addToCart(this.db, req.authUser.uid, body.artworkId);
    } catch (error) {
      if (error instanceof CartError) throw cartFull(error.message);
      throw error;
    }
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Delete("items/:artworkId")
  remove(
    @Req() req: AuthenticatedRequest,
    @Param("artworkId") artworkId: string,
  ) {
    return removeFromCart(this.db, req.authUser.uid, artworkId);
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Delete()
  clear(@Req() req: AuthenticatedRequest) {
    return clearCart(this.db, req.authUser.uid);
  }
}
