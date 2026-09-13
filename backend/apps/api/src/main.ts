import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "@galleryzone/config";
import { AppModule } from "./app.module.ts";
import { HttpExceptionFilter } from "./http-exception.filter.ts";

// Real NestJS bootstrap. Wired in: RolesGuard (global, fail-closed — real
// Firebase ID-token verification, see auth/roles.guard.ts), the RFC 7807
// exception filter, X-Request-Id middleware, and a CORS allowlist from
// CORS_ORIGINS. Still missing before internet exposure: rate limiting
// (Cloudflare + Redis token bucket).
async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  // Bearer tokens, not cookies, so no credentials — keeps the allowlist the only CORS decision.
  app.enableCors({ origin: env.corsOrigins, credentials: false, methods: ["GET", "POST", "PATCH", "DELETE"] });
  await app.listen(env.port);
  console.log(`[api] listening on :${env.port} (${env.nodeEnv})`);
}

void bootstrap();
