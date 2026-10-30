// Global guard on every :param. Express decodes %2F inside a param, so
// /v1/artworks/a%2Fpricing%2Fdata hands "a/pricing/data" to
// db.collection("artworks").doc(id) — a sub-collection path, not an id.
// Every param in this API is one path segment (an id, slug or filename), and
// an unbounded one also bloats cache keys, so both are refused up front.

import { BadRequestException, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";

export function isSafeRouteParam(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && !value.includes("/");
}

export class RouteParamPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== "param" || isSafeRouteParam(value)) return value;
    throw new BadRequestException({ type: "about:blank", title: "Malformed path parameter", status: 400, code: "bad_param" });
  }
}
