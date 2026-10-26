# GalleryZone Android release checklist

Status recorded on 25 October 2026. Re-run every command and re-check every
external service immediately before upload.

## Code and bundle

- [x] Package ID is `in.galleryzone.app`.
- [x] Flutter 3.47 defaults used by this checkout compile and target API 36,
  meeting the 31 August 2026 new-app/update target requirement.
- [x] Release manifest declares Internet and optional NFC/camera hardware.
- [x] Release builds use R8 and resource shrinking.
- [x] A release task fails closed when the private upload keystore is missing,
  incomplete or points at a missing file.
- [ ] Confirm `version: 1.0.0+1` has never been uploaded to this Play app. Raise
  the build number if versionCode 1 already exists.
- [ ] Accept the outstanding Android SDK licences with
  `flutter doctor --android-licenses` on the release machine.
- [ ] Create/secure the upload keystore, copy `android/key.properties.example`
  to the ignored `android/key.properties`, and back the key up separately.
- [ ] Build `flutter build appbundle --release`; retain the AAB, mapping file,
  native debug symbols and SHA-256 checksums as release evidence.
- [ ] Install the Play-delivered build from an internal test track on physical
  Android devices (NFC and non-NFC, compact and large screen, Android 10 and 16).

## Production services

- [ ] Deploy the reviewed backend with `NODE_ENV=production` and
  `PAYMENTS_MODE=razorpay`; confirm the simulated-payment endpoint is refused.
- [ ] Configure Razorpay live key/secret and the separate webhook secret; make
  a low-value live physical-goods payment, webhook, cancellation and refund
  test using an authorised test product/account.
- [ ] Configure Cashfree Secure ID production credentials plus its 2FA public
  key or allow-listed static egress IP; verify GSTIN and DigiLocker callback.
- [ ] Configure ShipRocket production credentials, pickup-location nickname
  and webhook token; prove booking, AWB, all four tracking stages and a failed
  booking. Demo tracking must never be presented as a live shipment.
- [ ] Configure Firebase production authentication and authorised domains;
  prove registration, email verification, reset, refresh and account closure.
- [ ] Configure object storage, Resend, Sentry, CORS, public API/site URLs and
  the GalleryZone MOU signatory.
- [ ] Run the public-profile backfill first in dry-run, review counts, then run
  with `--apply` against the intended environment.
- [ ] Implement and prove a real payout provider/bank reconciliation. Current
  withdrawal approval posts ledger entries but does not send money.
- [ ] Encrypt full payout account numbers at application level and migrate any
  legacy financial records before treating payouts as production-ready.
- [ ] Resolve captured Razorpay reservation payments that lose the reservation
  race with an automatic, idempotent gateway refund.

## Web and policy surfaces

- [ ] Deploy and open `https://www.galleryzone.art/privacy` without login.
- [ ] Deploy and open `https://www.galleryzone.art/account-deletion` without
  login, then complete a real deletion request and verify associated data is
  removed/de-identified according to policy.
- [ ] Publish `/.well-known/assetlinks.json` using the Play App Signing SHA-256
  fingerprint, then verify a `/verify/<id>` link opens the installed app.
- [ ] Have legal/finance owners approve the privacy policy, Terms, Artist MOU,
  Aggregator MOU, GST/TDS language, affiliate disclosure and retention periods.

## Play Console

- [ ] Complete Data safety using `DATA_SAFETY.md`, checking the final bundle's
  SDKs and provider contracts rather than copying blindly.
- [ ] Enter the privacy-policy and account-deletion URLs.
- [ ] Complete App access with durable reviewer accounts for customer, artist
  and aggregator flows; never commit those credentials.
- [ ] Complete content rating, ads declaration, target audience, government
  apps, financial features and physical-goods payment declarations.
- [ ] Confirm whether the developer account must complete Google's closed-test
  requirement before production access.
- [ ] Export an approved 512 x 512 Play icon, 1024 x 500 feature graphic and at
  least two real, redacted phone screenshots.
- [ ] Upload to internal testing first; review pre-launch report, automated
  device crashes, accessibility, bundle warnings and policy status.
- [ ] Obtain owner approval before promoting beyond testing. No upload or
  publication has been performed by this repository work.
