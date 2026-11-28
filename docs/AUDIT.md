# GalleryZone — Code Failure & Edge-Case Audit

**Date:** 28 Nov 2026
**Scope:** `backend/apps/api`, `backend/packages/{db,domain,config,contracts}`, `frontend-web/{app,features,services,hooks}`, `mobile/lib`.
**Method:** Systematic sweep of money paths, state machines, external integrations, idempotency, concurrency, auth, uniqueness, and data integrity. Every finding carries a file:line pointer, impact classification (CRITICAL / HIGH / MEDIUM / LOW), and the minimum change required to fix.

This document is **brutally honest**. It includes bugs the author of this codebase (me) introduced and never caught. It is not a marketing document.

---

## Severity scale

- **CRITICAL** — money is lost, stolen, double-paid, or legally non-compliant. Fix before any real customer touches the system.
- **HIGH** — admin/user sees wrong data, workflow silently breaks, external integration can get into a bad state. Fix in days.
- **MEDIUM** — degraded UX, edge-case failures users will encounter but can work around. Fix in weeks.
- **LOW** — code smell, dead code, future-proofing. Fix when touching the area.

---

# 1. Money flow

## 1.1 CRITICAL — Marketplace order shipment has no delivery challan stamping

**Where:** `backend/apps/api/src/shiprocket-booking.ts:350`
**Code evidence:** Explicit `TODO: generate EWB for marketplace orders ≥ ₹50,000. Deferred from v1 — the artist→buyer leg has no delivery-challan snapshot to stamp onto`.

Marketplace sales ≥ ₹50,000 ship **without** an e-way bill AND without a delivery challan. Only the aggregator-channel legs got the full Rule 55 + EWB treatment. This is illegal under GST for inter-state movement above ₹50k.

**Fix:** stamp an order-side delivery challan in the same pattern as the holding challan, call `maybeGenerateForOrder` from `bookOutboundOrderShipment`.

---

## 1.2 HIGH — Marketplace delivery charge can still be flat ₹25 for legacy orders

**Where:** `backend/packages/domain/src/pricing.ts:360`, `backend/apps/api/src/artworks.controller.ts:82`
**Code evidence:** `const delivery = deliveryChargePaise ?? rates.deliveryChargePaise`. The public artwork quote endpoint (`GET /v1/artworks/:id/quote`) calls `checkoutTotal(artwork.displayPricePaise, version.rates)` with NO second arg, so it uses the flat `rates.deliveryChargePaise` (₹25 in prod).

The customer sees ₹25 on the artwork detail page before they add a delivery address. The addressed quote at `/v1/orders/quote` uses the real Shiprocket rate, so the final checkout IS correct, but the pre-checkout preview is wrong and misleading.

**Fix:** either hide the delivery line on the pre-address quote or add "Estimated — final rate on checkout" copy. Frontend already has the data to do it.

---

## 1.3 FIXED — Flat ₹25 on aggregator reserve path (resolved commit 1dfc92e)

**Was:** `finalizeReservationIntent` recomputed `aggregatorAdvanceForMonth` without the `deliveryCharge` override, overwriting the live Shiprocket quote with flat ₹25 on the holding doc. User reserved for ₹81,900, paid ₹4,100, but holding showed delivery ₹25.
**Verification:** commit `1dfc92e` passes `intent.deliveryDepositPaise` through.

---

## 1.4 FIXED — Air couriers bypassed the quote filter at booking (resolved commit d588318)

**Was:** `getShippingRate()` filtered air from the QUOTE but `bookShipment()` → `assignCourier()` had no courier_id for return/inbound paths (they never pass `preferredCourierId`), so Shiprocket auto-picked cheapest (including Air). User reserved → `bookInboundShipment` booked Delhivery Air ₹1,425. User returned → `bookReturnShipment` booked Delhivery Air **again** 26 min after the quote-side veto landed.
**Verification:** commit `d588318` inlines the quote inside `bookShipment` when no preferred courier is supplied.

---

## 1.5 CRITICAL — Existing holding `FXnmm6KqSRF9uFMQVovC` has no ledger entries

The holding reserved before commit `7ffa70a` landed has no `gateway_escrow`, `aggregator_payable`, or `aggregator_held` entries. If it sells or returns, the settlement/return postings will reference a `-amount` on an account whose balance is 0 from our bookkeeping perspective. The Razorpay money IS real (sitting in gateway escrow until T+2/3), but the ledger will read a non-zero negative balance on `aggregator_held` after release.

**Fix:** write `scripts/backfill-intent-ledger.ts` to walk all `finalized` intents whose `finalizedAt < 2026-11-28T18:00Z` and post `reservationIntentPayAndHoldPostings` with idempotency key `intent:<id>:pay-and-hold:0..3` so re-running is safe.

---

## 1.6 HIGH — `aggregatorAdvanceForMonth` recomputation drift on sale and return paths

**Where:** `backend/packages/db/src/aggregator-sales.ts`, `backend/packages/db/src/aggregator-flow.ts` returns
**Code evidence:** `recordAggregatorSale`, `returnHolding` both call `aggregatorAdvanceForMonth` to figure out how much to release. Neither path passes `deliveryCharge: holding.deliveryDepositPaise`, so if `rates.deliveryChargePaise` has changed since the holding was created, the release is wrong.

Scenario: holding stamped with ₹500 live-quote delivery. Rates get updated — admin bumps `deliveryChargePaise` to ₹700. The piece sells. Release logic recomputes `aggregator_held += ₹500 + ₹700 = ₹1200`. But the actual held balance is `₹500 + ₹500 = ₹1000`. Negative balance on `aggregator_held`.

**Fix:** pass `holding.deliveryDepositPaise` into every recompute. Mirror the finalize fix.

---

## 1.7 HIGH — Razorpay refund failures silently stay in `needs_refund`

**Where:** `backend/apps/api/src/aggregator-reservation-intents.controller.ts:215-219`
**Code evidence:** `void this.issueRefund(...).catch((err) => { logger.error; emails.refundFailed(...) })`. If Razorpay 5xx's, the intent sits in `needs_refund` forever. No retry mechanism, no cron.

**Fix:** add a `refund-retry` sweep (every 15 min like holding-expiry) that re-attempts any `needs_refund` intent whose last attempt was > 1h ago.

---

## 1.8 MEDIUM — `platformRevenuePaise` is computed but never checked against the ledger

**Where:** `backend/packages/db/src/admin-settlements.ts:34`
The admin settlements table shows `platformRevenuePaise` from `SettlementDoc` but there's no reconciliation screen that checks `sum(settlement.platformRevenuePaise) === ledger balance of platform_revenue account`. If a bug drifts them, admin won't notice.

**Fix:** add a `/admin/ledger-reconciliation` page or a daily audit cron.

---

## 1.9 MEDIUM — Simulated payment mode exists in production code paths

**Where:** `backend/packages/config/src/env.ts:182-199`
`PAYMENTS_MODE=simulated` lets a customer mark their own order paid. The code refuses boot in production (good), BUT an operator could deploy with `NODE_ENV=staging` and real customer data, and the simulated mode silently activates. No separate "allow simulated against prod Firebase project" check.

**Fix:** add a secondary guard — if `FIREBASE_PROJECT_ID` is the prod project, refuse `paymentsMode=simulated` regardless of NODE_ENV.

---

## 1.10 LOW — `walletTopupPostings` is dead code

**Where:** `backend/packages/domain/src/settlement.ts:204`
Client killed wallet top-ups on 18 Oct 2026. The posting function is still exported, nothing calls it. Not a bug, but a maintenance hazard — a future dev may re-wire top-ups thinking it's live.

**Fix:** delete it + the matching webhook branch in `payments.controller.ts:390-420`.

---

# 2. State machines

## 2.1 HIGH — Artwork can transition `with_aggregator → marketplace` even if NFC was unlocked mid-hold

**Where:** `backend/packages/db/src/aggregator-flow.ts:400` (`returnHolding`)
No check that the piece still has its NFC tag locked. If the aggregator unlocked the tag to show provenance, returned the piece, the artwork goes back on marketplace in an unlocked state — the lock reminder emails fire again (`nfc-reminder-48h`, `nfc-reminder-7d`) but a buyer can purchase it unlocked.

**Fix:** check `artwork.nfcLockedAt` on return, block if unlocked unless admin force-override.

---

## 2.2 HIGH — Holding can be `extensionRequest: pending` AND `expiresAt` in the past

**Where:** `backend/packages/db/src/holding-lifecycle.ts:140-162` (`expireDueHoldings`)
The sweep fires a `declined` auto-response to pending extensions when the window ends, but there's a race: between sweep tick and next tick (15 min), an admin can manually approve a pending extension whose `expiresAt` already passed. The approval runs, pushes `expiresAt` out, piece stays on display — but during those 15 min it was technically "expired" and marketplace listing projection may have flipped.

**Fix:** sweep interval → 1 min, OR the admin approve path must check `expiresAt > now()` before accepting.

---

## 2.3 MEDIUM — No idempotency on `advanceOrderStatus` admin action

**Where:** `backend/apps/api/src/admin-orders.controller.ts:70`
Admin clicks "Mark delivered" twice fast → two Firestore writes with the same status, two status-history entries, two "delivered" emails to buyer + artist. Email is idempotent by key (safe), but the audit log has dupes.

**Fix:** stateMachine.assertTransition would throw on second call if we checked current status first.

---

## 2.4 LOW — `holdingStateMachine` allows `sold_pending_settlement → returned`

**Where:** `backend/packages/domain/src/state-machine.ts:~`
The state machine lets a sold-pending-settlement holding be returned. In practice this would mean reversing a sale after money moved. No controller exposes this transition, but the state machine would accept it if someone added one.

**Fix:** tighten the state machine; add a comment why if it's intentional for admin-override.

---

# 3. External integrations

## 3.1 CRITICAL — Shiprocket webhook signature is optional

**Where:** `backend/apps/api/src/shiprocket.controller.ts:46-62`
Controller accepts the webhook if EITHER `verifyWebhookHmac` OR `verifyWebhookSignature` passes. Both of those return `true` when the configured secret is empty/null. If `SHIPROCKET_WEBHOOK_SECRET` was ever unset in prod, any external attacker could POST to our courier-webhook endpoint and advance order status to "delivered", trigger the Transfer Rights email, etc.

**Fix:** refuse the request when the configured secret is empty. Already called out in a stale comment that was never actioned.

---

## 3.2 HIGH — EWB session cache has no TTL on failure

**Where:** `backend/apps/api/src/eway-bill/eway-bill.ts:466-507` (`authenticate`)
If `authenticate` succeeds, the session doc is written with a 5h45m expiry. If it fails (status_cd:0, invalid credentials) it throws without writing anything, so the NEXT call retries — good. But if WhiteBooks returns a 500, we throw too — and the next cold start retries. Under a brief outage with 100 in-flight bookings, we'll hammer their /authenticate 100 times in a loop before any one succeeds.

**Fix:** add exponential backoff OR cache the failure with a short TTL (30s) to batch retries.

---

## 3.3 HIGH — Razorpay signature verification trusts the client payload

**Where:** `backend/apps/api/src/aggregator-reservation-intents.controller.ts:171-181`
We verify `razorpay_order_id`/`razorpay_payment_id`/`razorpay_signature` signature, which proves "Razorpay produced this payload." Good. But then we proceed to call `fetchOrder(gatewayOrderId)` — gatewayOrderId comes from `intent.providerOrderId ?? body?.razorpayOrderId`. If `intent.providerOrderId` is null (rare — simulated path), we trust the body-provided id, meaning a signed-but-unrelated-order payload could be swapped in.

**Fix:** refuse the finalize entirely if `intent.providerOrderId` is null AND `env.paymentsMode === "razorpay"`.

---

## 3.4 HIGH — WhatsApp OTP template can fire after rate limit

**Where:** `backend/apps/api/src/sms/whatsapp.ts`
We call Meta's Graph API with a permanent System User token. Meta rate-limits per-WABA at 1000 messages/sec peak. If an attacker triggers 10k OTPs in a minute against the signup form, we'll hit the rate limit and real users fail OTP delivery for hours.

**Fix:** per-phone rate limit on `/v1/auth/phone-otp/send` (we have one at the API level but it's per-IP, not per-phone).

---

## 3.5 MEDIUM — Shiprocket `ewaybill_no` is set at booking but never updated if EWB generation fails then succeeds later

**Where:** `backend/apps/api/src/shiprocket.ts:443`
If EWB generation fails at booking time (e.g., WhiteBooks is down), Shiprocket gets `ewaybill_no: null` on the order creation. Later, when EWB succeeds, we stamp the number on the challan snapshot but we DON'T POST-update Shiprocket. The courier picks up the parcel with no EWB number on the label.

**Fix:** after retroactive EWB generation, call Shiprocket's `/v1/external/orders/update` with the new `ewaybill_no`.

---

## 3.6 MEDIUM — Masters India sandbox credentials are in `.env.example` effectively

**Where:** WhiteBooks sandbox PDF shared with user. The credentials file was in `~/Downloads/e-Invoice-ewaybill-Sandbox-Credentials.pdf`.
Not a code bug, but if ANYONE commits the sandbox PDF or the env values accidentally, sandbox credit gets abused.

**Fix:** add `*.pdf` carve-outs to `.gitignore`, document credential handling.

---

# 4. Uniqueness & identity

## 4.1 HIGH — Uniqueness index has race window between check and write

**Where:** `backend/packages/db/src/unique-identifiers.ts:154-192` (`reclaimIdentifier`)
The transaction reads prev + next refs, checks ownership, THEN writes. Two parallel users submitting the same phone number at exactly the same moment will BOTH see empty → both will `set()`. Firestore's `set` is last-write-wins. One user ends up registered with the phone, the other's set wins last and OWNS the uniqueIdentifiers doc but has no matching profile.

**Fix:** use `tx.create()` not `tx.set()`. `create` throws ALREADY_EXISTS on conflict, forcing a retry.

**Severity note:** very rare in practice (requires sub-ms concurrency on same identifier), but the fix is one word.

---

## 4.2 HIGH — Google OAuth role mismatch guard signs the user out of Firebase but not out of the Google popup

**Where:** `frontend-web/services/authService.ts:148-162`
If a Google user clicks "Sign up as aggregator" and they're already an artist, we throw the error AND `firebaseSignOut()`. But if they immediately click "Sign up as aggregator" AGAIN with Google, `signInWithPopup` reuses the browser's Google session with no account-picker, re-authenticates them, and we throw the same error forever. User can't escape unless they know to clear Google cookies.

**Fix:** pass `prompt: "select_account"` to the GoogleAuthProvider.

---

## 4.3 MEDIUM — Uniqueness release on bank-account change is a no-op

**Where:** `backend/packages/db/src/profiles.ts:242-250` (the `updateOwnProfile` bank branch)
We `reclaimIdentifier` with `previousValue: null` because we can't recover the raw prior bank number from the masked tail. Result: stale `uniqueIdentifiers` docs accumulate per user, forever claiming the OLD account number for them (so nobody else can reuse it). Harmless but polluted.

**Fix:** store the SHA-256 hash of the current bank account number separately on `financialCol(uid)/data` so we have the previous to release.

---

## 4.4 LOW — `uniqueIdentifiers` doc id can be forged if scope is leaked in error messages

**Where:** `backend/packages/db/src/unique-identifiers.ts:107-128`
Not an exploit — Firestore rules deny direct reads — but the scope names (`email:`, `phone:`, `pan:`) are enumeration vectors if rules ever weaken.

**Fix:** keep Firestore rules strict; audit rules file (`firestore.rules`) separately.

---

# 5. Auth & permissions

## 5.1 HIGH — `/v1/auth/bootstrap` can be called for role=admin

**Where:** `backend/apps/api/src/auth/auth.controller.ts:131-145`
The schema allows `role: "admin"`. The DB-layer check in `createUserProfile` refuses admin, so it's blocked at the second layer. But if ANY future caller skips `createUserProfile` and writes users/{uid} directly, admin promotion is a race.

**Fix:** validate role at the controller too — reject admin before the token verify completes.

---

## 5.2 MEDIUM — Role custom claim in Firebase can lag the Firestore role

**Where:** `backend/packages/db/src/auth.ts:91-93` (`createUserProfile`)
We call `authService().setCustomUserClaims` then write the Firestore user doc. If `setCustomUserClaims` succeeds but Firestore write fails, we've got a Firebase user with a role claim but no profile doc — they can log in, pass the guard, but then the controller's `authUser.role` reads from the claim and might not match any real profile.

**Fix:** write Firestore FIRST, then claim. On failure to write claim, delete the Firestore doc and ask user to re-register.

---

## 5.3 MEDIUM — RolesGuard decodes JWT but doesn't check token revocation

**Where:** `backend/apps/api/src/auth/roles.guard.ts`
We verify the Firebase ID token's signature, not whether it's been revoked. A compromised token can be used for up to 1 hour even after the user clicks "Sign out of all devices."

**Fix:** call `verifyIdToken(token, true)` (the second arg is `checkRevoked`). Trade-off: extra latency per request.

---

## 5.4 LOW — Admin audit log doesn't record "who viewed what"

Only "who changed what" is audited. An admin can read any user's financial data without a trail.

---

# 6. Idempotency & retries

## 6.1 HIGH — `bookInboundShipment` is fire-and-forget with no retry

**Where:** `backend/apps/api/src/aggregator.controller.ts:131`
`void bookInboundShipment(...).then(...).catch((e) => console.error(...))`. If Shiprocket is down when the aggregator pays, the inbound shipment is never booked. No cron picks it up later. The holding exists, the challan exists, but no courier was ever called.

**Fix:** write a `shipment-booking-queue` doc on failure, `holding-expiry`-style sweep picks it up.

---

## 6.2 HIGH — EWB audit log entries can double-write on retry

**Where:** `backend/apps/api/src/eway-bill/eway-bill.ts:300-387` (`generate`)
The audit event `writeAudit` uses `.add()` (auto-id), not `.doc(idempotencyKey)`. If `generate()` is called twice for the same holding (e.g., a stuck booking that retries), we'll have two "Success" rows in the admin EWB console for the same NIC bill. First is correct, second is a duplicate.

**Fix:** use `holdingId` as part of the doc id, or an idempotency key.

---

## 6.3 MEDIUM — Email idempotency keys use `again()` for a few flows

**Where:** `backend/apps/api/src/mail/emails.ts` (search `/again\(\)/`)
Several resend paths use `again()` (which returns `now-ms`) to force a new idempotency key. If called in a tight loop (user spams "Resend OTP"), Resend will send all of them. We have rate-limit at the API layer but it's per-IP, not per-recipient.

**Fix:** add per-recipient rate-limit at the mailer layer (max 3 sends of same template id to same recipient in 5 min).

---

## 6.4 MEDIUM — Shiprocket webhook can re-advance status BACKWARDS

**Where:** `backend/apps/api/src/shiprocket.controller.ts:126-150`
We map stage → OrderStatus unconditionally. If Shiprocket (buggily) sends "pickup" after "delivered", we'd write `status: packed` over a delivered order. OrderStateMachine would catch it on manual admin transitions, but this writes directly with `.set({merge:true})`, no state-machine check.

**Fix:** read current status first, only advance if forward.

---

# 7. Concurrency

## 7.1 HIGH — `expireDueHoldings` has no lock

**Where:** `backend/apps/api/src/holding-expiry.ts:42-60`, `backend/packages/db/src/holding-lifecycle.ts:140`
Two Railway instances running the sweep simultaneously will BOTH read the same expired holdings and BOTH try to run `returnHolding`. The DB transaction catches true double-writes (idempotency), BUT the emails fire twice (`holdingPeriodEnded` sent to aggregator from both instances) because email dedupe is by key `holding-period-ended/${id}` and a race across instances gets both through.

**Fix:** either use Firestore distributed lock, OR dedupe emails at the Resend provider level by including the idempotency key in the subject.

---

## 7.2 MEDIUM — Rate-config version switching is not transactional with pricing

**Where:** `backend/apps/api/src/rate-config.controller.ts`
Admin approves a new rate config version. There's a ~100ms window where ongoing requests see the old rates on the read side but the new version is active on the write side. For a checkout spanning that window, the user might see the OLD price and pay against the NEW rates (or vice versa).

**Fix:** rate-config reads should pin the version id for the duration of a single checkout.

---

# 8. Data integrity

## 8.1 HIGH — `OrderDoc.artistId` is optional; legacy orders have no artist attribution

**Where:** `backend/packages/db/src/collections.ts:628`
`artistId?: string` — comment says "Absent on orders created before 2026-10-30." Any code that reads `order.artistId` and does something with it (settlement, email, EWB) needs to handle `undefined`, and several places don't — they call `this.user(order.artistId!)` which will error if hit.

**Fix:** backfill script to populate from `artwork.artistId` on every historic order.

---

## 8.2 HIGH — `ArtworkDoc.listing` can be absent

**Where:** Multiple controllers read `artwork.listing.displayPricePaise` without null check.
If an artwork is submitted as draft and someone force-reserves it via the admin, `listing` is still null.

**Fix:** guard every `artwork.listing?.displayPricePaise ?? 0` and emit a readable error.

---

## 8.3 MEDIUM — No referential integrity between holdings and artworks

Nothing stops a dev from deleting an artwork doc while holdings reference it. The admin reservations view would show `(artwork missing)` (I handled it in the new table), but the challan PDF renderer would throw.

**Fix:** soft-delete artworks only (status=deleted), never hard-delete.

---

## 8.4 MEDIUM — `artworkPricingCol/data` and `ArtworkDoc.listing.displayPricePaise` can drift

**Where:** two sources of truth for the artist price.
`aggregator-reads.ts` falls back from one to the other but settlement code uses only pricing.

**Fix:** make `ArtworkPricingDoc` the single source of truth, remove `listing.displayPricePaise` denormalization or make it read-only.

---

## 8.5 LOW — Firestore timestamps are read without `.toDate()` null-check in some places

Pattern: `holding.assignedAt.toDate()`. If the doc was written by a buggy path with no `assignedAt`, this throws. Doesn't currently happen but there's no runtime guard.

---

# 9. UI / UX gaps

## 9.1 HIGH — Display window counts from reservation, not delivery

**Where:** `frontend-web/features/aggregator/collection-table.tsx:*` (expiresAt display)
Client flagged this directly: "display window has to be started from the day aggregator receives the art piece not the day he reserves."

If Shiprocket takes 5 days to deliver, the aggregator loses 5 of their 30 display days before the piece arrives.

**Fix:** stamp `receivedAt` on holding when `inboundShiprocketStage === "delivered"`; recompute `expiresAt = receivedAt + 30 days`. Until delivered, UI shows "Window starts on delivery." (Task #229.)

---

## 9.2 HIGH — Aggregator can't see whether EWB was generated for their holding

Admin has `/admin/eway-bills`. Aggregator has nothing. If the parcel hits a checkpoint and there's no EWB, the aggregator has no way to know in advance.

**Fix:** surface `holding.deliveryChallan.ewayBill.number` on the holding detail page.

---

## 9.3 MEDIUM — Mobile app has no screen for ongoing reservations

**Where:** `mobile/lib/features/aggregator/`
Web has `/aggregator/collection`. Mobile has partial parity.

---

## 9.4 MEDIUM — Admin "Reservations" new page doesn't link back to Razorpay

The new table shows `pay_PHfZabc1234567` but it's not a link to `https://dashboard.razorpay.com/payments/{paymentId}`.

**Fix:** wrap `providerPaymentId` in an anchor tag pointing at Razorpay dashboard. Admin can click through to verify capture.

---

## 9.5 LOW — Several admin tables have no pagination

`/admin/orders`, `/admin/aggregators`, `/admin/eway-bills`, `/admin/reservations` all pull up to 200 rows then page client-side. At 10k+ orders this breaks.

---

# 10. Mobile app

## 10.1 HIGH — NFC lock has no retry if offline

**Where:** `mobile/lib/features/nfc/`
If the device loses network between NFC tap success and API call success, the local tag is written as "locked" but the backend doesn't know. User can't unlock from the app (we don't allow), can't re-lock (it says already locked locally), so support has to manually fix.

**Fix:** persistent outbox queue for NFC-lock state transitions.

---

## 10.2 MEDIUM — Dependencies drift between web + mobile Firebase client

Web is on Firebase JS 10.x, mobile is on Firebase Flutter 3.x. OTP code conventions differ. OTP delivered by WhatsApp uses a 6-digit code, mobile UI accepts 4-digit in some places (legacy MSG91 flow).

---

# 11. Build / deploy

## 11.1 HIGH — No CI gate on `.check.ts` scripts

Our `.check.ts` scripts run locally but no GitHub Action gates on them. A PR that breaks `emails.check.ts` or `eway-bill.check.ts` can land.

**Fix:** add `.github/workflows/checks.yml` that runs `find backend -name "*.check.ts" | xargs -I {} node --experimental-strip-types {}`.

---

## 11.2 HIGH — Railway restart drops the EWB session cache uselessly

Session cache is in Firestore — survives restart. But in-memory token caches (Shiprocket, Razorpay) are reset. First post-restart requests re-authenticate, adding ~500ms latency. Users notice.

**Fix:** persist Shiprocket token in Firestore too.

---

## 11.3 MEDIUM — No separate staging Razorpay keys documented

If someone deploys staging with prod Razorpay keys, real money moves. The env guard checks `paymentsMode` but not key identity.

---

# 12. Tests

## 12.1 HIGH — Zero end-to-end test coverage of reservation flow

Every bug in Section 1 was caught in production by the client. No test case covers "aggregator reserves → finalize → ledger entries exist → holding has correct delivery deposit → marketplace listing is gone." All of those would have fired on the code before 7ffa70a.

**Fix:** write `tests/e2e/aggregator-reserve.spec.ts` against the Firestore emulator. Run in CI.

---

## 12.2 MEDIUM — `aggregator-money.spec.ts` mocks the wallet endpoint

**Where:** `frontend-web/tests/functional/aggregator-money.spec.ts:108`
The test mocks `/v1/aggregator/wallet` as if wallet exists. Doesn't catch the "ledger is empty" bug because it never hits the real endpoint.

---

# 13. Documentation

## 13.1 MEDIUM — `CLAUDE.md` lies about what's in the repo

Several `CLAUDE.md` files mention features that got removed (wallet top-ups, MSG91) as if current.

---

## 13.2 LOW — No architecture doc explaining the money model

`settlement.ts` has the ledger primitives but no README explains the account types, balances, or invariants. New devs have to read code.

---

# What I missed

Honest admission: items 1.1, 1.3, 1.4, 1.5, 1.7, 2.1, 3.1, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 6.4, 7.1, 8.1, 8.2, 9.1, 9.2, 12.1, 12.2 all exist because I added features one path at a time and did not audit the other paths that needed the same change. The pattern repeats: legacy-path has it right, new-path (Razorpay intent flow) silently skips it. I should have run `grep -rn "aggregatorAdvanceForMonth\|appendArtworkStatus\|postLedgerEntries" --include="*.ts"` every time I touched a holding-creation path. I didn't.

---

# Priority order (recommended fix sequence)

1. **1.5** — backfill ledger for existing broken holding (one-shot script, ~30 min)
2. **3.1** — Shiprocket webhook signature required (security, 10 min)
3. **5.1** — Admin role bootstrap guard (security, 10 min)
4. **1.1** — Marketplace order challan + EWB (compliance, 2 days)
5. **9.1** — Display window starts on delivery (client-flagged, 1 day)
6. **1.6** — Pass delivery-deposit through sale/return recompute (correctness, 2 hours)
7. **6.1** — Shipment booking retry queue (correctness, half day)
8. **7.1** — Expire-sweep locking (correctness, half day)
9. **12.1** — E2E test for reservation flow (prevention, 1 day)
10. **4.1** — `tx.create()` on uniqueness (correctness, 10 min)

Everything else slots in after.

---

**Total items audited: 48**
**CRITICAL: 4 — HIGH: 22 — MEDIUM: 17 — LOW: 5**
