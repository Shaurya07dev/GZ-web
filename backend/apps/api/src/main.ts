import "./instrument.ts";
import "reflect-metadata";
import express from "express";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "@galleryzone/config";
import { AppModule } from "./app.module.ts";
import { HttpExceptionFilter } from "./http-exception.filter.ts";
import { RouteParamPipe } from "./route-param.pipe.ts";
import { assertAllHandoutsLoadable } from "./mail/handouts.ts";

// Real NestJS bootstrap. Wired in: RolesGuard (global, fail-closed — real
// Firebase ID-token verification, see auth/roles.guard.ts), the RFC 7807
// exception filter, X-Request-Id middleware, and a CORS allowlist from
// CORS_ORIGINS, and a per-IP throttle (app.module.ts). Railway sits behind
// its own edge, so the client IP is the first X-Forwarded-For hop.
async function bootstrap() {
  const env = loadEnv();
  // Ship-blocker check: every lifecycle email that attaches a handout
  // has to find its file on disk, or the email goes out without the
  // client's intended PDF. Refuse to boot if any file is missing.
  assertAllHandoutsLoadable();
  // rawBody: both webhook signatures (Razorpay's over the body, Cashfree
  // Secure ID's over the timestamp plus the body) are computed over the exact
  // bytes received, so a re-serialised body will not match.
  const app = await NestFactory.create(AppModule, { rawBody: true, bodyParser: true });
  // Image bytes for the fallback upload route arrive as the raw body.
  app.use(express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "16mb" }));
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  // JSON API + images: never framed, never sniffed, HTTPS only. Images are loaded
  // cross-origin by the website, hence cross-origin CORP.
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  });
  // Admin console responses are per-admin, time-sensitive, and must never be
  // served from a browser or intermediary cache. Client flag 19 Nov 2026:
  // closing DevTools (which disables the HTTP cache) made admin detail pages
  // start serving the first-fetched user to every subsequent click — browser
  // was reusing cached /v1/admin/users/:id responses across different ids
  // because our responses carried no Cache-Control and Chrome's freshness
  // heuristic was happy to cache GET responses that lacked one. Blanket
  // `no-store` on every admin route, applied at the middleware layer so no
  // new admin controller can forget it.
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith("/v1/admin/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Vary", "Authorization");
    }
    next();
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new RouteParamPipe());
  // Bearer tokens, not cookies, so no credentials — keeps the allowlist the only CORS decision.
  app.enableCors({ origin: env.corsOrigins, credentials: false, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] });
  await app.listen(env.port);
  console.log(`[api] listening on :${env.port} (${env.nodeEnv})`);
}

void bootstrap();
