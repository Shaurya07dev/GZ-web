import { Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { listGallerySpaces, addGallerySpace, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const spaceSchema = z
  .object({ name: z.string().min(1), addressLine1: z.string().min(1), city: z.string().min(1), state: z.string().min(1), pincode: z.string().min(1), capacity: z.number().int().optional(), coordinatorName: z.string().optional() })
  .strict();
type SpaceBody = z.infer<typeof spaceSchema>;

@Controller("v1/aggregator/gallery-spaces")
export class GallerySpacesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("aggregator")
  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return listGallerySpaces(this.db, req.authUser.uid);
  }

  @Roles("aggregator")
  @Post()
  add(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(spaceSchema)) body: SpaceBody) {
    return addGallerySpace(this.db, req.authUser.uid, body);
  }
}
