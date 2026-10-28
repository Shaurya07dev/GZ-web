# GalleryZone mobile parity and Google Play readiness

Date: 25 October 2026  
Branch: `feat/legal-update-oct2026`  
Recorded HEAD before this uncommitted work: `fa13585`  
Android application ID: `in.galleryzone.app`  
App version in source: `1.0.0+1`

## Executive status

The Flutter app has been updated to the current GalleryZone product decisions and API contracts across the customer, artist, and aggregator experiences. The source now matches the website's current no-insurance, direct-reservation-payment, bank-settlement, MOU, COA/NFC, logistics, verification, content, and public-profile behavior.

This repository is **not yet ready for a production Google Play upload**. The source builds and the local automated gates pass, but a signed release AAB cannot be created without the private upload key. More importantly, several money, logistics, data-security, deletion, and live-credential gates remain. A local build is not evidence that Razorpay, ShipRocket, Cashfree, Firebase, email, production APIs, or payouts work in production.

No commit, push, deployment, Play Console upload, production credential change, database backfill, or external service mutation was performed.

## Baseline and latest recorded commits

The local branch started this implementation at:

- `fa13585` — MOU clause 42.4 insurer-name correction.
- `2115c3f` — insurance removed from the website.
- `2f7716b` — 22 October 2026 Artist and Aggregator MOUs published.
- `80f462e` — footer/social links and new Terms & Conditions.
- `a3d896d` — current `origin/main` baseline recorded locally.

All work described below is currently uncommitted. The working tree is intentionally broad because this was a whole-app parity update; Dart formatting also mechanically reformatted many existing Flutter files. Review the diff before creating commits.

## What is now aligned

### Shared business rules

- Canonical pricing, GST, GalleryZone markup, artist settlement, aggregator advance, and tiered aggregator commission rules are shared with backend behavior and covered by checks.
- Insurance was removed from artwork creation and public listing UI. Legacy fields remain only for backwards-compatible records and legal history.
- Subscription-plan and obsolete three-month copy was removed from current user-facing surfaces.
- Artist and aggregator MOUs, terms, privacy, FAQ, and company/legal content are aligned with the current web documents.
- Public artist profiles expose current social proof and verified status without leaking private profile data.

### Customer mobile

- Marketplace, search/filter/sort, artwork detail, artists directory/profile, blogs, art supplies, wishlist, checkout, order tracking, collection, resale listing, address book, profile/settings, support, COA/PDF, NFC status, passport, and ownership-transfer flows are present.
- The obsolete customer wallet page and withdrawal UI were removed. Approved refunds are described as returning to the original payment method.
- Resale is honestly seller-side only: listing and listing withdrawal work, but live buyer matching, secondary checkout, and seller payout are not represented as complete.
- Public privacy and account-deletion instructions are available without signing in.

### Artist mobile

- Dashboard, artwork CRUD/submission, exclusivity/listing type, certificates, passport data, postal validation, orders, settlement/earnings view, KYC, GST/Aadhaar status, bank details, MOU signing, blogs, gallery spaces, messages, analytics, network/deactivation, support, settings, and COA/NFC tools are aligned.
- Earnings are represented as a settlement ledger paid to the verified bank account; no manual wallet-withdrawal control is presented.
- Insurance controls and insurance badges were removed.

### Aggregator mobile

- Dashboard, browse/reserve, month-one pricing, GST/MOU gates, inventory/holding lifecycle, extension requests, issue reports, NFC, sale recording, customers, gallery spaces, analytics, messages, shipping, settlements, profile, GST/Aadhaar verification, MOU, support, and settings are aligned.
- Reservation advance plus delivery is paid per piece through the Razorpay reservation endpoint. There is no prepaid-wallet top-up UI.
- Earnings are read-only: owed, held, clearing, payout destination, transaction history, and GST details. There is no withdrawal request.
- Cash remittance UI now uses bank transfer only; the legacy “pay from wallet” control is removed.
- Inbound ShipRocket stage, carrier, and AWB are displayed when the backend has a real booking.

### Web corrections made during parity work

The audit found that the web contained stale wallet language despite comments declaring the wallet removed. The web reservation flow now calls the same direct Razorpay reservation-payment endpoints as mobile, its earnings view stays read-only, cash remittance is bank-only, and stale customer refund/resale copy was corrected. Browser coverage was updated accordingly.

### Android and Play package

- Main release manifest now has internet permission.
- Release signing fails closed when `android/key.properties` is absent or incomplete; it never falls back to a debug key.
- `android/key.properties.example` documents the required private signing fields.
- `flutter_nfc_kit` is updated for the current Flutter/AGP toolchain.
- Package description, Play listing text, release notes, Data Safety draft, app-access guidance, and release checklist are under `mobile/store/google-play/`.
- Public account-deletion page: `https://www.galleryzone.art/account-deletion`.
- Privacy page: `https://www.galleryzone.art/privacy`.
- Store text is within current limits: title 11/30, short description 60/80, full description 1788/4000, release notes 439/500 characters.
- Flutter uses its current Android defaults, which resolve to target/compile API 36 in this toolchain. Google Play's current target-API policy should be rechecked immediately before upload: <https://support.google.com/googleplay/android-developer/answer/11926878>.

## Integration truth table

| Area | Source state | Production evidence | Required before launch |
|---|---|---|---|
| Backend API | Contracts and 167 routes validate locally | None against deployed production | Deploy reviewed backend and run role-by-role smoke tests against the production URL |
| Firebase email/password auth | Real REST implementation exists | No production Android login proof in this run | Configure the production Firebase Android app, SHA fingerprints, authorized domains, email templates, and test sign-up/login/reset/deletion |
| Google sign-in | Not implemented | None | Either implement and test it or ensure no store/marketing copy promises it |
| Razorpay customer checkout | Checkout and server verification code exist | No live authorized payment/refund proof | Production keys, webhook, allow-listed domain/app flow, small live payment, cancellation, refund, duplicate-webhook, and reconciliation tests |
| Razorpay aggregator reservation | Web and mobile use the real reservation-payment endpoint | Locally tested with mocked Checkout.js and simulated backend mode only | Resolve the paid-before-reserve race and run authorized live payment/refund tests |
| Cashfree Secure ID / DigiLocker | Aadhaar/GST verification paths exist | No production credential/2FA/webhook proof | Production credentials, public key, webhook, IP/allow-list configuration, approved test identities, and failure/retry tests |
| ShipRocket | Configuration is fail-closed; no fake AWB is created | No production pickup/order/webhook proof | Complete outbound booking, configure production credentials/pickup/webhook, then verify label, pickup, tracking, cancellation, and NDR flows |
| Bank payouts | UI and settlement ledger exist | No payout provider or bank-file execution | Add a real payout adapter and reconciliation; never treat admin approval alone as money sent |
| Cash remittance | Aggregator can declare a bank transfer | No automated bank reconciliation | Add reference capture and reconciliation/approval controls |
| Resend/support email | Backend integration exists | No delivery/inbox proof | Configure sender/domain and prove delivery, bounce handling, and support ownership |
| Sentry | Client dependency/config exists | No production event proof | Configure production DSN/releases and send a controlled test event |
| NFC | Native package and app flows build; mock/device logic is tested | No physical-tag proof in this run | Test supported Android hardware and NTAG213 read/write/lock/recovery paths |

## Release-blocking product and security gaps

1. **Reservation payment race and refund:** the gateway payment is verified before the holding is created. If another aggregator wins the artwork between those steps, the payment can be credited internally without an automatic Razorpay refund. Make payment plus reservation an idempotent server workflow, bind the payment to the artwork/aggregator, and automatically refund or reconcile any allocation failure.

2. **Reservation refunds are not a real gateway refund flow:** returned/unsold advances are released in the internal ledger, but the current no-wallet product has no complete path that returns the money to the original Razorpay payment or safely applies it to a future reservation.

3. **ShipRocket is incomplete:** artist-to-aggregator inbound booking exists. Marketplace-to-buyer and aggregator-to-buyer outbound shipments are not automatically booked with ShipRocket. Some outbound statuses/references can be advanced manually, which is not the same as a courier booking.

4. **Payouts are ledger-only:** artist/aggregator settlement approval does not execute a bank transfer or RazorpayX payout. Customer withdrawal is not an active UI, and legacy withdrawal endpoints/admin screens should be retired or redesigned after the payout model is finalized.

5. **Bank-data protection:** a backend field named `bankAccountEncrypted` is currently populated with the raw account-number string. Add application-level encryption/KMS, access controls, key rotation, and a migration before production data is stored.

6. **Account deletion is operational, not automatic:** the app submits a support request and signs out; a public email route is documented. There is no verified deletion worker/SLA/audit trail spanning Firebase, database data, files, and processors. Google Play requires both an in-app path and a web deletion resource: <https://support.google.com/googleplay/android-developer/answer/13327111>.

7. **Secondary resale is incomplete:** seller listing and withdrawal exist, but buyer discovery/matching, checkout, ownership transfer on payment, refund/dispute handling, and seller payout are not end-to-end.

8. **Local-only features:** wishlist/follows and notification preferences are not fully synchronized to a user account; push notification delivery is not implemented.

9. **Public profile migration:** the supplied public-artist-profile backfill script has not been run against any production database.

10. **Live environments are unverified:** no production Firebase, Razorpay, Cashfree, ShipRocket, email, Sentry, database, domain, or webhook credentials were used in this run.

## Google Play owner-controlled blockers

- Create/provide the private Play upload keystore and `mobile/android/key.properties`; keep both out of Git.
- Confirm whether Play Console has already consumed version code `1`; increment `version: 1.0.0+1` if necessary.
- Accept Android SDK licenses with `flutter doctor --android-licenses`.
- Configure Play App Signing, upload/app-signing SHA-256 fingerprints in Firebase, and production `assetlinks.json` values.
- Export a final 512 x 512 icon, create a 1024 x 500 feature graphic, and capture at least two real phone screenshots. Current Play preview-asset rules: <https://support.google.com/googleplay/android-developer/answer/9866151>.
- Complete App content, privacy policy, ads declaration, content rating, target audience, reviewer access, and the Data Safety form from verified production behavior. Data Safety guidance: <https://support.google.com/googleplay/android-developer/answer/10787469>.
- Provide stable reviewer accounts for customer, artist, and aggregator roles without exposing production personal data.
- If this is a personal developer account created after 13 November 2023, complete the current closed-testing gate (at least 12 opted-in testers continuously for 14 days) before applying for production access: <https://support.google.com/googleplay/android-developer/answer/14151465>.
- Run device testing on low/mid/high Android phones, offline/poor-network cases, rotation, background/resume during payment, camera/file uploads, and physical NFC hardware.

## Validation completed on 25 October 2026

- `flutter analyze` — no issues.
- `flutter test` — **726 tests passed**.
- `flutter build apk --debug` — passed; artifact at `mobile/build/app/outputs/flutter-apk/app-debug.apk`.
- `flutter build appbundle --release` — intentionally blocked with the expected missing-private-keystore error. No release AAB was produced.
- `npm run check` in `backend` — passed, including pricing, payment signatures/mode, state machines, 7,000 randomized settlement checks, DTO/privacy checks, MOU, commissions, COA, NFC, marketplace/public profiles, policies, 167 unique API routes, ShipRocket configuration, TypeScript, and API build.
- `npm run lint` in `frontend-web` — 0 errors and 59 warnings. The warnings are non-blocking quality debt, including unused imports, image optimization, React Compiler compatibility notices, and one missing memo dependency.
- `npm run build` in `frontend-web` — passed; 92 routes generated.
- Chromium `aggregator-money.spec.ts` — **18/18 passed** serially. An initial eight-worker run timed out four navigation tests under local dev-server load; each and the whole suite passed with one worker.
- `git diff --check` — no whitespace errors; Git reported only Windows LF-to-CRLF notices.
- Google Play text-length validation — passed.
- `flutter doctor -v` — Flutter 3.47.0 / Dart 3.13.0; only Android license acceptance remains flagged.

## Exact release sequence after engineering blockers are closed

1. Complete and validate the payment/refund, payout/reconciliation, outbound ShipRocket, bank encryption, and deletion work above.
2. Deploy the reviewed backend and web release to production; verify privacy and deletion URLs publicly.
3. Configure production Firebase/Razorpay/Cashfree/ShipRocket/Resend/Sentry secrets outside Git.
4. Run authorized sandbox/live end-to-end tests and save transaction, webhook, shipment, payout, deletion, and NFC evidence.
5. Accept Android licenses and configure the private upload keystore from `mobile/android/key.properties.example`.
6. Set an unused version code in `mobile/pubspec.yaml`.
7. From `mobile/`, run:

   ```powershell
   flutter clean
   flutter pub get
   flutter analyze
   flutter test
   flutter build appbundle --release
   ```

8. Install/test the signed artifact through an internal Play track, then closed testing.
9. Complete Play listing graphics, App content, Data Safety, reviewer access, and staged rollout monitoring.

## Decision

The current code is a strong **local parity candidate**, not a production release. Do not upload it to a production Play track or advertise Razorpay/ShipRocket/payouts as fully live until every blocking item above has evidence from the deployed environment.
