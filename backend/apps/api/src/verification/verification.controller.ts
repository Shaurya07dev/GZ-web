// Identity and business verification through Cashfree Secure ID.
//
//   POST /v1/profile/gstin/verify        artist/aggregator — check the SAVED GSTIN against the registry
//   POST /v1/profile/aadhaar/digilocker  artist/aggregator — open a DigiLocker consent URL
//   POST /v1/verification/cashfree/webhook  public — the DigiLocker outcome, signature-verified
//
// Four things worth knowing about the shape of this controller:
//
//   1. The GSTIN is read from the caller's own profile, never from the request
//      body. Otherwise this route would be a free GST-registry lookup for
//      anyone with an account, which is both a data-harvesting surface and
//      something we are billed for per call.
//   2. A pass is evidence, not an approval. verification.ts explains why: the
//      GST flag drives invoicing and §194-O, so an admin still decides.
//   3. The DigiLocker result arrives only on the webhook. The POST that opens
//      the session returns a URL and nothing about the outcome — treating its
//      response as a result is the documented trap with async verification.
//   4. The webhook maps Cashfree's verification_id back to a user through a
//      session WE issued. An id we never issued matches nobody, so a forged
//      webhook cannot attach a "verified" identity to an arbitrary account.

import { BadRequestException, Controller, Headers, HttpCode, Inject, Post, Req } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import {
  openDigiLockerSession,
  recordDigiLockerOutcome,
  recordGstinCheck,
  savedGstin,
  userForVerification,
  type Db,
} from "@galleryzone/db";
import { Public, Roles } from "../auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "../auth/roles.guard.ts";
import { DB } from "../db.module.ts";
import { CashfreeVerification } from "./cashfree-verification.ts";

interface DigiLockerWebhook {
  type?: string;
  data?: {
    verification_id?: string;
    reference_id?: string | number;
    name?: string;
    aadhaar?: { masked_aadhaar_number?: string; name?: string };
    document?: { aadhaar?: { masked_aadhaar_number?: string; name?: string } };
  };
}

@Controller("v1")
export class VerificationController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly verification: CashfreeVerification,
  ) {}

  /**
   * Verify the GSTIN already saved on the caller's profile. Returns the
   * registry's verdict and the legal name so the artist can see it matched,
   * but the approval still belongs to an admin.
   */
  @Roles("artist", "aggregator")
  @Post("profile/gstin/verify")
  async verifyGstin(@Req() req: AuthenticatedRequest) {
    const { gstin, companyName } = await savedGstin(this.db, req.authUser.uid);
    const result = await this.verification.verifyGstin({
      gstin,
      verificationId: `gz-gstin-${req.authUser.uid}-${Date.now()}`,
      businessName: companyName ?? undefined,
    });
    await recordGstinCheck(this.db, req.authUser.uid, {
      valid: result.valid,
      referenceId: result.referenceId,
      legalName: result.legalName,
      detail: { registrationStatus: result.registrationStatus, tradeName: result.tradeName },
    });
    return {
      valid: result.valid,
      legalName: result.legalName,
      tradeName: result.tradeName,
      registrationStatus: result.registrationStatus,
      // Said plainly so the artist doesn't read a passing check as being approved.
      status: result.valid ? ("submitted" as const) : ("not_verified" as const),
      message: result.valid ? "GSTIN verified against the GST registry. An admin will confirm it against your account." : result.message,
    };
  }

  /**
   * Start Aadhaar verification over DigiLocker. The artist consents on
   * DigiLocker, so no Aadhaar number ever reaches this backend.
   */
  @Roles("artist", "aggregator")
  @Post("profile/aadhaar/digilocker")
  async startDigiLocker(@Req() req: AuthenticatedRequest) {
    const verificationId = `gz-dl-${randomUUID()}`;
    const session = await this.verification.createDigiLockerSession({ verificationId, redirectPath: "/dashboard/profile" });
    await openDigiLockerSession(this.db, { verificationId, uid: req.authUser.uid, referenceId: session.referenceId });
    // The consent URL is short-lived (about ten minutes); the client opens it immediately.
    return { consentUrl: session.consentUrl, verificationId: session.verificationId, expiresInSeconds: 600 };
  }

  /**
   * Cashfree Secure ID → us. 200 once the signature checks out so Cashfree
   * stops retrying; unknown events are acknowledged and ignored.
   */
  @Public()
  @SkipThrottle()
  @Post("verification/cashfree/webhook")
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-webhook-signature") signature: string | undefined,
    @Headers("x-webhook-timestamp") timestamp: string | undefined,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    if (!this.verification.verifyWebhookSignature(raw, timestamp, signature)) {
      throw new BadRequestException({ type: "about:blank", title: "Invalid webhook signature", status: 400, code: "bad_signature" });
    }
    const event = req.body as DigiLockerWebhook;
    const type = event.type ?? "";
    if (!type.startsWith("DIGILOCKER_VERIFICATION")) return { received: true, matched: false };

    const verificationId = event.data?.verification_id;
    // A session we never issued belongs to nobody — a forged webhook stops here.
    const uid = verificationId ? await userForVerification(this.db, verificationId) : null;
    if (!uid) return { received: true, matched: false };

    const aadhaar = event.data?.aadhaar ?? event.data?.document?.aadhaar;
    await recordDigiLockerOutcome(this.db, uid, {
      success: type === "DIGILOCKER_VERIFICATION_SUCCESS",
      referenceId: event.data?.reference_id === undefined ? null : String(event.data.reference_id),
      verifiedName: aadhaar?.name ?? event.data?.name ?? null,
      aadhaarMasked: aadhaar?.masked_aadhaar_number ?? null,
      // The event name is kept; the payload is not, so nothing from DigiLocker is stored wholesale.
      detail: { event: type },
    });
    return { received: true, matched: true };
  }
}
