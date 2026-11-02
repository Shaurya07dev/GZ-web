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

## Email

Transactional email goes out through Resend. The words are in
`apps/api/src/mail/templates.ts` (one pure function per email, and a catalogue of
who gets what and when), the look is `layout.ts`, and `emails.ts` is the service the
controllers call (`void this.emails.orderPaid(...)`: a mail failure is logged and
never becomes an API error). `mailer.ts` is the only code that talks to Resend.

| Variable | Set to |
| --- | --- |
| `RESEND_API_KEY` | A sending-only key. Unset, emails are logged, not sent. |
| `EMAIL_FROM` | `GalleryZone <hello@galleryzone.art>`: an address on the domain verified in Resend. The default, Resend's `onboarding@resend.dev`, only delivers to the Resend account's own address. |
| `EMAIL_REPLY_TO` | A mailbox someone reads, for example `support@galleryzone.art`. Several emails say "reply to this email". |
| `PUBLIC_SITE_URL` | `https://www.galleryzone.art`. Every button and the logo link to it. |

- `npm run check:email` renders every email with sample data and checks escaping,
  the plain-text part, links and colour contrast. It is part of `npm run check`.
- `npm run email:preview` writes every email as HTML and text to `email-previews/`;
  open `index.html`.
- `npm run check:email-demo` (demo emulator running and seeded, API built) runs the
  real service against the seeded data with a fake mailer.

To add an email: write a function in `templates.ts` and a row in `catalogue`; add a
method in `emails.ts` that looks the facts up and calls `deliver(key, to,
T.yourEmail(...))`; call it from the controller with `void this.emails.x(...).catch(this.emails.swallow("..."))`.
The key is the idempotency key. Resend drops a repeat of the same key within 24 hours
and refuses the same key with different content, so anything that can legitimately
happen twice needs a part that changes (see `again()` in `emails.ts`).
