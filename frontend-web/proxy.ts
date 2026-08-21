import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ROLE_LANDING,
  ROLE_SECTION_HOME,
  SESSION_COOKIE,
  isSessionRole,
} from "@/lib/session";

// Fake-auth route guard. There is no backend/session token — signing in just
// writes a `gz_session` cookie holding the demo role (see lib/session.ts).
// Next 16 renamed middleware.ts to proxy.ts (same API, `proxy` export instead
// of `middleware`) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.

const GUARDED_PREFIXES = ["/dashboard", "/aggregator", "/admin", "/account"];

// Arriving at any of these while already signed in means the person wanted
// their own home, not a marketing page or a login form they don't need.
const SIGNED_OUT_ONLY = ["/", "/login", "/register"];

function guardedPrefix(pathname: string): string | undefined {
  return GUARDED_PREFIXES.find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieRole = request.cookies.get(SESSION_COOKIE)?.value;
  const role = isSessionRole(cookieRole) ? cookieRole : undefined;

  // Signed in and asking for the site root or an auth page: go straight to
  // where this role belongs. This is what makes galleryzone.in open the
  // artist's dashboard days later instead of the landing page.
  if (SIGNED_OUT_ONLY.includes(pathname)) {
    return role
      ? NextResponse.redirect(new URL(ROLE_LANDING[role], request.url))
      : NextResponse.next();
  }

  const prefix = guardedPrefix(pathname);
  if (!prefix) return NextResponse.next();

  if (!role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in as the wrong role for this section (e.g. a customer hitting
  // /admin) — bounce to their own home instead of a bare 404/blank guard.
  const sectionHome = ROLE_SECTION_HOME[role];
  if (!sectionHome.startsWith(prefix)) {
    return NextResponse.redirect(new URL(sectionHome, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/dashboard/:path*",
    "/aggregator/:path*",
    "/admin/:path*",
    "/account/:path*",
  ],
};
