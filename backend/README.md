# GalleryZone Backend

Real backend for GalleryZone/ArtVault, serving both `frontend-web/` and
`mobile_flutter/`. See the full build plan for context, phases, and the
"nothing hardcoded" rate-config approach: it is the plan this repo's Phase 0
was scaffolded from.

## Status

Phase 0 (Foundations) — monorepo skeleton only. Nothing here is deployed or
wired to real infrastructure yet; `apps/api` and `apps/jobs` are placeholder
entry points until NestJS, Drizzle, and the rest of the locked stack are
installed (needs `npm install` with network access, not run in this pass).

## Layout

```
backend/
  apps/api/            NestJS HTTP API (Cloud Run)
  apps/jobs/            Cloud Tasks/Scheduler-triggered workers
  packages/domain/      Pure, zero-I/O: pricing engine, state machines, ledger primitives
  packages/db/          Drizzle schema + migrations
  packages/contracts/   Shared DTOs/Zod schemas + OpenAPI, consumed by both frontends
  packages/config/      Typed env + versioned rate-config loader (the "nothing hardcoded" seam)
  infra/                Terraform (Cloud SQL, Cloud Run, Secret Manager, KMS, Cloudflare)
```

## The "nothing hardcoded" rule

No rate, fee, or threshold (GST%, platform markup, aggregator advance/commission,
artist convenience fee, delivery zone rates, min-withdrawal, insurance
threshold, the 5-month discount ladder) is ever a literal in application code.
Every pricing function in `packages/domain/src/pricing.ts` takes a `PricingRates`
object as a parameter instead of reading module-level constants. `packages/config`
is what resolves that object — from the versioned `rate_config` table once
`packages/db` exists, or from `DEFAULT_RATE_SEED` (also in `packages/config`)
only as the literal seed migration writes into that table on first boot. Application
code never imports `DEFAULT_RATE_SEED` directly for a business calculation.

## Pricing engine — ground truth

`packages/domain/src/pricing.ts` is `frontend-web/lib/pricing.ts` ported
function-for-function (same names, same rounding order), parameterized on
rates instead of constants. `packages/domain/src/pricing.check.ts` replays
every worked example from `frontend-web/lib/pricing.check.ts` — run it with:

```
node --experimental-strip-types packages/domain/src/pricing.check.ts
```

Both frontends' own client-side pricing math (`frontend-web/lib/pricing.ts`,
`mobile_flutter/lib/core/pricing.dart`) gets retired once `apps/api` serves
real numbers (Phase 6) — this package is the single source of truth in the
meantime and going forward.
