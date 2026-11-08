// Wishlist (saved artworks) and follows (artists) — one controller, same
// pattern as cart.controller.ts.
//
//   GET    /v1/me/wishlist                       → list saved ids
//   POST   /v1/me/wishlist/items {artworkId}     → add; idempotent
//   DELETE /v1/me/wishlist/items/:artworkId      → remove
//
//   GET    /v1/me/follows                        → list followed artist ids
//   POST   /v1/me/follows/items {artistId}       → follow; idempotent
//   DELETE /v1/me/follows/items/:artistId        → unfollow
//
// Added 8 Nov 2026 to replace the client-side localStorage/zustand/mock
// implementations on web and mobile. See packages/db/src/wishlist.ts for why.

import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { addToWishlist, followArtist, getFollows, getWishlist, removeFromWishlist, unfollowArtist, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const addWishlistSchema = z.object({ artworkId: z.string().min(1).max(80) }).strict();
type AddWishlistBody = z.infer<typeof addWishlistSchema>;

const followSchema = z.object({ artistId: z.string().min(1).max(80) }).strict();
type FollowBody = z.infer<typeof followSchema>;

const fullList = (message: string) =>
  new BadRequestException({ type: "about:blank", title: message, status: 400, code: "list_full" });

@Controller("v1/me/wishlist")
export class WishlistController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer", "artist", "aggregator", "admin")
  @Get()
  read(@Req() req: AuthenticatedRequest) {
    return getWishlist(this.db, req.authUser.uid);
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Post("items")
  async add(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(addWishlistSchema)) body: AddWishlistBody,
  ) {
    try {
      return await addToWishlist(this.db, req.authUser.uid, body.artworkId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Wishlist is full")) {
        throw fullList(error.message);
      }
      throw error;
    }
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Delete("items/:artworkId")
  remove(
    @Req() req: AuthenticatedRequest,
    @Param("artworkId") artworkId: string,
  ) {
    return removeFromWishlist(this.db, req.authUser.uid, artworkId);
  }
}

@Controller("v1/me/follows")
export class FollowsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer", "artist", "aggregator", "admin")
  @Get()
  read(@Req() req: AuthenticatedRequest) {
    return getFollows(this.db, req.authUser.uid);
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Post("items")
  async add(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(followSchema)) body: FollowBody,
  ) {
    try {
      return await followArtist(this.db, req.authUser.uid, body.artistId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already follow")) {
        throw fullList(error.message);
      }
      throw error;
    }
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Delete("items/:artistId")
  remove(
    @Req() req: AuthenticatedRequest,
    @Param("artistId") artistId: string,
  ) {
    return unfollowArtist(this.db, req.authUser.uid, artistId);
  }
}
