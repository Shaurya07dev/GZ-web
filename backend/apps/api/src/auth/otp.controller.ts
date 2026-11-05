// OTP endpoints — email (sign-up verification + password reset) and phone
// (post-sign-up verification). All six-digit codes; the code itself only
// ever leaves the server in the delivered mail/SMS.
//
// Owner directive 3 Nov 2026:
//   - Sign-up: user creates account with password → we send an email OTP;
//     after verify, we ask for a phone number and send an SMS OTP.
//   - Google sign-up: email already verified by Google; only phone step runs.
//   - Password reset: /forgot-password → email OTP → /reset-password with
//     code + new password.
//
// Rate limiting: per endpoint + per identifier. db/otp.ts already caps 5
// send attempts per hour per identifier; the controller also applies IP
// throttling via @Throttle to stop an attacker from cycling emails from
// one host.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import {
  issueOtp,
  markEmailVerified,
  markPhoneVerified,
  setPassword,
  userRecordByEmail,
  verifyOtp,
  OtpError,
  AuthError,
  type Db,
} from "@galleryzone/db";
import { DB } from "../db.module.ts";
import { Emails } from "../mail/emails.ts";
import { Msg91Sender } from "../sms/msg91.ts";
import { Public, Roles } from "./roles.decorator.ts";
import type { AuthenticatedRequest } from "./roles.guard.ts";
import { ZodValidationPipe } from "../zod-validation.pipe.ts";

const emailOtpSendSchema = z
  .object({
    email: z.string().email().transform((s) => s.trim().toLowerCase()),
    purpose: z.enum(["signup", "password_reset"]),
  })
  .strict();
type EmailOtpSendBody = z.infer<typeof emailOtpSendSchema>;

const emailOtpVerifySchema = z
  .object({
    email: z.string().email().transform((s) => s.trim().toLowerCase()),
    code: z.string().regex(/^\d{6}$/, "6-digit code"),
    purpose: z.enum(["signup", "password_reset"]),
  })
  .strict();
type EmailOtpVerifyBody = z.infer<typeof emailOtpVerifySchema>;

const phoneOtpSendSchema = z
  .object({
    phone: z.string().regex(/^(\+?91)?[6-9]\d{9}$/, "10-digit Indian mobile"),
  })
  .strict();
type PhoneOtpSendBody = z.infer<typeof phoneOtpSendSchema>;

const phoneOtpVerifySchema = z
  .object({
    phone: z.string().regex(/^(\+?91)?[6-9]\d{9}$/, "10-digit Indian mobile"),
    code: z.string().regex(/^\d{6}$/, "6-digit code"),
  })
  .strict();
type PhoneOtpVerifyBody = z.infer<typeof phoneOtpVerifySchema>;

const resetPasswordSchema = z
  .object({
    email: z.string().email().transform((s) => s.trim().toLowerCase()),
    code: z.string().regex(/^\d{6}$/, "6-digit code"),
    password: z
      .string()
      .min(8)
      .regex(/[A-Za-z]/, "needs a letter")
      .regex(/\d/, "needs a number"),
  })
  .strict();
type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;

function problem(status: number, title: string, code: string) {
  return { type: "about:blank", title, status, code };
}

@Controller("v1/auth")
export class OtpController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
    private readonly sms: Msg91Sender,
  ) {}

  /**
   * Issues an email OTP. For sign-up: refuses only if the email already
   * has a VERIFIED account (the registration flow creates the Firebase
   * user unverified, then calls this endpoint — so "account exists but
   * not verified yet" is exactly the state we want to send OTPs to).
   * For password-reset: refuses silently with 202 if there's no account
   * (same shape as a successful send) so the response never reveals
   * whether an address is registered.
   */
  @Public()
  @Throttle({ burst: { limit: 3, ttl: 60_000 }, sustained: { limit: 20, ttl: 3_600_000 } })
  @Post("email-otp/send")
  @HttpCode(202)
  async sendEmailOtp(@Body(new ZodValidationPipe(emailOtpSendSchema)) body: EmailOtpSendBody) {
    // If the Mailer cannot reach a stranger (RESEND_API_KEY missing OR
    // EMAIL_FROM still pointing at Resend's sandbox) we would silently
    // issue codes that never arrive. Fail loud with an actionable
    // message so the operator sees the config issue instead of the
    // customer sitting on a "verify your email" screen forever.
    const hint = this.emails.setupHint;
    if (hint) {
      throw new ServiceUnavailableException(
        problem(
          503,
          `Email service is not fully configured on the backend: ${hint}`,
          "email_not_configured",
        ),
      );
    }
    const record = await userRecordByEmail(body.email);
    if (body.purpose === "signup" && record?.emailVerified) {
      throw new ConflictException(problem(409, "An account with this email already exists", "email_taken"));
    }
    if (body.purpose === "password_reset" && !record) {
      // Silent accept — same shape as success.
      return { accepted: true };
    }
    try {
      const { code } = await issueOtp({
        db: this.db,
        channel: "email",
        identifier: body.email,
        purpose: body.purpose === "signup" ? "signup_email" : "password_reset",
        uid: record?.uid ?? null,
      });
      if (body.purpose === "signup") {
        await this.emails.signupEmailOtp(body.email, null, code);
      } else {
        await this.emails.passwordResetOtp(body.email, record?.displayName ?? null, code);
      }
    } catch (error) {
      if (error instanceof OtpError) {
        throw new BadRequestException(problem(400, error.message, "otp_rate_limited"));
      }
      throw error;
    }
    return { accepted: true };
  }

  /**
   * Verifies an email OTP. For sign-up: marks the email verified on the just-
   * created account. For password_reset: returns a short-lived token the
   * `/reset-password` endpoint uses to apply the new password — but we
   * actually bake the OTP code INTO reset-password so this endpoint is only
   * used for the sign-up flow.
   */
  @Public()
  @Throttle({ burst: { limit: 5, ttl: 60_000 }, sustained: { limit: 30, ttl: 3_600_000 } })
  @Post("email-otp/verify")
  @HttpCode(200)
  async verifyEmailOtp(@Body(new ZodValidationPipe(emailOtpVerifySchema)) body: EmailOtpVerifyBody) {
    try {
      const { uid } = await verifyOtp({
        db: this.db,
        channel: "email",
        identifier: body.email,
        code: body.code,
        expectedPurpose: body.purpose === "signup" ? "signup_email" : "password_reset",
      });
      if (body.purpose === "signup") {
        // Look up the uid now (sign-up OTP is issued before account exists in
        // the common flow; by verify time registerUser has run).
        const record = await userRecordByEmail(body.email);
        if (!record) {
          throw new BadRequestException(problem(400, "No account to verify. Finish sign-up first.", "no_account"));
        }
        await markEmailVerified(this.db, record.uid);
        return { verified: true, uid: record.uid };
      }
      return { verified: true, uid };
    } catch (error) {
      if (error instanceof OtpError) {
        throw new BadRequestException(problem(400, error.message, "otp_invalid"));
      }
      throw error;
    }
  }

  /**
   * Issues a phone OTP for the signed-in user. Called after email is verified;
   * the UI collects the phone number and posts it here. Refuses if MSG91 is
   * not configured — see Msg91Sender.
   */
  @Roles("customer", "artist", "aggregator", "admin")
  @Throttle({ burst: { limit: 3, ttl: 60_000 }, sustained: { limit: 10, ttl: 3_600_000 } })
  @Post("phone-otp/send")
  @HttpCode(202)
  async sendPhoneOtp(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(phoneOtpSendSchema)) body: PhoneOtpSendBody,
  ) {
    if (!this.sms.enabled) {
      throw new ServiceUnavailableException(
        problem(503, "SMS is not configured on this server. Please contact support.", "sms_unavailable"),
      );
    }
    const normalised = body.phone.replace(/\D/g, "").slice(-10);
    try {
      const { code } = await issueOtp({
        db: this.db,
        channel: "phone",
        identifier: `+91${normalised}`,
        purpose: "signup_phone",
        uid: req.authUser.uid,
      });
      await this.sms.send({ phone: normalised, code });
    } catch (error) {
      if (error instanceof OtpError) {
        throw new BadRequestException(problem(400, error.message, "otp_rate_limited"));
      }
      throw error;
    }
    return { accepted: true };
  }

  /**
   * Verifies a phone OTP and stores the number on the user. The OTP's `uid`
   * must match the caller — defence in depth beyond the auth guard.
   */
  @Roles("customer", "artist", "aggregator", "admin")
  @Throttle({ burst: { limit: 5, ttl: 60_000 }, sustained: { limit: 30, ttl: 3_600_000 } })
  @Post("phone-otp/verify")
  @HttpCode(200)
  async verifyPhoneOtp(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(phoneOtpVerifySchema)) body: PhoneOtpVerifyBody,
  ) {
    const normalised = body.phone.replace(/\D/g, "").slice(-10);
    try {
      const { uid } = await verifyOtp({
        db: this.db,
        channel: "phone",
        identifier: `+91${normalised}`,
        code: body.code,
        expectedPurpose: "signup_phone",
      });
      if (uid && uid !== req.authUser.uid) {
        // OTP was issued for a different account — refuse.
        throw new UnauthorizedException(problem(401, "That code was issued for a different account.", "wrong_account"));
      }
      await markPhoneVerified(this.db, req.authUser.uid, normalised);
    } catch (error) {
      if (error instanceof OtpError) {
        throw new BadRequestException(problem(400, error.message, "otp_invalid"));
      }
      if (error instanceof AuthError) {
        throw new BadRequestException(problem(400, error.message, "invalid_phone"));
      }
      throw error;
    }
    return { verified: true };
  }

  /**
   * Applies a new password after verifying the password-reset OTP. One shot:
   * the OTP is consumed and the password is set in a single request, so a
   * leaked verify response doesn't give the attacker a token to replay.
   */
  @Public()
  @Throttle({ burst: { limit: 3, ttl: 60_000 }, sustained: { limit: 10, ttl: 3_600_000 } })
  @Post("reset-password")
  @HttpCode(200)
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordBody) {
    try {
      const { uid } = await verifyOtp({
        db: this.db,
        channel: "email",
        identifier: body.email,
        code: body.code,
        expectedPurpose: "password_reset",
      });
      if (!uid) {
        throw new BadRequestException(problem(400, "No account found for this email.", "no_account"));
      }
      await setPassword(uid, body.password);
    } catch (error) {
      if (error instanceof OtpError) {
        throw new BadRequestException(problem(400, error.message, "otp_invalid"));
      }
      if (error instanceof AuthError) {
        throw new BadRequestException(problem(400, error.message, "invalid_password"));
      }
      throw error;
    }
    return { reset: true };
  }
}
