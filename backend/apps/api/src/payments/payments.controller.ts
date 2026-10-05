// Gateway checkout for an order, on Razorpay.
//
//   POST /v1/orders/:id/payment/session   customer (own order)
//        → { mode: "simulated" }  while PAYMENTS_MODE=simulated
//        → { mode: "razorpay", keyId, razorpayOrderId, amountPaise, currency, name, description, prefill }
//   POST /v1/orders/:id/payment/verify    customer — called when the buyer returns
//        optional body { razorpayOrderId, razorpayPaymentId, signature } from Checkout.js;
//        the order is then RE-READ from Razorpay and marked paid only if it is paid
//   POST /v1/payments/razorpay/webhook    public — Razorpay's server → ours
//        payment.captured / order.paid → paid; payment.failed → recorded
//
// An aggregator's wallet top-up is the same shape:
//   POST /v1/aggregator/wallet/topups             aggregator — { amountPaise } → the same session shape
//   POST /v1/aggregator/wallet/topups/:id/verify  aggregator — re-read, then credit the wallet
//   POST /v1/aggregator/wallet/topups/:id/simulate  aggregator — PAYMENTS_MODE=simulated only
// The webhook routes a payment to a top-up by the gzTopupId note on its order.
//
// Payments came back to Razorpay on 5 Oct 2026 (client decision; Cashfree now
// does Aadhaar/GSTIN verification only). The provider reverted but four rules
// introduced while the gateway was Cashfree did NOT, because none of them were
// Cashfree-specific and all four are stronger than what Razorpay had before:
//
//   1. Nothing the browser says is SUFFICIENT to settle money. Razorpay does
//      hand the client a signed payload, and that signature is still checked —
//      but it only proves the payload came from Razorpay, not that it is
//      current or for the amount we asked. So verify also re-reads the order
//      over our own authenticated connection, and that read is what decides.
//   2. The amount is re-checked against our own order before anything is
//      marked paid — on the webhook path AND the re-read path. A paid order
//      for the wrong amount is refused, not settled.
//   3. The webhook is the source of truth (it arrives even if the buyer closes
//      the tab); the verify call only makes the success screen instant. Both
//      funnel into markOrderPaid, which is idempotent, so whichever arrives
//      second is a no-op.
//   4. The webhook gate answers an unsigned probe with 200 and processes
//      nothing, so the endpoint can be registered, while a WRONG signature is
//      a loud 400.

import { BadRequestException, Body, Controller, ForbiddenException, Headers, HttpCode, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { z } from "zod";
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
  providerOrderIdForOrder,
  topupIdForProviderOrder,
  Collections,
  type Db,
  type ArtworkDoc,
} from "@galleryzone/db";
import { startWalletTopupInputSchema, type StartWalletTopupInput } from "@galleryzone/contracts";
import type { AppEnv } from "@galleryzone/config";
import { Public, Roles } from "../auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "../auth/roles.guard.ts";
import { DB, ENV } from "../db.module.ts";
import { Emails } from "../mail/emails.ts";
import { ReadCache } from "../read-cache.ts";
import { ZodValidationPipe } from "../zod-validation.pipe.ts";
import { Razorpay, type RazorpayOrder } from "./razorpay.ts";
import { classifyWebhook, invalidSignature } from "./webhook-signature.ts";

/**
 * The Checkout.js success payload, OPTIONAL on purpose.
 *
 * When the browser sends it the HMAC is checked and a mismatch is refused — a
 * cheap extra signal, and a wrong one means something is genuinely off. But
 * the flow must also work without it: a UPI app or a bank's 3-D Secure page
 * can complete the payment out of band, leaving the modal with no payload to
 * hand back. Requiring it would strand exactly those buyers, who HAVE paid.
 */
const verifySchema = z.preprocess(
  // A POST with no body reaches us as `{}`, not `undefined`, because express's
  // JSON parser fills it in. Without this, `.optional()` would reject the
  // body-less call — which is precisely the call a buyer makes after paying in
  // a UPI app out of band, i.e. the one person here who HAS paid. They would
  // get a 400 instead of their order.
  (value) => (value !== null && typeof value === "object" && Object.keys(value).length === 0 ? undefined : value),
  z
    .object({
      razorpayOrderId: z.string().min(1).max(100),
      razorpayPaymentId: z.string().min(1).max(100),
      signature: z.string().min(1).max(200),
    })
    .strict()
    .optional(),
);
type VerifyBody = z.infer<typeof verifySchema>;

const notFound = () => new NotFoundException({ type: "about:blank", title: "Order not found", status: 404, code: "not_found" });

const notStarted = (what: string) =>
  new BadRequestException({ type: "about:blank", title: `No payment has been started for this ${what}`, status: 409, code: "payment_not_started" });

const badSignature = () => new BadRequestException({ type: "about:blank", title: "Payment signature does not match", status: 400, code: "bad_signature" });

interface WebhookEvent {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; method?: string; amount?: number; notes?: Record<string, string> } };
    order?: { entity?: { id?: string; receipt?: string; amount?: number; notes?: Record<string, string> } };
  };
}

@Controller("v1")
export class PaymentsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
    private readonly razorpay: Razorpay,
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

  @Roles("customer")
  @Post("orders/:id/payment/session")
  async session(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const order = await this.ownOrder(req, id);
    if (order.status !== "pending") {
      throw new BadRequestException({ type: "about:blank", title: `Order is already ${order.status}`, status: 409, code: "order_not_pending" });
    }
    if (this.env.paymentsMode !== "razorpay") return { mode: "simulated" as const };

    const [user, artworkSnap] = await Promise.all([
      getCurrentUser(this.db, req.authUser.uid, { touchLogin: false }),
      this.db.collection(Collections.artworks).doc(order.artworkId).get(),
    ]);
    const artwork = artworkSnap.data() as ArtworkDoc | undefined;
    const gateway = await this.razorpay.createOrder({ orderId: id, amountPaise: order.totalPaise, customerId: req.authUser.uid });
    await attachProviderOrder(this.db, id, gateway.id);
    // The key id is public by design — it identifies the merchant to
    // Checkout.js. The secret never leaves this process.
    return {
      mode: "razorpay" as const,
      keyId: this.razorpay.keyId,
      razorpayOrderId: gateway.id,
      amountPaise: order.totalPaise,
      currency: "INR",
      name: "GalleryZone",
      description: artwork ? `${artwork.title} (${artwork.productCode})` : `Order ${id}`,
      // Hints only — Razorpay lets the buyer correct them, so an incomplete
      // profile does not block checkout.
      prefill: { name: user?.name ?? "", email: user?.email ?? "", contact: user?.phone ?? "" },
    };
  }

  /**
   * Called when the buyer lands back on the site. The body is optional; what
   * settles the order is Razorpay's own answer for it, plus the amount we
   * expected.
   */
  @Roles("customer")
  @Post("orders/:id/payment/verify")
  async verify(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(verifySchema)) body: VerifyBody) {
    const order = await this.ownOrder(req, id);
    if (order.status === "paid") return { status: "paid" as const };

    // Which gateway order to ask about is OUR record, not the browser's claim.
    const ours = await providerOrderIdForOrder(this.db, id);
    const gatewayOrderId = ours ?? body?.razorpayOrderId ?? null;
    if (!gatewayOrderId) throw notStarted("order");

    // A payload naming a different gateway order, or one whose signature does
    // not check out, is refused before anything is read.
    if (body) {
      const belongsToThisOrder = ours ? body.razorpayOrderId === ours : (await orderIdForProviderOrder(this.db, body.razorpayOrderId)) === id;
      if (!belongsToThisOrder || !this.razorpay.verifyCheckoutSignature(body)) throw badSignature();
    }

    const gateway = await this.razorpay.fetchOrder(gatewayOrderId);
    const guard = this.amountGuard(gateway, order.totalPaise, gatewayOrderId);
    if (guard) throw guard;
    if (gateway.status !== "paid") return { status: gateway.status };

    const payment = (await this.razorpay.fetchPayments(gatewayOrderId)).find((p) => p.status === "captured");
    try {
      const result = await this.settle(id, {
        method: payment?.method ? `razorpay_${payment.method}` : "razorpay",
        providerPaymentId: payment?.id ?? body?.razorpayPaymentId ?? null,
      });
      return { status: "paid" as const, transactionId: result.transactionId };
    } catch (error) {
      if (error instanceof CheckoutError) throw new BadRequestException({ type: "about:blank", title: error.message, status: 409, code: "checkout_rejected" });
      throw error;
    }
  }

  /**
   * A paid order whose amount is not the amount we asked for never settles.
   * This is the check that makes trusting the gateway's status safe.
   *
   * Both sides are paise integers, so this is an exact comparison with no
   * rounding to reason about — the one thing Razorpay makes genuinely easier
   * than Cashfree, whose rupee decimals needed a dedicated module.
   *
   * `amount` is what we asked for and `amount_paid` is what was captured;
   * both have to agree with our own total, so a partial capture is refused
   * rather than settled as if it were the full price.
   */
  private amountGuard(gateway: RazorpayOrder, expectedPaise: number, gatewayOrderId: string): BadRequestException | null {
    if (gateway.status !== "paid") return null;
    if (gateway.amount === expectedPaise && gateway.amount_paid === expectedPaise) return null;
    // Loud on purpose: this is either a tampered order or a unit bug, and both need a human.
    console.error(
      JSON.stringify({
        event: "payments.amount_mismatch",
        gatewayOrderId,
        expectedPaise,
        reportedAmount: gateway.amount,
        reportedAmountPaid: gateway.amount_paid,
      }),
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
    if (this.env.paymentsMode !== "razorpay") return { mode: "simulated" as const, topupId, amountPaise: body.amountPaise };

    const [user, gateway] = await Promise.all([
      getCurrentUser(this.db, req.authUser.uid, { touchLogin: false }),
      this.razorpay.createTopupOrder({ topupId, amountPaise: body.amountPaise, userId: req.authUser.uid }),
    ]);
    await attachTopupProviderOrder(this.db, topupId, gateway.id);
    return {
      mode: "razorpay" as const,
      topupId,
      keyId: this.razorpay.keyId,
      razorpayOrderId: gateway.id,
      amountPaise: body.amountPaise,
      currency: "INR",
      name: "GalleryZone",
      description: "Add funds to your GalleryZone wallet",
      prefill: { name: user?.name ?? "", email: user?.email ?? "", contact: user?.phone ?? "" },
    };
  }

  @Roles("aggregator")
  @Post("aggregator/wallet/topups/:id/verify")
  async verifyTopup(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(verifySchema)) body: VerifyBody) {
    const topup = await this.ownTopup(req, id);
    if (topup.status === "paid") return { status: "paid" as const, amountPaise: topup.amountPaise };

    const gatewayOrderId = topup.providerOrderId ?? body?.razorpayOrderId ?? null;
    if (!gatewayOrderId) throw notStarted("top-up");
    if (body && (body.razorpayOrderId !== gatewayOrderId || !this.razorpay.verifyCheckoutSignature(body))) throw badSignature();

    const gateway = await this.razorpay.fetchOrder(gatewayOrderId);
    const guard = this.amountGuard(gateway, topup.amountPaise, gatewayOrderId);
    if (guard) throw guard;
    if (gateway.status !== "paid") return { status: gateway.status };

    const payment = (await this.razorpay.fetchPayments(gatewayOrderId)).find((p) => p.status === "captured");
    const result = await markTopupPaid(this.db, id, {
      method: payment?.method ? `razorpay_${payment.method}` : "razorpay",
      providerPaymentId: payment?.id ?? body?.razorpayPaymentId ?? null,
    });
    return { status: "paid" as const, amountPaise: result.amountPaise };
  }

  /** The simulated gateway, for environments with no Razorpay keys. Refused the moment PAYMENTS_MODE is razorpay. */
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
   * Razorpay → us. Always 200 once the signature checks out, so Razorpay stops
   * retrying; unknown events are acknowledged and ignored.
   *
   * The signature covers the RAW body, so the raw bytes are required —
   * re-serialised JSON will not match.
   */
  @Public()
  @SkipThrottle()
  @Post("payments/razorpay/webhook")
  @HttpCode(200)
  async webhook(@Req() req: Request & { rawBody?: Buffer }, @Headers("x-razorpay-signature") signature: string | undefined) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const check = classifyWebhook({
      source: "payments",
      rawBody: raw,
      // Razorpay signs the body alone — there is no timestamp header to pass.
      timestamp: undefined,
      signature,
      verify: (b, _t, s) => this.razorpay.verifyWebhookSignature(b, s),
    });
    // An unsigned probe is acknowledged and nothing is read from it; a wrong
    // signature is refused.
    if (check === "probe") return { received: true, matched: false };
    if (check === "rejected") throw invalidSignature();

    const event = req.body as WebhookEvent;
    const payment = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const providerOrderId = payment?.order_id ?? orderEntity?.id ?? null;
    // The reported amount is checked against our own record before anything
    // settles. The order's own amount is preferred over the payment's, because
    // a partial capture reports less on the payment and must not settle.
    const reportedAmount = orderEntity?.amount ?? payment?.amount ?? null;

    // A wallet top-up is told apart from an artwork order by its note (or its gateway order id).
    const topupId =
      payment?.notes?.gzTopupId ?? orderEntity?.notes?.gzTopupId ?? (providerOrderId ? await topupIdForProviderOrder(this.db, providerOrderId) : null);
    if (topupId) return this.topupWebhook(event.event, topupId, { payment, reportedAmount, providerOrderId });

    const noteOrderId = payment?.notes?.gzOrderId ?? orderEntity?.notes?.gzOrderId ?? null;
    const orderId = noteOrderId ?? (providerOrderId ? await orderIdForProviderOrder(this.db, providerOrderId) : null);
    if (!orderId) return { received: true, matched: false };

    switch (event.event) {
      case "payment.captured":
      case "order.paid": {
        const order = await getOrder(this.db, orderId);
        if (!order) return { received: true, matched: false };
        if (reportedAmount !== null && reportedAmount !== order.totalPaise) {
          console.error(
            JSON.stringify({ event: "payments.amount_mismatch", source: "webhook", providerOrderId, expectedPaise: order.totalPaise, reportedAmount }),
          );
          return { received: true, matched: false };
        }
        try {
          await this.settle(orderId, {
            method: payment?.method ? `razorpay_${payment.method}` : "razorpay",
            providerPaymentId: payment?.id ?? null,
            rawWebhookPayload: event,
          });
        } catch (error) {
          // A cancelled order that later gets a capture is an operator problem, not a retry loop.
          if (!(error instanceof CheckoutError)) throw error;
        }
        break;
      }
      case "payment.failed": {
        await markPaymentFailed(this.db, orderId, { providerPaymentId: payment?.id ?? null, rawWebhookPayload: event });
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
    event: string,
    topupId: string,
    ctx: { payment: { id?: string; method?: string } | undefined; reportedAmount: number | null; providerOrderId: string | null },
  ) {
    try {
      if (event === "payment.captured" || event === "order.paid") {
        const topup = await getWalletTopup(this.db, topupId);
        if (!topup) return { received: true, matched: false };
        if (ctx.reportedAmount !== null && ctx.reportedAmount !== topup.amountPaise) {
          console.error(
            JSON.stringify({
              event: "payments.amount_mismatch",
              source: "webhook_topup",
              providerOrderId: ctx.providerOrderId,
              expectedPaise: topup.amountPaise,
              reportedAmount: ctx.reportedAmount,
            }),
          );
          return { received: true, matched: false };
        }
        await markTopupPaid(this.db, topupId, {
          method: ctx.payment?.method ? `razorpay_${ctx.payment.method}` : "razorpay",
          providerPaymentId: ctx.payment?.id ?? null,
        });
      } else if (event === "payment.failed") {
        await markTopupFailed(this.db, topupId, { providerPaymentId: ctx.payment?.id ?? null });
      }
    } catch (error) {
      // An unknown top-up id is an operator problem, not a retry loop.
      if (!(error instanceof WalletTopupError)) throw error;
    }
    return { received: true, matched: true };
  }
}
