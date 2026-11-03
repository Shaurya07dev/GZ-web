// Admin Excel exports — audit §10. The admin dashboards (/admin/orders,
// /admin/settlements, /admin/artists, …) show paginated tables; the owner
// wants a one-click "Download all as Excel" per table for offline analysis.
//
// We use exceljs because it:
//   - streams to a buffer so a large export doesn't blow up memory,
//   - formats headers + column widths + currency + dates cleanly,
//   - produces .xlsx that Excel/Numbers/Sheets all open without warnings.
//
// Each endpoint returns the file as an attachment. The frontend's download
// button just hits the URL — browser handles the save dialog. Auth is via
// the normal admin role guard, same as the admin dashboard reads.

import { Controller, Get, Header, Inject, Query, Res, StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import ExcelJS from "exceljs";
import {
  listOrdersAdmin,
  listSettlements,
  listUsersForAdmin,
  type Db,
} from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";

@Controller("v1/admin/export")
export class AdminExportController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // --- Orders ---------------------------------------------------------------

  @Roles("admin")
  @Get("orders.xlsx")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", `attachment; filename="orders-${isoDay()}.xlsx"`)
  async orders(@Res({ passthrough: true }) _res: Response): Promise<StreamableFile> {
    const orders = await listOrdersAdmin(this.db);

    const wb = new ExcelJS.Workbook();
    wb.creator = "GalleryZone Admin";
    wb.created = new Date();

    const sheet = wb.addWorksheet("Orders");
    sheet.columns = [
      { header: "Order ID", key: "id", width: 24 },
      { header: "Status", key: "status", width: 12 },
      { header: "Created at", key: "createdAt", width: 20 },
      { header: "Customer ID", key: "customerId", width: 24 },
      { header: "Artist ID", key: "artistId", width: 24 },
      { header: "Artwork ID", key: "artworkId", width: 24 },
      { header: "Artwork title", key: "title", width: 36 },
      { header: "Display price (₹)", key: "display", width: 14, style: { numFmt: "#,##0.00" } },
      { header: "GST (₹)", key: "gst", width: 10, style: { numFmt: "#,##0.00" } },
      { header: "Delivery (₹)", key: "delivery", width: 10, style: { numFmt: "#,##0.00" } },
      { header: "Convenience (₹)", key: "convenience", width: 12, style: { numFmt: "#,##0.00" } },
      { header: "Convenience GST (₹)", key: "convenienceGst", width: 14, style: { numFmt: "#,##0.00" } },
      { header: "Total (₹)", key: "total", width: 12, style: { numFmt: "#,##0.00" } },
      { header: "Shipping carrier", key: "carrier", width: 14 },
    ];
    styleHeader(sheet);

    for (const o of orders) {
      sheet.addRow({
        id: o.id,
        status: o.status,
        createdAt: o.createdAt,
        customerId: o.customerId,
        artistId: o.artistId ?? "",
        artworkId: o.artworkId,
        title: o.artwork?.title ?? "",
        display: paiseToRupees(o.displayPricePaise),
        gst: paiseToRupees(o.gstPaise),
        delivery: paiseToRupees(o.deliveryChargePaise),
        convenience: paiseToRupees(o.convenienceFeePaise),
        convenienceGst: paiseToRupees(o.convenienceGstPaise),
        total: paiseToRupees(o.totalPaise),
        // ShipRocket quote snapshot (new in audit §3 PR). Older orders show "".
        carrier: o.shippingQuote?.carrier ?? "",
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new StreamableFile(Buffer.from(buffer));
  }

  // --- Settlements ----------------------------------------------------------

  @Roles("admin")
  @Get("settlements.xlsx")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", `attachment; filename="settlements-${isoDay()}.xlsx"`)
  async settlements(): Promise<StreamableFile> {
    const rows = await listSettlements(this.db);
    const wb = new ExcelJS.Workbook();
    wb.creator = "GalleryZone Admin";
    wb.created = new Date();
    const sheet = wb.addWorksheet("Settlements");
    sheet.columns = [
      { header: "Settlement ID", key: "id", width: 24 },
      { header: "Status", key: "status", width: 14 },
      { header: "Artist ID", key: "artistId", width: 24 },
      { header: "Artist name", key: "artistName", width: 24 },
      { header: "Related order", key: "orderId", width: 24 },
      { header: "Related holding", key: "holdingId", width: 24 },
      { header: "Artist amount (₹)", key: "artist", width: 16, style: { numFmt: "#,##0.00" } },
      { header: "Aggregator commission (₹)", key: "aggCommission", width: 22, style: { numFmt: "#,##0.00" } },
      { header: "Platform revenue (₹)", key: "platform", width: 18, style: { numFmt: "#,##0.00" } },
      { header: "Release after", key: "releaseAfter", width: 20 },
      { header: "Created at", key: "createdAt", width: 20 },
      { header: "Processed at", key: "processedAt", width: 20 },
    ];
    styleHeader(sheet);
    for (const s of rows) {
      sheet.addRow({
        id: s.id,
        status: s.status,
        artistId: s.artistId,
        artistName: s.artistName ?? "",
        orderId: s.orderId ?? "",
        holdingId: s.holdingId ?? "",
        artist: paiseToRupees(s.artistAmountPaise),
        aggCommission: s.aggregatorCommissionPaise != null ? paiseToRupees(s.aggregatorCommissionPaise) : "",
        platform: paiseToRupees(s.platformRevenuePaise),
        releaseAfter: s.releaseAfter,
        createdAt: s.createdAt,
        processedAt: s.processedAt ?? "",
      });
    }
    const buffer = await wb.xlsx.writeBuffer();
    return new StreamableFile(Buffer.from(buffer));
  }

  // --- Users (filter by role) -----------------------------------------------

  @Roles("admin")
  @Get("users.xlsx")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  async users(@Query("role") role: string | undefined, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const safeRole = role === "artist" || role === "aggregator" || role === "customer" || role === "admin" ? role : undefined;
    const filename = `users${safeRole ? `-${safeRole}` : ""}-${isoDay()}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const users = await listUsersForAdmin(this.db, safeRole);
    const wb = new ExcelJS.Workbook();
    wb.creator = "GalleryZone Admin";
    wb.created = new Date();
    const sheet = wb.addWorksheet(safeRole ? capitalize(safeRole) + "s" : "Users");
    sheet.columns = [
      { header: "User ID", key: "id", width: 24 },
      { header: "Role", key: "role", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Name", key: "name", width: 24 },
      { header: "Email", key: "email", width: 32 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Created at", key: "createdAt", width: 20 },
      { header: "Last login", key: "lastLoginAt", width: 20 },
      { header: "GST status", key: "gstStatus", width: 12 },
      { header: "KYC status", key: "aadhaarStatus", width: 12 },
    ];
    styleHeader(sheet);
    for (const u of users) {
      sheet.addRow({
        id: u.id,
        role: u.role,
        status: u.status,
        name: u.name,
        email: u.email,
        phone: u.phone ?? "",
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt ?? "",
        gstStatus: u.gstStatus ?? "",
        aadhaarStatus: u.aadhaarStatus ?? "",
      });
    }
    const buffer = await wb.xlsx.writeBuffer();
    return new StreamableFile(Buffer.from(buffer));
  }
}

// --- helpers ---------------------------------------------------------------

/** Paise → rupees as a Number for cell numFmt to apply currency formatting. */
function paiseToRupees(paise: number | null | undefined): number | "" {
  if (paise == null) return "";
  return paise / 100;
}

function isoDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Make the header row bold with a subtle fill — matches Google Sheets' default. */
function styleHeader(sheet: ExcelJS.Worksheet): void {
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEEEE" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}
