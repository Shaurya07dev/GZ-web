import type { BrowserContext } from '@playwright/test';

// Mirrors lib/session.ts: there is no real backend, signing in just writes
// this cookie and proxy.ts reads it as the route guard. Setting it directly
// reaches guarded routes (/dashboard, /aggregator, /admin, /account) without
// driving the login form in every route-level test.
export type SessionRole = 'artist' | 'aggregator' | 'customer' | 'admin';

const SESSION_COOKIE = 'gz_session';

export async function signInAs(
  context: BrowserContext,
  role: SessionRole,
  baseURL: string,
): Promise<void> {
  const { hostname } = new URL(baseURL);
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: role,
      domain: hostname,
      path: '/',
    },
  ]);
}
