// Per-route role metadata, matching packages/contracts/api-routes.ts's
// `authRole` field one-to-one — every controller method should carry
// exactly one of these two decorators so RolesGuard (roles.guard.ts) knows
// what to check. A route with neither is a bug the guard treats as
// forbidden by default, not a route the guard skips.

import { SetMetadata } from "@nestjs/common";
import type { AuthRole } from "@galleryzone/contracts";

export const ROLES_KEY = "gz:roles";
export const PUBLIC_KEY = "gz:public";

/** Minimum role(s) allowed to call this route once real auth exists. */
export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);

/** Explicitly no auth required — the NFC/QR passport page, health check, etc. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
