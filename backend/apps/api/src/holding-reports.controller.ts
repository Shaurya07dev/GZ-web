// Aggregator-raised issue reports on pieces they're holding. Two audiences:
//   - aggregator  POST  /v1/aggregator/holdings/:id/reports  submit a new report
//                 GET   /v1/aggregator/holdings/:id/reports  list my own reports on this holding
//   - admin       GET   /v1/admin/holding-reports            review all reports (filter by status)
//                 POST  /v1/admin/holding-reports/:id/resolve  mark resolved with an optional note

import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req } from "@nestjs/common";
import {
  createHoldingReport,
  listHoldingReports,
  resolveHoldingReport,
  type Db,
  type HoldingReportStatus,
} from "@galleryzone/db";
import {
  createHoldingReportInputSchema,
  resolveHoldingReportInputSchema,
  type CreateHoldingReportInput,
  type ResolveHoldingReportInput,
} from "@galleryzone/contracts";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

@Controller("v1")
export class HoldingReportsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("aggregator")
  @Post("aggregator/holdings/:id/reports")
  async submit(
    @Req() req: AuthenticatedRequest,
    @Param("id") holdingId: string,
    @Body(new ZodValidationPipe(createHoldingReportInputSchema)) body: CreateHoldingReportInput,
  ) {
    try {
      return await createHoldingReport(this.db, {
        holdingId,
        aggregatorId: req.authUser.uid,
        issueType: body.issueType,
        description: body.description,
      });
    } catch (err) {
      // Not-found-shaped either way: a stranger shouldn't learn whether the id exists.
      throw new NotFoundException({ type: "about:blank", title: "Holding not found", status: 404, code: "not_found" });
    }
  }

  @Roles("admin")
  @Get("admin/holding-reports")
  async list(@Query("status") status?: string) {
    const narrowed: HoldingReportStatus | undefined =
      status === "open" || status === "resolved" ? status : undefined;
    const filter = narrowed ? { status: narrowed } : undefined;
    return { reports: await listHoldingReports(this.db, filter) };
  }

  @Roles("admin")
  @Post("admin/holding-reports/:id/resolve")
  async resolve(
    @Req() req: AuthenticatedRequest,
    @Param("id") reportId: string,
    @Body(new ZodValidationPipe(resolveHoldingReportInputSchema)) body: ResolveHoldingReportInput,
  ) {
    return resolveHoldingReport(this.db, {
      reportId,
      adminId: req.authUser.uid,
      note: body.note ?? null,
    });
  }
}
