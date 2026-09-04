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
      throw new BadRequestException({
        type: "about:blank",
        title: "Validation failed",
        status: 400,
        code: "validation_error",
        detail: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
