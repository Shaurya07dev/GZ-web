// Pure helpers for the e-way bill (NIC / Masters India WhiteBooks GSP)
// integration. No Nest decorators here, so this file can be imported
// by the stability check script that runs under `node
// --experimental-strip-types` (which can't parse decorators).
//
// The Nest service class lives in ./eway-bill.ts and re-exports the
// symbols below for call sites that still read them from there.

/**
 * Error raised by anything in this module. `code` is the NIC's numeric
 * response code when available, or a local sentinel otherwise.
 *
 *   `nic:<n>`        — NIC's own 300-series code (e.g. "nic:333" =
 *                      "The gstin is not registered or not available")
 *   `config:*`       — misconfiguration on our side (missing env, etc)
 *   `transport:*`    — network / HTTP transport failure before a response
 *   `parse:*`        — response couldn't be parsed as JSON / missing
 *                      expected fields
 */
export class EwayBillError extends Error {
  readonly code: string;
  readonly httpStatus?: number | undefined;
  readonly nicStatusCd?: string | undefined;
  constructor(
    message: string,
    code: string,
    opts?: { httpStatus?: number; nicStatusCd?: string },
  ) {
    super(message);
    this.name = "EwayBillError";
    this.code = code;
    this.httpStatus = opts?.httpStatus;
    this.nicStatusCd = opts?.nicStatusCd;
  }
}

/** Threshold below which an e-way bill is NOT legally required (CBIC
 *  Rule 138(1)). Intra-state thresholds can be lower in some states
 *  (Tamil Nadu ₹100,000, West Bengal ₹100,000 for intra-state
 *  movement) but ₹50,000 is the safe universal floor. The service
 *  always generates above this; below is a judgment call for the
 *  caller. */
export const EWB_VALUE_THRESHOLD_PAISE = 50_000_00;

/** NIC supply-type codes. Only the two we actually send are enumerated;
 *  "I" = Inward, "O" = Outward (i.e. what our GSTIN is doing). */
export type SupplyType = "I" | "O";

/** NIC sub-supply types. These are the integer-labelled reasons the
 *  consignment is moving. Mapped from our internal flow:
 *   1 = Supply (ordinary sale)
 *   6 = Exhibition or fairs (artist studio → aggregator venue for display)
 *   7 = For own use (aggregator venue → artist on unsold return) */
export type SubSupplyType = "1" | "6" | "7";

/** NIC document types. "INV" = tax invoice, "CHL" = delivery challan.
 *  Movements with a sale travel on INV; non-sale legs (rotation,
 *  returns, display) travel on CHL (our own Rule 55 challan series). */
export type NicDocType = "INV" | "CHL";

/** Transport modes NIC accepts. We always use "1" = Road because
 *  Shiprocket's partners are all road carriers in our catchment. */
export type TransMode = "1" | "2" | "3" | "4";

/** NIC responds with `status_cd`:"1" on success. Everything else is a
 *  failure we surface via EwayBillError. */
export function isNicSuccess(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const cd = (body as { status_cd?: unknown }).status_cd;
  return cd === "1" || cd === 1;
}

/** Extract NIC's error message out of the response envelope. NIC uses
 *  `status_desc` for human-readable + `error` / `errorCodes` for
 *  machine-readable. We normalise to a single message + code. */
export function parseNicError(body: unknown): {
  code: string;
  message: string;
  nicStatusCd: string;
} {
  if (!body || typeof body !== "object") {
    return { code: "parse:not_object", message: "Unparseable response", nicStatusCd: "" };
  }
  const b = body as {
    status_cd?: unknown;
    status_desc?: unknown;
    error?: unknown;
    errorCodes?: unknown;
  };
  const sd = typeof b.status_desc === "string" ? b.status_desc : "";
  const nicCd = typeof b.status_cd === "string" || typeof b.status_cd === "number" ? String(b.status_cd) : "";
  // NIC's "error" sometimes carries a numeric code ("333") or a message.
  const err = b.error;
  if (typeof err === "object" && err !== null) {
    const e = err as { error_cd?: unknown; message?: unknown };
    const ec = typeof e.error_cd === "string" || typeof e.error_cd === "number" ? String(e.error_cd) : "";
    const em = typeof e.message === "string" ? e.message : "";
    if (ec || em) {
      return {
        code: ec ? `nic:${ec}` : "nic:unknown",
        message: em || sd || "e-way bill API error",
        nicStatusCd: nicCd,
      };
    }
  }
  if (typeof err === "string" && err) {
    return { code: "nic:unknown", message: err, nicStatusCd: nicCd };
  }
  return {
    code: nicCd ? `nic:status_${nicCd}` : "nic:unknown",
    message: sd || "e-way bill API error",
    nicStatusCd: nicCd,
  };
}

/** Strip anything that looks like a credential from a request body
 *  before we persist it to the audit log. NIC payloads shouldn't carry
 *  secrets, but the client_id/client_secret headers absolutely do, and
 *  we belt-and-brace the body too. */
const REDACT_KEYS = new Set([
  "clientId",
  "client_id",
  "clientSecret",
  "client_secret",
  "password",
  "secret",
  "token",
  "accessToken",
  "access_token",
]);
export function redactForAudit(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (REDACT_KEYS.has(k)) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactForAudit(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** The two-letter state code → NIC's two-digit numeric code. NIC
 *  requires the numeric form in every address block. Mirrors
 *  packages/db/src/india-states.ts but intentionally duplicated so this
 *  helper file stays dependency-free (the Nest service imports the
 *  canonical table from the db package; this helper is tested in
 *  isolation). */
const STATE_NUMERIC: Record<string, number> = {
  JK: 1, HP: 2, PB: 3, CH: 4, UK: 5, HR: 6, DL: 7, RJ: 8, UP: 9, BR: 10,
  SK: 11, AR: 12, NL: 13, MN: 14, MZ: 15, TR: 16, ML: 17, AS: 18, WB: 19, JH: 20,
  OD: 21, CG: 22, MP: 23, GJ: 24, DN: 26, MH: 27, KA: 29, GA: 30, LD: 31, KL: 32,
  TN: 33, PY: 34, AN: 35, TS: 36, AP: 37,
};
export function stateNumericCode(twoLetter: string): number | null {
  return STATE_NUMERIC[twoLetter.toUpperCase()] ?? null;
}

/** Response snippet gets stored verbatim for audit — cap at 8 KB so a
 *  pathological response can't bloat Firestore. */
export const RESPONSE_SNIPPET_MAX = 8 * 1024;
export function clampSnippet(text: string): string {
  if (text.length <= RESPONSE_SNIPPET_MAX) return text;
  return text.slice(0, RESPONSE_SNIPPET_MAX) + "…[truncated]";
}
