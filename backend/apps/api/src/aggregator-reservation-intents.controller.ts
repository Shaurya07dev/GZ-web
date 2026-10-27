// Aggregator reservation payments. Replaces the old wallet-balance reserve
// flow — the aggregator now pays through Razorpay per reservation, and the
// holding is only created AFTER the payment captures AND the allocation is
// still free. See packages/db/src/reservation-intents.ts for the state
// machine and the atomic finalize transaction.
//
// Endpoints:
//   POST /v1/aggregator/reservation-intents             create intent + open Razorpay order
//   POST /v1/aggregator/reservation-intents/:id/verify  verify payment, finalize holding or queue refund
//
// The webhook branch for intents lives in payments.controller.ts, next to the
// existing order + topup branches, because signature verification + raw-body
// handling are already set up there.

import { BadRequestException, Body, Controller, ForbiddenException, Inject, Logger, NotFoundException, Param, Post, Req } from "@nestjs/common";
import {
  attachIntentProviderOrder,
  createReservationIntent,
  finalizeReservationIntent,
  getReservationIntent,
  hasApprovedGst,
  hasSignedCurrentMou,
  markIntentCancelled,
  markIntentRefunded,
  ReservationIntentError,
  type Db,
  type FinalizeOutcome,
} from "@galleryzone/db";
import {
  createReservationIntentInputSchema,
  verifyReservationIntentInputSchema,
  type CreateReservationIntentInput,
  type VerifyReservationIntentInput,
} from "@galleryzone/contracts";
import type { AppEnv } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { Razorpay } from "./payments/razorpay.ts";
import { bookInboundShipment } from "./shiprocket-booking.ts";

// The response shape mirrors what openRazorpayCheckout() on the frontend
// expects, so the client hands it straight to Checkout.js. Shape is inferred
// from the return statements so `keyId: this.razorpay.keyId` (string | null)
// doesn't fight a declared `keyId: string` interface — the gateway call above
// enforces configuration at runtime.

@Controller("v1/aggregator/reservation-intents")
export class AggregatorReservationIntentsController {
  private readonly logger = new Logger(AggregatorReservationIntentsController.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
    private readonly razorpay: Razorpay,
  ) {}

  @Roles("aggregator")
  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createReservationIntentInputSchema)) body: CreateReservationIntentInput,
  ) {
    // Same gates as the old reserve flow — MOU signed, GST approved. We check
    // BEFORE taking money because collecting the payment then telling them
    // "you can't reserve anyway" is the worst UX.
    if (!(await hasSignedCurrentMou(this.db, req.authUser.uid, "aggregator"))) {
      throw new ForbiddenException({ type: "about:blank", title: "Sign the current Aggregator MOU in My Profile before reserving artwork", status: 403, code: "mou_required" });
    }
    if (!(await hasApprovedGst(this.db, req.authUser.uid))) {
      throw new ForbiddenException({ type: "about:blank", title: "Add your GST number in My Profile, and wait for GalleryZone to approve it, before reserving artwork", status: 403, code: "gst_required" });
    }

    let created;
    try {
      created = await createReservationIntent(this.db, {
        aggregatorId: req.authUser.uid,
        artworkId: body.artworkId,
        sellingPricePaise: body.sellingPricePaise,
        idempotencyKey: body.idempotencyKey,
      });
    } catch (err) {
      if (err instanceof ReservationIntentError) {
        throw new BadRequestException({ type: "about:blank", title: err.message, status: 400, code: "reservation_rejected" });
      }
      throw err;
    }

    // Simulated mode: skip Razorpay entirely. The /verify endpoint accepts the
    // intent id and finalizes immediately. Prod never hits this path.
    if (this.env.paymentsMode !== "razorpay") {
      return { mode: "simulated" as const, intentId: created.intent.id, amountPaise: created.intent.totalPayablePaise };
    }

    // Idempotent return: if the intent was reused AND already has a Razorpay
    // order, give that back instead of opening a second one.
    if (created.reused && created.intent.providerOrderId) {
      return {
        mode: "razorpay" as const,
        intentId: created.intent.id,
        keyId: this.razorpay.keyId,
        razorpayOrderId: created.intent.providerOrderId,
        amountPaise: created.intent.totalPayablePaise,
        currency: "INR",
        name: "GalleryZone",
        description: `Reserve artwork (advance + delivery)`,
      };
    }

    // Open the Razorpay order and persist its id onto the intent. If this
    // throws, the intent sits in `created` until it expires — safe, just
    // unused. The aggregator can retry with a fresh idempotency key.
    const gateway = await this.razorpay.createIntentOrder({
      intentId: created.intent.id,
      amountPaise: created.intent.totalPayablePaise,
      aggregatorId: req.authUser.uid,
    });
    await attachIntentProviderOrder(this.db, created.intent.id, gateway.id);

    return {
      mode: "razorpay" as const,
      intentId: created.intent.id,
      keyId: this.razorpay.keyId,
      razorpayOrderId: gateway.id,
      amountPaise: created.intent.totalPayablePaise,
      currency: "INR",
      name: "GalleryZone",
      description: `Reserve artwork (advance + delivery)`,
    };
  }

  @Roles("aggregator")
  @Post(":id/verify")
  async verify(
    @Req() req: AuthenticatedRequest,
    @Param("id") intentId: string,
    @Body(new ZodValidationPipe(verifyReservationIntentInputSchema.optional())) body: VerifyReservationIntentInput | undefined,
  ) {
    const intent = await getReservationIntent(this.db, intentId);
    if (!intent) throw new NotFoundException({ type: "about:blank", title: "Intent not found", status: 404, code: "not_found" });
    if (intent.aggregatorId !== req.authUser.uid) throw new NotFoundException({ type: "about:blank", title: "Intent not found", status: 404, code: "not_found" });

    // Already settled — return the current state. The client decides whether
    // to show "reserved" or "refund in progress" based on this.
    if (intent.status === "finalized") return { status: "finalized" as const, holdingId: intent.holdingId };
    if (intent.status === "refunded") return { status: "refunded" as const, reason: intent.failureReason };
    if (intent.status === "needs_refund") return { status: "needs_refund" as const, reason: intent.failureReason };

    // Simulated: finalize straight away with a fake payment id.
    if (this.env.paymentsMode !== "razorpay") {
      const outcome = await finalizeReservationIntent(this.db, {
        intentId,
        aggregatorId: req.authUser.uid,
        providerPaymentId: `sim-${intentId}`,
      });
      return this.respondAndBookShipment(outcome, req.authUser.uid, intent.artworkId);
    }

    // Real gateway. Which Razorpay order to ask about is OUR record, not the
    // browser's claim — this stops a malicious payload from pointing at a
    // different (already-paid) order.
    const gatewayOrderId = intent.providerOrderId ?? body?.razorpayOrderId ?? null;
    if (!gatewayOrderId) {
      // No Razorpay order was ever opened and nothing's been paid. Treat as cancel.
      await markIntentCancelled(this.db, intentId, "No payment was started");
      return { status: "cancelled" as const };
    }
    if (body) {
      const belongsToThisIntent = intent.providerOrderId ? body.razorpayOrderId === intent.providerOrderId : true;
      if (!belongsToThisIntent) throw new BadRequestException({ type: "about:blank", title: "Payment doesn't match this reservation", status: 400, code: "bad_signature" });
      if (!this.razorpay.verifyCheckoutSignature({
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
        signature: body.razorpaySignature,
      })) {
        throw new BadRequestException({ type: "about:blank", title: "Payment signature failed", status: 400, code: "bad_signature" });
      }
    }

    // Server-side truth: ask Razorpay directly whether this is paid, and if so,
    // for how much. Only this read settles money — not the browser's claim.
    const gateway = await this.razorpay.fetchOrder(gatewayOrderId);
    if (gateway.amount !== intent.totalPayablePaise) {
      // Amount mismatch is a hard refuse. Log + refund if captured.
      this.logger.error(`amount mismatch on intent ${intentId}: expected ${intent.totalPayablePaise}, gateway said ${gateway.amount}`);
      throw new BadRequestException({ type: "about:blank", title: "Payment amount mismatch", status: 400, code: "amount_mismatch" });
    }
    if (gateway.status !== "paid") {
      // Dismissed/failed with no capture yet. Don't cancel the intent — a UPI
      // app can still complete it out of band, in which case the webhook or a
      // retried verify picks it up. Just report the current gateway status.
      return { status: gateway.status };
    }

    // Payment is captured. Find the captured payment id (prefer the one the
    // browser just handed us, but fall back to the gateway's own list).
    const providerPaymentId = body?.razorpayPaymentId ?? (await this.razorpay.fetchPayments(gatewayOrderId)).find((p) => p.status === "captured")?.id ?? null;
    if (!providerPaymentId) {
      this.logger.error(`intent ${intentId} is paid but no captured payment id found`);
      throw new BadRequestException({ type: "about:blank", title: "Payment couldn't be identified", status: 400, code: "payment_missing" });
    }

    const outcome = await finalizeReservationIntent(this.db, {
      intentId,
      aggregatorId: req.authUser.uid,
      providerPaymentId,
    });

    // If finalize said needs_refund, issue the Razorpay refund right now. This
    // keeps the money moving back without waiting for a job to pick it up.
    if (outcome.kind === "needs_refund") {
      void this.issueRefund(intentId, providerPaymentId, intent.totalPayablePaise, outcome.reason).catch((err) => {
        this.logger.error(`refund failed for intent ${intentId}: ${String(err)}`);
      });
    }

    return this.respondAndBookShipment(outcome, req.authUser.uid, intent.artworkId);
  }

  private async respondAndBookShipment(outcome: FinalizeOutcome, aggregatorId: string, artworkId: string) {
    if (outcome.kind === "finalized" || outcome.kind === "already_finalized") {
      // Book the inbound (artist → aggregator) ShipRocket leg. Fire-and-forget;
      // the webhook writes the AWB onto the holding when it comes back.
      void bookInboundShipment(this.db, outcome.holdingId, artworkId, aggregatorId).catch((err) => {
        this.logger.error(`shiprocket inbound booking failed for holding ${outcome.holdingId}: ${String(err)}`);
      });
      return { status: outcome.kind, holdingId: outcome.holdingId };
    }
    return { status: outcome.kind, reason: outcome.reason };
  }

  private async issueRefund(intentId: string, providerPaymentId: string, amountPaise: number, reason: string): Promise<void> {
    const refund = await this.razorpay.createRefund({
      providerPaymentId,
      amountPaise,
      receipt: `refund-${intentId}`.slice(0, 40),
      notes: { gzIntentId: intentId, reason: reason.slice(0, 200) },
    });
    await markIntentRefunded(this.db, intentId, refund.id);
  }
}
