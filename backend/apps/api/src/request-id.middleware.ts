// X-Request-Id propagation (plan.md §18). Accepts an inbound request id
// (so a request traced through Cloudflare/a load balancer keeps the same
// id end-to-end) or mints one — every log line and error response for this
// request should carry it once structured logging exists (Phase 0/1).

import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("X-Request-Id");
  const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader("X-Request-Id", requestId);
  (req as Request & { requestId: string }).requestId = requestId;
  next();
}
