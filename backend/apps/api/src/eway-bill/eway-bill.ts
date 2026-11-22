// EwayBillService — adapter for the Masters India / WhiteBooks GSP
// e-way bill API (NIC v1.03 shape). Scaffold only — the public methods
// below are stubs that throw EwayBillError("config:disabled") when the
// env is not configured, so wiring in the Shiprocket booking paths can
// land safely before sandbox credentials are live.
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
// See the Postman collection in /tmp/ewb/ (unzipped from the Resources
// download in the WhiteBooks dashboard) for full request/response
// shapes.

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AppEnv } from "@galleryzone/config";
import { ENV } from "../db.module.ts";

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
  EwayBillError as EwayBillErrorInternal,
} from "./eway-bill-helpers.ts";

/** Minimum information callers hand us to generate an e-way bill. The
 *  service enriches this with the registered-GSTIN block, numeric
 *  state codes, HSN defaults, etc. before calling NIC. */
export interface GenerateEwayBillInput {
  /** What we're moving. "order_shipment" = marketplace sale, "holding_
   *  inbound" = artist→aggregator, "holding_return" = aggregator→artist. */
  subject:
    | { kind: "order_shipment"; orderId: string }
    | { kind: "holding_inbound"; holdingId: string }
    | { kind: "holding_return"; holdingId: string };
  /** Which doc travels with the consignment. "INV" for marketplace
   *  sales, "CHL" for non-sale legs. Must match what we hand Shiprocket. */
  docType: "INV" | "CHL";
  /** The doc number printed on the PDF (e.g. "GZ/26-27/000142" for
   *  tax invoices, "GZ/DC/26-27/000042" for challans). */
  docNo: string;
  /** Doc date in dd/mm/yyyy (NIC format). */
  docDate: string;
  /** Pre-tax consignment value, paise. The service gate checks this
   *  against EWB_VALUE_THRESHOLD_PAISE before calling NIC — callers can
   *  blindly request a bill and we'll no-op below ₹50,000. */
  totalValuePaise: number;
  /** FROM party (consignor). */
  from: EwayBillParty;
  /** TO party (consignee). */
  to: EwayBillParty;
  /** Approximate transport distance in km. NIC uses it to compute the
   *  validity window (1 day per 200 km). Shiprocket's quote carries
   *  this; callers should pass it through. */
  transportDistanceKm: number;
  /** The one artwork line. Multiple-item e-way bills are allowed by
   *  NIC but we only ever ship one artwork per leg. */
  item: {
    description: string;
    /** HSN — 9701 for paintings, 9703 for sculpture, 9702 for prints. */
    hsnCode: string;
    /** Rate as integer percent, e.g. 12. */
    gstRatePercent: 0 | 5 | 12 | 18 | 28;
  };
  /** Admin uid that initiated the generate, or null when fired
   *  automatically from a Shiprocket booking path. */
  initiatedBy: string | null;
}

export interface EwayBillParty {
  gstin: string;
  tradeName: string;
  addressLine1: string;
  addressLine2: string | null;
  place: string;
  pincode: number;
  /** Two-letter postal code ("TS", "KA"). The service converts to
   *  NIC's numeric code (36, 29) at request time. */
  stateCode: string;
}

export interface GenerateEwayBillResult {
  ewbNo: string;
  generatedAt: string;
  /** NIC's validity format is "dd/mm/yyyy HH:MM". We parse to Date at
   *  snapshot time in the stamping layer. */
  validUntil: string;
}

@Injectable()
export class EwayBillService {
  private readonly logger = new Logger(EwayBillService.name);

  constructor(@Inject(ENV) private readonly env: AppEnv) {
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

  /** True iff every env var is set AND the provider is "masters_india". */
  get enabled(): boolean {
    return this.env.ewayBill !== null;
  }

  /** Human-readable "why am I disabled" message the controller can
   *  surface. Returns null when enabled. */
  get disabledReason(): string | null {
    if (this.enabled) return null;
    if (!this.env.ewayBill)
      return "e-way bill generation is disabled (EWAYBILL_PROVIDER / EWAYBILL_* env vars incomplete)";
    return null;
  }

  // ─── Scaffold stubs — bodies land in a follow-up commit ───────────

  /**
   * Generate an e-way bill for a shipment. Returns the bill number +
   * validity + the raw NIC response for audit storage upstream.
   *
   * Short-circuits BELOW the ₹50,000 threshold: logs and returns null
   * so callers can treat "no bill needed" as a success path.
   *
   * Throws EwayBillError on API failure — never on "not applicable".
   */
  async generate(
    _input: GenerateEwayBillInput,
  ): Promise<GenerateEwayBillResult | null> {
    if (!this.enabled) {
      throw new EwayBillErrorInternal(
        this.disabledReason ?? "e-way bill service disabled",
        "config:disabled",
      );
    }
    // Scaffold — real implementation lands in task #222. Throws so
    // anyone wiring generate() prematurely finds out in sandbox.
    throw new EwayBillErrorInternal(
      "EwayBillService.generate not yet implemented — scaffold only",
      "config:unimplemented",
    );
  }

  /** Cancel a generated bill within 24h. NIC accepts reason codes 1-4:
   *   1 = Duplicate, 2 = Order cancelled, 3 = Data entry mistake,
   *   4 = Others (requires remarks). */
  async cancel(
    _input: {
      ewbNo: string;
      reasonCode: 1 | 2 | 3 | 4;
      remarks: string;
      initiatedBy: string;
    },
  ): Promise<void> {
    if (!this.enabled) {
      throw new EwayBillErrorInternal(
        this.disabledReason ?? "e-way bill service disabled",
        "config:disabled",
      );
    }
    throw new EwayBillErrorInternal(
      "EwayBillService.cancel not yet implemented — scaffold only",
      "config:unimplemented",
    );
  }

  /** Extend the validity of an existing bill (parcel stuck in transit).
   *  NIC requires remaining distance + reason + current vehicle info. */
  async extendValidity(
    _input: {
      ewbNo: string;
      remainingDistanceKm: number;
      reasonCode: number;
      remarks: string;
      initiatedBy: string;
    },
  ): Promise<GenerateEwayBillResult> {
    if (!this.enabled) {
      throw new EwayBillErrorInternal(
        this.disabledReason ?? "e-way bill service disabled",
        "config:disabled",
      );
    }
    throw new EwayBillErrorInternal(
      "EwayBillService.extendValidity not yet implemented — scaffold only",
      "config:unimplemented",
    );
  }
}
