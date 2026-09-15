// Razorpay Checkout.js, loaded on demand. The API opens the gateway order
// (POST /v1/orders/:id/payment/session) and we only ever hand the
// browser the public key id and that order id; the secret never leaves
// the server, and the API re-verifies the HMAC before an order is paid.

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

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
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

export class PaymentDismissedError extends Error {
  constructor() {
    super("Payment was cancelled");
    this.name = "PaymentDismissedError";
  }
}

/** Opens the Razorpay modal and resolves with the gateway's success payload, or rejects when the buyer closes it / the payment fails. */
export async function openRazorpayCheckout(session: RazorpaySession): Promise<RazorpaySuccess> {
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Payment page did not initialise");

  return new Promise<RazorpaySuccess>((resolve, reject) => {
    const checkout = new Razorpay({
      key: session.keyId,
      order_id: session.razorpayOrderId,
      amount: session.amountPaise,
      currency: session.currency,
      name: session.name,
      description: session.description,
      prefill: session.prefill,
      theme: { color: "#b8892b" },
      handler: (response: RazorpaySuccess) => resolve(response),
      modal: { ondismiss: () => reject(new PaymentDismissedError()) },
    });
    checkout.on("payment.failed", (response) => {
      reject(new Error(response.error.description ?? "The payment did not go through. Nothing was charged."));
    });
    checkout.open();
  });
}
