import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { z } from "zod";
import { listGallerySpaces, addGallerySpace, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const spaceSchema = z
  .object({ name: z.string().min(1), addressLine1: z.string().min(1), city: z.string().min(1), state: z.string().min(1), pincode: z.string().min(1), capacity: z.number().int().optional(), coordinatorName: z.string().optional() })
  .strict();
type SpaceBody = z.infer<typeof spaceSchema>;

@Controller("v1/aggregator/gallery-spaces")
export class GallerySpacesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // TODO(Phase 1): aggregatorId from the authenticated request.
  @Roles("aggregator")
  @Get()
  list() {
    return listGallerySpaces(this.db, "TODO-authenticated-user-id");
  }

  @Roles("aggregator")
  @Post()
  add(@Body(new ZodValidationPipe(spaceSchema)) body: SpaceBody) {
    return addGallerySpace(this.db, "TODO-authenticated-user-id", body);
  }
}
