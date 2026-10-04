// The one place paise becomes a gateway amount, and the only place a gateway
// amount becomes paise again.
//
// Everything inside GalleryZone counts money in paise as an integer. Cashfree
// takes and returns `order_amount` in RUPEES as a decimal ("45000.00"), so
// every amount crossing that boundary is converted — and a factor-of-100
// mistake there is a real money bug, not a display bug. Hence: one module, no
// arithmetic at the call sites, and a check script that round-trips it.
//
// Floating point is avoided on purpose. 4_500_000 / 100 is exact in binary64,
// but 2_010_020 / 100 is 20100.199999999997, and Number(x).toFixed(2) on a
// value that large can round the wrong way. So paise are split into whole
// rupees and a remainder with integer arithmetic and formatted as a string.

/** Thrown when an amount can't be represented exactly at the gateway boundary. */
export class GatewayAmountError extends Error {}

/**
 * Paise → the decimal rupee string Cashfree expects, always with two places.
 * 4_500_000 → "45000.00"; 2_010_020 → "20100.20"; 1 → "0.01".
 */
export function paiseToGatewayAmount(paise: number): string {
  if (!Number.isInteger(paise)) throw new GatewayAmountError(`Amount in paise must be a whole number, got ${paise}`);
  if (paise < 0) throw new GatewayAmountError(`Amount in paise must not be negative, got ${paise}`);
  if (!Number.isSafeInteger(paise)) throw new GatewayAmountError(`Amount in paise is too large to be exact: ${paise}`);
  const rupees = Math.floor(paise / 100);
  const remainder = paise - rupees * 100;
  return `${rupees}.${String(remainder).padStart(2, "0")}`;
}

/**
 * A rupee amount from Cashfree (number or string) → paise. Refuses anything
 * with sub-paise precision rather than rounding it away: if the gateway ever
 * reports an amount we can't represent, that is a reconciliation problem and
 * it should be loud.
 */
export function gatewayAmountToPaise(amount: number | string): number {
  const text = typeof amount === "number" ? (Number.isFinite(amount) ? String(amount) : "") : amount.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new GatewayAmountError(`Not a rupee amount with at most two decimals: ${JSON.stringify(amount)}`);
  const rupees = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const paise = rupees * 100 + fraction;
  if (!Number.isSafeInteger(paise)) throw new GatewayAmountError(`Amount is too large to be exact: ${text}`);
  return paise;
}

/**
 * What the gateway says was paid, checked against what we asked for. The
 * webhook and the status re-fetch both run this before anything is marked
 * paid, so a tampered or mismatched amount can never settle an order.
 */
export function gatewayAmountMatches(expectedPaise: number, reported: number | string): boolean {
  try {
    return gatewayAmountToPaise(reported) === expectedPaise;
  } catch {
    return false;
  }
}
