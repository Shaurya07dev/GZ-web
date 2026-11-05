import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "./auth/roles.decorator.ts";
import { Emails } from "./mail/emails.ts";
import type { AppEnv } from "@galleryzone/config";
import { ENV } from "./db.module.ts";

// Wired to Cloud Run's readiness/liveness probe once deployed (plan's
// Phase 0). Deliberately does no DB/Redis ping yet — that's added once
// packages/db has a real Postgres client (Phase 1), at which point this
// becomes the place a broken connection pool actually shows up as an
// unhealthy container instead of silently serving 500s.
@Controller("v1/health")
export class HealthController {
  constructor(
    private readonly emails: Emails,
    @Inject(ENV) private readonly env: AppEnv,
  ) {}

  @Public()
  @Get()
  check(): { status: "ok"; timestamp: string } {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  /**
   * Public config-readiness probe. No secrets leaked — just booleans and
   * actionable hints. Used by the operator to debug "my client isn't
   * getting the OTP email" / "Razorpay isn't opening" from outside the
   * container with no auth needed.
   */
  @Public()
  @Get("config")
  config(): Record<string, unknown> {
    return {
      emailDeliveryReady: this.emails.canDeliverExternally,
      emailSetupHint: this.emails.setupHint,
      paymentsMode: this.env.paymentsMode,
      paymentsConfigured: Boolean(this.env.razorpayKeyId && this.env.razorpayKeySecret),
      smsConfigured: this.env.msg91 !== null,
      adminSeedConfigured: this.env.adminSeed !== null,
      otpSecretConfigured: Boolean(process.env.OTP_SECRET && process.env.OTP_SECRET.length >= 32),
      publicSiteUrl: process.env.PUBLIC_SITE_URL || null,
      timestamp: new Date().toISOString(),
    };
  }
}
