// SECURITY: authorization is re-derived from Firestore on every request,
// never trusted from the ID token's own custom claims (plan.md §5.2's
// rule, unchanged by the pivot from Postgres to Firestore — only the
// datastore being read changed, not the "never trust the token" policy).
//
// Flow: verify the Firebase ID token (proves WHO is calling) -> read
// users/{uid} from Firestore (the only place role/status are authoritative)
// -> compare against the route's @Roles() list. A missing/invalid token,
// a suspended/blocked account, or a role not in the route's list all fail
// closed with a real 401/403 — this guard is no longer the 501 stub.

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { verifyIdToken, Collections, type Db, type UserDoc, type UserRole } from "@galleryzone/db";
import { PUBLIC_KEY, ROLES_KEY } from "./roles.decorator.ts";
import { DB } from "../db.module.ts";

export interface AuthenticatedRequest extends Request {
  authUser: { uid: string; role: UserRole; grants: string[] };
}

function problem(status: number, title: string, code: string, detail?: string): HttpException {
  return new HttpException({ type: "about:blank", title, status, code, ...(detail ? { detail } : {}) }, status);
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles) {
      // No @Roles() and no @Public() — a bug in the route definition, not
      // an accidentally-open endpoint.
      throw problem(HttpStatus.INTERNAL_SERVER_ERROR, "Route is missing an access-control decorator", "misconfigured_route");
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) throw problem(HttpStatus.UNAUTHORIZED, "Missing Authorization: Bearer <Firebase ID token>", "unauthorized");

    const verified = await verifyIdToken(token).catch(() => null);
    if (!verified) throw problem(HttpStatus.UNAUTHORIZED, "Invalid or expired ID token", "unauthorized");

    const userSnap = await this.db.collection(Collections.users).doc(verified.uid).get();
    if (!userSnap.exists) throw problem(HttpStatus.UNAUTHORIZED, "No account record for this token", "unauthorized");
    const user = userSnap.data() as UserDoc;

    if (user.status === "suspended" || user.status === "blocked") {
      throw problem(HttpStatus.FORBIDDEN, `Account is ${user.status}`, "account_" + user.status);
    }

    const allowed = roles.some((r) => r === user.role || (user.roleGrants ?? []).includes(r));
    if (!allowed) {
      throw problem(HttpStatus.FORBIDDEN, `This route requires one of [${roles.join(", ")}]`, "forbidden");
    }

    req.authUser = { uid: verified.uid, role: user.role, grants: user.roleGrants ?? [] };
    return true;
  }
}
