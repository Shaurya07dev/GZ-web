// Sentry must initialise before any other import so it can patch http and
// the framework — hence its own file, imported first from main.ts. No DSN
// (local dev) means a no-op SDK.

import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.RAILWAY_GIT_COMMIT_SHA ?? undefined,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  });
}

export { Sentry };
