// Gateway checkout for an order, on Cashfree.
//
//   POST /v1/orders/:id/payment/session   customer (own order)
//        → { mode: "simulated" }  while PAYMENTS_MODE=simulated
//        → { mode: "cashfree", paymentSessionId, orderId, amountPaise, currency, environment }
//   POST /v1/orders/:id/payment/verify    customer — called when the buyer returns
//        no body: the order is re-read FROM CASHFREE and marked paid only if it is PAID
//   POST /v1/payments/cashfree/webhook    public — Cashfree's server → ours
//        PAYMENT_SUCCESS_WEBHOOK → paid; PAYMENT_FAILED/USER_DROPPED → recorded
//
// An aggregator's wallet top-up is the same shape:
//   POST /v1/aggregator/wallet/topups             aggregator — { amountPaise } → the same session shape
//   POST /v1/aggregator/wallet/topups/:id/verify  aggregator — re-read, then credit the wallet
//   POST /v1/aggregator/wallet/topups/:id/simulate  aggregator — PAYMENTS_MODE=simulated only
// The webhook routes a payment to a top-up by the gateway order id we stored.
//
// Three rules hold everywhere in this file, and they are the whole security
// posture of the migration off Razorpay:
//
//   1. Nothing the browser says settles money. Razorpay handed the client a
//      signed payload to post back; Cashfree does not, and we do not invent
//      one. "Verify" means asking Cashfree, over our own authenticated
//      connection, what the order's status is.
//   2. The amount is re-checked against our own order before anything is
//      marked paid — on the webhook path AND the re-read path. A PAID order
//      for the wrong amount is refused, not settled.
//   3. The webhook is the source of truth (it arrives even if the buyer closes
//      the tab); the verify call only makes the success screen instant. Both
//      funnel into markOrderPaid, which is idempotent, so whichever arrives
//      second is a no-op.

import { BadRequestException, Body, Controller, ForbiddenException, Headers, HttpCode, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import {
  CheckoutError,
  WalletTopupError,
  attachProviderOrder,
  attachTopupProviderOrder,
  createWalletTopup,
  getCurrentUser,
  getOrder,
  getWalletTopup,
  markOrderPaid,
  markPaymentFailed,
  markTopupFailed,
  markTopupPaid,
  orderIdForProviderOrder,
  topupIdForProviderOrder,
  Collections,
  type Db,
  type ArtworkDoc,
} from "@galleryzone/db";
import { startWalletTopupInputSchema, type StartWalletTopupInput } from "@galleryzone/contracts";
import { gatewayAmountMatches } from "@galleryzone/domain";
import type { AppEnv } from "@galleryzone/config";
import { Public, Roles } from "../auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "../auth/roles.guard.ts";
import { DB, ENV } from "../db.module.ts";
import { Emails } from "../mail/emails.ts";
import { ReadCache } from "../read-cache.ts";
import { ZodValidationPipe } from "../zod-validation.pipe.ts";
import { Cashfree, type CashfreeOrder, type CustomerDetails } from "./cashfree.ts";
import { classifyWebhook, invalidSignature } from "./webhook-signature.ts";

const notFound = () => new NotFoundException({ type: "about:blank", title: "Order not found", status: 404, code: "not_found" });

/**
 * Cashfree's order ids must be unique per merchant account and ours already
 * are, but a top-up and an artwork order are different objects in different
 * collections, so each gets its own prefix. The prefix is also how the webhook
 * tells them apart without a lookup.
 */
const ORDER_PREFIX = "gz-order-";
const TOPUP_PREFIX = "gz-topup-";

/** Only the events that mean something to us; anything else is acknowledged and ignored. */
type WebhookType = "PAYMENT_SUCCESS_WEBHOOK" | "PAYMENT_FAILED_WEBHOOK" | "PAYMENT_USER_DROPPED_WEBHOOK";

interface WebhookEvent {
  type?: string;
  data?: {
    order?: { order_id?: string; order_amount?: string | number };
    payment?: { cf_payment_id?: string | number; payment_status?: string; payment_group?: string; payment_amount?: string | number };
  };
}

@Controller("v1")
export class PaymentsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
    private readonly cashfree: Cashfree,
    private readonly emails: Emails,
    private readonly cache: ReadCache,
  ) {}

  private async ownOrder(req: AuthenticatedRequest, id: string) {
    const order = await getOrder(this.db, id);
    // 404, not 403: don't confirm to a stranger that the order id exists.
    if (!order || order.customerId !== req.authUser.uid) throw notFound();
    return order;
  }

  private async settle(orderId: string, capture: { method: string; providerPaymentId: string | null; rawWebhookPayload?: unknown }) {
    const result = await markOrderPaid(this.db, orderId, capture);
    this.cache.clear();
    void this.emails
      .orderPaid({ orderId, customerId: result.customerId, artistId: result.artistId, title: result.artworkTitle, totalPaise: result.totalPaise, artistNetPaise: result.artistNetPaise })
      .catch(this.emails.swallow("order mail"));
    return result;
  }

  /**
   * Cashfree requires a customer phone on every order and will not accept a
   * placeholder. We refuse checkout with something actionable rather than
   * sending a fabricated number, which would also break their fraud checks.
   */
  private customerDetails(uid: string, user: { name?: string | null; email?: string | null; phone?: string | null } | null): CustomerDetails {
    const phone = user?.phone?.replace(/\D/g, "").slice(-10) ?? "";
    if (phone.length !== 10) {
      throw new BadRequestException({
        type: "about:blank",
        title: "Add a 10-digit mobile number to your profile before paying",
        status: 400,
        code: "phone_required",
      });
    }
    return {
      customerId: uid,
      customerPhone: phone,
      ...(user?.email ? { customerEmail: user.email } : {}),
      ...(user?.name ? { customerName: user.name } : {}),
    };
  }

  @Roles("customer")
  @Post("orders/:id/payment/session")
  async session(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const order = await this.ownOrder(req, id);
    if (order.status !== "pending") {
      throw new BadRequestException({ type: "about:blank", title: `Order is already ${order.status}`, status: 409, code: "order_not_pending" });
    }
    if (this.env.paymentsMode !== "cashfree") return { mode: "simulated" as const };

    const [user, artworkSnap] = await Promise.all([
      getCurrentUser(this.db, req.authUser.uid, { touchLogin: false }),
      this.db.collection(Collections.artworks).doc(order.artworkId).get(),
    ]);
    const artwork = artworkSnap.data() as ArtworkDoc | undefined;
    const gatewayOrderId = `${ORDER_PREFIX}${id}`;
    const gateway = await this.cashfree.createOrder({
      orderId: gatewayOrderId,
      amountPaise: order.totalPaise,
      customer: this.customerDetails(req.authUser.uid, user),
      note: artwork ? `${artwork.title} (${artwork.productCode})` : `Order ${id}`,
      returnPath: `/account/orders/${id}`,
    });
    await attachProviderOrder(this.db, id, gatewayOrderId);
    // Only the short-lived session id crosses to the browser — no app id, no key.
    return {
      mode: "cashfree" as const,
      paymentSessionId: gateway.paymentSessionId,
      orderId: gatewayOrderId,
      amountPaise: order.totalPaise,
      currency: "INR",
      environment: this.env.cashfreeEnv,
    };
  }

  /**
   * Called when the buyer lands back on the site. Takes no body on purpose:
   * the only thing consulted is Cashfree's own answer for the order, plus the
   * amount we expected.
   */
  @Roles("customer")
  @Post("orders/:id/payment/verify")
  async verify(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const order = await this.ownOrder(req, id);
    if (order.status === "paid") return { status: "paid" as const };

    // Derived, not stored: the gateway id for an order is always this, which
    // is also how the webhook maps back without a lookup.
    const gatewayOrderId = `${ORDER_PREFIX}${id}`;
    const gateway = await this.cashfree.fetchOrder(gatewayOrderId);
    const guard = this.amountGuard(gateway, order.totalPaise, gatewayOrderId);
    if (guard) throw guard;
    if (gateway.orderStatus !== "PAID") return { status: gateway.orderStatus };

    const payment = (await this.cashfree.fetchPayments(gatewayOrderId)).find((p) => p.paymentStatus === "SUCCESS");
    try {
      const result = await this.settle(id, {
        method: payment?.paymentMethod ? `cashfree_${payment.paymentMethod}` : "cashfree",
        providerPaymentId: payment?.cfPaymentId ?? null,
      });
      return { status: "paid" as const, transactionId: result.transactionId };
    } catch (error) {
      if (error instanceof CheckoutError) throw new BadRequestException({ type: "about:blank", title: error.message, status: 409, code: "checkout_rejected" });
      throw error;
    }
  }

  /**
   * A PAID order whose amount is not the amount we asked for never settles.
   * This is the check that makes trusting the gateway's status safe.
   */
  private amountGuard(gateway: CashfreeOrder, expectedPaise: number, gatewayOrderId: string): BadRequestException | null {
    if (gateway.orderStatus !== "PAID" || gatewayAmountMatches(expectedPaise, gateway.orderAmount)) return null;
    // Loud on purpose: this is either a tampered order or a unit bug, and both need a human.
    console.error(
      JSON.stringify({ event: "payments.amount_mismatch", gatewayOrderId, expectedPaise, reportedAmount: String(gateway.orderAmount) }),
    );
    return new BadRequestException({ type: "about:blank", title: "Paid amount does not match the order", status: 409, code: "amount_mismatch" });
  }

  private async ownTopup(req: AuthenticatedRequest, id: string) {
    const topup = await getWalletTopup(this.db, id);
    // 404, not 403: don't confirm to a stranger that the id exists.
    if (!topup || topup.userId !== req.authUser.uid) throw new NotFoundException({ type: "about:blank", title: "Top-up not found", status: 404, code: "not_found" });
    return topup;
  }

  @Roles("aggregator")
  @Post("aggregator/wallet/topups")
  async startTopup(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(startWalletTopupInputSchema)) body: StartWalletTopupInput) {
    const { topupId } = await createWalletTopup(this.db, { userId: req.authUser.uid, amountPaise: body.amountPaise });
    if (this.env.paymentsMode !== "cashfree") return { mode: "simulated" as const, topupId, amountPaise: body.amountPaise };

    const user = await getCurrentUser(this.db, req.authUser.uid, { touchLogin: false });
    const gatewayOrderId = `${TOPUP_PREFIX}${topupId}`;
    const gateway = await this.cashfree.createOrder({
      orderId: gatewayOrderId,
      amountPaise: body.amountPaise,
      customer: this.customerDetails(req.authUser.uid, user),
      note: "Add funds to your GalleryZone wallet",
      returnPath: "/aggregator/wallet",
    });
    await attachTopupProviderOrder(this.db, topupId, gatewayOrderId);
    return {
      mode: "cashfree" as const,
      topupId,
      paymentSessionId: gateway.paymentSessionId,
      orderId: gatewayOrderId,
      amountPaise: body.amountPaise,
      currency: "INR",
      environment: this.env.cashfreeEnv,
    };
  }

  @Roles("aggregator")
  @Post("aggregator/wallet/topups/:id/verify")
  async verifyTopup(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const topup = await this.ownTopup(req, id);
    if (topup.status === "paid") return { status: "paid" as const, amountPaise: topup.amountPaise };

    const gatewayOrderId = topup.providerOrderId ?? `${TOPUP_PREFIX}${id}`;
    const gateway = await this.cashfree.fetchOrder(gatewayOrderId);
    const guard = this.amountGuard(gateway, topup.amountPaise, gatewayOrderId);
    if (guard) throw guard;
    if (gateway.orderStatus !== "PAID") return { status: gateway.orderStatus };

    const payment = (await this.cashfree.fetchPayments(gatewayOrderId)).find((p) => p.paymentStatus === "SUCCESS");
    const result = await markTopupPaid(this.db, id, {
      method: payment?.paymentMethod ? `cashfree_${payment.paymentMethod}` : "cashfree",
      providerPaymentId: payment?.cfPaymentId ?? null,
    });
    return { status: "paid" as const, amountPaise: result.amountPaise };
  }

  /** The simulated gateway, for environments with no Cashfree keys. Refused the moment PAYMENTS_MODE is cashfree. */
  @Roles("aggregator")
  @Post("aggregator/wallet/topups/:id/simulate")
  async simulateTopup(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    if (this.env.paymentsMode !== "simulated") {
      throw new ForbiddenException({ type: "about:blank", title: "Simulated payment is disabled", status: 403, code: "payments_not_simulated" });
    }
    await this.ownTopup(req, id);
    const result = await markTopupPaid(this.db, id, { method: "simulated", providerPaymentId: null });
    return { status: "paid", amountPaise: result.amountPaise };
  }

  /**
   * Cashfree → us. Always 200 once the signature checks out, so Cashfree stops
   * retrying; unknown events are acknowledged and ignored.
   *
   * The signature covers `x-webhook-timestamp` + the RAW body, so the raw
   * bytes are required — re-serialised JSON will not match.
   */
  @Public()
  @SkipThrottle()
  @Post("payments/cashfree/webhook")
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-webhook-signature") signature: string | undefined,
    @Headers("x-webhook-timestamp") timestamp: string | undefined,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const check = classifyWebhook({
      source: "payments",
      rawBody: raw,
      timestamp,
      signature,
      verify: (b, t, s) => this.cashfree.verifyWebhookSignature(b, t, s),
    });
    // An unsigned probe (the dashboard's "Test & Add") is acknowledged and
    // nothing is read from it; a wrong signature is refused.
    if (check === "probe") return { received: true, matched: false };
    if (check === "rejected") throw invalidSignature();
    const event = req.body as WebhookEvent;
    const type = event.type as WebhookType | undefined;
    const gatewayOrderId = event.data?.order?.order_id ?? null;
    if (!gatewayOrderId || !type) return { received: true, matched: false };

    const payment = event.data?.payment;
    const method = payment?.payment_group ? `cashfree_${payment.payment_group}` : "cashfree";
    const providerPaymentId = payment?.cf_payment_id === undefined ? null : String(payment.cf_payment_id);
    // The reported amount is checked against our own record before anything settles.
    const reportedAmount = event.data?.order?.order_amount ?? payment?.payment_amount ?? null;

    if (gatewayOrderId.startsWith(TOPUP_PREFIX)) {
      const topupId = gatewayOrderId.slice(TOPUP_PREFIX.length) || (await topupIdForProviderOrder(this.db, gatewayOrderId));
      if (!topupId) return { received: true, matched: false };
      return this.topupWebhook(type, topupId, { method, providerPaymentId, reportedAmount, gatewayOrderId });
    }

    const orderId = gatewayOrderId.startsWith(ORDER_PREFIX)
      ? gatewayOrderId.slice(ORDER_PREFIX.length)
      : await orderIdForProviderOrder(this.db, gatewayOrderId);
    if (!orderId) return { received: true, matched: false };

    switch (type) {
      case "PAYMENT_SUCCESS_WEBHOOK": {
        const order = await getOrder(this.db, orderId);
        if (!order) return { received: true, matched: false };
        if (reportedAmount !== null && !gatewayAmountMatches(order.totalPaise, reportedAmount)) {
          console.error(
            JSON.stringify({ event: "payments.amount_mismatch", source: "webhook", gatewayOrderId, expectedPaise: order.totalPaise, reportedAmount: String(reportedAmount) }),
          );
          return { received: true, matched: false };
        }
        try {
          await this.settle(orderId, { method, providerPaymentId, rawWebhookPayload: event });
        } catch (error) {
          // A cancelled order that later gets a capture is an operator problem, not a retry loop.
          if (!(error instanceof CheckoutError)) throw error;
        }
        break;
      }
      case "PAYMENT_FAILED_WEBHOOK":
      case "PAYMENT_USER_DROPPED_WEBHOOK": {
        await markPaymentFailed(this.db, orderId, { providerPaymentId, rawWebhookPayload: event });
        // The buyer reached the gateway and it declined. Saying nothing means
        // the cart simply dies; they often don't realise it didn't go through.
        const failed = await getOrder(this.db, orderId);
        if (failed) {
          void this.emails
            .paymentFailed({ orderId, customerId: failed.customerId, title: failed.artwork?.title ?? "your artwork", totalPaise: failed.totalPaise })
            .catch(this.emails.swallow("payment failed mail"));
        }
        break;
      }
      default:
        break;
    }
    return { received: true, matched: true };
  }

  private async topupWebhook(
    type: WebhookType,
    topupId: string,
    ctx: { method: string; providerPaymentId: string | null; reportedAmount: string | number | null; gatewayOrderId: string },
  ) {
    try {
      if (type === "PAYMENT_SUCCESS_WEBHOOK") {
        const topup = await getWalletTopup(this.db, topupId);
        if (!topup) return { received: true, matched: false };
        if (ctx.reportedAmount !== null && !gatewayAmountMatches(topup.amountPaise, ctx.reportedAmount)) {
          console.error(
            JSON.stringify({ event: "payments.amount_mismatch", source: "webhook_topup", gatewayOrderId: ctx.gatewayOrderId, expectedPaise: topup.amountPaise, reportedAmount: String(ctx.reportedAmount) }),
          );
          return { received: true, matched: false };
        }
        await markTopupPaid(this.db, topupId, { method: ctx.method, providerPaymentId: ctx.providerPaymentId });
      } else {
        await markTopupFailed(this.db, topupId, { providerPaymentId: ctx.providerPaymentId });
      }
    } catch (error) {
      // An unknown top-up id is an operator problem, not a retry loop.
      if (!(error instanceof WalletTopupError)) throw error;
    }
    return { received: true, matched: true };
  }
}
