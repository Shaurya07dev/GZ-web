import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Fake-auth route guard. There is no backend/session token — login just
// writes a `gz_session` cookie holding the demo role (see
// features/auth/components/login-form.tsx). Next 16 renamed middleware.ts to
// proxy.ts (same API, `proxy` export instead of `middleware`) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
const ROLE_HOME: Record<string, string> = {
  artist: "/dashboard",
  aggregator: "/aggregator/dashboard",
  customer: "/account",
  admin: "/admin",
};

const GUARDED_PREFIXES = ["/dashboard", "/aggregator", "/admin", "/account"];

function guardedPrefix(pathname: string): string | undefined {
  return GUARDED_PREFIXES.find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const prefix = guardedPrefix(request.nextUrl.pathname);
  if (!prefix) return NextResponse.next();

  const role = request.cookies.get("gz_session")?.value;
  const home = role ? ROLE_HOME[role] : undefined;

  if (!home) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in as the wrong role for this section (e.g. a customer hitting
  // /admin) — bounce to their own home instead of a bare 404/blank guard.
  if (!home.startsWith(prefix)) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/aggregator/:path*",
    "/admin/:path*",
    "/account/:path*",
  ],
};
