import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from the schema in src/schema/*.ts. Doesn't
// need a live Postgres connection to run `drizzle-kit generate` — it only
// introspects the TypeScript schema and diffs against the migrations
// folder's existing snapshot. Applying the generated SQL against a real
// database is a separate step (`drizzle-kit migrate`), gated on Phase 0's
// Cloud SQL instance existing.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/index.ts",
  out: "./migrations",
  // Placeholder — drizzle-kit generate doesn't connect with this config,
  // but the field is required. Real value comes from packages/config's
  // loadEnv() once this runs against an actual database.
  dbCredentials: {
    url: "postgres://placeholder:placeholder@localhost:5432/placeholder",
  },
});
