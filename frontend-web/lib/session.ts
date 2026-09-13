// The role cookie, in one place. The real credential is the Firebase ID
// token (lib/firebase.ts) which the API verifies on every call; this cookie
// only carries the ROLE the backend reported from GET /v1/auth/me, so that
// proxy.ts can route-guard on the server and the header can show the right
// controls without a round trip. Login, the register page's demo buttons,
// both sign-out buttons and the route guard all go through here, so the
// cookie name, lifetime and landing routes can't drift apart across files.

export type SessionRole = "artist" | "aggregator" | "customer" | "admin";

export const SESSION_COOKIE = "gz_session";

// 30 days. The session has to survive closing the browser: someone who signed
// in this morning and comes back after lunch expects their dashboard, not the
// login page.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// Where a signed-in person lands when they ARRIVE AT THE SITE ROOT. Buyers go
// to the marketplace on purpose — sending someone who came to look at art to
// their own orders page is the wrong door. Signing in explicitly is different:
// that uses ROLE_SECTION_HOME below, because you sign in to get to your own
// portal.
export const ROLE_LANDING: Record<SessionRole, string> = {
  artist: "/dashboard",
  aggregator: "/aggregator/dashboard",
  admin: "/admin",
  customer: "/marketplace",
};

// Deliberately NOT the same map as ROLE_LANDING. This one is each role's own
// portal, used in the two cases where a person is explicitly headed there:
// right after signing in, and when they are bounced off a section belonging to
// another role. A buyer lands in their account area both times — dropping them
// into the shop instead reads as "nothing happened".
export const ROLE_SECTION_HOME: Record<SessionRole, string> = {
  artist: "/dashboard",
  aggregator: "/aggregator/dashboard",
  admin: "/admin",
  customer: "/account",
};

export function isSessionRole(value: string | undefined): value is SessionRole {
  return value === "artist" || value === "aggregator" || value === "customer" || value === "admin";
}

// Client-side read of the session cookie. The route guard reads it on the
// server; the public header needs it in the browser so it can show the right
// controls instead of an unconditional "Sign In".
export function readSessionRole(): SessionRole | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${SESSION_COOKIE}=`));
  const value = match?.split("=")[1];
  return isSessionRole(value) ? value : null;
}

// The cookie is external state as far as React is concerned, so components
// read it through useSyncExternalStore rather than an effect. Nothing emits an
// event when a cookie changes, so signIn/signOut announce it themselves and we
// also re-read when the tab regains focus (covers signing out in another tab).
const SESSION_CHANGED_EVENT = "gz:session-changed";

export function subscribeToSession(onChange: () => void): () => void {
  window.addEventListener(SESSION_CHANGED_EVENT, onChange);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener(SESSION_CHANGED_EVENT, onChange);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

function announceSessionChange(): void {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

// `persistent: false` makes it a browser-session cookie (dies on close) —
// the "Keep me signed in" unticked case.
export function signIn(
  role: SessionRole,
  { persistent = true }: { persistent?: boolean } = {},
): void {
  const maxAge = persistent ? `; max-age=${SESSION_MAX_AGE_SECONDS}` : "";
  document.cookie = `${SESSION_COOKIE}=${role}; path=/${maxAge}; samesite=lax`;
  announceSessionChange();
}

export function signOut(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
  announceSessionChange();
}
