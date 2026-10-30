# Security review & residual risks — 2026-10-30

Scope: code review of `backend/` (NestJS API, Firestore), `frontend-web/` (Next.js 16) and `mobile/` (Flutter), plus a read-only check of the live Firebase project. **Not done:** penetration testing against a running system, DAST, Railway/Vercel edge configuration, or the Razorpay/Cashfree dashboards. No system is "hack-proof". This records what was found, what was fixed, and what risk remains.

Severity: P0 money or identity loss now · P1 exploitable by a normal account · P2 needs effort or insider · P3 hardening.

## Fixed (verified by checks run twice; see "Evidence")

| # | Sev | Finding | Fix |
|---|---|---|---|
| S1 | P0 | **The artist was paid the live price, not the price the buyer paid.** An artist could raise the price while an order was pending, and `markOrderPaid` credited the new figure. | Orders snapshot `artistId` + `artistPricePaise`; settlement uses the snapshot (`checkout.ts settlementPricingOf`). Older orders fall back to the live price. |
| S2 | P0 | Every buyer was shown a **placeholder bank account** at checkout (web + mobile). | Removed from customer checkout. |
| S3 | P0 | Admin GST/KYC approve/reject URLs returned 404 (no decisions possible). | URLs fixed. `check:client-routes` now fails CI on any client→API route drift. |
| S4 | P1 | **Anyone signed in could order the physical certificate of any artwork**, posted to their own address. Doing so also blocked the real owner. | Only the current owner may request it (`coa.ts`). |
| S5 | P1 | **A transfer could be accepted by whoever registered the invited email first.** The transfer id is public on `/verify`, and email verification was never checked. | Accepting needs a verified email (token `email_verified`). |
| S6 | P1 | `platform_admin` could mark any order paid with live payments on. | The simulate route is closed in `razorpay` mode for everyone. |
| S7 | P1 | Admin `PATCH /orders/:id/status {to:"paid"}` marked orders paid with no ledger entry and no title move. | "paid" is refused there; only a verified payment sets it. |
| S8 | P1 | The aggregator bank form never saved the account number. | Fixed. |
| S9 | P2 | Aggregators could reserve `marketplace_only` pieces, and buyers could buy `aggregator_only` pieces. | Enforced on reservation, intent finalize (with refund) and checkout. |
| S10 | P2 | Ownership could be transferred while a piece was listed or with a gallery. The later sale then took title from the new owner while paying the old one. | Refused while the status is marketplace, reserved or with_aggregator. |
| S11 | P2 | Withdrawals never checked KYC, although the product copy says KYC gates payouts. | KYC is required at request **and** at approval (artist and aggregator). |
| S12 | P2 | A holding return and a holding sale sent together refunded the hold twice. | A transactional claim (`holding-claim.ts`) lets a holding close one way only. |
| S13 | P2 | Billed Cashfree verification calls and registration (which sends a branded email) were limited only by the global throttle. | Per-route limits: 3/min, 10/h (verification); 3/min, 20/h (register). |
| S14 | P2 | The read cache was unbounded, so random public ids could exhaust memory. | Capped at 5,000 entries. |
| S15 | P2 | The website sent no anti-framing or nosniff headers (clickjacking of admin and checkout pages). | `frame-ancestors 'self'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS. |
| S16 | P3 | The API sent no security headers. | `nosniff`, `X-Frame-Options: DENY`, `no-referrer`, HSTS, CORP. |
| S17 | P3 | `%2F` in a path id reached Firestore sub-collection paths. | A global pipe refuses params containing `/` or longer than 200 chars. |
| S18 | P3 | The Amazon lookup followed redirects before checking the host (blind SSRF). | Redirects are followed manually; every hop is allow-listed before it is fetched. |
| S19 | P3 | A replayed or late Cashfree DigiLocker event could overwrite a newer outcome. | The signed event timestamp is stored; older events are ignored. |
| S20 | P2 | A second GST/KYC rejection inside 24h was silently not emailed, and the applicant never saw the reason. | The reason is stored on the profile and shown in the UI; each decision has its own email key. |
| S21 | P1 | The mobile app could ship in mock mode, where any password logs in. | A release build with `GZ_MOCK` refuses to start. |
| S22 | — | Production dependencies had critical/high CVEs: `proxy-addr`, `@sentry/nextjs`, `multer`, `body-parser`, `qs` and others. | `npm audit fix` plus pinned patched versions inside the current majors (`overrides`); `shadcn` CLI moved to devDependencies. |

## Open — needs a business decision (see DECISIONS_NEEDED.md)

| # | Sev | Finding | Why it isn't fixed yet |
|---|---|---|---|
| O-A | **P1** | **Aggregator sales credit the artist before any money is proven.** `POST holdings/:id/sale` books escrow and credits artist and aggregator immediately. `direct_to_galleryzone` has no check that money arrived; `remit {via:"bank"}` is self-declared. A colluding aggregator and artist can turn a fake sale into a withdrawal. | Fixing it means changing when money is credited: hold credits until an admin confirms the remittance, or require Razorpay for gallery sales. That is a flow decision (D18). Until then, **admins should cross-check remittances before approving artist withdrawals tied to gallery sales.** |
| O-B | P2 | A collector can mark their own resale listing "sold" for any price and credit `customer_wallet`. That is harmless today, because the wallet has no spend or withdraw route, but it becomes P0 the day it does. | Who completes a resale (buyer payment? admin?) is undefined (D19). |
| O-C | P1 | Bank account numbers are stored in plaintext in `bankAccountEncrypted`. | Needs KMS and Blaze billing (D10/D11). |
| O-D | P2 | Firestore is on Spark with no backups or PITR. Data loss is unrecoverable. | Billing decision (D10). |

## Accepted residual risks (documented, not fixed)

- **Dependencies needing major upgrades:** `zod` 3→4 (memory DoS on oversized collections; mitigated by body-size limits), `@nestjs/core` 10→11 (moderate), `uuid` (affected API not used), `file-type` (moderate DoS in a parser not reached by uploads), and `@grpc/grpc-js` in the Firebase web SDK (no upstream fix; server-side only). Plan the Nest 11 / zod 4 migration as its own PR with full regression.
- **Races (P3):** two parallel withdrawal requests can both pass the balance check, and approval re-checks outside the ledger transaction. Two aggregators can both reserve the same piece in a narrow window. Move both checks inside the posting transaction in a follow-up.
- **Password-reset email bombing** with rotating IPs (per-IP throttle only). Add a per-email cooldown.
- **Sold-elsewhere fee:** inside the 7-day edit window an artist can lower the price before declaring "sold elsewhere" and shrink the penalty. Snapshot the price at approval if this matters.
- **Account status `pending`** is never enforced and nothing sets `active`. Suspended and blocked users are refused.
- **Firestore read rules** use custom claims that the API never sets. Clients don't read Firestore directly today, so the impact is nil until they do.

## Verified OK (no change needed)

- **Webhooks.** Razorpay HMAC is checked over the raw body with a constant-time compare, the amount is re-checked, and settlement is idempotent. Failure emails are deduped per order. The ShipRocket token uses `timingSafeEqual`.
- **Uploads.** jpeg/png/webp allowlist; size checked at presign and confirm; no SVG/HTML; served with `nosniff`; no path traversal.
- **Web XSS.** The only `dangerouslySetInnerHTML` is DOMPurify-sanitised; blogs render as text; the `?next=` redirect is guarded; email templates escape user data.
- **Sentry and logging.** `sendDefaultPii:false`. No tokens, bank, Aadhaar or GSTIN in logs; Aadhaar is masked at write time.
- **Mobile.** Tokens in `flutter_secure_storage`; no cleartext traffic, no `debuggable`, no ATS exceptions; only the launcher activity is exported.
- **Mass assignment and roles.** Every body schema traced is `.strict()`; self-registration can't pick admin; bootstrap can't change role; rate config is platform_admin-only with no self-approval.
- **Firebase.** Deployed rules equal the repo and deny all client writes; 10/10 indexes READY.

## Evidence

All checks below were run twice on the same tree, with the same result both times:
- **Backend:** `npm run check`, 31 steps, including `check:checkout`, `check:moderation`, `check:verification`, `check:notifications`, `check:holding-claim`, `check:route-param`, `check:client-routes` (0 drift), `tsc -b` and the API build.
- **Web:** `next build` clean.
- **Mobile:** `flutter analyze` (no issues) and `flutter test` (739 passing).

Each new money and security check was also confirmed to **fail against the old code** where that was practical (`moderation`, `client-routes`).

The Playwright functional suite (stubbed API) is **not** counted as evidence. It was already unreliable before these changes: 49 of 129 failed on the untouched code and 41 with the changes, a different set each run. Every test that failed only with the changes passed twice in isolation. See `FINAL_STATUS_2026-10-30.md` §5.
