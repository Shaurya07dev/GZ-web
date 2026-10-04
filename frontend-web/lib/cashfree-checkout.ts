// Cashfree's JS SDK, loaded and initialised once.
//
// The one thing to understand here, and the reason this file is so much
// thinner than the Razorpay helper it replaces: nothing secret or verifiable
// reaches the browser. The API opens the gateway order
// (POST /v1/orders/:id/payment/session) and hands back only a short-lived
// `payment_session_id`. There is no key id, no amount to tamper with, and no
// signed success payload posted back from here.
//
// So this module never decides whether a payment succeeded. It runs the flow
// and returns; the caller then asks OUR API, which re-reads the order from
// Cashfree. That server-side re-read is the only thing that settles money.
//
// It also deliberately does NOT try to tell "the buyer closed the modal" apart
// from "the payment failed" by reading the SDK's message text. Those strings
// are display-and-log material and get reworded between SDK versions, so
// matching on them is a silent breakage waiting to happen. The order's real
// status answers the question properly, so the question is left to the API.

export interface CashfreeSession {
  mode: "cashfree";
  paymentSessionId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  environment: "sandbox" | "production";
}

/** What the flow did, as far as the browser can honestly tell. Never "paid". */
export interface CheckoutOutcome {
  /** The SDK reported a problem (which includes the buyer closing the modal). */
  reportedError: boolean;
  /** The page is navigating to return_url; the result arrives after the redirect. */
  redirecting: boolean;
  /** For logs and support, never for control flow. */
  message: string | null;
}

interface CashfreeCheckoutResult {
  error?: { message?: string; code?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
}

interface CashfreeInstance {
  checkout(options: { paymentSessionId: string; redirectTarget?: string }): Promise<CashfreeCheckoutResult>;
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => CashfreeInstance;
  }
}

const SCRIPT_SRC = "https://sdk.cashfree.com/js/v3/cashfree.js";
let loading: Promise<void> | null = null;
// Initialised once per environment and reused, rather than rebuilt inside a
// click handler — re-initialising per click is a documented source of flaky
// checkouts.
const instances = new Map<string, CashfreeInstance>();

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Checkout needs a browser"));
  if (window.Cashfree) return Promise.resolve();
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

async function instanceFor(environment: "sandbox" | "production"): Promise<CashfreeInstance> {
  const existing = instances.get(environment);
  if (existing) return existing;
  await loadScript();
  const factory = window.Cashfree;
  if (!factory) throw new Error("Payment page did not initialise");
  const instance = factory({ mode: environment });
  instances.set(environment, instance);
  return instance;
}

/**
 * Raised when the API has confirmed the order is NOT paid after the flow
 * ended — the buyer closed the window, or it did not go through. Thrown by the
 * services that own the verify call, not by this module, because only the API
 * knows.
 */
export class PaymentDismissedError extends Error {
  constructor() {
    super("Payment was cancelled");
    this.name = "PaymentDismissedError";
  }
}

/**
 * Runs the Cashfree payment flow in a modal over the current page.
 *
 * Resolves for every outcome the SDK can report, including a buyer-closed
 * modal, and throws only when the SDK itself could not run. The caller must
 * confirm with the API either way: an errored modal can still have taken a
 * payment (a UPI app or a bank 3-D Secure page completing out of band), so
 * treating `reportedError` as "no money moved" would be wrong.
 */
export async function openCashfreeCheckout(session: CashfreeSession): Promise<CheckoutOutcome> {
  const cashfree = await instanceFor(session.environment);
  // "_modal" keeps the buyer on our page so the caller can verify and show the
  // result without a round trip. The API still sets return_url for the flows
  // that redirect anyway, and the webhook covers an abandoned tab.
  const result = await cashfree.checkout({ paymentSessionId: session.paymentSessionId, redirectTarget: "_modal" });
  return {
    reportedError: Boolean(result.error),
    redirecting: result.redirect === true,
    message: result.error?.message ?? result.paymentDetails?.paymentMessage ?? null,
  };
}
