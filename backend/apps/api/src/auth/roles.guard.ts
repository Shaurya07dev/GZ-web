// SECURITY: this guard is intentionally NOT permissive. Until Firebase ID
// token verification exists (Phase 1 — see the plan's Security posture
// section: "authorization decisions always re-derived from Postgres roles,
// never trusted from JWT custom claims"), every non-@Public() route fails
// closed with 501 Not Implemented rather than being silently reachable.
// This is deliberate: the alternative (skip the check, "add auth later")
// is exactly the kind of gap the plan explicitly rules out — a route that
// LOOKS protected because it carries @Roles() but isn't actually enforced
// yet is worse than one that's honestly broken until it's finished.
//
// Replacing the 501 with a real check is a Phase 1 task: verify the
// Firebase ID token, load the user's role + role_grants from Postgres
// (packages/db's identity schema), and compare against the route's
// @Roles() list — never against the token's own claims.

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PUBLIC_KEY, ROLES_KEY } from "./roles.decorator.ts";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles) {
      // No @Roles() and no @Public() — treat as a bug in the route
      // definition, not an accidentally-open endpoint.
      throw new HttpException(
        { type: "about:blank", title: "Route is missing an access-control decorator", status: 500, code: "misconfigured_route" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    throw new HttpException(
      {
        type: "about:blank",
        title: "Authentication is not implemented yet",
        status: 501,
        code: "not_implemented",
        detail: `This route requires one of [${roles.join(", ")}], but Firebase auth verification (Phase 1) isn't wired in yet.`,
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
