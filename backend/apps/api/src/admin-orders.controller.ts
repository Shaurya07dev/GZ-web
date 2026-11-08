import { BadRequestException, Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { orderStatusValues } from "@galleryzone/contracts";
import { Collections, advanceOrderStatus, getAddressAdmin, getOrder, getOrderAdmin, listOrdersAdmin, markOrderRefunded, providerPaymentIdForOrder, type Db } from "@galleryzone/db";
import { FieldValue } from "firebase-admin/firestore";
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
}
