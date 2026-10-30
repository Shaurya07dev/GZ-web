# Repository audit — Milestone 0 (2026-10-30)

Status key: NOT STARTED / IN PROGRESS / VERIFIED / BLOCKED. VERIFIED = code evidence + a check that passed twice.

## Baseline

| Item | Value |
|---|---|
| Repo / branch | `Shaurya07dev/GZ-web`, `main` @ `c2a2318` (2026-10-28). The master spec names `Mouriyan-gandhi/GalleryZone`, which is not this checkout. |
| Web | Next.js 16.3, React 19.2, firebase 12.19, react-joyride 3.2 |
| API | NestJS 10.4, firebase-admin 13 (Firestore), Node 24 locally / 22 in CI |
| Mobile | Flutter (Dart ^3.13), Riverpod 3.4, go_router 17.5, flutter_nfc_kit 3.7 |
| Firebase project | `galleryzone-prod` (`backend/.firebaserc`, `.env`). Account identity **not verified** (see Blockers). |
| Live API | `https://gz-web-production.up.railway.app` (health 200). `api-production-9fd9.up.railway.app`, which docs give as the webhook host, answers "Application not found". |

### Baseline commands

| Command | Result |
|---|---|
| `backend: npm ci && npm run check` | PASS ×2 before changes, PASS ×2 after (23 checks + tsc + API build) |
| `frontend-web: npm ci` | **FAIL**: lockfile out of sync (`@emnapi/runtime`, `@emnapi/core` missing). Fixed locally with `npm install`; lockfile diff pending review. |
| `frontend-web: npm run build` | PASS (3 clean builds: one Turbopack Google-font resolve error, unrelated and not reproduced; two passes) |
| `frontend-web: playwright tests/smoke` (chromium) | 2/2 assertions pass. The full-page evidence screenshot flakes ~1 in 4 with `Page.captureScreenshot` (pre-existing). |
| `mobile: flutter analyze / test` | **BLOCKED**: Flutter SDK not installed on this machine |

## Fixed in this milestone

| # | Sev | Finding | Fix | Evidence |
|---|---|---|---|---|
| F1 | P0 | Admin GST **and** KYC approve/reject posted to `/v1/moderation/...`; the controller is `/v1/admin/moderation/...` (`moderation.controller.ts:18`). Every decision returned 404. | `frontend-web/services/adminApi.ts` decide URLs | New `check:client-routes` flags the old URLs and passes the new ones |
| F2 | P0 | Every web and mobile buyer was shown a **placeholder bank account** (`lib/payee.ts`, "Placeholder values until the real account is handed over") as "Pay GalleryZone directly" under the Razorpay button | Removed `PayeeDetails` from `checkout-confirm-step.tsx` and from both mobile checkout steps | web build ×2; mobile not compiled (Flutter missing) |
| F3 | P1 | `POST /v1/orders/:id/simulate-payment` let a `platform_admin` mark **any** order paid even with `PAYMENTS_MODE=razorpay` | The mode check now applies to every caller (`orders.controller.ts`) | tsc + API build ×2 |
| F4 | P1 | The aggregator bank form sent `bankAccountMasked`, which the service drops, so the account number was never saved; it still showed "Bank details updated" | `features/aggregator/profile-form.tsx` sends `bankAccountNumber`; the server validates 9–18 digits and mails a bank-change alert | web build ×2 |
| F5 | P2 | Client/server route drift had no guard | `backend/scripts/client-routes.check.mjs` in `npm run check`; CI now triggers on `frontend-web/**` and `mobile/lib/**` | 255 calls vs 181 controller routes, PASS ×2 |

## Open findings (ranked)

| # | Sev | Finding | Needs |
|---|---|---|---|
| O1 | P0 | **Checkout charges a flat ₹25 delivery.** The live rate config `STv4fmpNKMgOeartydNx` has `deliveryChargePaise: 2500`, a legacy rupee value read as paise (`pricing.ts:210-213`). Zone rates are rupee-scaled too. No ShipRocket quote exists: the client only has `/auth/login` and `/orders/create/adhoc` (`apps/api/src/shiprocket.ts`). The quote endpoint takes the artwork id only, not the address. | Decision + ShipRocket creds (see report) |
| O2 | P0 | Razorpay and Cashfree webhooks are documented at the dead `api-production-9fd9` host. If the dashboards still point there, paid orders whose tab closes never confirm. | Check Razorpay/Cashfree dashboards |
| O3 | P0 | The aggregator remittance screens still show the placeholder account (`settlements-table.tsx:248`, mobile `aggregator_finance_screens.dart:426`, `holding_dialogs.dart:905`) | Real collection account, or remove |
| O4 | P1 | The payout bank account is stored in plaintext in a field named `bankAccountEncrypted` (`packages/db/src/profiles.ts:203`) | Encryption design (KMS / envelope) |
| O5 | P1 | Commission slab basis is the **previous calendar month in UTC** (`aggregator-commission.ts:22-26`) from `aggregatorSales.soldAt`, with **no refund/cancel filter**. Marketplace orders are excluded. Slabs: 20% ≤ ₹10L, 35% > ₹10L, 50% > ₹50L, applied to the markup. | Business rule: month basis, IST vs UTC, refund handling |
| O6 | P1 | Mobile can ship mock mode: `GZ_MOCK` has no `kReleaseMode` guard, and mock login accepts any password (`mock_auth_repository.dart:8`) | Phase C |
| O7 | P2 | The GST rejection reason is stored only in the audit log, not on the profile, so the applicant view can't show it. The reject email is idempotency-keyed per user for 24h, so a second rejection inside 24h is silent. | Phase B6 |
| O8 | P2 | Mobile collector wallet calls `GET /v1/customer/wallet`, which does not exist (tracked in `KNOWN_DRIFT`) | Phase C |
| O9 | P2 | Firestore read rules use custom claims (`role`, `grants`); the API uses the Firestore `users` doc. Claims may not be set. | Phase D |
| O10 | P2 | No cart (single-artwork orders), no Excel exports, no notifications feed (the bell is a permanent empty state), no persisted tour completion (localStorage, unversioned, no replay), no admin tour, no mobile Google Sign-In | Phase B/C features |
| O11 | P2 | Categories are a free string. The upload list is hardcoded (6 values); the admin `categories` collection is unused; browse labels are `humanize()`d and differ from upload labels. The spec's "four categories" do not exist in code. | Business: which taxonomy |
| O12 | P3 | Amazon CTAs read "View on Amazon" / "Buy on Amazon"; "Shop on Amazon" does not exist. The affiliate disclosure is present. | Confirm label scope |
| O13 | P3 | `artworkDelisted` email is defined and never sent. `payment.failed` re-mails on every webhook redelivery. | Phase B9 |

## Blockers

- ~~Firebase identity~~ **VERIFIED 2026-10-30** with a CI token. Google tokeninfo shows `galleryzone5@gmail.com` (verified), role `roles/editor` on `galleryzone-prod`; owner is `shaurya8851@gmail.com`. Deployed rules match the repo; 10/10 indexes are READY. Billing is **disabled** (Spark). PITR, delete protection and backups are off. Only the web app is registered. See `DECISIONS_NEEDED.md` D10.
- **Admin SDK**: the `.env` names `galleryzone-prod-firebase-adminsdk-fbsvc-bc0f29a089.json`, which is not on this machine, so the local API cannot reach Firestore and no end-to-end API test can run.
- **ShipRocket**: no `SHIPROCKET_*` values provided.
- **Razorpay**: only **live** keys were provided. No test-mode key, so no sandbox payment test.
- **Flutter SDK**: not installed. Mobile analyze/test/build is blocked.
