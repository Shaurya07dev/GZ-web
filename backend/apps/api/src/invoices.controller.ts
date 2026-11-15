// Tax-invoice download — audit §9.
//
// GET /v1/orders/:id/invoice.pdf → application/pdf. Only the order's own
// customer or a platform/finance admin can download; a stranger gets 404 so
// we never confirm the existence of an unrelated order id.
//
// The invoice is stamped on first download (atomic sequence allocation inside
// getOrCreateInvoice) and the snapshot is frozen on the order doc from then
// on — subsequent calls re-render the same PDF, same number, same tax split.

import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import type { AppEnv } from "@galleryzone/config";
import {
  Collections,
  InvoiceError,
  getOrCreateInvoice,
  type ArtworkDoc,
  type Db,
  type OrderDoc,
} from "@galleryzone/db";
import { Public, Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { renderInvoicePdf } from "./invoice-pdf.ts";

/** HMAC-sign an orderId with the Razorpay webhook secret (already a
 *  per-env shared secret). Shiprocket fetches the public invoice URL
 *  with ?token=<hmac>; we recompute and compare. Attacker can't forge
 *  one without the secret; a leaked URL only exposes ONE order's
 *  invoice, not the whole catalogue. */
function signOrderId(orderId: string, secret: string): string {
  return createHmac("sha256", secret).update(orderId).digest("hex");
}
function verifyOrderToken(orderId: string, token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const expected = signOrderId(orderId, secret);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(token, "utf8"));
}

/** Build the public URL Shiprocket will fetch to print the invoice. Called
 *  by shiprocket-booking when creating the shipment. Exported so tests can
 *  reproduce it. */
export function invoiceUrlForShiprocket(args: { publicApiUrl: string; orderId: string; secret: string }): string {
  const token = signOrderId(args.orderId, args.secret);
  return `${args.publicApiUrl}/v1/orders/${encodeURIComponent(args.orderId)}/invoice.pdf/public?token=${token}`;
}

@Controller("v1/orders")
export class InvoicesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
  ) {}

  @Roles("customer", "platform_admin")
  @Get(":id/invoice.pdf")
  @Header("Content-Type", "application/pdf")
  async download(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    const orderSnap = await this.db.collection(Collections.orders).doc(id).get();
    if (!orderSnap.exists) {
      throw new NotFoundException({
        type: "about:blank",
        title: "Order not found",
        status: 404,
        code: "not_found",
      });
    }
    const order = orderSnap.data() as OrderDoc;

    const isAdmin = req.authUser.grants.includes("platform_admin");
    if (!isAdmin && order.customerId !== req.authUser.uid) {
      // 404, not 403 — don't confirm the id belongs to someone else.
      throw new NotFoundException({
        type: "about:blank",
        title: "Order not found",
        status: 404,
        code: "not_found",
      });
    }

    try {
      const invoice = await getOrCreateInvoice(this.db, {
        orderId: id,
        seller: this.env.invoiceSeller,
      });

      const artworkSnap = await this.db
        .collection(Collections.artworks)
        .doc(order.artworkId)
        .get();
      const artworkTitle =
        (artworkSnap.data() as ArtworkDoc | undefined)?.title ?? "Artwork";

      const pdf = await renderInvoicePdf({
        order: { ...order, id },
        invoice,
        artworkTitle,
      });

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="invoice-${invoice.number.replace(/\//g, "-")}.pdf"`,
      );
      res.setHeader("Content-Length", String(pdf.byteLength));
      res.end(pdf);
    } catch (error) {
      if (error instanceof InvoiceError) {
        // "Order is pending" — expected for still-unpaid orders. 409 is more
        // accurate than 404 (the order exists; it just isn't invoiceable yet).
        throw new ForbiddenException({
          type: "about:blank",
          title: error.message,
          status: 403,
          code: "invoice_not_available",
        });
      }
      throw error;
    }
  }

  /**
   * Public, token-signed invoice download — exclusively for Shiprocket's
   * servers to fetch when printing the tax invoice to attach to the
   * parcel. HMAC token (keyed by RAZORPAY_WEBHOOK_SECRET, which is
   * already a per-env shared secret) stops a stranger from enumerating
   * invoices; the URL is single-order-scoped so a leaked one only
   * exposes that one order.
   *
   * We use RAZORPAY_WEBHOOK_SECRET (rather than minting a new secret
   * variable) because a) it's already set in every env, and b) the risk
   * profile is the same — both protect server-to-server fetches.
   *
   * Same body as the authenticated endpoint above; just the auth
   * mechanism differs.
   */
  @Public()
  @Get(":id/invoice.pdf/public")
  @Header("Content-Type", "application/pdf")
  async downloadPublic(
    @Param("id") id: string,
    @Query("token") token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const secret = this.env.razorpayWebhookSecret;
    if (!secret) {
      throw new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });
    }
    if (!token || !verifyOrderToken(id, token, secret)) {
      // 404, not 401 — don't reveal to a scanner that the id exists or
      // that token-protection is the gate.
      throw new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });
    }

    const orderSnap = await this.db.collection(Collections.orders).doc(id).get();
    if (!orderSnap.exists) {
      throw new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });
    }
    const order = orderSnap.data() as OrderDoc;

    try {
      const invoice = await getOrCreateInvoice(this.db, {
        orderId: id,
        seller: this.env.invoiceSeller,
      });
      const artworkSnap = await this.db
        .collection(Collections.artworks)
        .doc(order.artworkId)
        .get();
      const artworkTitle =
        (artworkSnap.data() as ArtworkDoc | undefined)?.title ?? "Artwork";
      const pdf = await renderInvoicePdf({
        order: { ...order, id },
        invoice,
        artworkTitle,
      });
      res.setHeader(
        "Content-Disposition",
        `inline; filename="invoice-${invoice.number.replace(/\//g, "-")}.pdf"`,
      );
      res.setHeader("Content-Length", String(pdf.byteLength));
      res.end(pdf);
    } catch (error) {
      if (error instanceof InvoiceError) {
        // Paid-only — a pending order has no invoice yet. Return 404 to
        // stay opaque to Shiprocket's logs if the webhook fires before
        // we've settled.
        throw new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });
      }
      throw error;
    }
  }
}
