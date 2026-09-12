import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright's baseURL is 127.0.0.1 (more reliable than localhost for this
  // environment's curl/Playwright connectivity — see TESTING_VERIFICATION_REPORT.md),
  // but `next dev`'s default cross-origin dev-asset protection only allows
  // "localhost" by default. Without this, every async chunk request (any
  // client component using next/dynamic, or split out by Turbopack — this
  // hit framer-motion and @base-ui/react in practice) 403s in the browser
  // even though curl on the same URL returns 200, because curl sends no
  // Origin header and skips the check entirely. Effect: pages render (SSR
  // HTML is unaffected) but are inert — no click/keyboard interaction works.
  // Requires a dev server restart to take effect (next.config.ts is not
  // hot-reloaded).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
