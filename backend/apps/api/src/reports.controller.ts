import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { setEarningsAbove5L, listReports, generateReport, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const earningsSchema = z.object({ value: z.boolean() }).strict();
type EarningsBody = z.infer<typeof earningsSchema>;
const reportSchema = z.object({ type: z.enum(["sales", "settlements", "gst"]) }).strict();
type ReportBody = z.infer<typeof reportSchema>;

@Controller("v1/admin")
export class ReportsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin")
  @Patch("users/:id/earnings-above-5l")
  async setEarnings(@Param("id") id: string, @Body(new ZodValidationPipe(earningsSchema)) body: EarningsBody) {
    await setEarningsAbove5L(this.db, id, body.value);
    return { userId: id, earningsAbove5L: body.value };
  }

  @Roles("admin")
  @Get("reports")
  list() {
    return listReports();
  }

  @Roles("admin")
  @Post("reports")
  generate(@Body(new ZodValidationPipe(reportSchema)) body: ReportBody) {
    return generateReport(this.db, body.type);
  }
}
