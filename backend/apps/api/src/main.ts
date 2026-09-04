// NestJS bootstrap entry point. Deliberately left as a stub rather than a
// fabricated "working" server: standing this up for real needs `@nestjs/*`
// installed (network access, not available in this scaffolding pass) plus
// the Firebase-token auth guard and role middleware from Phase 1 — starting
// it before those exist would mean shipping an unauthenticated API surface,
// which the plan's Security posture section rules out.
//
// What Phase 1 wires in here:
//   - NestFactory.create(AppModule)
//   - Firebase ID token verification guard (global, default-deny)
//   - Zod validation pipe (packages/contracts schemas, reject-unknown-keys)
//   - RFC 7807 exception filter with the `code` field (plan.md §18)
//   - X-Request-Id middleware
//   - health check route, wired to Cloud Run's readiness probe
//
// loadEnv() below is real and already enforces "fail fast on missing
// config" — it's the one piece of this file safe to run today.

import { loadEnv } from "@galleryzone/config";

function main(): void {
  const env = loadEnv();
  console.log(
    `[api] env loaded for ${env.nodeEnv} — NestJS bootstrap not yet implemented (Phase 1).`,
  );
}

main();
