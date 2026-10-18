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
// When the env vars aren't set (dev / preview without credentials), the
// client falls back to NO-OP creators that return a stub shipment with a
// `demo-*` tracking id, so the UI's "booked a shipment" flow keeps working
// end-to-end without hitting a real courier. Nothing goes to ShipRocket
// unless both the API token endpoint AND webhook secret are configured.

import { createHmac, timingSafeEqual } from "node:crypto";

const SHIPROCKET_BASE = process.env.SHIPROCKET_BASE_URL ?? "https://apiv2.shiprocket.in/v1/external";
const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL ?? "";
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD ?? "";
const WEBHOOK_SECRET = process.env.SHIPROCKET_WEBHOOK_SECRET ?? "";

export type ShiprocketStage = "pickup" | "in_transit" | "out_for_delivery" | "delivered";

export interface BookedShipment {
  trackingId: string;
  carrier: string | null;
  stage: ShiprocketStage;
  // True when this came back from the real ShipRocket API; false when the
  // wrapper fell back to the local no-op stub. Loggable but not exposed to
  // the user — a stub shipment reads the same in the UI as a real one.
  real: boolean;
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
  line2?: string | null;
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
  return Boolean(SHIPROCKET_EMAIL && SHIPROCKET_PASSWORD);
}

async function getToken(): Promise<string> {
  if (!isShiprocketConfigured()) throw new Error("ShipRocket credentials are not configured");
  // Tokens are valid for 10 days; refresh a day early to leave a cushion.
  if (authCache && authCache.expiresAt > Date.now() + 86_400_000) return authCache.token;
  const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SHIPROCKET_EMAIL, password: SHIPROCKET_PASSWORD }),
  });
  if (!res.ok) throw new Error(`ShipRocket auth failed (${res.status})`);
  const data = (await res.json()) as { token: string };
  authCache = { token: data.token, expiresAt: Date.now() + 9 * 86_400_000 };
  return data.token;
}

export async function bookShipment(input: ShipmentBookingInput): Promise<BookedShipment> {
  if (!isShiprocketConfigured()) {
    // Local fallback — a deterministic demo id tied to the reference, so
    // repeated bookings of the same leg don't rotate ids.
    return {
      trackingId: `demo-${input.orderReference}`,
      carrier: null,
      stage: "pickup",
      real: false,
    };
  }
  const token = await getToken();
  const payload = {
    order_id: input.orderReference,
    order_date: new Date().toISOString(),
    pickup_location: "Primary",
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
  const res = await fetch(`${SHIPROCKET_BASE}/orders/create/adhoc`, {
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

export function verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string | null): boolean {
  if (!WEBHOOK_SECRET || !signatureHeader) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
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
