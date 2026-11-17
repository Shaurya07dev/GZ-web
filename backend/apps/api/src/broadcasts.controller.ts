// Admin broadcasts: type a message once, choose artists, aggregators or both, send.
//   GET  /v1/admin/broadcasts/reach  → how many people each audience reaches right now
//   GET  /v1/admin/broadcasts        → what has been sent
//   POST /v1/admin/broadcasts        → send one
// Recipients see it in their Messages inbox and as a bell notification.

import { Body, Controller, Get, Inject, Post, Query, Req, BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { BroadcastError, BROADCAST_BODY_MAX, BROADCAST_TITLE_MAX, broadcastAudiences, broadcastReach, listBroadcasts, sendBroadcast, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

// A path on this site only: it starts with one slash, so it can never point at another website.
const sitePath = z.string().trim().max(200).regex(/^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/, "Use a page on this site, like /dashboard/coa-nfc");

const sendSchema = z
  .object({
    audiences: z.array(z.enum(broadcastAudiences)).min(1).max(broadcastAudiences.length),
    title: z.string().trim().min(1).max(BROADCAST_TITLE_MAX),
    body: z.string().trim().min(1).max(BROADCAST_BODY_MAX),
    url: sitePath.nullable().optional(),
  })
  .strict();
type SendBody = z.infer<typeof sendSchema>;

@Controller("v1/admin/broadcasts")
export class BroadcastsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin")
  @Get("reach")
  reach() {
    return broadcastReach(this.db);
  }

  @Roles("admin")
  @Get()
  async list(@Query("limit") limit?: string) {
    return { broadcasts: await listBroadcasts(this.db, Number(limit) || 50) };
  }

  @Roles("admin")
  @Post()
  async send(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(sendSchema)) body: SendBody) {
    try {
      return await sendBroadcast(this.db, {
        adminId: req.authUser.uid,
        audiences: body.audiences,
        title: body.title,
        body: body.body,
        url: body.url ?? null,
      });
    } catch (error) {
      if (error instanceof BroadcastError) throw new BadRequestException({ type: "about:blank", title: error.message, status: 400, code: "broadcast_refused" });
      throw error;
    }
  }
}
