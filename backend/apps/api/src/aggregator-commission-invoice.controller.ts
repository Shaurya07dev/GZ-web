// Aggregator commission tax-invoice — download + acceptance routes.
//
// MOU Clause 9.6 (v2026.4): the aggregator owes GST-inclusive commission
// on every facilitated counter sale. GalleryZone generates the invoice
// on their behalf and the aggregator agrees to its contents in the
// settlement portal. These three routes are the whole aggregator-side
// surface:
//
//   GET  /v1/aggregator/sales/:id/commission-invoice.pdf
//     Stamps the snapshot (first access) and returns the rendered PDF.
//     Readable by the owning aggregator and any platform admin; 404
//     for anyone else so the id is never confirmed to a stranger.
//
//   POST /v1/aggregator/sales/:id/commission-invoice/agree
//     Stamps the aggregator's acceptance (timestamp + IP + user-agent)
//     onto the already-stamped snapshot. Owning aggregator only;
//     idempotent — a second click returns the already-stored block.
//
//   GET  /v1/aggregator/sales/:id/commission-invoice
//     Returns the stamped snapshot (or null) + the acceptance block.
//     Lets the portal show the invoice number, status and totals
//     without downloading the PDF. Owning aggregator / admin only.

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { AppEnv } from "@galleryzone/config";
import {
  Collections,
  acceptAggregatorCommissionInvoice,
  AggregatorCommissionInvoiceError,
  FirestoreRateConfigStore,
  getOrCreateAggregatorCommissionInvoice,
  type AggregatorCommissionInvoiceDocSnapshot,
  type AggregatorHoldingDoc,
  type AggregatorSaleDoc,
  type Db,
  type GalleryZoneBillTo,
} from "@galleryzone/db";
import { loadActiveRates } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { renderAggregatorCommissionInvoicePdf } from "./aggregator-commission-invoice-pdf.ts";

/** Derive the 10-char PAN from a 15-char GSTIN. Duplicate of the helper
 *  in admin-settlements.controller.ts — intentional, so this controller
 *  stays free of cross-controller imports. */
function panFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const trimmed = gstin.trim().toUpperCase();
  if (trimmed.length !== 15) return null;
  return trimmed.slice(2, 12);
}

/** Build the half-month service period the invoice covers. We take the
 *  calendar half (1–15 or 16–end) the sale date falls into — matches
 *  how most Indian gallery back offices reconcile commissions. */
function servicePeriodFor(saleDate: Date): { from: Date; to: Date } {
  const y = saleDate.getFullYear();
  const m = saleDate.getMonth();
  const d = saleDate.getDate();
  if (d <= 15) {
    return {
      from: new Date(y, m, 1, 0, 0, 0, 0),
      to: new Date(y, m, 15, 23, 59, 59, 999),
    };
  }
  // 16 → end-of-month. Day 0 of next month = last day of this month.
  return {
    from: new Date(y, m, 16, 0, 0, 0, 0),
    to: new Date(y, m + 1, 0, 23, 59, 59, 999),
  };
}

/** Due date: T+15 calendar days from the sale. (Business days needs a
 *  holidays table; a straight +15 days is close enough for display and
 *  matches how the ops team was tracking in Sheets.) */
function dueDateFor(saleDate: Date): Date {
  const d = new Date(saleDate);
  d.setDate(d.getDate() + 15);
  return d;
}

/** The AppEnv invoiceSeller block mapped to the DB layer's
 *  GalleryZoneBillTo shape. invoiceSeller.gstin is optional on the env
 *  side; a missing GSTIN means the server is misconfigured for a
 *  commission invoice to GZ, so we throw at call time rather than
 *  silently printing "UNREGISTERED". */
function galleryZoneBillToFromEnv(env: AppEnv): GalleryZoneBillTo {
  if (!env.invoiceSeller.gstin) {
    throw new AggregatorCommissionInvoiceError(
      "INVOICE_SELLER_GSTIN is not set — the server cannot generate a commission invoice to GalleryZone without it",
    );
  }
  const pan = panFromGstin(env.invoiceSeller.gstin);
  if (!pan) {
    throw new AggregatorCommissionInvoiceError(
      "INVOICE_SELLER_GSTIN is not a valid 15-character GSTIN — fix the env var",
    );
  }
  return {
    legalName: env.invoiceSeller.legalName,
    addressLine1: env.invoiceSeller.addressLine1,
    addressLine2: env.invoiceSeller.addressLine2 ?? null,
    city: env.invoiceSeller.city,
    state: env.invoiceSeller.state,
    pincode: env.invoiceSeller.pincode,
    gstin: env.invoiceSeller.gstin,
    pan,
  };
}

/** Convert the stored snapshot (Firestore Timestamps) to the renderer's
 *  Date-based shape. */
function toRendererSnapshot(snap: AggregatorCommissionInvoiceDocSnapshot) {
  return {
    ...snap,
    issuedAt: snap.issuedAt.toDate(),
    dueDate: snap.dueDate.toDate(),
    servicePeriod: {
      from: snap.servicePeriod.from.toDate(),
      to: snap.servicePeriod.to.toDate(),
    },
    sale: {
      ...snap.sale,
      saleDate: snap.sale.saleDate.toDate(),
    },
    acceptance: snap.acceptance
      ? {
          acceptedAt: snap.acceptance.acceptedAt.toDate(),
          acceptedByIp: snap.acceptance.acceptedByIp,
          acceptedByUserAgent: snap.acceptance.acceptedByUserAgent,
        }
      : null,
  };
}

const notFound = () =>
  new NotFoundException({
    type: "about:blank",
    title: "Not found",
    status: 404,
    code: "not_found",
  });

@Controller("v1/aggregator/sales")
export class AggregatorCommissionInvoiceController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
  ) {}

  /** Check the caller owns this sale, returning the sale doc. Throws
   *  404 for unrelated callers. Admins pass through without the
   *  ownership check. */
  private async authorize(
    req: AuthenticatedRequest,
    saleId: string,
  ): Promise<{ sale: AggregatorSaleDoc; isAdmin: boolean }> {
    const saleSnap = await this.db
      .collection(Collections.aggregatorSales)
      .doc(saleId)
      .get();
    if (!saleSnap.exists) throw notFound();
    const sale = saleSnap.data() as AggregatorSaleDoc;

    const isAdmin = req.authUser.grants.includes("platform_admin");
    if (isAdmin) return { sale, isAdmin };

    // Not an admin — must be the owning aggregator (resolved via the
    // sale's holding). Any mismatch returns 404 so we never confirm
    // the sale id belongs to someone else.
    const holdingSnap = await this.db
      .collection(Collections.aggregatorHoldings)
      .doc(sale.holdingId)
      .get();
    const holding = holdingSnap.data() as AggregatorHoldingDoc | undefined;
    if (!holding || holding.aggregatorId !== req.authUser.uid) {
      throw notFound();
    }
    return { sale, isAdmin: false };
  }

  @Roles("aggregator", "platform_admin")
  @Get(":id/commission-invoice")
  async get(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<{
    snapshot: ReturnType<typeof toRendererSnapshot> | null;
  }> {
    const { sale } = await this.authorize(req, id);
    return {
      snapshot: sale.commissionInvoice
        ? toRendererSnapshot(sale.commissionInvoice)
        : null,
    };
  }

  @Roles("aggregator", "platform_admin")
  @Get(":id/commission-invoice.pdf")
  @Header("Content-Type", "application/pdf")
  async download(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.authorize(req, id);

    let snapshot;
    try {
      const rates = await loadActiveRates(
        new FirestoreRateConfigStore(this.db),
      );
      const galleryZone = galleryZoneBillToFromEnv(this.env);
      const saleSnap = await this.db
        .collection(Collections.aggregatorSales)
        .doc(id)
        .get();
      const sale = saleSnap.data() as AggregatorSaleDoc;
      const saleDate = sale.soldAt.toDate();
      snapshot = await getOrCreateAggregatorCommissionInvoice(this.db, {
        saleId: id,
        galleryZone,
        fallbackCommissionRate: rates.aggregatorCommissionRate,
        servicePeriod: servicePeriodFor(saleDate),
        dueDate: dueDateFor(saleDate),
      });
    } catch (err) {
      if (err instanceof AggregatorCommissionInvoiceError) {
        // 409: the data isn't ready yet (profile incomplete, no commission
        // on this sale, etc). Surface the message so the UI can tell
        // the aggregator what to fix.
        throw new ForbiddenException({
          type: "about:blank",
          title: err.message,
          status: 403,
          code: "commission_invoice_unavailable",
        });
      }
      throw err;
    }

    const pdf = await renderAggregatorCommissionInvoicePdf(
      toRendererSnapshot(snapshot),
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="commission-invoice-${snapshot.number.replace(/\//g, "-")}.pdf"`,
    );
    res.setHeader("Content-Length", String(pdf.byteLength));
    res.end(pdf);
  }

  @Roles("aggregator")
  @Post(":id/commission-invoice/agree")
  async agree(
    @Req() req: AuthenticatedRequest & Request,
    @Param("id") id: string,
  ): Promise<{
    acceptance: NonNullable<
      ReturnType<typeof toRendererSnapshot>["acceptance"]
    > | null;
  }> {
    await this.authorize(req, id);
    // Capture the real client IP via Express. The platform runs behind
    // Railway's proxy, which populates `X-Forwarded-For` → trust proxy
    // must be enabled for req.ip to return the correct value.
    const ip = req.ip ?? "";
    const userAgent =
      (req.headers["user-agent"] as string | undefined) ?? "unknown";
    try {
      const updated = await acceptAggregatorCommissionInvoice(this.db, {
        saleId: id,
        aggregatorId: req.authUser.uid,
        acceptedByIp: ip,
        acceptedByUserAgent: userAgent,
      });
      const rendered = toRendererSnapshot(updated);
      return { acceptance: rendered.acceptance };
    } catch (err) {
      if (err instanceof AggregatorCommissionInvoiceError) {
        throw new ForbiddenException({
          type: "about:blank",
          title: err.message,
          status: 403,
          code: "commission_invoice_cannot_accept",
        });
      }
      throw err;
    }
  }
}
