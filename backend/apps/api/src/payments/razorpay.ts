// Razorpay adapter: create a gateway order, re-read an order's status, verify
// the checkout callback, verify a webhook. Plain fetch + HMAC — the official
// SDK adds nothing we need and pulls in its own axios.
//
// Amounts are PAISE on both sides. Razorpay's unit for INR is the paise and so
// is ours, so there is no conversion anywhere in this file and no decimal
// parsing. (The Cashfree adapter this replaces needed a whole module for that
// boundary; this is one of the two places the revert genuinely simplifies.)
//
// Three credentials, not two: the webhook secret is chosen in the dashboard
// when the webhook is registered and is the only thing that signs
// `x-razorpay-signature`. It is NOT the API secret.
//
// Disabled (null credentials) when the keys aren't set; the controller answers
// 503 in that case rather than the process refusing to boot.

import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { AppEnv } from "@galleryzone/config";
import { razorpayCheckoutSignature, razorpayWebhookSignature, signaturesMatch } from "@galleryzone/domain";
import { ENV } from "../db.module.ts";

const BASE_URL = "https://api.razorpay.com/v1";

export interface RazorpayOrder {
  id: string;
  /** Paise. What we asked Razorpay to collect. */
  amount: number;
  /** Paise. What has actually been captured against this order. */
  amount_paid: number;
  currency: string;
  receipt: string | null;
  /** "created" | "attempted" | "paid" */
  status: string;
}

export interface RazorpayPayment {
  id: string;
  /** "created" | "authorized" | "captured" | "refunded" | "failed" */
  status: string;
  method: string | null;
  /** Paise. */
  amount: number;
}

@Injectable()
export class Razorpay {
  private readonly logger = new Logger(Razorpay.name);
  readonly keyId: string | null;
  private readonly keySecret: string | null;
  private readonly webhookSecret: string | null;

  constructor(@Inject(ENV) env: AppEnv) {
    this.keyId = env.razorpayKeyId;
    this.keySecret = env.razorpayKeySecret;
    this.webhookSecret = env.razorpayWebhookSecret;
    if (!this.keyId || !this.keySecret) this.logger.warn("RAZORPAY_KEY_ID/SECRET not set — gateway checkout unavailable");
    else if (!this.webhookSecret) this.logger.warn("RAZORPAY_WEBHOOK_SECRET not set — webhooks will be rejected, so a buyer who closes the tab never gets their order");
  }

  get enabled(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  private require(): { keyId: string; keySecret: string } {
    if (!this.keyId || !this.keySecret) {
      throw new ServiceUnavailableException({ type: "about:blank", title: "Payments are not configured", status: 503, code: "payments_unavailable" });
    }
    return { keyId: this.keyId, keySecret: this.keySecret };
  }

  private authHeader(): string {
    const { keyId, keySecret } = this.require();
    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  }

  /** POST /v1/orders. `receipt` is our order id; `notes` carries it too so a webhook can find us without the receipt. */
  createOrder(input: { orderId: string; amountPaise: number; customerId: string }): Promise<RazorpayOrder> {
    return this.post({ receipt: input.orderId, amountPaise: input.amountPaise, notes: { gzOrderId: input.orderId, gzCustomerId: input.customerId } });
  }

  /** The same, for an aggregator adding money to their wallet. The notes carry the top-up id for the webhook. */
  createTopupOrder(input: { topupId: string; amountPaise: number; userId: string }): Promise<RazorpayOrder> {
    return this.post({ receipt: input.topupId, amountPaise: input.amountPaise, notes: { gzTopupId: input.topupId, gzUserId: input.userId } });
  }

  private async post(input: { receipt: string; amountPaise: number; notes: Record<string, string> }): Promise<RazorpayOrder> {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { Authorization: this.authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.receipt.slice(0, 40), notes: input.notes }),
    });
    const body = (await res.json().catch(() => ({}))) as RazorpayOrder & { error?: { description?: string } };
    if (!res.ok) {
      this.logger.error(`razorpay order create failed: ${res.status} ${body.error?.description ?? ""}`);
      throw new ServiceUnavailableException({ type: "about:blank", title: "Could not start the payment", status: 503, code: "gateway_error" });
    }
    return body;
  }

  /**
   * GET /v1/orders/{id} — the authoritative answer to "was this paid?".
   *
   * This is the half the old Razorpay integration was missing: it settled on
   * the strength of a signature the BROWSER posted back, which proves the
   * payload came from Razorpay but not that it is current, complete or for the
   * amount we asked. Re-reading over our own authenticated connection does.
   *
   * A failed read throws 503 rather than returning a not-paid-looking order,
   * because "we could not ask" must never be recorded as "it was not paid".
   */
  async fetchOrder(orderId: string): Promise<RazorpayOrder> {
    const res = await fetch(`${BASE_URL}/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: this.authHeader() } });
    const body = (await res.json().catch(() => ({}))) as RazorpayOrder & { error?: { description?: string } };
    if (!res.ok || typeof body.status !== "string") {
      this.logger.error(`razorpay order fetch failed: ${res.status} ${body.error?.description ?? ""}`);
      throw new ServiceUnavailableException({ type: "about:blank", title: "Could not confirm the payment", status: 503, code: "gateway_error" });
    }
    return body;
  }

  /** GET /v1/orders/{id}/payments — used only to record which payment and method settled the order. */
  async fetchPayments(orderId: string): Promise<RazorpayPayment[]> {
    const res = await fetch(`${BASE_URL}/orders/${encodeURIComponent(orderId)}/payments`, { headers: { Authorization: this.authHeader() } });
    if (!res.ok) {
      // Non-fatal: the order status already decided the outcome, and this call
      // only enriches the receipt. Losing it costs a method label.
      this.logger.warn(`razorpay payments fetch failed: ${res.status}`);
      return [];
    }
    const body = (await res.json().catch(() => ({}))) as { items?: RazorpayPayment[] };
    return body.items ?? [];
  }

  /**
   * Checkout.js hands back order_id, payment_id and
   * signature = HMAC_SHA256(order_id|payment_id, KEY secret).
   *
   * A pass proves the payload came from Razorpay. It does NOT prove the order
   * is currently paid, or paid for the right amount, so the controller treats
   * this as a necessary-not-sufficient check and re-reads the order too.
   */
  verifyCheckoutSignature(input: { razorpayOrderId: string; razorpayPaymentId: string; signature: string }): boolean {
    const { keySecret } = this.require();
    return signaturesMatch(razorpayCheckoutSignature({ ...input, keySecret }), input.signature);
  }

  /** Webhook: x-razorpay-signature = HMAC_SHA256(raw body, WEBHOOK secret). Needs the RAW body bytes, not re-serialised JSON. */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
    if (!this.webhookSecret || !signature) return false;
    return signaturesMatch(razorpayWebhookSignature(rawBody, this.webhookSecret), signature);
  }
}
