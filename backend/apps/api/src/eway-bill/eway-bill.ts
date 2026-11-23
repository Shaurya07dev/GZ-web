// EwayBillService — adapter for the Masters India / WhiteBooks GSP
// e-way bill API (NIC v1.03 shape).
//
// Live endpoints we target (base URL in env.ewayBill.baseUrl):
//   GET  /ewaybillapi/v1.03/authenticate
//        - warm-up call, keyed on (client_id, gstin, email); session
//          lives ~6h on their side. We cache it in Firestore via the
//          ewayBillSessions collection to avoid re-auth on every call.
//   POST /ewaybillapi/v1.03/ewayapi/genewaybill
//   POST /ewaybillapi/v1.03/ewayapi/canewb
//   POST /ewaybillapi/v1.03/ewayapi/extendvalidity
//   GET  /ewaybillapi/v1.03/ewayapi/getewaybill
//
// Every request carries 4 HTTP headers:
//   ip_address: <audit log IP, server source IP works>
//   client_id, client_secret: from Developer Hub sandbox keys
//   gstin: the registered GSTIN this session authenticated as
// plus an `email=` query param on every URL.
//
// All call attempts (success + failure) write an ewayBillEvents audit
// row so the admin console can see history + retry/cancel failed bills.

import { Inject, Injectable, Logger } from "@nestjs/common";
import { Timestamp } from "firebase-admin/firestore";
import type { AppEnv } from "@galleryzone/config";
import {
  Collections,
  type Db,
  type EwayBillEventDoc,
  type EwayBillSessionDoc,
} from "@galleryzone/db";
import { DB, ENV } from "../db.module.ts";

// Re-export the pure helpers so callers can import { EwayBillError }
// from this file without reaching into eway-bill-helpers.
export {
  EwayBillError,
  EWB_VALUE_THRESHOLD_PAISE,
  isNicSuccess,
  parseNicError,
  stateNumericCode,
  redactForAudit,
  clampSnippet,
  RESPONSE_SNIPPET_MAX,
} from "./eway-bill-helpers.ts";
import {
  clampSnippet,
  EwayBillError as EwayBillErrorInternal,
  isNicSuccess,
  parseNicError,
  redactForAudit,
  stateNumericCode,
} from "./eway-bill-helpers.ts";

/** NIC session lives 6h server-side. We re-auth 15 minutes early so a
 *  call doesn't land mid-rotation. */
const SESSION_TTL_MS = (6 * 60 - 15) * 60 * 1000;

/** The source-IP we claim to the WhiteBooks `ip_address` header. NIC
 *  uses it for audit logging, not whitelisting (sandbox accepts
 *  anything). In production the account can be IP-whitelisted; the
 *  Railway egress is stable per service. */
const DEFAULT_IP_HEADER = "0.0.0.0";

/** Minimum information callers hand us to generate an e-way bill. */
export interface GenerateEwayBillInput {
  subject:
    | { kind: "order_shipment"; orderId: string }
    | { kind: "holding_inbound"; holdingId: string }
    | { kind: "holding_return"; holdingId: string };
  docType: "INV" | "CHL";
  docNo: string;
  /** dd/mm/yyyy. */
  docDate: string;
  totalValuePaise: number;
  from: EwayBillParty;
  to: EwayBillParty;
  transportDistanceKm: number;
  item: {
    description: string;
    hsnCode: string;
    gstRatePercent: 0 | 5 | 12 | 18 | 28;
  };
  initiatedBy: string | null;
}

export interface EwayBillParty {
  gstin: string;
  tradeName: string;
  addressLine1: string;
  addressLine2: string | null;
  place: string;
  pincode: number;
  /** Two-letter postal code ("TS", "KA"). */
  stateCode: string;
}

export interface GenerateEwayBillResult {
  ewbNo: string;
  generatedAt: string;
  validUntil: string;
}

/** Shape of the NIC POST body we build. Faithful to the Postman
 *  collection — field names are NIC's, not ours. */
interface NicGenerateBody {
  supplyType: "O" | "I";
  subSupplyType: string;
  docType: "INV" | "CHL";
  docNo: string;
  docDate: string;
  fromGstin: string;
  fromTrdName: string;
  fromAddr1: string;
  fromAddr2: string;
  fromPlace: string;
  fromPincode: number;
  fromStateCode: number;
  actFromStateCode: number;
  toGstin: string;
  toTrdName: string;
  toAddr1: string;
  toAddr2: string;
  toPlace: string;
  toPincode: number;
  toStateCode: number;
  actToStateCode: number;
  transactionType: 1 | 2 | 3 | 4;
  totalValue: number;
  cgstValue: number;
  sgstValue: number;
  igstValue: number;
  cessValue: number;
  totInvValue: number;
  transMode: "1";
  transDistance: string;
  itemList: Array<{
    productName: string;
    productDesc: string;
    hsnCode: number;
    quantity: number;
    qtyUnit: string;
    taxableAmount: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    cessRate: number;
  }>;
}

@Injectable()
export class EwayBillService {
  private readonly logger = new Logger(EwayBillService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
  ) {
    if (this.enabled) {
      this.logger.log(
        `e-way bill service enabled (mode=${env.ewayBill!.mode}, gstin=${env.ewayBill!.gstin})`,
      );
    } else {
      this.logger.warn(
        "e-way bill service disabled — EWAYBILL_* env vars incomplete; consignments will ship without an e-way bill",
      );
    }
  }

  get enabled(): boolean {
    return this.env.ewayBill !== null;
  }

  get disabledReason(): string | null {
    if (this.enabled) return null;
    return "e-way bill generation is disabled (EWAYBILL_PROVIDER / EWAYBILL_* env vars incomplete)";
  }

  // ─── Public API ────────────────────────────────────────────────────

  async generate(input: GenerateEwayBillInput): Promise<GenerateEwayBillResult> {
    this.assertEnabled();
    const cfg = this.env.ewayBill!;

    const fromState = stateNumericCode(input.from.stateCode);
    const toState = stateNumericCode(input.to.stateCode);
    if (fromState === null) {
      throw new EwayBillErrorInternal(
        `From state "${input.from.stateCode}" is not an Indian state/UT`,
        "config:bad_from_state",
      );
    }
    if (toState === null) {
      throw new EwayBillErrorInternal(
        `To state "${input.to.stateCode}" is not an Indian state/UT`,
        "config:bad_to_state",
      );
    }

    // GST on art is 12% (HSN 9701). Intra-state splits into CGST+SGST;
    // inter-state is one IGST amount. NIC wants both the per-item rate
    // AND the top-level total — we send consistent values.
    const taxable = Math.round(input.totalValuePaise / 100);
    const rate = input.item.gstRatePercent / 100;
    const gstAmount = Math.round(taxable * rate);
    const intraState = fromState === toState;
    const cgst = intraState ? Math.floor(gstAmount / 2) : 0;
    const sgst = intraState ? gstAmount - cgst : 0;
    const igst = intraState ? 0 : gstAmount;
    const totInvValue = taxable + gstAmount;

    const body: NicGenerateBody = {
      supplyType: "O",
      // "6" = Exhibition or fairs (non-sale display legs).
      // "1" = Supply (ordinary sale, marketplace shipment).
      // "7" = For own use (return of unsold piece).
      subSupplyType:
        input.subject.kind === "order_shipment"
          ? "1"
          : input.subject.kind === "holding_return"
            ? "7"
            : "6",
      docType: input.docType,
      docNo: input.docNo,
      docDate: input.docDate,
      fromGstin: input.from.gstin || "URP", // NIC's code for unregistered
      fromTrdName: input.from.tradeName,
      fromAddr1: input.from.addressLine1.slice(0, 120),
      fromAddr2: (input.from.addressLine2 ?? "").slice(0, 120),
      fromPlace: input.from.place.slice(0, 50),
      fromPincode: input.from.pincode,
      fromStateCode: fromState,
      actFromStateCode: fromState,
      toGstin: input.to.gstin || "URP",
      toTrdName: input.to.tradeName,
      toAddr1: input.to.addressLine1.slice(0, 120),
      toAddr2: (input.to.addressLine2 ?? "").slice(0, 120),
      toPlace: input.to.place.slice(0, 50),
      toPincode: input.to.pincode,
      toStateCode: toState,
      actToStateCode: toState,
      // 1 = Regular (consignor + consignee at same party addresses as from/to).
      transactionType: 1,
      totalValue: taxable,
      cgstValue: cgst,
      sgstValue: sgst,
      igstValue: igst,
      cessValue: 0,
      totInvValue,
      transMode: "1", // Road
      transDistance: String(Math.max(1, Math.round(input.transportDistanceKm))),
      itemList: [
        {
          productName: input.item.description.slice(0, 100),
          productDesc: input.item.description.slice(0, 100),
          hsnCode: Number(input.item.hsnCode),
          quantity: 1,
          qtyUnit: "PCS",
          taxableAmount: taxable,
          cgstRate: intraState ? input.item.gstRatePercent / 2 : 0,
          sgstRate: intraState ? input.item.gstRatePercent / 2 : 0,
          igstRate: intraState ? 0 : input.item.gstRatePercent,
          cessRate: 0,
        },
      ],
    };

    const url = this.urlFor("/ewaybillapi/v1.03/ewayapi/genewaybill");
    const started = new Date();
    let httpStatus = 0;
    let responseText = "";
    let parsed: unknown = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { ...this.commonHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      httpStatus = res.status;
      responseText = await res.text();
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = null;
      }
    } catch (err) {
      await this.writeAudit({
        subject: input.subject,
        endpoint: "genewaybill",
        action: "generate",
        requestAt: started,
        initiatedBy: input.initiatedBy,
        httpStatus,
        statusCd: null,
        ewbNo: null,
        generatedAt: null,
        validUntil: null,
        errorCode: "transport:fetch_failed",
        errorMessage: String(err),
        requestSummary: redactForAudit(body as unknown as Record<string, unknown>),
        responseSnippet: "",
      });
      throw new EwayBillErrorInternal(
        `e-way bill API unreachable: ${String(err)}`,
        "transport:fetch_failed",
      );
    }

    if (!isNicSuccess(parsed)) {
      const err = parseNicError(parsed);
      await this.writeAudit({
        subject: input.subject,
        endpoint: "genewaybill",
        action: "generate",
        requestAt: started,
        initiatedBy: input.initiatedBy,
        httpStatus,
        statusCd: err.nicStatusCd || null,
        ewbNo: null,
        generatedAt: null,
        validUntil: null,
        errorCode: err.code,
        errorMessage: err.message,
        requestSummary: redactForAudit(body as unknown as Record<string, unknown>),
        responseSnippet: clampSnippet(responseText),
      });
      throw new EwayBillErrorInternal(err.message, err.code, {
        httpStatus,
        nicStatusCd: err.nicStatusCd,
      });
    }

    const data = (parsed as { data?: { ewayBillNo?: unknown; ewayBillDate?: unknown; validUpto?: unknown } }).data ?? {};
    const ewbNo = data.ewayBillNo === undefined || data.ewayBillNo === null ? "" : String(data.ewayBillNo);
    const generatedAtStr = typeof data.ewayBillDate === "string" ? data.ewayBillDate : "";
    const validUntilStr = typeof data.validUpto === "string" ? data.validUpto : "";
    if (!ewbNo || !generatedAtStr || !validUntilStr) {
      await this.writeAudit({
        subject: input.subject,
        endpoint: "genewaybill",
        action: "generate",
        requestAt: started,
        initiatedBy: input.initiatedBy,
        httpStatus,
        statusCd: "1",
        ewbNo: null,
        generatedAt: null,
        validUntil: null,
        errorCode: "parse:missing_data",
        errorMessage: "NIC success response missing ewayBillNo / ewayBillDate / validUpto",
        requestSummary: redactForAudit(body as unknown as Record<string, unknown>),
        responseSnippet: clampSnippet(responseText),
      });
      throw new EwayBillErrorInternal(
        "NIC success response missing expected fields",
        "parse:missing_data",
        { httpStatus, nicStatusCd: "1" },
      );
    }

    await this.writeAudit({
      subject: input.subject,
      endpoint: "genewaybill",
      action: "generate",
      requestAt: started,
      initiatedBy: input.initiatedBy,
      httpStatus,
      statusCd: "1",
      ewbNo,
      generatedAt: generatedAtStr,
      validUntil: validUntilStr,
      errorCode: null,
      errorMessage: null,
      requestSummary: redactForAudit(body as unknown as Record<string, unknown>),
      responseSnippet: clampSnippet(responseText),
    });
    return { ewbNo, generatedAt: generatedAtStr, validUntil: validUntilStr };
  }

  async cancel(input: {
    ewbNo: string;
    reasonCode: 1 | 2 | 3 | 4;
    remarks: string;
    initiatedBy: string;
  }): Promise<void> {
    this.assertEnabled();
    const body = {
      ewbNo: Number(input.ewbNo),
      cancelRsnCode: input.reasonCode,
      cancelRmrk: input.remarks.slice(0, 100),
    };
    const url = this.urlFor("/ewaybillapi/v1.03/ewayapi/canewb");
    await this.callAndAudit({
      url,
      method: "POST",
      bodyJson: body,
      endpoint: "canewb",
      action: "cancel",
      initiatedBy: input.initiatedBy,
      // No subject — cancel is addressed by ewbNo, not internal doc.
      subjectRef: { kind: "ewb_only", ewbNo: input.ewbNo },
    });
  }

  async extendValidity(input: {
    ewbNo: string;
    remainingDistanceKm: number;
    reasonCode: number;
    remarks: string;
    initiatedBy: string;
    // "1" = In movement, "2" = In transit (parked somewhere).
    consignmentStatus: "1" | "2";
    from: { place: string; pincode: number; stateCode: string };
  }): Promise<GenerateEwayBillResult> {
    this.assertEnabled();
    const fromState = stateNumericCode(input.from.stateCode);
    if (fromState === null) {
      throw new EwayBillErrorInternal(
        `Extend: from state "${input.from.stateCode}" is not an Indian state/UT`,
        "config:bad_from_state",
      );
    }
    const body = {
      ewbNo: Number(input.ewbNo),
      extnRsnCode: input.reasonCode,
      extnRemarks: input.remarks.slice(0, 100),
      fromPlace: input.from.place,
      fromPincode: input.from.pincode,
      fromState: fromState,
      remainingDistance: Math.max(1, Math.round(input.remainingDistanceKm)),
      // "R" = In Movement, continues by road.
      transMode: "1",
      consignmentStatus: input.consignmentStatus,
      transitType: "R",
    };
    const url = this.urlFor("/ewaybillapi/v1.03/ewayapi/extendvalidity");
    const result = await this.callAndAudit({
      url,
      method: "POST",
      bodyJson: body,
      endpoint: "extendvalidity",
      action: "extend",
      initiatedBy: input.initiatedBy,
      subjectRef: { kind: "ewb_only", ewbNo: input.ewbNo },
    });
    const data = (result.parsed as { data?: { ewayBillNo?: unknown; ewayBillDate?: unknown; validUpto?: unknown } }).data ?? {};
    return {
      ewbNo: String(data.ewayBillNo ?? input.ewbNo),
      generatedAt: typeof data.ewayBillDate === "string" ? data.ewayBillDate : "",
      validUntil: typeof data.validUpto === "string" ? data.validUpto : "",
    };
  }

  // ─── Session management ────────────────────────────────────────────

  /** Warm-up authentication. WhiteBooks keeps the session server-side,
   *  so we only need to re-authenticate every ~6h. Session doc id =
   *  `${gstin}:${mode}` to keep sandbox + production separate. */
  async authenticate(): Promise<void> {
    this.assertEnabled();
    const cfg = this.env.ewayBill!;
    const sessionId = `${cfg.gstin}:${cfg.mode}`;
    const ref = this.db
      .collection(Collections.ewayBillSessions)
      .doc(sessionId);
    const existing = await ref.get();
    const now = Date.now();
    const currentExpiry = (existing.data() as EwayBillSessionDoc | undefined)?.expiresAt?.toMillis() ?? 0;
    if (currentExpiry > now) return; // still fresh

    const url =
      this.urlFor("/ewaybillapi/v1.03/authenticate") +
      `&username=${encodeURIComponent(cfg.gstinUsername)}&password=${encodeURIComponent(cfg.gstinPassword)}`;
    const res = await fetch(url, { method: "GET", headers: this.commonHeaders() });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    if (!isNicSuccess(body)) {
      const err = parseNicError(body);
      throw new EwayBillErrorInternal(
        `e-way bill authenticate failed: ${err.message}`,
        err.code || "auth:refused",
        { httpStatus: res.status, nicStatusCd: err.nicStatusCd },
      );
    }
    const doc: EwayBillSessionDoc = {
      gstin: cfg.gstin,
      mode: cfg.mode,
      authenticatedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + SESSION_TTL_MS),
    };
    await ref.set(doc);
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new EwayBillErrorInternal(
        this.disabledReason ?? "e-way bill service disabled",
        "config:disabled",
      );
    }
  }

  private urlFor(path: string): string {
    const cfg = this.env.ewayBill!;
    const email = encodeURIComponent(cfg.accountEmail);
    return `${cfg.baseUrl}${path}?email=${email}`;
  }

  private commonHeaders(): Record<string, string> {
    const cfg = this.env.ewayBill!;
    return {
      ip_address: DEFAULT_IP_HEADER,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      gstin: cfg.gstin,
      Accept: "application/json",
    };
  }

  /** Shared wrapper for cancel + extend. Keeps the audit + error
   *  handling consistent with generate() without duplicating all the
   *  branches above (which has its own shape — the ewbNo is in the
   *  request, not derived from a subject). */
  private async callAndAudit(args: {
    url: string;
    method: "POST" | "GET";
    bodyJson: unknown;
    endpoint: string;
    action: EwayBillEventDoc["action"];
    initiatedBy: string | null;
    subjectRef: { kind: "ewb_only"; ewbNo: string };
  }): Promise<{ parsed: unknown; statusCd: string }> {
    const started = new Date();
    let httpStatus = 0;
    let responseText = "";
    let parsed: unknown = null;
    const bodyAudit =
      args.bodyJson && typeof args.bodyJson === "object"
        ? redactForAudit(args.bodyJson as Record<string, unknown>)
        : {};
    // These actions don't tie to a single internal subject the audit
    // table understands — write a placeholder subject that still lets
    // admin UI filter by ewbNo. We use order_shipment with orderId =
    // "ewb:<ewbNo>" so the field stays discriminable.
    const subject: EwayBillEventDoc["subject"] = {
      kind: "order_shipment",
      orderId: `ewb:${args.subjectRef.ewbNo}`,
    };
    try {
      const init: RequestInit = {
        method: args.method,
        headers:
          args.method === "POST"
            ? { ...this.commonHeaders(), "Content-Type": "application/json" }
            : this.commonHeaders(),
      };
      if (args.method === "POST") init.body = JSON.stringify(args.bodyJson);
      const res = await fetch(args.url, init);
      httpStatus = res.status;
      responseText = await res.text();
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = null;
      }
    } catch (err) {
      await this.writeAudit({
        subject,
        endpoint: args.endpoint,
        action: args.action,
        requestAt: started,
        initiatedBy: args.initiatedBy,
        httpStatus,
        statusCd: null,
        ewbNo: args.subjectRef.ewbNo,
        generatedAt: null,
        validUntil: null,
        errorCode: "transport:fetch_failed",
        errorMessage: String(err),
        requestSummary: bodyAudit,
        responseSnippet: "",
      });
      throw new EwayBillErrorInternal(
        `e-way bill API unreachable: ${String(err)}`,
        "transport:fetch_failed",
      );
    }
    if (!isNicSuccess(parsed)) {
      const err = parseNicError(parsed);
      await this.writeAudit({
        subject,
        endpoint: args.endpoint,
        action: args.action,
        requestAt: started,
        initiatedBy: args.initiatedBy,
        httpStatus,
        statusCd: err.nicStatusCd || null,
        ewbNo: args.subjectRef.ewbNo,
        generatedAt: null,
        validUntil: null,
        errorCode: err.code,
        errorMessage: err.message,
        requestSummary: bodyAudit,
        responseSnippet: clampSnippet(responseText),
      });
      throw new EwayBillErrorInternal(err.message, err.code, {
        httpStatus,
        nicStatusCd: err.nicStatusCd,
      });
    }
    await this.writeAudit({
      subject,
      endpoint: args.endpoint,
      action: args.action,
      requestAt: started,
      initiatedBy: args.initiatedBy,
      httpStatus,
      statusCd: "1",
      ewbNo: args.subjectRef.ewbNo,
      generatedAt: null,
      validUntil: null,
      errorCode: null,
      errorMessage: null,
      requestSummary: bodyAudit,
      responseSnippet: clampSnippet(responseText),
    });
    return { parsed, statusCd: "1" };
  }

  private async writeAudit(ev: Omit<EwayBillEventDoc, "requestAt"> & { requestAt: Date }): Promise<void> {
    try {
      const doc: EwayBillEventDoc = {
        ...ev,
        requestAt: Timestamp.fromDate(ev.requestAt),
      };
      await this.db.collection(Collections.ewayBillEvents).add(doc);
    } catch (err) {
      // Audit failure must never block the call it's auditing. Logged
      // so a disappeared audit trail is noticed in Sentry.
      this.logger.error(`audit write failed: ${String(err)}`);
    }
  }
}
