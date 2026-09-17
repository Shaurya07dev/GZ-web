// Artwork images: the artist's upload routes and the public serve route.
//
//   POST   /v1/artist/artworks/:id/images/upload-url  {contentType, contentLength}
//          → {key, uploadUrl, expiresInSeconds}   (browser then PUTs the file there)
//   POST   /v1/artist/artworks/:id/images/confirm     {key, altText?}
//          → ArtworkImage                          (we HEAD the object first)
//   GET    /v1/artist/artworks/:id/images
//   DELETE /v1/artist/artworks/:id/images/:imageId
//   PUT    /v1/artist/artworks/:id/images/order      {imageIds}
//   GET    /v1/images/artworks/:artworkId/:file       public, immutable
//
// The bucket is private, so the serve route is the only way a browser
// sees an image. Keys carry a random suffix and are never rewritten, so
// the response is immutable-cacheable — Vercel's image optimiser fetches
// each one once per region and serves resized variants from its own edge.

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import {
  ArtworkImageError,
  IMAGE_CONTENT_TYPES,
  assertArtworkOwnedBy,
  MAX_IMAGE_BYTES,
  confirmImage,
  imageUrlFor,
  listArtworkImages,
  removeImage,
  reorderImages,
  reserveImageSlot,
  type Db,
} from "@galleryzone/db";
import type { AppEnv } from "@galleryzone/config";
import { Public, Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { CacheKeys, ReadCache } from "./read-cache.ts";
import { Storage } from "./storage.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const uploadUrlSchema = z
  .object({
    contentType: z.enum(IMAGE_CONTENT_TYPES),
    contentLength: z.number().int().positive().max(MAX_IMAGE_BYTES),
  })
  .strict();
type UploadUrlBody = z.infer<typeof uploadUrlSchema>;

const confirmSchema = z
  .object({
    key: z.string().min(1).max(300).regex(/^artworks\/[^/]+\/[A-Za-z0-9]+\.(jpg|png|webp)$/),
    altText: z.string().trim().max(200).optional(),
  })
  .strict();
type ConfirmBody = z.infer<typeof confirmSchema>;

const orderSchema = z.object({ imageIds: z.array(z.string().min(1)).max(8) }).strict();
type OrderBody = z.infer<typeof orderSchema>;

const notFound = () => new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });

function rethrow(error: unknown): never {
  if (error instanceof ArtworkImageError) {
    if (error.message.startsWith("No ")) throw notFound();
    throw new BadRequestException({ type: "about:blank", title: error.message, status: 400, code: "image_rejected" });
  }
  throw error;
}

@Controller("v1")
export class ImagesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
    private readonly storage: Storage,
    private readonly cache: ReadCache,
  ) {}

  private bust(artworkId: string) {
    this.cache.invalidate(CacheKeys.marketplace);
    this.cache.invalidate(CacheKeys.artwork(artworkId));
    this.cache.invalidate(CacheKeys.verify(artworkId));
  }

  @Roles("artist")
  @Get("artist/artworks/:id/images")
  async list(@Req() req: AuthenticatedRequest, @Param("id") artworkId: string) {
    try {
      await assertArtworkOwnedBy(this.db, artworkId, req.authUser.uid);
    } catch (error) {
      rethrow(error);
    }
    return { images: await listArtworkImages(this.db, artworkId) };
  }

  @Roles("artist")
  @Post("artist/artworks/:id/images/upload-url")
  async uploadUrl(@Req() req: AuthenticatedRequest, @Param("id") artworkId: string, @Body(new ZodValidationPipe(uploadUrlSchema)) body: UploadUrlBody) {
    try {
      const { key } = await reserveImageSlot(this.db, { artworkId, artistId: req.authUser.uid, contentType: body.contentType });
      const uploadUrl = await this.storage.presignUpload(key, body.contentType, body.contentLength);
      return { key, uploadUrl, expiresInSeconds: 600, method: "PUT", headers: { "Content-Type": body.contentType } };
    } catch (error) {
      rethrow(error);
    }
  }

  /**
   * Fallback upload THROUGH the API: raw image bytes in the body
   * (Content-Type = the image type). Used when the browser can't PUT to the
   * bucket directly; costs API egress, so the presigned path stays primary.
   */
  @Roles("artist")
  @Post("artist/artworks/:id/images/upload")
  async uploadDirect(@Req() req: AuthenticatedRequest & { rawBody?: Buffer; body?: unknown; headers: Record<string, string | string[] | undefined> }, @Param("id") artworkId: string) {
    const contentType = (req.headers["content-type"] ?? "").split(";")[0]!.trim();
    if (!(IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      throw new BadRequestException({ type: "about:blank", title: "Only JPEG, PNG or WebP images are accepted", status: 400, code: "image_rejected" });
    }
    const body = Buffer.isBuffer(req.body) ? (req.body as Buffer) : req.rawBody;
    if (!body || !body.length) throw new BadRequestException({ type: "about:blank", title: "Empty upload", status: 400, code: "image_rejected" });
    if (body.length > MAX_IMAGE_BYTES) throw new BadRequestException({ type: "about:blank", title: "Images must be 15 MB or smaller", status: 400, code: "image_rejected" });
    try {
      const { key } = await reserveImageSlot(this.db, { artworkId, artistId: req.authUser.uid, contentType: contentType as (typeof IMAGE_CONTENT_TYPES)[number] });
      await this.storage.put(key, body, contentType);
      const altText = typeof req.headers["x-alt-text"] === "string" ? decodeURIComponent(req.headers["x-alt-text"]).slice(0, 200) : undefined;
      const image = await confirmImage(this.db, { artworkId, artistId: req.authUser.uid, key, url: imageUrlFor(this.env.publicApiUrl, key), altText });
      this.bust(artworkId);
      return image;
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("artist")
  @Post("artist/artworks/:id/images/confirm")
  async confirm(@Req() req: AuthenticatedRequest, @Param("id") artworkId: string, @Body(new ZodValidationPipe(confirmSchema)) body: ConfirmBody) {
    const head = await this.storage.head(body.key);
    if (!head) throw new BadRequestException({ type: "about:blank", title: "Nothing has been uploaded to that key", status: 400, code: "upload_missing" });
    if (!head.contentType || !(IMAGE_CONTENT_TYPES as readonly string[]).includes(head.contentType) || (head.contentLength ?? 0) > MAX_IMAGE_BYTES) {
      await this.storage.delete(body.key).catch(() => undefined);
      throw new BadRequestException({ type: "about:blank", title: "Uploaded object is not an accepted image", status: 400, code: "image_rejected" });
    }
    try {
      const image = await confirmImage(this.db, {
        artworkId,
        artistId: req.authUser.uid,
        key: body.key,
        url: imageUrlFor(this.env.publicApiUrl, body.key),
        altText: body.altText,
      });
      this.bust(artworkId);
      return image;
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("artist")
  @Delete("artist/artworks/:id/images/:imageId")
  async remove(@Req() req: AuthenticatedRequest, @Param("id") artworkId: string, @Param("imageId") imageId: string) {
    try {
      const { key } = await removeImage(this.db, { artworkId, artistId: req.authUser.uid, imageId });
      await this.storage.delete(key).catch((e) => {
        // Metadata is already gone; an orphaned object costs $0.015/GB-month, not a failed request.
        console.warn(`images: could not delete ${key}: ${String(e)}`);
      });
      this.bust(artworkId);
      return { deleted: true };
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("artist")
  @Put("artist/artworks/:id/images/order")
  async reorder(@Req() req: AuthenticatedRequest, @Param("id") artworkId: string, @Body(new ZodValidationPipe(orderSchema)) body: OrderBody) {
    try {
      const images = await reorderImages(this.db, { artworkId, artistId: req.authUser.uid, imageIds: body.imageIds });
      this.bust(artworkId);
      return { images };
    } catch (error) {
      rethrow(error);
    }
  }

  /** Streams the object from the private bucket. Keys are immutable, so the response is too. */
  @Public()
  @Get("images/artworks/:artworkId/:file")
  async serve(@Param("artworkId") artworkId: string, @Param("file") file: string, @Res() res: Response) {
    if (!/^[A-Za-z0-9]+\.(jpg|png|webp)$/.test(file) || !/^[^/]+$/.test(artworkId)) throw notFound();
    const object = await this.storage.get(`artworks/${artworkId}/${file}`);
    if (!object) throw notFound();
    res.setHeader("Content-Type", object.contentType ?? "application/octet-stream");
    if (object.contentLength !== null) res.setHeader("Content-Length", String(object.contentLength));
    if (object.etag) res.setHeader("ETag", object.etag);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    object.body.pipe(res);
  }
}
