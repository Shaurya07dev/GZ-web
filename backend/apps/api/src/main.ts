import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "@galleryzone/config";
import { AppModule } from "./app.module.ts";

// Real NestJS bootstrap — no longer the Phase 0 stub. Still missing before
// this can be deployed reachable from the internet (plan's Security
// posture section, all non-negotiable):
//   - Firebase ID token verification guard (global, default-deny)
//   - RBAC per-route enforcement (roles declared in packages/contracts'
//     api-routes.ts aren't checked yet — every route here is currently
//     reachable by anyone who can reach the process)
//   - RFC 7807 global exception filter (ZodValidationPipe covers
//     validation errors only, not every error path)
//   - X-Request-Id middleware, CORS allowlist, rate limiting
// Safe to run locally today for verifying the HTTP layer actually works.
async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  await app.listen(env.port);
  console.log(`[api] listening on :${env.port} (${env.nodeEnv})`);
}

void bootstrap();
