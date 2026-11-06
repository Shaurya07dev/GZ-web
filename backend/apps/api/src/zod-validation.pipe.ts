import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

// RFC 7807 Problem Details + a machine-readable `code`, per plan.md §18 —
// the one error-format directive that document gives, applied here at the
// narrowest point (validation) rather than left for every handler to
// reinvent.
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      // Humans see `title`; ops see `detail` + `issues`. The old title
      // ("Validation failed") said nothing — the client flagged this
      // after a buyer saw "razorpayOrderId: Required; razorpayPaymentId:
      // Required; razorpaySignature: Required" as a toast on the
      // aggregator reserve flow (5 Nov 2026). The new title names one
      // field that's wrong so the UI can display a concrete sentence.
      const first = result.error.issues[0];
      const firstField = first?.path.join(".") || "a field";
      const friendlyTitle = first
        ? `Please check "${firstField}" and try again`
        : "Please fill in the required details and try again";
      throw new BadRequestException({
        type: "about:blank",
        title: friendlyTitle,
        status: 400,
        code: "validation_error",
        detail: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
