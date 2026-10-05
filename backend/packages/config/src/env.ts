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
   * Razorpay — the payment gateway. Optional so the app boots without them
   * (the gateway answers 503 rather than the process refusing to start).
   *
   * The webhook secret is a THIRD credential, separate from the API secret:
   * you choose it in the Razorpay dashboard when registering the webhook, and
   * it is the only thing that signs `x-razorpay-signature`. Signing webhooks
   * with the API secret is a Cashfree habit that does not carry over.
   */
  razorpayKeyId: string | null;
  razorpayKeySecret: string | null;
  razorpayWebhookSecret: string | null;
  /**
   * Cashfree Secure ID — Aadhaar/GSTIN verification, and nothing else. The
   * payment gateway is Razorpay (client decision, 5 Oct 2026), so the Cashfree
   * gateway credentials are gone; these are Secure ID's own key pair, issued
   * from its own dashboard section.
   *
   * Optional, so the verification routes answer 503 instead of blocking the
   * boot. `sandbox` is the default on purpose — going live is an explicit act,
   * never something a missing variable does for you.
   *
   * The public key is Secure ID's second 2FA method. Secure ID enforces 2FA on
   * every outbound call, and the alternative — an IP allow-list — cannot work
   * from a host with no static outbound IP. When this is set, each request
   * carries an X-Cf-Signature derived from it; when it is unset, the header is
   * omitted entirely and the account is expected to be on IP allow-listing
   * (Cashfree rejects requests that send both). Use the OLDEST client id on
   * the account for this flow — a newer key pair fails signature validation
   * specifically.
   */
  cashfreeEnv: "sandbox" | "production";
  cashfreeVerificationAppId: string | null;
  cashfreeVerificationSecretKey: string | null;
  cashfreeVerificationPublicKey: string | null;
  sentryDsn: string | null;
  gcpProjectId: string;
  /** Browser origins allowed by CORS. Comma-separated in env; defaults to the local Next dev server. */
  corsOrigins: string[];
  /**
   * "simulated" lets the order's own customer call
   * POST /v1/orders/:id/simulate-payment — i.e. mark their own order paid
   * without paying. "razorpay" closes that door.
   *
   * Because the permissive value is the one that costs money, this is parsed
   * strictly: an unrecognised value FAILS THE BOOT rather than falling back.
   * A silent fallback is exactly how a stale gateway name left over from a
   * provider switch would have turned into free checkout.
   */
  paymentsMode: "simulated" | "razorpay";
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

/**
 * Cashfree hands you the Secure ID 2FA public key as a .pem file. How it
 * survives a trip through an environment variable varies, so all three shapes
 * that actually turn up are accepted and normalised to a real PEM:
 *
 *   - pasted verbatim, with real newlines (what Railway stores);
 *   - pasted into a UI that flattened the newlines into the two characters
 *     backslash-n;
 *   - base64 of the whole file, for env stores that dislike multi-line values.
 *
 * Anything that is not recognisably a PEM after that throws, because the
 * alternative is a signature that fails at runtime with an error that looks
 * exactly like a wrong key.
 */
function publicKeyOf(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const pem = raw.includes("BEGIN")
    ? raw.replace(/\\n/g, "\n")
    : Buffer.from(raw, "base64").toString("utf8").trim();
  if (!pem.includes("BEGIN") || !pem.includes("KEY")) {
    throw new Error(
      "CASHFREE_VERIFICATION_PUBLIC_KEY is set but is not a PEM public key. Paste the .pem downloaded " +
        "from Cashfree (Developers > Two-Factor Authentication, under Secure ID), or its base64. Leave it " +
        "unset to fall back to IP allow-listing.",
    );
  }
  // A private key would actually WORK here — node derives the public half from
  // it — so nothing downstream would ever reveal the mistake. Refused at boot
  // instead, because Cashfree only ever issues a public key for this.
  if (pem.includes("PRIVATE KEY")) {
    throw new Error("CASHFREE_VERIFICATION_PUBLIC_KEY contains a PRIVATE key. Cashfree issues a PUBLIC key for Secure ID 2FA; do not store a private key here.");
  }
  return pem;
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
 *   - an unrecognised value (a stale gateway name, a typo, "true") throws;
 *   - unset throws in production, where leaving it out is never intentional,
 *     while still defaulting to "simulated" for local development.
 */
function paymentsModeOf(value: string | undefined, nodeEnv: AppEnv["nodeEnv"]): AppEnv["paymentsMode"] {
  if (value === "simulated" || value === "razorpay") return value;
  if (value === undefined || value.length === 0) {
    if (nodeEnv === "production") {
      throw new Error(
        "PAYMENTS_MODE is not set. Set it to \"razorpay\" to take real payments, or \"simulated\" to " +
          "deliberately allow customers to mark their own orders paid. There is no default in production.",
      );
    }
    return "simulated";
  }
  throw new Error(
    `PAYMENTS_MODE=${JSON.stringify(value)} is not a valid mode. Use "razorpay" or "simulated". ` +
      `(If this says "cashfree", payments moved back to Razorpay — set it to "razorpay". Cashfree is now ` +
      `used only for Aadhaar/GSTIN verification. It is refused rather than ignored because falling back to ` +
      `"simulated" would let customers mark their own orders paid.)`,
  );
}

/** Reads process.env once at boot. Call this exactly once per process. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    nodeEnv: nodeEnvOf(source.NODE_ENV),
    port: Number(source.PORT ?? 8080),
    redisUrl: optional(source.REDIS_URL),
    firebaseProjectId: required("FIREBASE_PROJECT_ID", source.FIREBASE_PROJECT_ID),
    razorpayKeyId: optional(source.RAZORPAY_KEY_ID),
    razorpayKeySecret: optional(source.RAZORPAY_KEY_SECRET),
    razorpayWebhookSecret: optional(source.RAZORPAY_WEBHOOK_SECRET),
    cashfreeEnv: source.CASHFREE_ENV?.toLowerCase() === "production" ? "production" : "sandbox",
    cashfreeVerificationAppId: optional(source.CASHFREE_VERIFICATION_APP_ID),
    cashfreeVerificationSecretKey: optional(source.CASHFREE_VERIFICATION_SECRET_KEY),
    cashfreeVerificationPublicKey: publicKeyOf(source.CASHFREE_VERIFICATION_PUBLIC_KEY),
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
