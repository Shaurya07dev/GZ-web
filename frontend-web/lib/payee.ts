// GalleryZone's own collection account — where buyers send money.
//
// The client's rule: the aggregator collects "on behalf of GalleryZone", never
// for themselves. A buyer standing in a partner gallery pays into THIS account,
// either by transfer or by scanning the UPI code. If they hand over cash
// instead, the aggregator owes GalleryZone the WHOLE sale price and their
// commission is settled separately afterwards — they never net it off
// themselves.
//
// Placeholder values until the real account is handed over, same as the logo
// and the insurance partner URL. `PAYEE_UPI_ID` being null is what keeps the
// checkout from showing a QR that scans to nowhere.

export const PAYEE = {
  accountName: "GalleryZone Art Ventures Pvt Ltd",
  accountNumber: "50200098765432",
  ifsc: "HDFC0001234",
  bankName: "HDFC Bank",
  branch: "Udaipur Main",
} as const;

/** Null until the live VPA is provided — see the QR panel in checkout. */
export const PAYEE_UPI_ID: string | null = null;

/**
 * The UPI intent a QR would encode. Returned only when there is a real VPA to
 * encode, so nothing ever renders a code that resolves to nothing.
 */
export function upiIntentFor(amount: number, note: string): string | null {
  if (!PAYEE_UPI_ID) return null;
  const params = new URLSearchParams({
    pa: PAYEE_UPI_ID,
    pn: PAYEE.accountName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}
