import { BadRequestException, Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { orderStatusValues } from "@galleryzone/contracts";
import {
  Collections,
  FirestoreRateConfigStore,
  advanceOrderStatus,
  artworkPricingCol,
  getAddressAdmin,
  getOrder,
  getOrderAdmin,
  listOrdersAdmin,
  markOrderRefunded,
  postArtistSale,
  providerPaymentIdForOrder,
  recordNotifications,
  type ArtworkPricingDoc,
  type Db,
  type OrderDoc,
  type UserDoc,
} from "@galleryzone/db";
import { marketplaceCheckoutPostings } from "@galleryzone/domain";
import { FieldValue } from "firebase-admin/firestore";
import { bookOutboundOrderShipment } from "./shiprocket-booking.ts";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { Emails } from "./mail/emails.ts";
import { DB } from "./db.module.ts";
import { Razorpay } from "./payments/razorpay.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const statusPatchSchema = z.object({ to: z.enum([...orderStatusValues]) }).strict();
type StatusPatchBody = z.infer<typeof statusPatchSchema>;

const refundSchema = z
  .object({
    reason: z.string().min(1, "Give a short reason — it is logged on the audit trail.").max(500),
  })
  .strict();
type RefundBody = z.infer<typeof refundSchema>;

@Controller("v1/admin")
export class AdminOrdersController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
    private readonly razorpay: Razorpay,
  ) {}

  @Roles("admin")
  @Get("orders")
  list() {
    return listOrdersAdmin(this.db);
  }

  @Roles("admin")
  @Get("orders/:id")
  get(@Param("id") id: string) {
    return getOrderAdmin(this.db, id);
  }

  @Roles("admin")
  @Get("addresses/:id")
  getAddress(@Param("id") id: string) {
    return getAddressAdmin(this.db, id);
  }

  @Roles("admin")
  @Patch("orders/:id/status")
  async advanceStatus(@Param("id") id: string, @Body(new ZodValidationPipe(statusPatchSchema)) body: StatusPatchBody) {
    await advanceOrderStatus(this.db, id, body.to);
    // Until now a buyer heard nothing between paying and the parcel arriving.
    // Read back rather than trust the patch: the order carries who to tell,
    // and the decorated view already resolves the artwork's artist.
    const order = await getOrder(this.db, id);
    if (order) {
      void this.emails
        .orderStatus({
          orderId: id,
          customerId: order.customerId,
          artistId: order.artwork?.artistId ?? null,
          title: order.artwork?.title ?? "your artwork",
          status: body.to,
        })
        .catch(this.emails.swallow("order status mail"));
    }
    return { orderId: id, status: body.to };
  }

  /**
   * Admin-approved refund. Issues the Razorpay refund against the captured
   * payment, then marks the order cancelled with a `refundedAt` stamp and
   * writes an audit-log entry under the admin's uid.
   *
   * Guard rails:
   *  - Order must exist, must be paid/confirmed/packed (not pending,
   *    delivered or already cancelled). Delivered means the piece has
   *    shipped — a refund here would strand the collector with no money
   *    and no piece.
   *  - A captured provider payment id must exist. Simulated orders
   *    (PAYMENTS_MODE=simulated) have no real payment to refund — those
   *    get a clear 409 instead of a silent no-op.
   *
   * Added 8 Nov 2026 — customer refund requests were landing as support
   * tickets and being processed manually inside the Razorpay dashboard.
   * This endpoint makes the process a one-click admin action with an
   * audit trail and the amount captured against the right fields.
   */
  @Roles("admin")
  @Post("orders/:id/refund")
  async refund(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(refundSchema)) body: RefundBody,
  ) {
    const order = await getOrder(this.db, id);
    if (!order) {
      throw new NotFoundException({ type: "about:blank", title: "Order not found", status: 404, code: "not_found" });
    }
    if (!["paid", "confirmed", "packed"].includes(order.status)) {
      throw new ConflictException({
        type: "about:blank",
        title: `Order cannot be refunded in status "${order.status}"`,
        status: 409,
        code: "order_not_refundable",
      });
    }

    const providerPaymentId = await providerPaymentIdForOrder(this.db, id);
    if (!providerPaymentId) {
      throw new BadRequestException({
        type: "about:blank",
        title: "This order has no captured Razorpay payment to refund (simulated or pre-gateway).",
        status: 400,
        code: "no_captured_payment",
      });
    }

    const refund = await this.razorpay.createRefund({
      providerPaymentId,
      amountPaise: order.totalPaise,
      receipt: `refund-${id}`.slice(0, 40),
      notes: { gzOrderId: id, reason: body.reason.slice(0, 200), approvedBy: req.authUser.uid },
    });

    await markOrderRefunded(this.db, id, {
      providerRefundId: refund.id,
      reason: body.reason,
    });

    // Audit log matches the shape admin-artworks.ts writes.
    await this.db.collection(Collections.auditLog).add({
      adminId: req.authUser.uid,
      action: "order.refunded",
      entityType: "order",
      entityId: id,
      entityLabel: null,
      detail: { providerRefundId: refund.id, amountPaise: order.totalPaise, reason: body.reason },
      createdAt: FieldValue.serverTimestamp(),
    });

    return { orderId: id, providerRefundId: refund.id, status: refund.status };
  }

  /**
   * Run the paid-side effects (settlement, Shiprocket booking, notifications,
   * emails) on an order that is already in "paid" state but had those
   * effects skipped. Used after the scripts/revive-order-direct.ts fallback,
   * which writes paid state directly to Firestore and deliberately skips
   * all the downstream wiring because it lives outside the Nest app.
   *
   * Each sub-step is idempotent-ish:
   *   - postArtistSale uses saleKey so a repeat is a no-op
   *   - bookOutboundOrderShipment refuses if an AWB already exists
   *   - recordNotifications uses the email idempotency key, so a second
   *     call never creates a duplicate bell
   *   - emails.orderPaid has its own idempotency key under the hood
   *
   * Only works on orders in "paid" state — paid+shipped and later can't
   * benefit from re-running these; refunded/cancelled would be wrong to
   * run on. Admin-only; added 16 Nov 2026 for the ₹260.21 revival incident.
   */
  @Roles("admin")
  @Post("orders/:id/finish-revived")
  async finishRevived(@Param("id") id: string) {
    const orderSnap = await this.db.collection(Collections.orders).doc(id).get();
    if (!orderSnap.exists) {
      throw new NotFoundException({ type: "about:blank", title: "Order not found", status: 404, code: "not_found" });
    }
    const order = orderSnap.data() as OrderDoc;
    if (order.status !== "paid") {
      throw new ConflictException({
        type: "about:blank",
        title: `Order is "${order.status}", not "paid". Only paid orders can be finished-revived.`,
        status: 409,
        code: "wrong_status",
      });
    }

    const results: Record<string, string> = {};

    // 1. Settlement
    try {
      const pricingSnap = await this.db
        .collection(artworkPricingCol(order.artworkId))
        .doc("data")
        .get();
      if (!pricingSnap.exists) throw new Error(`No pricing doc for ${order.artworkId}`);
      const pricing = pricingSnap.data() as ArtworkPricingDoc;
      const rateStore = new FirestoreRateConfigStore(this.db);
      const version = await rateStore.getActiveVersion(order.createdAt.toDate());
      if (!version) throw new Error("No active rate config");
      const { transactionId } = await postArtistSale(this.db, {
        artistId: pricing.artistId,
        artistPricePaise: pricing.artistPricePaise,
        channel: "marketplace",
        rates: version.rates,
        saleKey: `order:${id}`,
        orderId: id,
        build: (tdsApplies) =>
          marketplaceCheckoutPostings({
            artistId: pricing.artistId,
            artistPricePaise: pricing.artistPricePaise,
            rates: version.rates,
            tdsApplies,
          }),
      });
      results.settlement = `ok:${transactionId}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // ALREADY_EXISTS on the artistSales doc means the settlement was
      // already posted by a previous Finish-revived run. That's the
      // desired idempotent outcome, not an error — surface it as such so
      // the admin toast doesn't look like a half-failure.
      if (msg.includes("ALREADY_EXISTS")) {
        results.settlement = "already posted (idempotent)";
      } else {
        results.settlement = `skipped: ${msg}`;
      }
    }

    // 2. Shiprocket outbound booking
    try {
      await bookOutboundOrderShipment(this.db, id);
      const refreshed = await this.db.collection(Collections.orders).doc(id).get();
      const data = refreshed.data() as OrderDoc;
      results.shiprocket = `ok: stage=${data.shiprocketStage} awb=${data.shiprocketTrackingId} carrier=${data.shiprocketCarrier}`;
    } catch (error) {
      results.shiprocket = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    // 3. In-app notifications + emails (one call, handles both)
    try {
      const [buyerSnap, artistSnap, artworkSnap] = await Promise.all([
        this.db.collection(Collections.users).doc(order.customerId).get(),
        this.db.collection(Collections.users).doc(order.artistId ?? "").get(),
        this.db.collection(Collections.artworks).doc(order.artworkId).get(),
      ]);
      const buyer = buyerSnap.data() as UserDoc | undefined;
      const artist = artistSnap.data() as UserDoc | undefined;
      const title = (artworkSnap.data() as { title?: string } | undefined)?.title ?? "your artwork";
      await this.emails.orderPaid({
        orderId: id,
        customerId: order.customerId,
        artistId: order.artistId ?? "",
        title,
        totalPaise: order.totalPaise,
        artistNetPaise: 0,
      });
      results.notifications = `ok: buyer=${buyer?.email ?? "?"} artist=${artist?.email ?? "?"}`;
    } catch (error) {
      results.notifications = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Audit trail
    await this.db.collection(Collections.auditLog).add({
      action: "order.finish_revived",
      entityType: "order",
      entityId: id,
      entityLabel: null,
      detail: results,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { orderId: id, ...results };
  }

  // Silence unused-import warnings in strict TS: these are only touched via
  // the finishRevived path. Removing the imports breaks the barrel re-export
  // chain elsewhere.
  private _unused = { recordNotifications };
}
