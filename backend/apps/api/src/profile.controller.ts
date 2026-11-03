// The signed-in account's own profile, for every role:
//   GET   /v1/me/profile     identity + private facts + compliance states
//   PATCH /v1/me/profile     partial update; validation in packages/db/profiles.ts
// One route pair rather than one per role — the body schema is a superset
// and the db layer ignores what doesn't apply (a customer has no GSTIN).

import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Patch, Post, Req } from "@nestjs/common";
import { z } from "zod";
import {
  freeAccessFor,
  getOwnProfile,
  getProfilePhotoUrl,
  setProfilePhotoUrl,
  updateOwnProfile,
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  ProfileUpdateError,
  refreshArtistListings,
  type Db,
  type OwnProfile,
} from "@galleryzone/db";
import type { AppEnv } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { ReadCache } from "./read-cache.ts";
import { Emails } from "./mail/emails.ts";
import { Storage } from "./storage.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

const patchSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: nullableText(20),
    headline: nullableText(120),
    bio: nullableText(2000),
    location: nullableText(80),
    instagram: nullableText(120),
    website: nullableText(200),
    socialProofVideoUrl: nullableText(300),
    pan: nullableText(10),
    gstin: nullableText(15),
    companyName: nullableText(120),
    bankAccountNumber: nullableText(24),
    ifsc: nullableText(11),
    pickupLine1: nullableText(120),
    pickupLine2: nullableText(120),
    pickupCity: nullableText(80),
    pickupState: nullableText(80),
    // 12 covers the longest common format (US ZIP+4 with hyphen) and the UAE
    // "PO Box 12345" style; the per-country regex lives in profiles.ts.
    pickupPincode: nullableText(12),
    pickupCountry: nullableText(2),
    tourCompleted: z
      .object({ tour: z.enum(["customer", "artist", "aggregator", "admin"]), version: z.number().int().min(1).max(1000) })
      .strict()
      .optional(),
  })
  .strict();
type PatchBody = z.infer<typeof patchSchema>;

// Profile photo upload — audit, 31 Oct 2026. One flow for every role: the
// browser gets a presigned PUT, uploads the file straight to the bucket,
// and confirms. Keys include a random suffix so each upload is a new URL
// (immutable caching); the old key is deleted on confirm so a user who
// re-uploads doesn't leak objects.
const EXT_FOR: Record<(typeof IMAGE_CONTENT_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
// 5 MB cap for profile photos — far below the 15 MB artwork image ceiling.
// A profile picture doesn't need gallery-print resolution and a looser cap
// would just mean slower loads on every page the avatar renders.
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

function newProfilePhotoKey(uid: string, contentType: (typeof IMAGE_CONTENT_TYPES)[number]): string {
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `profiles/${uid}/${rand}.${EXT_FOR[contentType]}`;
}

/** Parse the key out of our own served URL so we know what to delete on replace. */
function keyFromServedUrl(url: string | null, apiBaseUrl: string): string | null {
  if (!url) return null;
  const prefix = `${apiBaseUrl.replace(/\/$/, "")}/v1/images/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

const photoUploadUrlSchema = z
  .object({
    contentType: z.enum(IMAGE_CONTENT_TYPES),
    contentLength: z.number().int().positive().max(MAX_PROFILE_PHOTO_BYTES),
  })
  .strict();
type PhotoUploadUrlBody = z.infer<typeof photoUploadUrlSchema>;

const photoConfirmSchema = z
  .object({
    key: z.string().min(1).max(200).regex(/^profiles\/[^/]+\/[A-Za-z0-9]+\.(jpg|png|webp)$/),
  })
  .strict();
type PhotoConfirmBody = z.infer<typeof photoConfirmSchema>;

@Controller("v1/me")
export class ProfileController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
    private readonly cache: ReadCache,
    private readonly emails: Emails,
    private readonly storage: Storage,
  ) {}

  /** The profile plus the artist's free-access period (null for every other role). */
  private async withFreeAccess(profile: OwnProfile) {
    const freeAccess = await freeAccessFor(this.db, { email: profile.email, role: profile.role, joinedAt: new Date(profile.createdAt) });
    return { ...profile, freeAccess };
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Get("profile")
  async get(@Req() req: AuthenticatedRequest) {
    const profile = await getOwnProfile(this.db, req.authUser.uid);
    if (!profile) throw new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });
    return this.withFreeAccess(profile);
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Patch("profile")
  async patch(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(patchSchema)) body: PatchBody) {
    try {
      const profile = await updateOwnProfile(this.db, req.authUser.uid, body);
      // A changed payout destination is the classic account-takeover payload,
      // so the owner is always told — including when it wasn't them.
      if (body.bankAccountNumber !== undefined) {
        void this.emails
          .bankAccountChanged({ userId: req.authUser.uid, maskedAccount: profile.bankAccountMasked ?? null })
          .catch(this.emails.swallow("bank change mail"));
      }
      // A renamed or relocated artist changes every one of their listing rows.
      if (profile.role === "artist" && (body.fullName !== undefined || body.location !== undefined)) {
        await refreshArtistListings(this.db, req.authUser.uid);
        this.cache.clear();
      }
      return this.withFreeAccess(profile);
    } catch (error) {
      if (error instanceof ProfileUpdateError) {
        throw new BadRequestException({ type: "about:blank", title: error.message, status: 400, code: "profile_rejected" });
      }
      throw error;
    }
  }

  // --- Profile photo ---------------------------------------------------------
  // Mirrors the artwork image flow: presign → browser PUT → confirm. One
  // "profiles" subpath per uid so the serve route can gate on ownership.

  @Roles("customer", "artist", "aggregator", "admin")
  @Post("profile/photo/upload-url")
  async photoUploadUrl(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(photoUploadUrlSchema)) body: PhotoUploadUrlBody,
  ) {
    const key = newProfilePhotoKey(req.authUser.uid, body.contentType);
    const uploadUrl = await this.storage.presignUpload(key, body.contentType, body.contentLength);
    return { key, uploadUrl, expiresInSeconds: 600, method: "PUT", headers: { "Content-Type": body.contentType } };
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Post("profile/photo/confirm")
  async photoConfirm(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(photoConfirmSchema)) body: PhotoConfirmBody,
  ) {
    // The key must address this user's own namespace — a presigned URL for
    // someone else's uid can't be confirmed into this account.
    if (!body.key.startsWith(`profiles/${req.authUser.uid}/`)) {
      throw new BadRequestException({ type: "about:blank", title: "That upload doesn't belong to this account", status: 400, code: "image_rejected" });
    }
    const head = await this.storage.head(body.key);
    if (!head) {
      throw new BadRequestException({ type: "about:blank", title: "Nothing has been uploaded to that key", status: 400, code: "upload_missing" });
    }
    if (!head.contentType || !(IMAGE_CONTENT_TYPES as readonly string[]).includes(head.contentType) || (head.contentLength ?? 0) > MAX_PROFILE_PHOTO_BYTES) {
      // A browser that uploaded the wrong type or an oversize file: refuse and
      // tidy up the object so the bucket doesn't collect dead keys.
      await this.storage.delete(body.key).catch(() => undefined);
      throw new BadRequestException({ type: "about:blank", title: "Uploaded object is not an accepted image", status: 400, code: "image_rejected" });
    }

    const previous = await getProfilePhotoUrl(this.db, req.authUser.uid);
    const photoUrl = `${this.env.publicApiUrl.replace(/\/$/, "")}/v1/images/${body.key}`;
    await setProfilePhotoUrl(this.db, req.authUser.uid, photoUrl);
    // The marketplace card can show the artist's avatar, so a photo change
    // invalidates the facets cache. Best-effort.
    this.cache.clear();
    // Delete the previously-stored object so a replace doesn't leak storage.
    const previousKey = keyFromServedUrl(previous, this.env.publicApiUrl);
    if (previousKey && previousKey !== body.key) {
      await this.storage.delete(previousKey).catch(() => undefined);
    }
    return { photoUrl };
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Delete("profile/photo")
  async photoDelete(@Req() req: AuthenticatedRequest) {
    const previous = await getProfilePhotoUrl(this.db, req.authUser.uid);
    await setProfilePhotoUrl(this.db, req.authUser.uid, null);
    this.cache.clear();
    const previousKey = keyFromServedUrl(previous, this.env.publicApiUrl);
    if (previousKey) await this.storage.delete(previousKey).catch(() => undefined);
    return { ok: true };
  }
}
