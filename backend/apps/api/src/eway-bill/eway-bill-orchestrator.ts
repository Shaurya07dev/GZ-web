// Shipment-booking orchestrator for e-way bills. Wraps the gate + the
// EwayBillService.generate() call + the challan stamp into one helper
// so each Shiprocket booking path calls one function and either:
//
//   - returns the ewbNo (to pass to Shiprocket on booking), OR
//   - returns null (threshold / disabled / not applicable), OR
//   - logs + returns null (generate failed — the SHIPMENT still
//     proceeds; admin can retry from /admin/eway-bills).
//
// A generate failure must NEVER fail the shipment. The parcel still
// needs to leave; the e-way bill is paperwork that can be regenerated
// after the fact. Admin surfaces the failure in the audit UI.

import { Logger } from "@nestjs/common";
import {
  stampEwayBillOnHoldingChallan,
  stampEwayBillOnOrderChallan,
  type Db,
} from "@galleryzone/db";
import { EwayBillService, EwayBillError, EWB_VALUE_THRESHOLD_PAISE, type GenerateEwayBillInput } from "./eway-bill.ts";

const log = new Logger("EwayBillOrchestrator");

/** NIC validity format is "dd/mm/yyyy HH:MM AM/PM". Parse carefully —
 *  the AM/PM is sometimes lowercase, sometimes missing. Fall back to
 *  the stamp time + 24h if parse fails (safer than persisting null to
 *  a Timestamp field). */
export function parseNicDate(nic: string, fallback: Date): Date {
  if (!nic) return fallback;
  // "20/11/2026 09:30 PM" or "20/11/2026 21:30".
  const m = nic.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) return fallback;
  const [, dd, mm, yyyy, hRaw, mn, ap] = m;
  let h = Number(hRaw);
  if (ap && ap.toUpperCase() === "PM" && h < 12) h += 12;
  if (ap && ap.toUpperCase() === "AM" && h === 12) h = 0;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), h, Number(mn), 0, 0);
}

/** Format a Date as NIC's `dd/mm/yyyy`. */
export function formatNicDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Generate + stamp for a holding leg (inbound or return). Returns
 *  the ewbNo on success, or null when nothing was stamped. */
export async function maybeGenerateForHolding(args: {
  db: Db;
  service: EwayBillService | null;
  holdingId: string;
  leg: "inbound" | "return";
  input: GenerateEwayBillInput;
}): Promise<string | null> {
  const { db, service, holdingId, leg, input } = args;
  if (!service || !service.enabled) return null;
  if (input.totalValuePaise < EWB_VALUE_THRESHOLD_PAISE) {
    log.log(
      `holding ${holdingId} (${leg}): value ₹${input.totalValuePaise / 100} below ₹50,000 threshold — no e-way bill`,
    );
    return null;
  }
  try {
    const result = await service.generate(input);
    const genAt = parseNicDate(result.generatedAt, new Date());
    const validUntil = parseNicDate(result.validUntil, new Date(Date.now() + 24 * 3600_000));
    await stampEwayBillOnHoldingChallan(db, {
      holdingId,
      leg,
      ewbNo: result.ewbNo,
      generatedAt: genAt,
      validUntil,
    });
    log.log(`holding ${holdingId} (${leg}): e-way bill ${result.ewbNo} generated`);
    return result.ewbNo;
  } catch (err) {
    if (err instanceof EwayBillError) {
      log.error(
        `holding ${holdingId} (${leg}): e-way bill generation failed [${err.code}] ${err.message} — shipment will proceed without it`,
      );
    } else {
      log.error(`holding ${holdingId} (${leg}): unexpected e-way bill failure — ${String(err)}`);
    }
    return null;
  }
}

/** Generate + stamp for a marketplace order shipment. */
export async function maybeGenerateForOrder(args: {
  db: Db;
  service: EwayBillService | null;
  orderId: string;
  input: GenerateEwayBillInput;
}): Promise<string | null> {
  const { db, service, orderId, input } = args;
  if (!service || !service.enabled) return null;
  if (input.totalValuePaise < EWB_VALUE_THRESHOLD_PAISE) {
    log.log(
      `order ${orderId}: value ₹${input.totalValuePaise / 100} below ₹50,000 threshold — no e-way bill`,
    );
    return null;
  }
  try {
    const result = await service.generate(input);
    const genAt = parseNicDate(result.generatedAt, new Date());
    const validUntil = parseNicDate(result.validUntil, new Date(Date.now() + 24 * 3600_000));
    await stampEwayBillOnOrderChallan(db, {
      orderId,
      ewbNo: result.ewbNo,
      generatedAt: genAt,
      validUntil,
    });
    log.log(`order ${orderId}: e-way bill ${result.ewbNo} generated`);
    return result.ewbNo;
  } catch (err) {
    if (err instanceof EwayBillError) {
      log.error(
        `order ${orderId}: e-way bill generation failed [${err.code}] ${err.message} — shipment will proceed without it`,
      );
    } else {
      log.error(`order ${orderId}: unexpected e-way bill failure — ${String(err)}`);
    }
    return null;
  }
}
