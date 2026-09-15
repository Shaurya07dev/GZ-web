// Auth HTTP surface. Sign-IN never touches this controller: the browser
// signs in against Firebase Auth directly (client SDK) and sends the
// resulting ID token as `Authorization: Bearer` to every other route,
// where RolesGuard verifies it. What the backend must own is the
// Firestore side of an account — users/{uid} is the ONLY authoritative
// source of role/status (auth/roles.guard.ts) and the Admin SDK is its
// only writer — hence:
//   POST /v1/auth/register   email+password sign-up (creates Auth user + profile)
//   POST /v1/auth/bootstrap  OAuth first-login (Auth user already exists; create profile)
//   GET  /v1/auth/me         the caller's own profile, from Firestore
//
// `bootstrap` is @Public() because RolesGuard 401s any token whose
// users/{uid} doc is missing — exactly the state this route exists to fix.
// It still verifies the token itself; the uid comes from the token, never
// the body, so a caller can only ever create their own profile.

import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { z } from "zod";
import {
  AuthError,
  createUserProfile,
  generateEmailVerificationLink,
  generatePasswordResetLink,
  getCurrentUser,
  registerUser,
  userRecordByEmail,
  verifyIdToken,
  type Db,
} from "@galleryzone/db";
import { Emails, oobCodeOf } from "../mail/emails.ts";
import { Throttle } from "@nestjs/throttler";
import { Public, Roles } from "./roles.decorator.ts";
import type { AuthenticatedRequest } from "./roles.guard.ts";
import { DB } from "../db.module.ts";
import { ZodValidationPipe } from "../zod-validation.pipe.ts";

const selfServeRole = z.enum(["artist", "aggregator", "customer"]);
// Same rules the frontend's registerBaseSchema enforces (8+ chars, a letter
// and a digit) so a request that passes the form can't fail here.
const password = z.string().min(8).regex(/[A-Za-z]/, "needs a letter").regex(/\d/, "needs a number");
const phone = z.string().regex(/^\d{10}$/, "10-digit Indian mobile number").optional();

const registerSchema = z
  .object({ email: z.string().email(), password, name: z.string().trim().min(2).max(120), role: selfServeRole, phone })
  .strict();
type RegisterBody = z.infer<typeof registerSchema>;

const bootstrapSchema = z.object({ role: selfServeRole, name: z.string().trim().min(2).max(120).optional(), phone }).strict();
type BootstrapBody = z.infer<typeof bootstrapSchema>;

const emailOnlySchema = z.object({ email: z.string().email() }).strict();
type EmailOnlyBody = z.infer<typeof emailOnlySchema>;

const SITE = () => (process.env.PUBLIC_SITE_URL || "https://www.galleryzone.art").replace(/\/$/, "");

function problem(status: number, title: string, code: string, detail?: string) {
  return { type: "about:blank", title, status, code, ...(detail ? { detail } : {}) };
}

/** firebase-admin surfaces its own errors as `{ code: "auth/…" }`; map the ones a user can actually cause. */
function firebaseAuthCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
}

@Controller("v1/auth")
export class AuthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
  ) {}

  /** Welcome mail with an email-verification link that lands on OUR /verify-email page. Never fails the request. */
  private sendWelcome(uid: string, email: string) {
    void generateEmailVerificationLink(email, `${SITE()}/login`)
      .then((link) => {
        const code = oobCodeOf(link);
        return this.emails.welcome(uid, code ? `${SITE()}/verify-email?token=${encodeURIComponent(code)}` : null);
      })
      .catch(this.emails.swallow("welcome mail"));
  }

  @Public()
  @Post("register")
  @HttpCode(201)
  async register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterBody): Promise<{ uid: string }> {
    try {
      const result = await registerUser(this.db, body);
      this.sendWelcome(result.uid, body.email);
      return result;
    } catch (error) {
      const code = firebaseAuthCode(error);
      if (code === "auth/email-already-exists") {
        throw new ConflictException(problem(409, "An account with this email already exists", "email_taken"));
      }
      if (code === "auth/invalid-email" || code === "auth/invalid-password") {
        throw new ConflictException(problem(409, "Firebase rejected the email or password", "invalid_credentials", code));
      }
      throw error;
    }
  }

  @Public()
  @Post("bootstrap")
  @HttpCode(201)
  async bootstrap(
    @Headers("authorization") authorization: string | undefined,
    @Body(new ZodValidationPipe(bootstrapSchema)) body: BootstrapBody,
  ) {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
    if (!token) throw new UnauthorizedException(problem(401, "Missing Authorization: Bearer <Firebase ID token>", "unauthorized"));
    const verified = await verifyIdToken(token).catch(() => null);
    if (!verified) throw new UnauthorizedException(problem(401, "Invalid or expired ID token", "unauthorized"));

    // Idempotent: a second call (e.g. the client retried) returns the existing profile untouched.
    const existing = await getCurrentUser(this.db, verified.uid);
    if (existing) return existing;

    const name = body.name ?? verified.name ?? verified.email ?? "New user";
    if (!verified.email) {
      throw new ConflictException(problem(409, "This sign-in provider did not share an email address", "email_required"));
    }
    try {
      await createUserProfile(this.db, verified.uid, { email: verified.email, name, role: body.role, phone: body.phone ?? null });
    } catch (error) {
      if (error instanceof AuthError) throw new ConflictException(problem(409, error.message, "profile_exists"));
      throw error;
    }
    // OAuth providers hand us a verified email, so no verification link.
    void this.emails.welcome(verified.uid, null).catch(this.emails.swallow("welcome mail"));
    return getCurrentUser(this.db, verified.uid);
  }

  /**
   * Password reset by email, sent through our own mailer so it carries our
   * branding and lands on /reset-password?token=<oobCode>. Always answers
   * 202 — the response never reveals whether the address has an account.
   */
  @Public()
  @Throttle({ burst: { limit: 3, ttl: 60_000 }, sustained: { limit: 10, ttl: 3_600_000 } })
  @Post("password-reset")
  @HttpCode(202)
  async passwordReset(@Body(new ZodValidationPipe(emailOnlySchema)) body: EmailOnlyBody): Promise<{ accepted: true }> {
    void (async () => {
      const record = await userRecordByEmail(body.email);
      if (!record) return;
      const link = await generatePasswordResetLink(body.email, `${SITE()}/login`);
      const code = oobCodeOf(link);
      if (!code) return;
      await this.emails.passwordReset(body.email, record.displayName, `${SITE()}/reset-password?token=${encodeURIComponent(code)}`);
    })().catch(this.emails.swallow("password reset mail"));
    return { accepted: true };
  }

  /** Re-send the verification link to a signed-in, still-unverified account. */
  @Roles("customer", "artist", "aggregator", "admin")
  @Post("resend-verification")
  @HttpCode(202)
  async resendVerification(@Req() req: AuthenticatedRequest): Promise<{ accepted: true }> {
    const user = await getCurrentUser(this.db, req.authUser.uid);
    if (user) this.sendWelcome(user.uid, user.email);
    return { accepted: true };
  }

  @Roles("customer", "artist", "aggregator", "admin")
  @Get("me")
  async me(@Req() req: AuthenticatedRequest) {
    // The guard already proved users/{uid} exists; a null here would mean it was deleted mid-request.
    const user = await getCurrentUser(this.db, req.authUser.uid);
    if (!user) throw new UnauthorizedException(problem(401, "No account record for this token", "unauthorized"));
    return user;
  }
}
