// Cashfree Secure ID adapter: GSTIN lookup and Aadhaar identity via
// DigiLocker.
//
// This is a SEPARATE product from the payment gateway with its OWN key pair,
// issued from a different part of the dashboard and sent as X-Client-Id /
// X-Client-Secret against a different base URL. Reusing the gateway keys here
// fails with 401, so the two are kept apart in config and in this file.
//
// Why DigiLocker rather than Aadhaar OTP: with OTP the raw 12-digit Aadhaar
// number passes through this backend, which pulls GalleryZone into UIDAI
// storage and logging obligations. With DigiLocker the artist consents on
// DigiLocker's own site and we receive a verified name plus a MASKED Aadhaar
// — which is all `ProfileDoc.aadhaarMasked` was ever shaped to hold. The full
// number is never requested, received, logged or stored.

import { createHmac, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { AppEnv } from "@galleryzone/config";
import { ENV } from "../db.module.ts";

const API_VERSION = "2024-12-01";
const BASE_URL = { sandbox: "https://sandbox.cashfree.com/verification", production: "https://api.cashfree.com/verification" } as const;

/** What the GST registry says about a GSTIN. `valid` is the only thing that can support an approval. */
export interface GstinResult {
  valid: boolean;
  gstin: string;
  legalName: string | null;
  tradeName: string | null;
  registrationStatus: string | null;
  referenceId: string | null;
  /** Cashfree's own message when the lookup says no — shown to the artist as-is only when it is safe prose. */
  message: string | null;
}

/** A DigiLocker consent URL. Short-lived: Cashfree documents ten minutes. */
export interface DigiLockerSession {
  referenceId: string;
  consentUrl: string;
  verificationId: string;
}

@Injectable()
export class CashfreeVerification {
  private readonly logger = new Logger(CashfreeVerification.name);
  private readonly clientId: string | null;
  private readonly clientSecret: string | null;
  private readonly baseUrl: string;
  private readonly siteUrl: string;

  constructor(@Inject(ENV) env: AppEnv) {
    this.clientId = env.cashfreeVerificationAppId;
    this.clientSecret = env.cashfreeVerificationSecretKey;
    this.baseUrl = BASE_URL[env.cashfreeEnv];
    this.siteUrl = env.publicSiteUrl;
    if (!this.enabled) this.logger.warn("CASHFREE_VERIFICATION_APP_ID/SECRET not set — GSTIN and Aadhaar verification unavailable");
  }

  get enabled(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private headers(): Record<string, string> {
    if (!this.clientId || !this.clientSecret) {
      throw new ServiceUnavailableException({ type: "about:blank", title: "Verification is not configured", status: 503, code: "verification_unavailable" });
    }
    return { "Content-Type": "application/json", "x-api-version": API_VERSION, "X-Client-Id": this.clientId, "X-Client-Secret": this.clientSecret };
  }

  /**
   * Look a GSTIN up in the GST registry. `verificationId` is ours and comes
   * back on the response, so a result can be tied to the artist who asked.
   */
  async verifyGstin(input: { gstin: string; verificationId: string; businessName?: string | undefined }): Promise<GstinResult> {
    const res = await fetch(`${this.baseUrl}/gstin`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        GSTIN: input.gstin,
        verification_id: input.verificationId,
        ...(input.businessName ? { business_name: input.businessName } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      valid?: boolean;
      GSTIN?: string;
      legal_name_of_business?: string;
      trade_name_of_business?: string;
      gst_in_status?: string;
      reference_id?: string | number;
      type?: string;
      message?: string;
      code?: string;
    };
    // Only a real answer from the registry counts as an answer. 200 carries the
    // verdict, and 404/422 mean "no such registration" — also a verdict. Every
    // other status is OUR problem (bad or missing keys, an un-whitelisted IP,
    // a rate limit, an outage) and must not be written down as "this artist's
    // GSTIN is invalid". Secure ID enforces IP allow-listing, so a 403
    // ip_validation_failed is the likely first response from a new
    // environment — recording that as a failed GSTIN would quietly accuse the
    // artist of a bad registration number.
    const isVerdict = res.status === 200 || res.status === 404 || res.status === 422;
    if (!isVerdict) {
      this.logger.error(`cashfree gstin lookup failed: ${res.status} ${body.type ?? ""} ${body.code ?? ""} ${body.message ?? ""}`);
      throw new ServiceUnavailableException({
        type: "about:blank",
        title: "Could not reach the GST registry",
        status: 503,
        // The operator needs to know which misconfiguration this was; the
        // artist only ever sees the title.
        code: body.code === "ip_validation_failed" ? "verification_ip_not_whitelisted" : "verification_upstream_error",
      });
    }
    return {
      valid: res.ok && body.valid === true,
      gstin: body.GSTIN ?? input.gstin,
      legalName: body.legal_name_of_business ?? null,
      tradeName: body.trade_name_of_business ?? null,
      registrationStatus: body.gst_in_status ?? null,
      referenceId: body.reference_id === undefined ? null : String(body.reference_id),
      message: body.message ?? null,
    };
  }

  /**
   * Open a DigiLocker consent session. The artist is sent to `consentUrl`;
   * the outcome arrives on the Secure ID webhook, never inline.
   */
  async createDigiLockerSession(input: { verificationId: string; redirectPath: string }): Promise<DigiLockerSession> {
    const res = await fetch(`${this.baseUrl}/digilocker`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        verification_id: input.verificationId,
        document_requested: ["AADHAAR"],
        redirect_url: `${this.siteUrl}${input.redirectPath}`,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { reference_id?: string | number; url?: string; verification_id?: string; message?: string; code?: string };
    if (!res.ok || !body.url) {
      this.logger.error(`cashfree digilocker session failed: ${res.status} ${body.code ?? ""} ${body.message ?? ""}`);
      throw new ServiceUnavailableException({ type: "about:blank", title: "Could not start Aadhaar verification", status: 503, code: "verification_upstream_error" });
    }
    return {
      referenceId: body.reference_id === undefined ? "" : String(body.reference_id),
      consentUrl: body.url,
      verificationId: body.verification_id ?? input.verificationId,
    };
  }

  /**
   * Same scheme as the gateway webhook — base64(HMAC-SHA256(timestamp + raw
   * body, secret)) — but signed with the VERIFICATION secret, which is a
   * different key. Returns false for anything missing.
   */
  verifyWebhookSignature(rawBody: Buffer | string, timestamp: string | undefined, signature: string | undefined): boolean {
    if (!this.clientSecret || !timestamp || !signature) return false;
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const expected = createHmac("sha256", this.clientSecret).update(timestamp + body).digest("base64");
    const ab = Buffer.from(expected);
    const bb = Buffer.from(signature);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }
}
