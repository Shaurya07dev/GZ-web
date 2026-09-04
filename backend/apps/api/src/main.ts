import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "@galleryzone/config";
import { AppModule } from "./app.module.ts";
import { HttpExceptionFilter } from "./http-exception.filter.ts";

// Real NestJS bootstrap. Wired in so far: RolesGuard (global, fail-closed —
// see auth/roles.guard.ts), the RFC 7807 exception filter, X-Request-Id
// middleware. Still missing before this can be deployed reachable from the
// internet (plan's Security posture section, all non-negotiable):
//   - Firebase ID token verification (RolesGuard currently 501s every
//     protected route rather than actually checking a token — Phase 1)
//   - CORS allowlist, rate limiting (Cloudflare + Redis token bucket)
// Safe to run locally today for verifying the HTTP layer actually works —
// every protected route correctly fails closed rather than being open.
async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(env.port);
  console.log(`[api] listening on :${env.port} (${env.nodeEnv})`);
}

void bootstrap();
