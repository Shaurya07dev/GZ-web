// The in-app inbox. Every route is scoped to the caller's own uid (the
// notifications live under users/{uid}/), so there is no id to guess.
//   GET  /v1/notifications            → { items, unreadCount }, newest first
//   POST /v1/notifications/:id/read   → mark one read
//   POST /v1/notifications/read-all   → mark everything read

import { Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from "@nestjs/common";
import { listNotifications, markAllNotificationsRead, markNotificationRead, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";

@Controller("v1/notifications")
export class NotificationsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer", "artist", "aggregator", "admin")
  @Get()
  list(@Req() req: AuthenticatedRequest, @Query("limit") limit?: string) {
    return listNotifications(this.db, req.authUser.uid, Number(limit) || 30);
  }

  // Declared before :id/read so "read-all" is never taken for an id.
  @Roles("customer", "artist", "aggregator", "admin")
  @Post("read-all")
  @HttpCode(200)
  async readAll(@Req() req: AuthenticatedRequest) {
    return { updated: await markAllNotificationsRead(this.db, req.authUser.uid) };
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Post(":id/read")
  @HttpCode(200)
  async read(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    await markNotificationRead(this.db, req.authUser.uid, id);
    return { id, read: true };
  }
}
