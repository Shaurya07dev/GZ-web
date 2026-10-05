// Razorpay Checkout.js, loaded on demand.
//
// The API opens the gateway order (POST /v1/orders/:id/payment/session) and
// hands the browser only the public key id and that order id. The secret never
// leaves the server.
//
// What this module does NOT do is decide whether a payment succeeded. It runs
// the flow and reports what the SDK said; the caller then asks OUR API, which
// re-reads the order from Razorpay and checks the amount. That server-side
// re-read is the only thing that settles money.
//
// That matters most in the cases that look like failure. A dismissed modal or
// a `payment.failed` event does not mean no money moved — a UPI app or a
// bank's 3-D Secure page can complete the payment out of band, after the modal
// has given up on it. So every outcome resolves, including dismissal, and the
// caller always confirms with the API. (The earlier version of this file threw
// on dismissal, which skipped the confirm and would have stranded exactly
// those buyers: charged, with no order.)

export interface RazorpaySession {
  mode: "razorpay";
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
}

/** Checkout.js's success payload. Forwarded to the API, which verifies its HMAC. */
export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/** What the flow did, as far as the browser can honestly tell. Never "paid". */
export interface CheckoutOutcome {
  /** Present only when Checkout.js handed back a signed payload. */
  success: RazorpaySuccess | null;
  /** The buyer closed the modal without completing it. */
  dismissed: boolean;
  /** For the error message and for support, never for control flow. */
  failureMessage: string | null;
}

interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", handler: (response: { error: { description?: string; reason?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Checkout needs a browser"));
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load the payment page. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Raised when the API has confirmed the order is NOT paid after the buyer
 * closed the window. Thrown by the services that own the verify call, not by
 * this module, because only the API knows.
 */
export class PaymentDismissedError extends Error {
  constructor() {
    super("Payment was cancelled");
    this.name = "PaymentDismissedError";
  }
}

/**
 * Opens the Razorpay modal and resolves once the flow has ended, whatever the
 * outcome. Rejects only when Checkout.js itself could not run.
 */
export async function openRazorpayCheckout(session: RazorpaySession): Promise<CheckoutOutcome> {
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Payment page did not initialise");

  return new Promise<CheckoutOutcome>((resolve) => {
    // Exactly one of these fires first and settles the promise; the rest are
    // then no-ops, which is what keeps a late `payment.failed` after a success
    // from rewriting the outcome.
    let settled = false;
    const finish = (outcome: CheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const checkout = new Razorpay({
      key: session.keyId,
      order_id: session.razorpayOrderId,
      amount: session.amountPaise,
      currency: session.currency,
      name: session.name,
      description: session.description,
      prefill: session.prefill,
      theme: { color: "#b8892b" },
      handler: (response: RazorpaySuccess) => finish({ success: response, dismissed: false, failureMessage: null }),
      modal: { ondismiss: () => finish({ success: null, dismissed: true, failureMessage: null }) },
    });
    checkout.on("payment.failed", (response) => {
      finish({ success: null, dismissed: false, failureMessage: response.error.description ?? null });
    });
    checkout.open();
  });
}
