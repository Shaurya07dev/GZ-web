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
  // Optional for now — Razorpay is explicitly deferred (test-mode setup
  // comes later); confirmSimulatedPayment() doesn't call out to Razorpay
  // at all yet, so the app can boot and be exercised without these. They
  // become required the moment Phase 2 wires in a real webhook handler.
  razorpayKeyId: string | null;
  razorpayKeySecret: string | null;
  razorpayWebhookSecret: string | null;
  sentryDsn: string | null;
  gcpProjectId: string;
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
    sentryDsn: optional(source.SENTRY_DSN),
    gcpProjectId: required("GCP_PROJECT_ID", source.GCP_PROJECT_ID),
  };
}
