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
  Req,
  Res,
} from "@nestjs/common";
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
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { renderInvoicePdf } from "./invoice-pdf.ts";

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
}
