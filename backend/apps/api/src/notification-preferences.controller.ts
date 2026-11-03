// Notification preferences + FCM device-token registry — audit §8.
//
// Preferences are per-channel opt-outs stored on the user's profile; the
// transactional emails ignore them, only the marketing/digest categories
// check them in Emails.
//
// Device tokens are collected from any client that wants push: the mobile
// app on first launch, the web via navigator.serviceWorker, etc. The token
// is the doc id so re-registering is idempotent.

import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import {
  readNotificationPreferences,
  registerFcmToken,
  revokeFcmToken,
  updateNotificationPreferences,
  type Db,
} from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const preferencesPatchSchema = z
  .object({
    abandonedCart: z.boolean().optional(),
    marketing: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
  })
  .strict();
type PreferencesPatchBody = z.infer<typeof preferencesPatchSchema>;

const fcmTokenSchema = z
  .object({
    token: z.string().min(20).max(1500),
    platform: z.enum(["ios", "android", "web"]),
    deviceLabel: z.string().max(100).nullable().optional(),
  })
  .strict();
type FcmTokenBody = z.infer<typeof fcmTokenSchema>;

@Controller("v1/account/notifications")
export class NotificationPreferencesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer", "artist", "aggregator", "admin")
  @Get("preferences")
  async read(@Req() req: AuthenticatedRequest) {
    return readNotificationPreferences(this.db, req.authUser.uid);
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Patch("preferences")
  async update(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(preferencesPatchSchema)) body: PreferencesPatchBody,
  ) {
    // Drop undefined keys so exactOptionalPropertyTypes stays happy — the Zod
    // schema already enforces the per-field shape when a key is present.
    const patch: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === "boolean") patch[k] = v;
    }
    return updateNotificationPreferences(this.db, req.authUser.uid, patch);
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Post("devices")
  async registerDevice(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(fcmTokenSchema)) body: FcmTokenBody,
  ) {
    await registerFcmToken(this.db, req.authUser.uid, {
      token: body.token,
      platform: body.platform,
      deviceLabel: body.deviceLabel ?? null,
    });
    return { ok: true };
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Delete("devices/:token")
  async revokeDevice(
    @Req() req: AuthenticatedRequest,
    @Param("token") token: string,
  ) {
    await revokeFcmToken(this.db, req.authUser.uid, token);
    return { ok: true };
  }
}
