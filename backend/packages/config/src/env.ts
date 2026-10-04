// Typed env loader. Every required variable is listed here once; a missing
// one fails fast at boot instead of surfacing as an undefined-is-not-a-
// function error three layers down in a webhook handler.

export interface AppEnv {
  nodeEnv: "development" | "staging" | "production" | "test";
  port: number;
  // Optional — nothing in this codebase actually uses Redis yet (it's
  // reserved for rate limiting/caching per the plan); required only once
  // something really connects to it.
  redisUrl: string | null;
  firebaseProjectId: string;
  /**
   * Cashfree. Two separate products, two separate key pairs issued from two
   * different dashboard sections — the payment gateway and Secure ID
   * (Aadhaar/GSTIN verification) cannot share credentials.
   *
   * Both are optional so the app boots without them: the gateway answers 503
   * and the verification routes answer 503, rather than the process refusing
   * to start. `sandbox` is the default environment on purpose — going live is
   * an explicit act, never something a missing variable does for you.
   *
   * Unlike Razorpay there is no separate webhook secret: Cashfree signs
   * webhooks with the same secret key as the API.
   */
  cashfreeEnv: "sandbox" | "production";
  cashfreeAppId: string | null;
  cashfreeSecretKey: string | null;
  cashfreeVerificationAppId: string | null;
  cashfreeVerificationSecretKey: string | null;
  sentryDsn: string | null;
  gcpProjectId: string;
  /** Browser origins allowed by CORS. Comma-separated in env; defaults to the local Next dev server. */
  corsOrigins: string[];
  /**
   * "simulated" lets the order's own customer call
   * POST /v1/orders/:id/simulate-payment — i.e. mark their own order paid
   * without paying. "cashfree" closes that door.
   *
   * Because the permissive value is the one that costs money, this is parsed
   * strictly: an unrecognised value FAILS THE BOOT rather than falling back.
   * A silent fallback is exactly how a stale "razorpay" left over from the old
   * gateway would have turned into free checkout.
   */
  paymentsMode: "simulated" | "cashfree";
  /** S3-compatible object storage for artwork images (Railway bucket). Null until configured — image routes then 503. */
  /** Where this API is reachable by browsers — baked into image URLs. */
  publicApiUrl: string;
  /** The website's own origin. The gateway sends the buyer back here, and mail links point here. */
  publicSiteUrl: string;
  s3: { bucket: string; accessKeyId: string; secretAccessKey: string; endpoint: string; region: string } | null;
  /** Who signs the MOUs for Galleryzone. Unset leaves the company's name/designation blanks empty on every MOU. */
  mouSignatory: { name: string | null; designation: string | null };
}

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required environment variable ${name}. Set it in .env (see .env.example) — ` +
        `this backend never falls back to a hardcoded default for infra config.`,
    );
  }
  return value;
}

function optional(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

const NODE_ENVS: readonly AppEnv["nodeEnv"][] = ["development", "staging", "production", "test"];

function nodeEnvOf(value: string | undefined): AppEnv["nodeEnv"] {
  if (value && (NODE_ENVS as readonly string[]).includes(value)) {
    return value as AppEnv["nodeEnv"];
  }
  return "development";
}

/**
 * Strict on purpose. "simulated" means a customer can mark their own order
 * paid, so every path that is not deliberate ends in an exception rather than
 * in that mode:
 *
 *   - an unrecognised value (a stale "razorpay", a typo, "true") throws;
 *   - unset throws in production, where leaving it out is never intentional,
 *     while still defaulting to "simulated" for local development.
 */
function paymentsModeOf(value: string | undefined, nodeEnv: AppEnv["nodeEnv"]): AppEnv["paymentsMode"] {
  if (value === "simulated" || value === "cashfree") return value;
  if (value === undefined || value.length === 0) {
    if (nodeEnv === "production") {
      throw new Error(
        "PAYMENTS_MODE is not set. Set it to \"cashfree\" to take real payments, or \"simulated\" to " +
          "deliberately allow customers to mark their own orders paid. There is no default in production.",
      );
    }
    return "simulated";
  }
  throw new Error(
    `PAYMENTS_MODE=${JSON.stringify(value)} is not a valid mode. Use "cashfree" or "simulated". ` +
      `(If this says "razorpay", the gateway moved to Cashfree — set it to "cashfree". It is refused rather ` +
      `than ignored because falling back to "simulated" would let customers mark their own orders paid.)`,
  );
}

/** Reads process.env once at boot. Call this exactly once per process. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    nodeEnv: nodeEnvOf(source.NODE_ENV),
    port: Number(source.PORT ?? 8080),
    redisUrl: optional(source.REDIS_URL),
    firebaseProjectId: required("FIREBASE_PROJECT_ID", source.FIREBASE_PROJECT_ID),
    cashfreeEnv: source.CASHFREE_ENV?.toLowerCase() === "production" ? "production" : "sandbox",
    cashfreeAppId: optional(source.CASHFREE_APP_ID),
    cashfreeSecretKey: optional(source.CASHFREE_SECRET_KEY),
    cashfreeVerificationAppId: optional(source.CASHFREE_VERIFICATION_APP_ID),
    cashfreeVerificationSecretKey: optional(source.CASHFREE_VERIFICATION_SECRET_KEY),
    sentryDsn: optional(source.SENTRY_DSN),
    gcpProjectId: required("GCP_PROJECT_ID", source.GCP_PROJECT_ID),
    corsOrigins: (source.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((o) => o.trim()).filter(Boolean),
    paymentsMode: paymentsModeOf(source.PAYMENTS_MODE, nodeEnvOf(source.NODE_ENV)),
    publicApiUrl:
      optional(source.PUBLIC_API_URL) ??
      (source.RAILWAY_PUBLIC_DOMAIN ? `https://${source.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${Number(source.PORT ?? 8080)}`),
    publicSiteUrl: (optional(source.PUBLIC_SITE_URL) ?? (source.CORS_ORIGINS ?? "http://localhost:3000").split(",")[0]!.trim()).replace(/\/$/, ""),
    s3:
      source.S3_BUCKET && source.S3_ACCESS_KEY_ID && source.S3_SECRET_ACCESS_KEY && source.S3_ENDPOINT
        ? {
            bucket: source.S3_BUCKET,
            accessKeyId: source.S3_ACCESS_KEY_ID,
            secretAccessKey: source.S3_SECRET_ACCESS_KEY,
            endpoint: source.S3_ENDPOINT,
            region: source.S3_REGION || "auto",
          }
        : null,
    mouSignatory: { name: optional(source.MOU_SIGNATORY_NAME?.trim()), designation: optional(source.MOU_SIGNATORY_DESIGNATION?.trim()) },
  };
}
