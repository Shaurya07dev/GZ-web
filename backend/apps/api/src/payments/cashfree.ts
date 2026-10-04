// Cashfree Payment Gateway adapter: create an order, read an order's true
// status back, verify a webhook. Plain fetch + HMAC — the official SDK adds
// nothing we need and carries its own HTTP stack.
//
// Four things differ from the Razorpay adapter this replaces, and each one is
// a place a migration goes wrong:
//
//   1. Amounts are RUPEES as a decimal, not paise. Every conversion goes
//      through gateway-money.ts; there is no arithmetic in this file.
//   2. Auth is three headers (x-client-id, x-client-secret, x-api-version),
//      not HTTP Basic.
//   3. Nothing is client-safe. The browser gets only a short-lived
//      payment_session_id — never an app id, never a key.
//   4. A webhook is signed base64(HMAC-SHA256(timestamp + rawBody, secret))
//      using the SAME secret as the API, and the timestamp is part of the
//      signed material.
//
// There is deliberately no "verify what the client told us" method. Cashfree
// does not hand the browser a signed success payload, and we do not invent
// one: success is established by reading the order back from Cashfree
// (fetchOrder) or by a signed webhook. Nothing a browser says settles money.

import { createHmac, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { AppEnv } from "@galleryzone/config";
import { paiseToGatewayAmount } from "@galleryzone/domain";
import { ENV } from "../db.module.ts";

const API_VERSION = "2025-01-01";
const BASE_URL = { sandbox: "https://sandbox.cashfree.com/pg", production: "https://api.cashfree.com/pg" } as const;

/** Cashfree's order status. ACTIVE means created-or-still-being-attempted; only PAID is money. */
export type CashfreeOrderStatus = "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED";

export interface CashfreeOrder {
  cfOrderId: string;
  orderId: string;
  orderStatus: CashfreeOrderStatus;
  /** Rupees as the gateway reported them, unconverted. Callers compare via gatewayAmountMatches. */
  orderAmount: string | number;
  paymentSessionId: string | null;
}

interface CashfreeOrderBody {
  cf_order_id?: string | number;
  order_id?: string;
  order_status?: string;
  order_amount?: string | number;
  payment_session_id?: string;
  message?: string;
  code?: string;
}

/** One payment attempt against an order, as /payments reports it. */
export interface CashfreePayment {
  cfPaymentId: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentAmount: string | number | null;
}

export interface CustomerDetails {
  customerId: string;
  /** Cashfree requires a phone. Checkout is refused upstream when we don't have one rather than sending a fake. */
  customerPhone: string;
  customerEmail?: string | undefined;
  customerName?: string | undefined;
}

@Injectable()
export class Cashfree {
  private readonly logger = new Logger(Cashfree.name);
  private readonly appId: string | null;
  private readonly secretKey: string | null;
  private readonly baseUrl: string;
  private readonly siteUrl: string;
  private readonly apiUrl: string;

  constructor(@Inject(ENV) env: AppEnv) {
    this.appId = env.cashfreeAppId;
    this.secretKey = env.cashfreeSecretKey;
    this.baseUrl = BASE_URL[env.cashfreeEnv];
    this.siteUrl = env.publicSiteUrl;
    this.apiUrl = env.publicApiUrl;
    if (!this.enabled) this.logger.warn("CASHFREE_APP_ID/CASHFREE_SECRET_KEY not set — gateway checkout unavailable");
    else if (env.cashfreeEnv === "production") this.logger.log("Cashfree gateway in PRODUCTION mode");
  }

  get enabled(): boolean {
    return Boolean(this.appId && this.secretKey);
  }

  private credentials(): { appId: string; secretKey: string } {
    if (!this.appId || !this.secretKey) {
      throw new ServiceUnavailableException({ type: "about:blank", title: "Payments are not configured", status: 503, code: "payments_unavailable" });
    }
    return { appId: this.appId, secretKey: this.secretKey };
  }

  private headers(): Record<string, string> {
    const { appId, secretKey } = this.credentials();
    return { "Content-Type": "application/json", "x-api-version": API_VERSION, "x-client-id": appId, "x-client-secret": secretKey };
  }

  /**
   * Create the gateway order for one of our orders. `orderId` is ours and
   * Cashfree echoes it back, which is what lets a webhook find us without a
   * lookup table. Passing it also makes creation idempotent: a second call
   * with the same id is refused by Cashfree rather than charging twice.
   */
  createOrder(input: { orderId: string; amountPaise: number; customer: CustomerDetails; note: string; returnPath: string }): Promise<CashfreeOrder> {
    return this.post("/orders", {
      order_id: input.orderId,
      order_amount: paiseToGatewayAmount(input.amountPaise),
      order_currency: "INR",
      customer_details: {
        customer_id: input.customer.customerId,
        customer_phone: input.customer.customerPhone,
        ...(input.customer.customerEmail ? { customer_email: input.customer.customerEmail } : {}),
        ...(input.customer.customerName ? { customer_name: input.customer.customerName } : {}),
      },
      order_meta: {
        return_url: `${this.siteUrl}${input.returnPath}`,
        notify_url: `${this.apiUrl}/v1/payments/cashfree/webhook`,
      },
      order_note: input.note.slice(0, 200),
    });
  }

  /**
   * The truth about an order, read from Cashfree. This is what replaces
   * Razorpay's client-side signature check: the browser tells us nothing we
   * act on, we ask the gateway.
   */
  async fetchOrder(orderId: string): Promise<CashfreeOrder> {
    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderId)}`, { method: "GET", headers: this.headers() });
    const body = (await res.json().catch(() => ({}))) as CashfreeOrderBody;
    if (!res.ok) throw this.failed("order fetch", res.status, body);
    return toOrder(body);
  }

  /** The attempts against an order, newest-looking first. Used to record how it was paid. */
  async fetchPayments(orderId: string): Promise<CashfreePayment[]> {
    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderId)}/payments`, { method: "GET", headers: this.headers() });
    if (!res.ok) return [];
    const body = (await res.json().catch(() => [])) as {
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_group?: string;
      payment_method?: unknown;
      payment_amount?: string | number;
    }[];
    if (!Array.isArray(body)) return [];
    return body.map((p) => ({
      cfPaymentId: p.cf_payment_id === undefined ? null : String(p.cf_payment_id),
      paymentStatus: p.payment_status ?? null,
      // payment_method is an object keyed by instrument ("upi", "card", ...); payment_group is the flat name.
      paymentMethod: p.payment_group ?? (p.payment_method && typeof p.payment_method === "object" ? Object.keys(p.payment_method)[0] ?? null : null),
      paymentAmount: p.payment_amount ?? null,
    }));
  }

  private async post(path: string, payload: unknown): Promise<CashfreeOrder> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: "POST", headers: this.headers(), body: JSON.stringify(payload) });
    const body = (await res.json().catch(() => ({}))) as CashfreeOrderBody;
    if (!res.ok) throw this.failed(`POST ${path}`, res.status, body);
    return toOrder(body);
  }

  /** Gateway errors are logged with Cashfree's own code but never echoed to the buyer verbatim. */
  private failed(what: string, status: number, body: CashfreeOrderBody): ServiceUnavailableException {
    this.logger.error(`cashfree ${what} failed: ${status} ${body.code ?? ""} ${body.message ?? ""}`);
    return new ServiceUnavailableException({ type: "about:blank", title: "Could not start the payment", status: 503, code: "gateway_error" });
  }

  /**
   * x-webhook-signature = base64(HMAC-SHA256(timestamp + rawBody, secretKey)).
   * Needs the RAW body bytes: re-serialised JSON will not match. Returns false
   * for anything missing, so an unsigned request is simply never valid.
   */
  verifyWebhookSignature(rawBody: Buffer | string, timestamp: string | undefined, signature: string | undefined): boolean {
    if (!this.secretKey || !timestamp || !signature) return false;
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const expected = createHmac("sha256", this.secretKey).update(timestamp + body).digest("base64");
    return safeEqual(expected, signature);
  }
}

function toOrder(body: CashfreeOrderBody): CashfreeOrder {
  return {
    cfOrderId: body.cf_order_id === undefined ? "" : String(body.cf_order_id),
    orderId: body.order_id ?? "",
    orderStatus: (body.order_status ?? "ACTIVE") as CashfreeOrderStatus,
    orderAmount: body.order_amount ?? 0,
    paymentSessionId: body.payment_session_id ?? null,
  };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
