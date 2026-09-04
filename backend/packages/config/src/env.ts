// Typed env loader. Every required variable is listed here once; a missing
// one fails fast at boot instead of surfacing as an undefined-is-not-a-
// function error three layers down in a webhook handler.

export interface AppEnv {
  nodeEnv: "development" | "staging" | "production" | "test";
  port: number;
  databaseUrl: string;
  redisUrl: string;
  firebaseProjectId: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
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
    databaseUrl: required("DATABASE_URL", source.DATABASE_URL),
    redisUrl: required("REDIS_URL", source.REDIS_URL),
    firebaseProjectId: required("FIREBASE_PROJECT_ID", source.FIREBASE_PROJECT_ID),
    razorpayKeyId: required("RAZORPAY_KEY_ID", source.RAZORPAY_KEY_ID),
    razorpayKeySecret: required("RAZORPAY_KEY_SECRET", source.RAZORPAY_KEY_SECRET),
    razorpayWebhookSecret: required("RAZORPAY_WEBHOOK_SECRET", source.RAZORPAY_WEBHOOK_SECRET),
    sentryDsn: optional(source.SENTRY_DSN),
    gcpProjectId: required("GCP_PROJECT_ID", source.GCP_PROJECT_ID),
  };
}
