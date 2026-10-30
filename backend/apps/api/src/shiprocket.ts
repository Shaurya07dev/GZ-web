// ShipRocket is the courier aggregator GalleryZone uses for every leg of a
// piece's journey — artist to aggregator (inbound to a gallery) and
// aggregator / warehouse to buyer (outbound after a sale). The client (18 Oct
// 2026) wants the four live stages visible to all three roles: PICKUP ->
// IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED, with the AWB tracking number
// and courier name.
//
// This file is a thin wrapper. ShipRocket has two surfaces we touch:
//   1. REST API (POST /auth/login, POST /orders/create/adhoc, GET /tracking/)
//      — called to book a shipment and to pull a status snapshot when a
//      webhook was missed.
//   2. Webhook — ShipRocket POSTs to us on every status change; the signature
//      header is a SHA256 HMAC of the raw body using our webhook secret.
//
// When the env vars aren't set, booking fails explicitly. The reservation is
// still valid and its caller logs the operations error, but no synthetic AWB
// is written and no user is told a courier pickup exists when it does not.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface ShiprocketConfig {
  baseUrl: string;
  email: string;
  password: string;
  webhookSecret: string;
  pickupLocationName: string;
}

/**
 * All-or-nothing configuration: booking without the webhook token creates a
 * shipment that can never advance in GalleryZone, which is not a usable live
 * integration. Empty means deliberately disabled; a partial setup fails boot.
 */
export function shiprocketConfigFrom(source: NodeJS.ProcessEnv): ShiprocketConfig | null {
  const email = source.SHIPROCKET_EMAIL?.trim() ?? "";
  const password = source.SHIPROCKET_PASSWORD?.trim() ?? "";
  const webhookSecret = source.SHIPROCKET_WEBHOOK_SECRET?.trim() ?? "";
  const supplied = [email, password, webhookSecret].filter(Boolean).length;
  if (supplied === 0) return null;
  if (supplied !== 3) {
    throw new Error(
      "Incomplete ShipRocket configuration: SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD and " +
        "SHIPROCKET_WEBHOOK_SECRET must be set together.",
    );
  }
  return {
    baseUrl: (source.SHIPROCKET_BASE_URL?.trim() || "https://apiv2.shiprocket.in/v1/external").replace(/\/$/, ""),
    email,
    password,
    webhookSecret,
    pickupLocationName: source.SHIPROCKET_PICKUP_LOCATION_NAME?.trim() || "Primary",
  };
}

const CONFIG = shiprocketConfigFrom(process.env);

export type ShiprocketStage = "pickup" | "in_transit" | "out_for_delivery" | "delivered";

export interface BookedShipment {
  trackingId: string;
  carrier: string | null;
  stage: ShiprocketStage;
  real: true;
}

export interface ShipmentBookingInput {
  // The internal id ShipRocket echoes back on webhooks — holding-{id} for an
  // artist->aggregator leg, sale-{id} for an aggregator->buyer leg.
  orderReference: string;
  pickup: ShipmentParty;
  dropoff: ShipmentParty;
  weightKg: number;
  artworkTitle: string;
  valueInr: number;
}

export interface ShipmentParty {
  name: string;
  phone: string;
  line1: string;
  // Explicit `| undefined` is required under exactOptionalPropertyTypes to
  // accept call sites that may pass undefined (via `profile?.pickupLine2`).
  line2?: string | null | undefined;
  city: string;
  state: string;
  pincode: string;
}

interface AuthCache {
  token: string;
  expiresAt: number;
}

let authCache: AuthCache | null = null;

export function isShiprocketConfigured(): boolean {
  return CONFIG !== null;
}

async function getToken(): Promise<string> {
  if (!isShiprocketConfigured()) throw new Error("ShipRocket credentials are not configured");
  // Tokens are valid for 10 days; refresh a day early to leave a cushion.
  if (authCache && authCache.expiresAt > Date.now() + 86_400_000) return authCache.token;
  const res = await fetch(`${CONFIG!.baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: CONFIG!.email, password: CONFIG!.password }),
  });
  if (!res.ok) throw new Error(`ShipRocket auth failed (${res.status})`);
  const data = (await res.json()) as { token: string };
  authCache = { token: data.token, expiresAt: Date.now() + 9 * 86_400_000 };
  return data.token;
}

// --- Rate quote (serviceability) --------------------------------------------
// Audit #3: the backend used to charge a flat `rates.deliveryChargePaise`
// (prod: 2500 paise = ₹25) for every order regardless of actual courier
// cost. This endpoint asks ShipRocket what the cheapest serviceable courier
// is for a specific pickup→drop + weight + value, and returns a quote in
// paise so checkout can use it.

export interface ShippingRateInput {
  pickupPincode: string;
  dropPincode: string;
  weightKg: number;
  /** Declared value in rupees — insurance / COD limits depend on this. */
  valueInr: number;
  codEnabled?: boolean;
}

export interface ShippingRateQuote {
  /** Courier company name, e.g. "Delhivery", "Bluedart". */
  carrier: string;
  /** The chargeable amount in paise, INCLUDING any ShipRocket mark-up but
   *  excluding GST (ShipRocket's rate API returns the pre-tax rate). */
  ratePaise: number;
  /** The courier's own id in ShipRocket, so booking can request this
   *  specific courier instead of auto-selecting. */
  courierCompanyId: number;
  /** ETA in days per ShipRocket. Null when the courier doesn't commit one. */
  estimatedDeliveryDays: number | null;
}

interface ShiprocketCourierOption {
  courier_company_id: number;
  courier_name: string;
  // ShipRocket returns the rate in rupees as a number (or sometimes string).
  rate: number | string;
  estimated_delivery_days?: string | number;
  // Only couriers with `is_surface_max_weight: false` (or similar flags) are
  // marked serviceable; the API filters these for us.
}

/**
 * Asks ShipRocket which couriers can deliver this parcel and at what rate.
 * Returns the cheapest option, or null when nothing is serviceable
 * (unreachable pincode, parcel too heavy, etc.). Callers should fall back to
 * the configured flat rate with a visible "estimated" marker, NOT silently.
 *
 * The returned amount is in PAISE even though ShipRocket's own API uses
 * rupees — paise is what the rest of our pricing code uses, and converting
 * at the boundary keeps the rest of checkout.ts unaware of the gateway.
 */
export async function getShippingRate(input: ShippingRateInput): Promise<ShippingRateQuote | null> {
  if (!isShiprocketConfigured()) return null;
  const token = await getToken();

  const params = new URLSearchParams({
    pickup_postcode: input.pickupPincode,
    delivery_postcode: input.dropPincode,
    weight: Math.max(0.5, input.weightKg).toFixed(2),
    cod: input.codEnabled ? "1" : "0",
    declared_value: input.valueInr.toFixed(0),
  });

  const res = await fetch(`${CONFIG!.baseUrl}/courier/serviceability?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // Log once; caller falls back.
    console.error(JSON.stringify({ event: "shiprocket.rate.failed", status: res.status, pickupPincode: input.pickupPincode, dropPincode: input.dropPincode }));
    return null;
  }
  const body = (await res.json().catch(() => ({}))) as {
    data?: {
      available_courier_companies?: ShiprocketCourierOption[];
      // ShipRocket also returns a `recommended_courier_company_id` field; we
      // deliberately pick cheapest instead of theirs (their recommendation
      // factors in a per-plan preference that may not align with ours).
    };
  };

  const options = body.data?.available_courier_companies ?? [];
  if (options.length === 0) return null;

  // Normalise rate to a number (ShipRocket is inconsistent about string vs number).
  const normalised = options
    .map((o) => ({ ...o, rateNum: typeof o.rate === "string" ? Number(o.rate) : o.rate }))
    .filter((o) => Number.isFinite(o.rateNum) && o.rateNum > 0);
  if (normalised.length === 0) return null;

  normalised.sort((a, b) => a.rateNum - b.rateNum);
  const cheapest = normalised[0]!;
  return {
    carrier: cheapest.courier_name,
    ratePaise: Math.round(cheapest.rateNum * 100),
    courierCompanyId: cheapest.courier_company_id,
    estimatedDeliveryDays:
      cheapest.estimated_delivery_days != null && cheapest.estimated_delivery_days !== ""
        ? Number(cheapest.estimated_delivery_days)
        : null,
  };
}

export async function bookShipment(input: ShipmentBookingInput): Promise<BookedShipment> {
  if (!isShiprocketConfigured()) {
    throw new Error("ShipRocket is not configured; no shipment was booked");
  }
  const token = await getToken();
  // `pickup_location` is the ACCOUNT-level nickname ShipRocket uses as a
  // billing anchor. The actual pickup street address comes from the
  // per-order `pickup_customer_name` / `pickup_address` fields below — this
  // is how multi-vendor marketplaces (Meesho, Flipkart, Etsy-style) handle
  // "pickup from the artist's studio" without registering each artist as a
  // separate warehouse. The nickname is configurable via env in case the
  // ShipRocket account uses a non-default one.
  const pickupLocationNickname = CONFIG!.pickupLocationName;
  const payload = {
    order_id: input.orderReference,
    order_date: new Date().toISOString(),
    pickup_location: pickupLocationNickname,

    // Per-order pickup = artist's studio for an inbound leg, aggregator's
    // gallery for an outbound leg. ShipRocket's courier is routed to this
    // address, not to the account-level pickup location.
    pickup_customer_name: input.pickup.name,
    pickup_phone: input.pickup.phone,
    pickup_address: input.pickup.line1,
    pickup_address_2: input.pickup.line2 ?? "",
    pickup_city: input.pickup.city,
    pickup_state: input.pickup.state,
    pickup_pincode: input.pickup.pincode,
    pickup_country: "India",

    billing_customer_name: input.dropoff.name,
    billing_phone: input.dropoff.phone,
    billing_address: input.dropoff.line1,
    billing_address_2: input.dropoff.line2 ?? "",
    billing_city: input.dropoff.city,
    billing_pincode: input.dropoff.pincode,
    billing_state: input.dropoff.state,
    billing_country: "India",
    billing_email: `${input.orderReference}@galleryzone.in`,
    shipping_is_billing: true,
    order_items: [
      { name: input.artworkTitle, sku: input.orderReference, units: 1, selling_price: input.valueInr },
    ],
    payment_method: "Prepaid",
    sub_total: input.valueInr,
    length: 30,
    breadth: 30,
    height: 10,
    weight: Math.max(0.5, input.weightKg),
  };
  const res = await fetch(`${CONFIG!.baseUrl}/orders/create/adhoc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`ShipRocket order create failed (${res.status})`);
  const data = (await res.json()) as { awb_code?: string | null; courier_name?: string | null; shipment_id?: number };
  return {
    trackingId: data.awb_code ?? String(data.shipment_id ?? input.orderReference),
    carrier: data.courier_name ?? null,
    stage: "pickup",
    real: true,
  };
}

// ShipRocket's webhook body carries a `current_status` string we map onto
// our four stages. New statuses that don't match map to `in_transit` so we
// never regress a shipment back to "pickup" by accident.
const STATUS_MAP: Record<string, ShiprocketStage> = {
  "AWB ASSIGNED": "pickup",
  PICKUP_SCHEDULED: "pickup",
  PICKUP_GENERATED: "pickup",
  OUT_FOR_PICKUP: "pickup",
  PICKED_UP: "in_transit",
  IN_TRANSIT: "in_transit",
  REACHED_DESTINATION: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
};

export function stageFromWebhook(currentStatus: string): ShiprocketStage {
  const upper = currentStatus.replace(/\s+/g, "_").toUpperCase();
  return STATUS_MAP[upper] ?? "in_transit";
}

// ShipRocket's actual webhook verification is just a shared-secret header
// (the "Token" you set when configuring the webhook, sent back in whichever
// header name you chose — usually x-api-key). It is NOT an HMAC signature;
// their dashboard confirms this with the note "Token will be passed in HTTP
// header as per selected Auth Token Type". So compare constant-time against
// WEBHOOK_SECRET directly.
export function verifyWebhookSignature(_rawBody: string | Buffer, tokenHeader: string | null): boolean {
  if (!CONFIG || !tokenHeader) return false;
  const got = Buffer.from(tokenHeader, "utf8");
  const exp = Buffer.from(CONFIG.webhookSecret, "utf8");
  if (got.length !== exp.length) return false;
  return timingSafeEqual(got, exp);
}

// Kept exported in case we ever need to go back to HMAC signing (ShipRocket
// supports it for enterprise plans). Not used by the live webhook path.
export function verifyWebhookHmac(rawBody: string | Buffer, signatureHeader: string | null): boolean {
  if (!CONFIG || !signatureHeader) return false;
  const expected = createHmac("sha256", CONFIG.webhookSecret).update(rawBody).digest("hex");
  const got = Buffer.from(signatureHeader, "utf8");
  const exp = Buffer.from(expected, "utf8");
  if (got.length !== exp.length) return false;
  return timingSafeEqual(got, exp);
}

export interface WebhookPayload {
  // The order_id we sent at booking time — holding-{id} or sale-{id}.
  order_id: string;
  awb_code?: string;
  current_status?: string;
  courier_name?: string;
}
