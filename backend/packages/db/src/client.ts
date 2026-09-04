// Postgres client factory. One `postgres()` connection pool per process —
// apps/api and apps/jobs each call this once at bootstrap and share the
// resulting client, never opening a pool per request (that's the
// "PgBouncer/connection pooling sized for Cloud Run's concurrent-instance
// fan-out" the plan's Scale target section calls for — pooling happens at
// this layer plus PgBouncer in front of Cloud SQL, not per-request).

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./index.ts";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(databaseUrl: string): { db: Db; close: () => Promise<void> } {
  const client = postgres(databaseUrl, {
    // Cloud Run scales instances horizontally; keep each instance's own
    // pool small so N instances x max don't collectively exceed Postgres's
    // max_connections. Real sizing is a Phase 0/Terraform decision once
    // Cloud SQL's tier is picked — this is a conservative placeholder, not
    // a tuned value.
    max: 10,
  });
  const db = drizzle(client, { schema });
  return { db, close: () => client.end() };
}
