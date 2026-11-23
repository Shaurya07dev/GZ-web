// Admin console for e-way bills. Reads from the ewayBillEvents audit
// collection (every API attempt — success + failure), filterable by
// date, status and subject. Also exposes cancel + extend endpoints
// that the admin UI invokes on an issued bill.
//
// Routes:
//   GET  /v1/admin/eway-bills            → list attempts, newest first
//   POST /v1/admin/eway-bills/:ewbNo/cancel
//   POST /v1/admin/eway-bills/:ewbNo/extend

import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import {
  Collections,
  type Db,
  type EwayBillEventDoc,
} from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { EwayBillService } from "./eway-bill/eway-bill.ts";

const cancelSchema = z
  .object({
    // NIC codes: 1 = Duplicate, 2 = Order cancelled, 3 = Data entry
    // mistake, 4 = Others (requires remarks). Admin picks from the UI.
    reasonCode: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    remarks: z.string().trim().min(3).max(100),
  })
  .strict();
type CancelBody = z.infer<typeof cancelSchema>;

const extendSchema = z
  .object({
    // NIC reason codes for extend (values 1–6 typical; admin chooses).
    reasonCode: z.number().int().min(1).max(10),
    remarks: z.string().trim().min(3).max(100),
    remainingDistanceKm: z.number().int().positive().max(10_000),
    consignmentStatus: z.union([z.literal("1"), z.literal("2")]),
    from: z.object({
      place: z.string().trim().min(1).max(50),
      pincode: z.number().int().min(100_000).max(999_999),
      stateCode: z.string().trim().length(2),
    }),
  })
  .strict();
type ExtendBody = z.infer<typeof extendSchema>;

export interface EwayBillEventView {
  id: string;
  endpoint: string;
  action: EwayBillEventDoc["action"];
  subject: EwayBillEventDoc["subject"];
  requestAt: string;
  initiatedBy: string | null;
  httpStatus: number;
  statusCd: string | null;
  ewbNo: string | null;
  generatedAt: string | null;
  validUntil: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  responseSnippet: string;
}

@Controller("v1/admin/eway-bills")
export class AdminEwayBillsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly ewayBill: EwayBillService,
  ) {}

  /** Every attempt, newest first. Capped at 200 to keep the admin
   *  page snappy — the audit log can grow unbounded over time. */
  @Roles("admin")
  @Get()
  async list(): Promise<{
    enabled: boolean;
    disabledReason: string | null;
    events: EwayBillEventView[];
  }> {
    const snap = await this.db
      .collection(Collections.ewayBillEvents)
      .orderBy("requestAt", "desc")
      .limit(200)
      .get();
    const events: EwayBillEventView[] = snap.docs.map((d) => {
      const data = d.data() as EwayBillEventDoc;
      return {
        id: d.id,
        endpoint: data.endpoint,
        action: data.action,
        subject: data.subject,
        requestAt: data.requestAt.toDate().toISOString(),
        initiatedBy: data.initiatedBy,
        httpStatus: data.httpStatus,
        statusCd: data.statusCd,
        ewbNo: data.ewbNo,
        generatedAt: data.generatedAt,
        validUntil: data.validUntil,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        responseSnippet: data.responseSnippet,
      };
    });
    return {
      enabled: this.ewayBill.enabled,
      disabledReason: this.ewayBill.disabledReason,
      events,
    };
  }

  @Roles("admin")
  @Post(":ewbNo/cancel")
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param("ewbNo") ewbNo: string,
    @Body(new ZodValidationPipe(cancelSchema)) body: CancelBody,
  ): Promise<{ ok: true }> {
    await this.ewayBill.cancel({
      ewbNo,
      reasonCode: body.reasonCode,
      remarks: body.remarks,
      initiatedBy: req.authUser.uid,
    });
    return { ok: true };
  }

  @Roles("admin")
  @Post(":ewbNo/extend")
  async extend(
    @Req() req: AuthenticatedRequest,
    @Param("ewbNo") ewbNo: string,
    @Body(new ZodValidationPipe(extendSchema)) body: ExtendBody,
  ): Promise<{
    ewbNo: string;
    generatedAt: string;
    validUntil: string;
  }> {
    return this.ewayBill.extendValidity({
      ewbNo,
      reasonCode: body.reasonCode,
      remarks: body.remarks,
      remainingDistanceKm: body.remainingDistanceKm,
      consignmentStatus: body.consignmentStatus,
      from: body.from,
      initiatedBy: req.authUser.uid,
    });
  }
}
