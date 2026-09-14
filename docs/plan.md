# ArtVault — Backend Master Plan

**Audience:** Claude Code (implementing agent) and the human engineering team.
**Status:** Authoritative build brief. Where this document conflicts with the earlier
`Procedures`, `Workflow`, or `Build Plan` PDFs, **this document wins.** Those PDFs contradict
each other; the contradictions are resolved in §3.
**Frontends:** already built — Next.js (TypeScript) web, Flutter mobile. This plan covers
**backend, data, infrastructure, and integrations only.**
**Last updated:** 2026-08-24

---

## 0. How to use this document (instructions to the implementing agent)

1. **Read §3 (Locked Decisions) and §4 (Open Decisions) before writing any code.**
   Anything in §4 is unresolved. Do **not** invent an answer and build past it. Stop and ask.
2. Build in the phase order in §16. Do not start a phase until the prior phase's
   Definition of Done (§17) passes in CI.
3. Every money-touching change requires a test. See §17 for the non-negotiable test list.
4. When a business rule is ambiguous, encode it as a **named constant in
   `packages/domain/src/rules.ts`** with a comment citing this document's section number.
   Never scatter magic numbers (0.30, 0.05, 0.20, 30) through the codebase.
5. Prefer boring. This system moves other people's money and certifies authenticity of
   physical objects. Clever is a liability.

---

## 1. What the product is

A verified, multi-role art marketplace with four participant roles plus an admin layer.

| Role | What they do |
|---|---|
| **Artist** | Lists original artwork at a **private** price, completes KYC + 3-tier verification, receives settlement when a piece sells. |
| **Aggregator (Distributor)** | A gallery/retail partner. Pays an advance to take **physical custody** of a piece, displays it for a fixed window, records the sale, earns an incentive. **Never the legal owner.** |
| **Customer** | Buys at the public price. Receives Certificate of Authenticity + a tamper-evident NFC/QR identity tag. May resell later. |
| **Admin** | Verifies users, oversees the ownership chain, runs the finance module, resolves disputes. |

The commercial substance: a markup sits between the artist's private price and the public
customer price; the aggregator earns a share of that markup for placing the work.

**The product's actual value proposition is provenance.** Every architectural decision below
that looks paranoid (append-only ownership events, cryptographic NFC, immutable audit log)
exists because provenance that can be silently edited is worth nothing.

---

## 2. Scale reality — read this before designing anything

Stated target: **1,000 artists, 3,000 aggregators, 6,000 customers ≈ 10,000 total accounts.**

**This is not a scale problem.** Estimate the working load honestly:

- 10,000 accounts, of whom maybe 10–15% are active in a given week.
- Peak realistic concurrency: **low hundreds**.
- Transaction volume: art is a low-frequency, high-consideration purchase. Even an
  aggressive assumption of 20 sales/day is **~0.0002 writes/sec** on the money path.
- Heaviest real load is **image delivery**, which is a CDN problem, not an application problem.

A single Cloud Run service with 2 vCPU and a single `db-custom-2-7680` Cloud SQL instance
handles this with two orders of magnitude of headroom. **Do not build for scale you do not
have.** No Kubernetes, no microservices, no event-sourcing framework, no read replicas on
day one, no sharding, no Kafka.

**Your production-grade risk is not throughput. It is:**

1. Settling money incorrectly (double-paying, under-paying, un-auditable).
2. Leaking the artist's private price to a customer.
3. Losing or corrupting the ownership chain.
4. Regulatory exposure — holding funds without authorisation, mishandling Aadhaar/KYC data,
   or storing payment data outside India.

Engineer against **those** four. Correctness and auditability over throughput, every time.

---

## 3. LOCKED DECISIONS

These resolve contradictions in the source PDFs. Implement exactly these.

### 3.1 Naming
- Platform name: **ArtVault**. (The Procedures PDF says "Galleryzone" but uses `AV###`
  product IDs — the docs were recycled. Standardise on ArtVault everywhere: DB, API, COA,
  emails, tag URLs.) If the business chooses Galleryzone instead, that is a **find-and-replace
  on a single constant**, so keep the display name in config, not hardcoded.
- Product ID format: `AV` + zero-padded 6 digits — `AV000001`. (The PDFs say `AV001`; 3 digits
  caps you at 999 artworks. Use 6.) Immutable once assigned. Generated from a Postgres sequence.

### 3.2 Legal ownership chain — THE canonical version
The PDFs give three different answers. This is the one:

| Stage | Legal owner | Physical custody |
|---|---|---|
| Listed, accepted by ArtVault | **Artist** | Artist |
| In transit to aggregator | **Artist** | Carrier |
| Held by aggregator | **Artist** | Aggregator (bailee — custody only, no title) |
| Sale recorded, in transit to buyer | **Artist** (title passes on delivery) | Carrier |
| Delivery confirmed | **Customer** | Customer |

Rationale: ArtVault never takes title. This keeps ArtVault an **agent/intermediary**, which is
consistent with §3.4 and materially reduces tax and liability exposure. The aggregator is a
**bailee**, which is the correct legal characterisation of "display partner, not owner."

Implement as append-only `ownership_events`. Current owner is a **projection**, never a
mutable column.

### 3.3 Confirmation fee
**Zero.** Free listing. (PDFs variously say 0%, 1%, and "1% TCS" — the last is a category
error; TCS is a statutory collection, not a platform fee. Do not use that word for a fee.)
Monetisation is the markup (§3.5) and the artist subscription (§3.10).

### 3.4 Agent, not principal — and therefore no wallet
ArtVault is an **electronic commerce operator / agent**. It does not buy and resell artwork.

**Consequence, and this is the single most important infrastructure decision in this document:**

> **Do not build a wallet that holds balances in an ArtVault-controlled bank account.**

Holding customer, artist, or aggregator balances is prepaid-payment-instrument territory and
requires RBI authorisation. Instead:

- All customer money lands in **Razorpay's escrow**, split at capture via **Razorpay Route**.
- Artist and aggregator payouts go out via **RazorpayX Payouts** to their verified bank accounts.
- The "wallet" the PDFs describe becomes a **read-only view over ArtVault's own ledger**
  (§9) showing amounts held/owed on each party's behalf. It is a UI surface, not a treasury.

This removes the largest regulatory risk in the project and deletes roughly six weeks of build.

### 3.5 Pricing engine — config-driven, versioned
```
customer_price_ex_gst = round_paise(artist_price × (1 + MARKUP_RATE))
markup                = customer_price_ex_gst − artist_price
distributor_incentive = round_paise(markup × INCENTIVE_RATE)
platform_margin       = markup − distributor_incentive
customer_payable      = customer_price_ex_gst + gst_on_price + delivery_charge
```
Defaults (from the PDFs): `MARKUP_RATE = 0.30`, `INCENTIVE_RATE = 0.20`,
`ADVANCE_RATE = 0.05`, `AGED_ADVANCE_RATE = 0.03`, `HOLD_WINDOW_DAYS = 30`,
`AGING_REDUCTION_RATE = 0.10` (applied **to the markup**, not the total — see §3.7).

**All of these live in a `pricing_configs` table with `effective_from` / `effective_to`.**
Every artwork stores the `pricing_config_id` in force when it was listed. Rates **will**
change; historical orders must remain reproducible. Never read a rate from an env var at
settlement time.

### 3.6 Aggregator advance is REFUNDABLE, applied at settlement
PDFs give three answers. Locked:
- The advance (`ADVANCE_RATE × customer_price_ex_gst`) is a **refundable security deposit**.
- On a confirmed sale, it is **set off** against amounts due to the aggregator.
- On a clean return/recall (undamaged, within terms), it is **refunded in full**.
- It is **forfeited** only on documented loss or damage in the aggregator's custody (§3.8).
- Ledger treatment: a **liability** of ArtVault to the aggregator from receipt until set-off
  or refund. Never recognised as revenue.

### 3.7 The aging rule — reduction is *of the markup*
After `HOLD_WINDOW_DAYS`, the customer price reduces by `AGING_REDUCTION_RATE × markup`.
The **artist price never changes.** Worked example on ₹10,000 artist price with default rates:
markup ₹3,000, customer price ₹13,000 → reduction ₹300 → new customer price ₹12,700.

**Implement a price floor.** Uncapped, repeated reductions eventually consume the entire
markup and then the artist's price. Add `MIN_MARKUP_RATE` (default `0.15`) below which no
further reduction occurs; artwork instead transitions to `aging_floor_reached` and raises an
admin task. Also cap `MAX_AGGREGATOR_TRANSFERS` (default `3`), after which the piece is
returned to the artist or moved to a clearance flow. **Neither rule exists in the PDFs and
without them the model has no terminal state.**

### 3.8 Custody liability
PDFs directly contradict (§3.5 vs §10.5 of Procedures). Locked:
- The aggregator **is** responsible for loss or damage while the piece is in their custody
  (that is what bailment means; a partner who bears no risk has no reason to be careful).
- Liability is capped at the artist price for uninsured works.
- Where transit/display insurance is in force, the claim runs first and the aggregator is
  liable only for the shortfall/deductible.
- Model this as an explicit `custody_liability` record created on `handover`, resolved on
  `handback` or `sale_delivered`.

### 3.9 Aggregators cannot change price
Procedures §3.1 says they can "appreciate" the price; §9.2 and the FAQ say they cannot.
Locked: **they cannot.** The customer price is system-derived. Any deviation requires an
admin-approved `price_override` record with a reason string, and is fully audit-logged.
Selling below the listed customer price without an approved override is a policy violation
that blocks the aggregator's payout pending admin review.

### 3.10 Artist settlement formula — canonical
The PDFs give four versions, one of which wrongly deducts GST from the artist. Locked:

```
artist_settlement = artist_price
                  − platform_convenience_fee (if any, default 0)
                  − insurance_premium (only if artist opted in AND ArtVault procured it)
                  − TDS u/s 194-O (if applicable, see §4.2)
```
**Delivery to the customer is paid by the customer and is never deducted from the artist.**
**GST is not deducted from the artist's settlement.** If the artist is GST-registered they
raise their own invoice; if unregistered, no GST arises on their supply. Getting this wrong
is the fastest way to lose supply-side trust.

Settlement is **initiated** on confirmed delivery (not on sale record) and paid within
**7 business days**.

### 3.11 Rights transfer — narrow, not "all rights"
The PDFs transfer reproduction, licensing and commercial rights to the buyer. **Do not
implement that.** Under the Copyright Act, 1957 (s.19) an assignment must be a signed
writing specifying work, rights, duration, territory and royalty — a checkbox is not that —
and buyers of physical art neither want nor expect copyright.

Implement: **transfer of physical property + a personal display licence.** Copyright remains
with the artist unless a separate, explicitly signed assignment document exists (model a
`rights_assignments` table for that future case, but do not wire it into the default flow).

Also: build a hook for **resale royalty (s.53A)** on the resale feature — the author has a
statutory right to share in resale proceeds of original works above a threshold. Model
`resale_royalty_accruals` now even if the rate is set to zero pending legal input (§4.5).

### 3.12 GST
Model it, do not hardcode it. `tax_rates` table keyed by HSN + effective date. Artwork sits
under HSN 9701; **the applicable rate must be confirmed by the finance owner (§4.1)** — do
not assume the 5% in the PDFs. Every order stores the rate applied, the HSN, and place of
supply (for CGST/SGST vs IGST determination). Build intra-state vs inter-state split from day
one; retrofitting it is painful.

---

## 4. OPEN DECISIONS — agent must STOP and ask

Do not build past these. Each blocks a specific component.

| # | Question | Blocks | Recommended default |
|---|---|---|---|
| 4.1 | Confirmed GST rate + HSN for artwork; is ArtVault registered; ECO liability u/s 9(5)? | Order totals, invoicing, `tax_rates` seed | 12% HSN 9701, ECO not liable for artist's supply — **must be confirmed by a tax advisor** |
| 4.2 | Does TDS u/s 194-O apply to artist payouts? At what rate/threshold? | Settlement formula, payout job | Assume yes, 0.1%, with threshold exemption logic |
| 4.3 | Is GST TCS u/s 52 applicable to ArtVault as ECO? | Monthly GSTR-8 reporting | Assume yes at 0.5%; build the accrual, flag for review |
| 4.4 | Aggregator incentive is ~4.6% of sale value at default rates. Is that the final commercial model? | Whole aggregator business case | **Raise this before Phase 3.** A gallery giving 30 days of wall space and bearing custody risk for 4.6% is a hard sell. Rates are config-driven, so the code survives a change — the business may not. |
| 4.5 | Resale royalty rate under s.53A | Resale feature | Accrue at 0%, flag as `pending_legal` |
| 4.6 | Which KYC aggregator? (Signzy / IDfy / HyperVerge / Setu) | KYC module — API shapes differ | Build behind the `KycProvider` interface (§11) so this is swappable; pick before Phase 2 ends |
| 4.7 | Insurance: does ArtVault earn any commission on HDFC Ergo policies? | IRDAI exposure | **If yes, this requires IRDAI registration as corporate agent/broker.** Default: plain outbound link, zero commission, ArtVault is not a party. |
| 4.8 | Delivery/logistics partner + who books the shipment | Shipping module | Build a `LogisticsProvider` interface; manual/admin-booked as the v1 implementation |

---

## 5. Tech stack

### 5.1 Locked stack

| Layer | Choice | Notes |
|---|---|---|
| API runtime | **NestJS + TypeScript** on **Cloud Run** (`asia-south1`, Mumbai) | Same language as the Next.js frontend; shared types package |
| Primary datastore | **Cloud SQL for PostgreSQL 16** (`asia-south1`, private IP, HA enabled) | Source of truth for **all** domain, money and provenance data |
| ORM / query | **Drizzle ORM** + raw SQL for ledger/reporting | Migrations checked into the repo, forward-only |
| Auth | **Firebase Authentication** | Phone OTP + email/password + Google. Already integrates cleanly with both Next.js and Flutter |
| Push notifications | **Firebase Cloud Messaging** | Flutter app |
| Object storage | **Firebase Cloud Storage** (GCS bucket, `asia-south1`) | Direct-to-bucket resumable uploads via signed URLs |
| CDN + image transforms | **Cloudflare** in front of a public derivatives bucket | See §5.3 |
| Cache / locks | **Memorystore for Redis** (or a single small Redis on Cloud Run sidecar for v1) | Idempotency keys, rate limits, distributed locks |
| Background jobs | **Cloud Tasks** (queued work) + **Cloud Scheduler** (cron) hitting authenticated Cloud Run endpoints | No separate worker fleet needed at this scale |
| Payments in | **Razorpay Route** (split settlement, escrow) | §10 |
| Payouts | **RazorpayX Payouts** | §10 |
| KYC | DigiLocker via aggregator (§4.6) behind our own interface | §11 |
| Email | **Resend** or **SES** (`ap-south-1`) | Transactional only |
| SMS/WhatsApp | **MSG91** | OTP is handled by Firebase; MSG91 for transactional + WhatsApp updates |
| PDF generation (COA, invoices) | **Puppeteer on Cloud Run Jobs**, HTML → PDF | Deterministic, versioned templates |
| Secrets | **GCP Secret Manager** | Never in env files in the repo |
| NFC tag keys | **GCP Cloud KMS** | AES keys for SUN tags never leave KMS (§12) |
| Errors / tracing | **Sentry** + **OpenTelemetry** → Cloud Trace | |
| CI/CD | **GitHub Actions** → Artifact Registry → Cloud Run | Terraform for infra |
| IaC | **Terraform** | All GCP resources declared; no click-ops |

### 5.2 Where Firebase is used — and where it is NOT

Firebase is a good fit for **Auth, FCM, and Storage**. Use it there.

**Do not use Firestore as the primary datastore.** This system needs:
- multi-row ACID transactions across artwork, ledger, order and settlement tables,
- foreign-key integrity on an ownership chain,
- `SERIALIZABLE` isolation on settlement runs,
- arbitrary SQL for reconciliation and finance reporting,
- a double-entry ledger with a balance-sums-to-zero constraint.

Firestore gives you none of these cleanly, and its pricing model punishes exactly the
read-heavy reporting a finance module does constantly. Postgres is the right core; Firebase
is the right edge.

**Hybrid contract:** Firebase Auth issues the identity. The backend verifies the Firebase ID
token, maps `firebase_uid` → internal `users.id`, and reads **role and permissions from
Postgres, never from the client token payload.** Firebase custom claims may mirror the role
for convenience in the frontend, but the backend must never trust them for authorisation.

### 5.3 Hosting — and the Vercel question

You are right that the **backend** does not belong on Vercel. Reasoning, in order of weight:

1. **Payment data localisation.** RBI's storage directive requires payment system data to be
   stored in India. A globally-distributed edge platform makes that hard to evidence.
   `asia-south1` with a private-IP Cloud SQL instance makes it trivial.
2. Long-running work (PDF generation, settlement runs, image processing) fits Cloud Run
   containers, not serverless functions with short timeouts.
3. You need a persistent connection pool to Postgres.

**However — the Next.js frontend on Vercel is genuinely fine at this scale**, and moving it
costs you the framework's best-supported deployment path. If you want everything in one place
for compliance simplicity, deploy Next.js to **Cloud Run** too (it containerises cleanly).
Either is defensible. What is *not* defensible is putting the API on Vercel.

**Recommended topology:**

```
GoDaddy (registrar)
   └─ nameservers delegated to → Cloudflare (DNS, CDN, WAF, DDoS, rate limiting)
        ├─ artvault.in            → Next.js  (Vercel or Cloud Run, asia-south1)
        ├─ api.artvault.in        → Cloud Run: NestJS API (asia-south1)
        ├─ cdn.artvault.in        → Cloudflare-cached GCS derivatives bucket
        └─ v.artvault.in          → Cloud Run: NFC/QR verification endpoint (§12)
```
Keep the domain registered at GoDaddy; delegate DNS to Cloudflare. You get WAF, bot
mitigation and caching that GoDaddy's DNS does not provide. Enforce HSTS, TLS 1.2+ minimum.

### 5.4 Repository layout

```
artvault/
├── apps/
│   ├── api/                  # NestJS — the only backend service
│   └── jobs/                 # Cloud Run Jobs (PDF gen, settlement runs, reports)
├── packages/
│   ├── domain/               # Pure TS: pricing, ledger rules, state machine. NO I/O.
│   ├── db/                   # Drizzle schema + migrations
│   ├── contracts/            # Zod schemas + generated OpenAPI; shared with Next.js
│   └── config/               # Constants, feature flags
├── infra/                    # Terraform
└── docs/
    └── master-plan.md        # this file
```

`packages/domain` must have **zero dependencies on the database or network.** All pricing,
settlement and state-transition logic is pure functions over plain data, tested in isolation.
This is the part that must be provably correct.

---

## 6. Data model

Money is `BIGINT` **paise**. Never float. Never `Decimal` in JS. Never rupees.
All timestamps `TIMESTAMPTZ`, stored UTC. All IDs `UUID v7` (time-sortable) except
`artworks.product_id`, which is the human-facing `AV000001` sequence.

### 6.1 Identity

```sql
users               id, firebase_uid UNIQUE, email, phone, primary_role,
                    status, created_at, deleted_at
user_roles          user_id, role, granted_at, granted_by     -- a user may hold >1 role
artist_profiles     user_id, display_name, handle UNIQUE, bio, socials JSONB,
                    verification_state, subscription_status, bank_account_id
aggregator_profiles user_id, legal_name, gstin, business_type, gallery_name,
                    display_address JSONB, kyc_state, credit_state
customer_profiles   user_id, display_name, default_address_id
addresses           id, user_id, line1, line2, city, state, state_code, pincode, type
bank_accounts       id, user_id, account_number_encrypted, ifsc, name_at_bank,
                    penny_drop_status, verified_at, razorpay_fund_account_id
```

### 6.2 Artwork and provenance

```sql
artworks              id, product_id UNIQUE, artist_id, title, medium, dimensions JSONB,
                      year_created, description, authenticity_statement,
                      artist_price_paise, pricing_config_id, listing_channel,
                      status, current_custodian_type, current_custodian_id,
                      insurance_policy_id NULL, listed_at, accepted_at
artwork_media         id, artwork_id, kind(cover|detail|signature|scale),
                      original_object_path, derivative_paths JSONB, sort_order
artwork_status_events id, artwork_id, from_status, to_status, actor_user_id,
                      reason, metadata JSONB, occurred_at      -- APPEND ONLY
ownership_events      id, artwork_id, event_type, owner_type, owner_id,
                      custodian_type, custodian_id, evidence JSONB, occurred_at
                      -- APPEND ONLY. Current owner is a projection over this.
social_proof_links    id, artwork_id, platform, url, reviewed_by, review_state
```

**No `UPDATE` and no `DELETE` on `ownership_events` or `artwork_status_events`.**
Enforce with a `BEFORE UPDATE OR DELETE` trigger that raises an exception, plus a DB role for
the app that lacks those grants on those tables.

### 6.3 Consignment (aggregator holding)

```sql
consignments        id, artwork_id, aggregator_id, pricing_snapshot JSONB,
                    advance_paise, advance_payment_id, delivery_charge_paise,
                    handover_at, window_expires_at, transfer_index,
                    status(pending_dispatch|in_transit|held|sold|recalled|returned|expired)
custody_liabilities id, consignment_id, cap_paise, state, resolved_at, notes
```

### 6.4 Orders and money

```sql
orders            id, order_number UNIQUE, artwork_id, customer_id, consignment_id NULL,
                  channel(marketplace|aggregator), price_ex_gst_paise, gst_rate,
                  gst_paise, cgst_paise, sgst_paise, igst_paise, hsn,
                  place_of_supply_state_code, delivery_paise, total_paise,
                  status, placed_at
payments          id, order_id, gateway(razorpay), gateway_order_id, gateway_payment_id,
                  amount_paise, status, method, captured_at, raw JSONB
route_transfers   id, payment_id, recipient_type, recipient_id,
                  razorpay_transfer_id, amount_paise, status
refunds           id, payment_id, amount_paise, reason, gateway_refund_id, status
settlements       id, subject_type(artist|aggregator), subject_id, order_id,
                  gross_paise, deductions JSONB, net_paise, status,
                  due_at, initiated_at, completed_at
payouts           id, settlement_id, razorpay_payout_id, fund_account_id,
                  amount_paise, status, utr, failure_reason
invoices          id, order_id, kind(tax_invoice|commission_invoice), number UNIQUE,
                  pdf_object_path, issued_at
```

### 6.5 The ledger — non-negotiable shape

```sql
ledger_accounts  id, account_type, owner_type NULL, owner_id NULL, currency, name
                 -- types: platform_revenue, gst_payable, tds_payable,
                 --        artist_payable, aggregator_payable, aggregator_deposit,
                 --        distributor_incentive_payable, gateway_clearing,
                 --        refunds_payable, resale_royalty_payable

ledger_transactions id, reference_type, reference_id, description,
                    idempotency_key UNIQUE, posted_at, posted_by

ledger_entries   id, transaction_id, account_id, direction(debit|credit),
                 amount_paise BIGINT CHECK (amount_paise > 0), created_at
```

Rules, enforced in the database not just the application:
- Every `ledger_transaction` must have debits summing exactly to credits. Enforce with a
  deferred constraint trigger that fires at `COMMIT`.
- `ledger_entries` is **append-only**. Corrections are **reversing entries** with a
  `reverses_transaction_id` reference. Never edit, never delete.
- `idempotency_key` is `UNIQUE` — this is how you make settlement runs safely re-runnable.
- Balances are computed, never stored. If a materialised balance view becomes necessary for
  performance later, it is derived and rebuildable from entries alone.

### 6.6 Trust, disputes, audit

```sql
nfc_tags          id, artwork_id, tag_uid UNIQUE, kms_key_name, last_counter,
                  provisioned_by, provisioned_at, state(active|revoked|replaced)
tag_scan_events   id, tag_id, counter, verdict(valid|stale_counter|bad_mac|revoked),
                  ip_hash, user_agent, geo_coarse, scanned_at
coas              id, artwork_id, order_id, coa_number UNIQUE, pdf_object_path,
                  content_hash, issued_at
disputes          id, order_id, raised_by, category, description, evidence JSONB,
                  state, resolution, sla_due_at, resolved_at
audit_log         id, actor_user_id, actor_ip, action, entity_type, entity_id,
                  before JSONB, after JSONB, request_id, occurred_at
```

`audit_log` is separate from application logs and is written **in the same transaction** as
the change it records, for every admin action and every money-moving operation.

---

## 7. Artwork state machine

Define once in `packages/domain/src/artwork-state.ts`. Every transition has a guard.
**No endpoint may set `status` directly.**

```
draft
  → submitted            (artist submits complete listing)
  → accepted             (admin/auto review passes)
  → available            (live; listing_channel decides marketplace and/or consignable)
  → reserved             (marketplace checkout in progress, TTL 15 min)
  → consigned_pending    (aggregator paid advance, awaiting dispatch)
  → in_transit_out       (dispatched to aggregator)
  → held                 (in aggregator custody; 30-day clock running)
  → sale_recorded        (aggregator recorded buyer, or marketplace order captured)
  → in_transit_buyer
  → delivered            (title passes; settlement initiated)
  → closed

Side branches:
  held → aging            (window expired; price reduced per §3.7)
  aging → available       (returned to pool, transfer_index++)
  aging → aging_floor_reached  (MIN_MARKUP_RATE hit — admin task)
  held → recalled → available  (admin recall)
  any → damaged_lost      (custody liability opens)
  delivered → dispute_open → {resolved | refunded | returned}
```

Guards that must be enforced:
- Cannot reach `held` without a **captured** advance payment.
- Cannot reach `sale_recorded` without a valid consignment (aggregator channel) or a captured
  customer payment (marketplace channel).
- Cannot reach `delivered` without a delivery confirmation event.
- Settlement can only be **initiated** from `delivered`.
- `recalled` is only legal from `held` or `aging`.

---

## 8. Authorisation — the price-visibility problem

**The commercial model dies the day one customer sees an artist's private price.** This
cannot depend on a frontend component not rendering a field.

Enforce at the serialisation boundary:

1. **Role-specific DTOs.** `ArtworkPublicDto`, `ArtworkArtistDto`, `ArtworkAggregatorDto`,
   `ArtworkAdminDto`. There is no "full" DTO with optional fields.
2. **Default deny.** A field is absent unless explicitly whitelisted for the requesting role.
3. `artist_price_paise` is exposed **only** to: the owning artist, an aggregator with an
   **active consignment on that specific artwork**, and admin. Not to aggregators browsing
   generally — that is a change from the PDFs, and it is deliberate: 3,000 aggregators with
   blanket access to every artist's cost base is a leak waiting to happen. Show them the
   customer price, their advance, and their incentive; reveal the artist price only once they
   have skin in the game, if at all. **Raise this with the business (§4.4 adjacent).**
4. **CI contract test:** assert that the customer-facing artwork response body, serialised,
   contains no key matching `/artist_price|private_price|cost/i`. Run on every commit. This
   test failing blocks merge.
5. Same discipline for buyer PII: an aggregator sees buyer details only for **their own**
   recorded sales, and only until delivery is confirmed + dispute window closes.

Authorisation is **policy-based (CASL or equivalent), evaluated server-side against Postgres**,
never from Firebase custom claims.

---

## 9. Money flows — exact ledger postings

Every flow below is a single `ledger_transaction` with an idempotency key.

**A. Aggregator pays advance** (`ADV:{consignment_id}`)
```
Dr gateway_clearing                     advance
   Cr aggregator_deposit[aggregator]    advance      -- liability, NOT revenue
```

**B. Customer payment captured** (`ORD:{order_id}`)
```
Dr gateway_clearing                     total (price + gst + delivery)
   Cr artist_payable[artist]            artist_price
   Cr distributor_incentive_payable[agg] incentive     (aggregator channel only)
   Cr platform_revenue                  platform_margin
   Cr gst_payable                       gst
   Cr refunds_payable / logistics       delivery
```

**C. Delivery confirmed → settlement initiated** (`STL:{settlement_id}`)
```
Dr artist_payable[artist]               artist_price
   Cr tds_payable                       tds (if §4.2 applies)
   Cr gateway_clearing                  net_to_artist

Dr distributor_incentive_payable[agg]   incentive
Dr aggregator_deposit[agg]              advance          -- refund of deposit
   Cr gateway_clearing                  net_to_aggregator
```

**D. Refund / dispute resolved in buyer's favour** — reversing entries against B, never edits.

**E. Aging reduction** — no ledger posting. Price change only, recorded in
`artwork_status_events` with before/after prices.

**Idempotency is mandatory on every money endpoint and every webhook.** Razorpay retries
webhooks; a non-idempotent handler double-settles an artist. Key on the gateway event ID,
store it in Redis **and** as `ledger_transactions.idempotency_key`.

---

## 10. Razorpay integration

- **Route** for split settlement. Artists and aggregators are onboarded as **linked accounts**
  with their own KYC. Transfers are defined at order creation and executed on capture.
- Start the **marketplace/Route onboarding paperwork in Phase 1.** It takes 3–6 weeks with
  the payment aggregator and is a common project-blocker. Do not discover this in week 10.
- **RazorpayX Payouts** for settlements. Fund accounts created after penny-drop verification.
- **Webhooks:** `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`,
  `transfer.processed`, `payout.processed`, `payout.reversed`, `payout.failed`.
  Verify `X-Razorpay-Signature` on every webhook — **reject unsigned requests, always.**
- Persist the raw webhook payload before processing. Process asynchronously via Cloud Tasks.
- **Never trust client-reported payment success.** Order state advances on verified webhook
  or on server-side payment fetch, never on a frontend callback.
- **Artist subscription must be sold on the web only.** Sell it in the Flutter app and Apple
  and Google take 30% of it under their in-app purchase rules.

---

## 11. KYC / DigiLocker

Build behind an interface so the vendor is swappable:

```ts
interface KycProvider {
  initiateDigilocker(userId: string, purpose: KycPurpose): Promise<{ redirectUrl, refId }>;
  fetchDigilockerDocuments(refId: string): Promise<KycDocumentSet>;
  verifyPan(pan: string, name: string): Promise<PanVerification>;
  verifyGstin(gstin: string): Promise<GstinVerification>;
  pennyDrop(account: string, ifsc: string, name: string): Promise<BankVerification>;
}
```

**Data handling rules — these are legal requirements, not preferences:**
- **Never store the full Aadhaar number.** Store the verification result, the last 4 digits,
  a reference ID, and a hash. The aggregator's response will contain more than you may keep —
  **strip it in the adapter, before it reaches your database.**
- Never store Aadhaar biometric or full eKYC XML.
- Store KYC documents in a **separate, restricted GCS bucket** with CMEK, no public access,
  signed URLs valid ≤5 minutes, and every access written to `audit_log`.
- Under the DPDP Act: capture a consent record (purpose, timestamp, version of the notice),
  implement retention limits, and build erasure/export endpoints from the start.
- Verification tiers: **Artist** = PAN + bank penny-drop + DigiLocker identity.
  **Aggregator** = the above + GSTIN + business proof + address.

---

## 12. NFC / QR authenticity — do this properly or don't ship it

**A tag holding a static URL is not an authenticity feature.** Anyone with a ₹30 blank tag
clones it in ten seconds, and the provenance claim that is your entire product becomes
theatre.

**Use NTAG 424 DNA with SUN (Secure Unique NFC) message authentication.** The chip holds an
AES key and appends a rotating read counter plus a CMAC to the URL on every tap:

```
https://v.artvault.in/AV000123?picc=<enc>&cmac=<mac>
```

Server-side verification:
1. Look up the tag by artwork/product ID.
2. Decrypt the PICC data and verify the CMAC using the key **in Cloud KMS** (the key never
   leaves KMS and is never in application memory or the database).
3. Assert the counter is **strictly greater** than `nfc_tags.last_counter` — a replayed or
   cloned tag fails here.
4. Write a `tag_scan_events` row with the verdict. Update `last_counter`.
5. Return a public provenance page: title, artist, product ID, current ownership status,
   COA reference, scan count. **Never** the artist price, the owner's contact details, or
   the owner's address.

Why this matters practically: because SUN delivers an NDEF URL, **any** phone opens it in a
browser with no app install and no iOS NFC entitlement fight. Reserve the Flutter app's NFC
module for **provisioning** tags at admin (Android only, which is fine for internal use).

Rate-limit `v.artvault.in` aggressively at Cloudflare — it is unauthenticated and public.
Print a QR fallback encoding the same verification URL for phones without NFC.

---

## 13. Background jobs

| Job | Trigger | Idempotent? |
|---|---|---|
| Consignment window sweep (warn at T-5, expire at T+0, apply reduction) | Cloud Scheduler, hourly | Yes — keyed on `consignment_id` + `window_expires_at` |
| Settlement initiation for delivered orders | Scheduler, hourly | Yes — keyed on `settlement_id` |
| Payout dispatch + status reconciliation | Scheduler, every 15 min | Yes |
| Razorpay webhook processing | Cloud Tasks | Yes — keyed on event ID |
| **Daily ledger reconciliation** (ledger vs Razorpay settlement report; alert on any variance) | Scheduler, daily 02:00 IST | Yes |
| COA + invoice PDF generation | Cloud Tasks on delivery confirmation | Yes |
| Image derivative generation | Cloud Tasks on upload | Yes |
| Reserved-artwork TTL release | Scheduler, every 5 min | Yes |
| Subscription renewal / lapse | Scheduler, daily | Yes |
| Notification outbox flush | Cloud Tasks | Yes |

The daily reconciliation job is not optional. It is how you find out you have a problem
before an artist does.

---

## 14. Security baseline

- Firebase ID token verified on every request; internal session context loaded from Postgres.
- Rate limiting at Cloudflare **and** in-app (Redis token bucket) on auth, OTP, checkout,
  and tag verification.
- All input validated with **Zod at the controller boundary**. Reject unknown keys.
- Cloud SQL on **private IP** only, reached via the Cloud SQL connector. No public IP, ever.
- Secrets in Secret Manager, injected at runtime. Nothing sensitive in the repo or image.
- PII columns (bank account, phone) encrypted at the application layer with a KMS-backed key,
  in addition to disk encryption.
- Signed URLs for all media; the originals bucket is **never** public.
- CORS allowlist: the web origin and the app's known origins only.
- Dependabot + `npm audit` in CI; container image scanning in Artifact Registry.
- Admin actions require re-authentication for destructive operations (recall, settlement
  adjustment, price override) and are all in `audit_log`.
- Penetration test before public launch. Budget for it.

---

## 15. Environments

`local` (Docker Compose: Postgres, Redis, Firebase emulators, Razorpay test keys) →
`staging` (full GCP mirror, Razorpay test mode, synthetic data) →
`production` (`asia-south1`, HA Cloud SQL, PITR enabled, daily backups, 30-day retention).

**Restore drill before launch:** actually restore a production backup into a scratch instance
and verify the ledger balances. A backup you have never restored is not a backup.

---

## 16. Build phases

Each phase ends with a checkpoint. Do not start the next until §17 passes.

**Phase 0 — Foundations (week 1)**
Monorepo, Terraform for GCP, Cloud SQL, Cloud Run skeleton, CI/CD, Firebase project,
Cloudflare DNS delegated from GoDaddy, Sentry, structured logging, health checks.
Resolve §4.1, §4.6. **Start Razorpay Route onboarding paperwork today.**

**Phase 1 — Identity & domain core (weeks 2–3)**
Users, roles, profiles, addresses. Firebase token verification + authorisation policies.
`packages/domain`: pricing engine, state machine, ledger primitives — **pure, fully unit
tested, no I/O.** Artwork listing, media upload, product ID sequence, status events.

**Phase 2 — Money (weeks 4–6)**
Ledger tables + balance constraint trigger. Razorpay Route integration, webhook pipeline,
idempotency infrastructure. Marketplace checkout end to end. Invoicing. GST computation with
place-of-supply logic. Refunds. **Nothing after this phase ships until the ledger balances in
an automated test.**

**Phase 3 — Consignment & aggregator (weeks 7–8)**
Aggregator KYC, consignment lifecycle, advance capture, 30-day window job, aging reduction
with floor + transfer cap, record-sale flow, custody liability, recall. Aggregator read-only
balance view (not a wallet).

**Phase 4 — Settlement & payouts (weeks 9–10)**
Settlement engine, TDS/TCS accruals, RazorpayX payouts, reconciliation job, finance reports,
artist and aggregator statements.

**Phase 5 — Trust layer (weeks 11–12)**
KYC/DigiLocker completion, 3-tier verification, NTAG 424 DNA provisioning + SUN verification
endpoint, COA generation, QR fallback, disputes, resale flow with royalty accrual hook.

**Phase 6 — Hardening (weeks 13–14)**
Load test (target: 10× the honest estimate in §2 — that is still small), chaos on webhook
retries, restore drill, penetration test, runbooks, admin tooling, launch checklist.

**Realistic total: 14 weeks with 2–3 competent backend engineers.** The original PDF's
four-week, five-portal, all-platforms plan is not achievable — Week 3 of that plan alone
contains a full quarter of engineering. If a vendor is holding to four weeks, the `AV001`
product IDs inside the Galleryzone document tell you why: the spec was recycled.

---

## 17. Definition of Done — applies to every phase

A phase is not complete until **all** of these hold:

1. **Ledger integrity test:** a property-based test runs 1,000 randomised transaction
   sequences (sales, refunds, aging, recalls, disputes) and asserts that every
   `ledger_transaction` sums to zero and that no account that should be non-negative goes
   negative.
2. **Price-leak test:** the CI contract test in §8.4 passes.
3. **Idempotency test:** every money endpoint and webhook handler, invoked 3× with the same
   key, produces exactly one ledger transaction.
4. **State-machine test:** every illegal transition is rejected; a full happy-path lifecycle
   from `draft` to `closed` produces a coherent `ownership_events` chain.
5. **Immutability test:** `UPDATE` and `DELETE` against `ledger_entries`,
   `ownership_events` and `artwork_status_events` raise a database exception.
6. **Reconciliation test:** the daily job detects a deliberately injected ₹1 discrepancy.
7. Migrations run forward cleanly on a copy of staging data.
8. Every new endpoint appears in the generated OpenAPI spec consumed by the Next.js and
   Flutter clients.
9. No secrets, no hardcoded rates, no floats in money paths (enforce with an ESLint rule
   banning `number` arithmetic in `packages/domain` money types).

---

## 18. Conventions

- Money: `BIGINT` paise, `Money` branded type in TS. Rounding: `ROUND_HALF_UP`, applied once
  at the final computed figure, never at intermediate steps.
- Time: UTC in the DB, IST for display. Business-day calculations use a
  `holidays` table, not a hardcoded weekend check.
- API: REST, `/v1/`, plural nouns, cursor pagination. `POST /v1/orders` returns `201` with a
  `Location` header. Errors follow RFC 7807 with a stable machine-readable `code`.
- Every request carries a `X-Request-Id`, propagated to logs, traces and `audit_log`.
- Migrations are forward-only, reviewed, and never edited after merge.
- Feature flags in `packages/config`, evaluated server-side.

---

## 19. Known open risks (track these, do not let them go quiet)

| Risk | Impact | Owner |
|---|---|---|
| Aggregator incentive ≈4.6% may not attract galleries (§4.4) | Invalidates the entire aggregator channel | Business |
| Razorpay Route marketplace onboarding delay (3–6 weeks) | Blocks Phase 2 | Eng lead — start in Phase 0 |
| GST/HSN rate unconfirmed (§4.1) | Wrong invoices, wrong margins, restatement risk | Finance |
| Customer acquisition cost appears nowhere in any planning document | Art is low-frequency and high-consideration; CAC may exceed unit margin entirely | Business |
| Copyright assignment as originally drafted is unenforceable (§3.11) | Legal exposure + repels supply side | Legal |
| Resale royalty s.53A obligation on the resale feature (§4.5) | Statutory liability | Legal |
| IRDAI exposure if any insurance commission is earned (§4.7) | Regulatory | Legal |
| DPDP consent, retention and erasure obligations | Regulatory | Eng + Legal |

---

*End of master plan. Update this file — do not fork it into a second version. Every
contradiction between documents costs an engineering week to rediscover.*