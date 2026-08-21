// The fake session, in one place. There is no backend to issue a real token,
// so signing in writes the chosen role to a cookie that proxy.ts reads on
// every request. Login, the register page's demo buttons, both sign-out
// buttons and the route guard all go through here, so the cookie name,
// lifetime and landing routes can't drift apart across five files.

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

export function signIn(role: SessionRole): void {
  document.cookie = `${SESSION_COOKIE}=${role}; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; samesite=lax`;
  announceSessionChange();
}

export function signOut(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
  announceSessionChange();
}
