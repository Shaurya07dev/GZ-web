// The one "Get in touch" form and the admin's inbox for it.
//   POST  /v1/contact                    → public; one enquiry, tagged with what it is about
//   GET   /v1/admin/enquiries            → admin; ?type= and ?status= filters, with counts of what is still new
//   PATCH /v1/admin/enquiries/:id        → admin; mark handled or new again

import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import {
  ENQUIRY_MESSAGE_MAX,
  EnquiryError,
  countByType,
  enquiryStatuses,
  enquirySenderRoles,
  enquiryTypes,
  listEnquiries,
  setEnquiryStatus,
  submitEnquiry,
  type Db,
  type EnquiryStatus,
  type EnquiryType,
} from "@galleryzone/db";
import { Public, Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const submitSchema = z
  .object({
    type: z.enum(enquiryTypes),
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(160),
    senderRole: z.enum(enquirySenderRoles),
    message: z.string().trim().min(1).max(ENQUIRY_MESSAGE_MAX),
    // A hidden field real people never fill in; a bot that fills every box trips it.
    website: z.string().max(0).optional(),
  })
  .strict();
type SubmitBody = z.infer<typeof submitSchema>;

const statusSchema = z.object({ status: z.enum(enquiryStatuses) }).strict();

@Controller("v1")
export class EnquiriesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Public()
  @Throttle({ sustained: { limit: 5, ttl: 60_000 } })
  @Post("contact")
  async submit(@Body(new ZodValidationPipe(submitSchema)) body: SubmitBody) {
    try {
      return await submitEnquiry(this.db, { type: body.type, name: body.name, email: body.email, senderRole: body.senderRole, message: body.message });
    } catch (error) {
      if (error instanceof EnquiryError) throw new BadRequestException({ type: "about:blank", title: error.message, status: 400, code: "enquiry_refused" });
      throw error;
    }
  }

  @Roles("admin")
  @Get("admin/enquiries")
  async list(@Query("type") type?: string, @Query("status") status?: string) {
    const wantedType = enquiryTypes.includes(type as EnquiryType) ? (type as EnquiryType) : undefined;
    const wantedStatus = enquiryStatuses.includes(status as EnquiryStatus) ? (status as EnquiryStatus) : undefined;
    // The counts are over everything, not the filtered view, so the filter chips keep their numbers.
    const everything = await listEnquiries(this.db);
    return {
      enquiries: everything.filter((e) => (!wantedType || e.type === wantedType) && (!wantedStatus || e.status === wantedStatus)),
      waiting: countByType(everything),
    };
  }

  @Roles("admin")
  @Patch("admin/enquiries/:id")
  async setStatus(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(statusSchema)) body: z.infer<typeof statusSchema>) {
    try {
      await setEnquiryStatus(this.db, id, body.status, req.authUser.uid);
    } catch (error) {
      if (error instanceof EnquiryError) throw new NotFoundException();
      throw error;
    }
    return { id, status: body.status };
  }
}
