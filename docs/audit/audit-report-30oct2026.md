# GalleryZone — audit report (30 Oct 2026)

**Prepared by:** Claude (code reading + Firestore + public API probes)
**No code pushed.** This is the deliverable. You review, we triage, then PRs.
**HEAD read:** `2e3b2e9` (post merge of PR #32 — General rarity tier)

---

## TL;DR

| # | Item                                        | Status today | Owner action |
|---|---------------------------------------------|---|---|
| 1 | Aggregator commission monthly vs lifetime   | ✅ **Monthly** (verified in 3 code paths) | None |
| 2 | Customer onboarding tour                    | ✅ Shipped (all 4 roles) | None |
| 3 | ShipRocket real-time delivery rate          | ❌ **Flat fallback.** No serviceability API call anywhere | **FIX** |
| 4 | Razorpay convenience fee from gateway       | ❌ **Hardcoded** `displayPrice × 2% × 1.18` | **FIX** |
| 5 | Remove bank/QR from customer-side payment   | ⚠️ **Interpretation needed** — customer checkout is already clean; concern is likely aggregator settlements page | Confirm interpretation |
| 6 | Add-to-cart + abandoned-checkout recovery   | ❌ **Not implemented** at all | **BUILD** |
| 7 | Admin GST reject                            | ✅ **Exists end-to-end.** Likely a specific UI bug — needs reproduction | Reproduce + share screenshot |
| 8 | Resend emails + in-app notifications        | ❌ **5 of ~30 events wired.** No `notify()` abstraction | **BUILD** |
| 9 | Amazon-style tax invoice (PDF)              | ❌ **Not implemented** | **BUILD** |
| 10 | Excel/CSV export of dashboards             | ❌ **Not implemented** | **BUILD** |
| 11 | Mobile iOS parity                          | ⚠️ **iOS project exists**, Flutter code shared, needs physical-device verify | Verify |

**Already done in prior PRs** (confirmed on `main`): Buy-now copy on art-supplies (PR #31), General rarity tier (PR #32), aggregator reserve via Razorpay (PR #27), onboarding tour (PR #28), help assistant FAQ (PR #29).

**Priority:**
P0 (money-wrong-today) → #3 ShipRocket, #4 Razorpay fee
P0 (missing core feature) → #6 Cart, #8 Email coverage, #9 Invoice
P1 → #10 Excel, #11 iOS verify
P2 → #5 UI cleanup, #7 GST reject bug

---

## #1 — Aggregator commission: monthly or lifetime?

**Verdict: ✅ MONTHLY.** The user-level auto-memory saying "lifetime pre-GST" is stale — the code was changed in the Oct 25 security pass (PR #30).

**Evidence (3 paths):**
- `backend/packages/db/src/aggregator-commission.ts` — file comment: *"The rate used this month is based only on the immediately preceding calendar month's successful sales. 'Eligible Monthly Sales' is… **not lifetime sales**"*
- `aggregator-flow.ts:211–217` — on each sale: `aggregatorEligibleSalesInPreviousMonthPaise(…)` → `commissionRateForPreviousMonthSales(sales, rates)` → slab picked
- `backend/packages/domain/src/pricing.check.ts:188–192` — test suite documents slab behavior (0 / 10L / 50L breakpoints with increasing rates)

**Nothing to fix.** My own memory note needs retirement (it's at `~/.claude/.../memory/project_commission_slabs_pre_gst.md`); won't affect code.

---

## #2 — Customer onboarding tour

**Verdict: ✅ Shipped.** Role-specific tour mounted in all 4 shells:
- `features/account/account-shell.tsx` → `<OnboardingTour role="customer" />`
- `features/dashboard/dashboard-shell.tsx` → `role="artist"`
- `features/aggregator/aggregator-shell.tsx` → `role="aggregator"`
- `features/admin/admin-shell.tsx` → `role="admin"`

Persisted on user profile (`toursCompleted[role]` with version); localStorage fast path. Replayable via `replayTour(role)` helper. **Nothing to fix.**

---

## #3 — ShipRocket real-time delivery rate ❌

**Verdict: Hardcoded flat ₹25.** No live rate call.

**Evidence (2 paths):**
1. `backend/apps/api/src/shiprocket.ts` — grep for `serviceability`, `getRate`, `shippingRate`, `/courier/serviceability` → **zero matches.** Wrapper only has `getToken`, `bookShipment`, `verifyWebhookSignature`.
2. `backend/packages/domain/src/pricing.ts:311`:
   ```ts
   export function checkoutTotal(displayPrice, rates, deliveryChargePaise?) {
     const delivery = deliveryChargePaise ?? rates.deliveryChargePaise;
     ...
   }
   ```
   Nobody passes the optional override. Prod rate config stores `deliveryCharge: 2500` paise = **₹25.** That's what the user sees.

**Minor:** Field name mismatch — prod data uses `deliveryCharge`, Zod schema expects `deliveryChargePaise`. If strict-mode load were running it would reject; it apparently isn't. Worth a schema rename + data migration.

**Fix plan:**
1. **`shiprocket.ts`** — add `getShippingRate({ pickupPincode, dropPincode, weightKg, declaredValue })` → `POST /v1/external/courier/serviceability` → return cheapest serviceable courier + rate.
2. **`checkout.ts`** — call it, pass real rate into `checkoutTotal()`. Pickup from artist profile, drop from buyer address, weight from `artwork.physical.weightKg` (default 2 kg), declared value = displayPrice.
3. **Cache quote on order doc** — re-visits of same checkout don't re-quote.
4. **Fallback** — if ShipRocket is unreachable or no courier is serviceable, show today's flat rate with a visible *"estimated; final at dispatch"* note. Don't silently use ₹25.
5. **Rename** `deliveryCharge` → `deliveryChargePaise` in Firestore (data migration).
6. **Frontend** — show courier name next to rate ("Delhivery · ₹X"); re-quote on address change; loading state while quoting.

**Owner setup:** confirm ShipRocket serviceability API is enabled (standard in all plans); confirm `SHIPROCKET_PICKUP_LOCATION_NAME` env var is correct.

**Scope:** ~400 LOC. 1 PR. 1 day.

---

## #4 — Razorpay convenience fee: from gateway or hardcoded? ❌

**Verdict: Hardcoded in rate config.** Not from Razorpay.

**Evidence:** `backend/packages/domain/src/pricing.ts:317–319`:
```ts
const convenienceFee = Math.round(exGst(displayPrice, rates) * rates.customerConvenienceRate);
const convenienceGst = Math.round(convenienceFee * rates.serviceGstRate);
```
Rate config has `customerConvenienceRate` (your 2%) and `serviceGstRate` (your 18%). Grep for `razorpay.*fee`, `fetchFees`, `/v1/fees` → **zero matches.** Razorpay's actual fee is never queried.

**Why it matters:** Razorpay charges by instrument (UPI: 0%, debit <₹2k: 0.4%, credit: 2%, international: 3%). Hardcoding one number means we either overcharge (we keep margin) or undercharge (we eat the gap).

**Fix plan — Option A (recommended):** Capture ACTUAL fee from Razorpay's `payment.captured` webhook payload (fields `payload.payment.entity.fee` and `.tax`), store on the payment doc. Show "Payment & taxes: as applicable at checkout" upfront; show actual breakdown on the invoice. More honest, RBI-safer.

**Backend changes:**
- `payments.controller.ts` webhook handler — parse `fee` and `tax` fields, persist on payment doc as `gatewayFeeActualPaise` + `gatewayFeeGstActualPaise`.
- Invoice generation (#9) reads these for the breakdown.
- Checkout UI — replace per-fee line with "Payment & taxes" generic line.

**Scope:** ~150 LOC. Half a day.

---

## #5 — Remove bank-details option on customer-side payment ⚠️

**Verdict: Interpretation needed.**

**Current state (verified):**
- **Customer checkout** (`features/checkout/*`): already clean — only Razorpay. **Zero bank fields or QRs.** Nothing to remove.
- **Artist / aggregator profile forms**: enter their OWN bank details for payouts. ✅ keep.
- **Aggregator settlements page** (`features/aggregator/settlements-table.tsx:248`): shows `<PayeeDetails>` with **GalleryZone's bank** for cash-remittance transfers.
- **Aggregator record-sale dialog** (`record-sale-dialog.tsx:382`): "Paid GalleryZone directly (transfer or UPI)" option.

**Two interpretations of your ask:**
- **A** — Remove GalleryZone's bank/QR from aggregator settlements and record-sale dialog (the cash-remittance flow); route remittance through Razorpay payment link instead.
- **B** — On the ADMIN side, show artist/aggregator bank details inline next to settlements so admin can pay out without clicking into the profile.

Both are reasonable. I believe you mean **A** but "customer" is ambiguous. **See doubt #1.**

---

## #6 — Add-to-cart + abandoned-checkout recovery ❌

**Verdict: Not implemented.** Grep for `useCart`, `cartService`, `CartStore`, `addToCart` → zero matches. Customer goes `/marketplace/<id>` → **Buy now** → `/checkout?artworkId=…` directly.

**Design:**
- New collection `carts` keyed by `userId` (one doc per customer):
  ```ts
  interface CartDoc {
    userId: string;
    items: Array<{ artworkId: string; addedAt: Timestamp; source: "explicit" | "abandoned_checkout" }>;
    updatedAt: Timestamp;
  }
  ```
  No price locked — re-read at checkout. No quantity — artworks are 1-of-1.
- Endpoints: `GET /v1/account/cart`, `POST /v1/account/cart/{id}`, `DELETE /v1/account/cart/{id}`, `POST /v1/account/cart/clear`
- **Abandoned-checkout trigger**: `/checkout?artworkId=X` → if no cart entry → add with `source=abandoned_checkout`. On successful order creation → remove from cart in same transaction.
- **Pruning**: weekly cron drops items > 30 days old; soft-remove when artwork no longer `marketplace`.
- **Signed-out → signed-in merge**: cart lives in localStorage until sign-in, then merged.
- **UI**: `/account/cart` page, AddToCart button on `ArtworkCard` + detail, Cart entry in sidebar + mobile bottom nav badge.

**Scope:** ~1000 LOC. 2–3 PRs (schema+API, UI, abandoned-checkout + merge). 2 days.

**Doubts** (see §Doubts): single-order vs multi-item Razorpay session? cart max size? abandoned-cart email at 1h / 24h?

---

## #7 — Admin GST reject ✅ but reportedly broken

**Verdict: Exists end-to-end in code.** User-reported "can't reject" is either a UI regression or a Cashfree race — needs reproduction.

**Evidence:**
- Backend: `moderation.controller.ts:42` `rejectGst(…)` endpoint + `moderation.ts:53` write with `gstStatus: input.decision, gstReviewNote: …`
- Frontend: `features/admin/moderation/gst-queue-table.tsx:36` `GstQueueTable`, line 156 writes audit log `"gst.rejected"`, line 163 shows success toast
- Audit log: `features/admin/system/audit-log-table.tsx:30` renders `"gst.rejected": "GST rejected"`
- DB test: `moderation.check.ts:80` asserts `gstStatus === "rejected"` ✓

**Possible actual bugs** (can't verify without a live reject attempt):
- Reason field required by backend; UI doesn't enforce → 400 silently
- Cashfree webhook race: auto-approve lands between reject-click and update
- Mutation fires but react-query cache not invalidated → UI looks like nothing happened

**Action:** reproduce → share DevTools Network response → one-line patch.

---

## #8 — Resend emails + in-app notifications ❌

**Verdict: Very thin coverage.** 5 of ~30 events have emails. In-app notifications almost nonexistent.

**What's wired (verified in `backend/apps/api/src/mail/emails.ts`):**
`welcome`, `passwordReset`, `orderPaid`, `holdingPeriodEnded`, `nfcLockReminder`.

**That's it.** The following events have ZERO notification (checked by grep against `emails.*`):

**Customer-facing missing:** order dispatched, out for delivery, delivered + certificate ready, refund initiated/completed, transfer-rights invite received, MOU/Terms update.

**Artist-facing missing:** artwork approved/rejected, artwork sold (marketplace OR aggregator), settlement released, payout processed w/ UTR, aggregator reserved your piece, aggregator returned, blog accepted/rejected, physical COA request received, MOU update.

**Aggregator-facing missing:** reservation confirmed (Razorpay), inbound shipment picked up, inbound shipment delivered, window-end approaching (3 days out), sale remitted → commission released, payout processed w/ UTR, holding report resolved, MOU update.

**Admin-facing missing:** moderation queue depth digest, new holding report, flagged payment, backfill/cron failures.

**Fix plan:**
1. Build single `notify(userId, event, data)` → writes `messageThreads` doc + enqueues Resend send + (future) push.
2. Call it from every event handler (~30 call sites).
3. User preferences on `UserDoc`: `notificationPreferences: { email: { marketing, transactional }, inApp: { enabled }, push: { enabled, deviceTokens[] } }`.
4. Transactional cannot be disabled (RBI/GDPR OK).
5. Move email HTML into React Email templates (`backend/apps/api/src/mail/templates/`).
6. Resend sender: currently `onboarding@resend.dev` — needs a verified GalleryZone domain.

**Scope:** 3–4 PRs, ~2000 LOC total. 3 days.

---

## #9 — Amazon-style tax invoice ❌

**Verdict: Not implemented.** No PDF generator. On-screen receipt only.

**What you want (from the Amazon invoice photo):** seller block (name, PAN, GSTIN, address), buyer billing + shipping blocks, invoice metadata (unique number, date, order number), line items with HSN, CGST/SGST (intra-state) or IGST (inter-state), totals in figures and words, authorized signatory, legal footer.

**Design:**
- **Library:** `@react-pdf/renderer` (React components → PDF; typed; good DX)
- **Invoice snapshot on OrderDoc:**
  ```ts
  invoice?: {
    invoiceNumber: string;         // GZ-INV-2026-27-00042, sequential per FY
    issuedAt: Timestamp;
    sellerSnapshot: { name, pan, gstin, address, cin };  // frozen at issue time
    buyerBillingSnapshot: Address;
    buyerShippingSnapshot: Address;
    hsnCode: string;               // 9701 for paintings
    interState: boolean;           // decides CGST+SGST vs IGST
    taxableAmountPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalTaxPaise: number;
    gatewayFeePaise: number;       // from Razorpay webhook (#4)
    gatewayFeeGstPaise: number;
  }
  ```
- **Numbering:** Firestore transaction on `counters/invoiceNumber` doc (`{ fy, nextSeq }`). Sequential per FY (GST requirement).
- **Issue trigger:** on order status → `paid`, same transaction.
- **Serve:** `GET /v1/orders/{id}/invoice.pdf` — rendered on demand, no caching (small volume).
- **Interstate decision:** compare seller state (fixed) vs buyer shipping state. Intra → CGST 2.5% + SGST 2.5%. Inter → IGST 5%. (Sum same, split different.)
- **Signatory image:** owner uploads a signature PNG once, embedded in every PDF.

**Scope:** ~500 LOC backend, ~100 LOC frontend. 2 days. Owner provides: company legal details, HSN code(s), signatory image.

**Doubts:** credit note on refund? different HSN per category? invoice visibility to artist/aggregator (they need it too for their records)?

---

## #10 — Excel/CSV export of dashboards ❌

**Verdict: Not implemented.** Grep for `exceljs`, `xlsx`, `csv.export`, `downloadXlsx` → zero matches (only `.xlsx` filename references in pricing docs).

**Design:**
- Library: `exceljs` (richer than `csv-stringify`, handles formatting, column widths, header styles, formulas if ever needed)
- Backend endpoint per dashboard: `GET /v1/admin/export/orders.xlsx?from=…&to=…&status=…` returns streamed `.xlsx` with proper columns.
- Similar for `settlements.xlsx`, `artists.xlsx`, `aggregators.xlsx`, `customers.xlsx`, `holdings.xlsx`, `payments.xlsx`, `audit-log.xlsx`.
- Frontend: "Download Excel" button on every admin table page; respects current filters.

**Per-role scope:**
- **Admin:** 7 exports (orders, settlements, artists, aggregators, customers, payments, audit log)
- **Artist:** 2 (my sales, my settlements)
- **Aggregator:** 3 (my inventory, my sales, my commissions)

**Scope:** ~800 LOC. 2 days.

**Doubt:** per-role or admin-only for v1?

---

## #11 — Mobile iOS parity ⚠️

**Verdict: Code parity YES, physical verification NEEDED.**

**Evidence:**
- `mobile/ios/Runner.xcworkspace` exists → iOS project is scaffolded.
- Flutter code is single-codebase (same `lib/` for iOS + Android).
- All feature code I've seen in `mobile/lib/features/` is platform-neutral Dart.

**Risks that only hardware testing catches:**
- Apple Sign-In requirement (Apple requires it if you offer Google/Facebook sign-in; we only have email/password + Google — so Apple review might force Apple Sign-In)
- Push notification setup (APNs certificates/keys)
- NFC: Core NFC on iOS requires physical device (not simulator) + specific entitlements
- Razorpay iOS SDK has its own quirks vs Android
- Deep links: Universal Links on iOS need `apple-app-site-association` file hosted at `https://www.galleryzone.art/.well-known/apple-app-site-association`

**Owner action:** build iOS release in Xcode, test on a physical iPhone, add Apple Developer account entitlements. Not something I can do from a Mac shell without the signing cert.

---

# Flow gaps I spotted beyond your list

### Customer
- **No "track my shipment" link in order detail** that opens the ShipRocket public tracking page (we have AWB but no deep link to the courier's tracker)
- **No download-COA** button on owned pieces (customer has to go to the public /verify page)
- **No "request refund" button** — refunds today require emailing support

### Artist
- **No preview-as-public** button that opens the artwork's /marketplace detail in a new tab from the artist's edit view
- **No "my work has been reserved" live indicator** on their dashboard — only visible via Earnings
- **No batch artwork submit** — must submit one at a time

### Aggregator
- **No calendar view** of placement windows ending — only a flat list; miss windows easily
- **No "mark delivered to buyer"** manual override — relies on ShipRocket webhook, which can be delayed
- **No sales analytics** beyond total count — no "which pricing worked", "which category sells fastest", "my conversion rate"

### Admin
- **No bulk approve/reject** on moderation queues (artwork, KYC, GST) — one by one
- **No "simulate as user"** feature for debugging a customer's complaint
- **No scheduled report emails** to the owner (weekly sales summary, moderation backlog)

---

# Doubts for the owner (please answer before I build)

Numbered so you can reply with just the numbers.

1. **Payment UI cleanup (#5)**: do you mean (A) remove GalleryZone's bank/QR from aggregator settlements & record-sale dialog, OR (B) show artist/aggregator bank details inline on admin settlements? Possibly both?

2. **ShipRocket rate (#3)**: if the quote at checkout differs from the actual booking rate (ShipRocket rates fluctuate), who eats the difference — GalleryZone absorbs it, or we re-quote and buyer pays delta?

3. **ShipRocket rate (#3)**: show the quote with GST on top, or including GST (like all other customer prices)?

4. **Cart (#6)**: multi-item checkout as ONE Razorpay session (3 pieces → one combined order), or sequential (3 separate orders)? Pieces are 1-of-1 so ownership transfer is per-piece either way.

5. **Cart (#6)**: max items allowed? Default I'd pick: 10. (Prevents griefing where a bad actor adds every artwork, making them show as "in someone's cart".)

6. **Cart (#6)**: email the buyer about an abandoned cart after 1h, 24h, or not at all?

7. **Email coverage (#8)**: do you have a verified Resend sender domain? Current config uses `onboarding@resend.dev` which goes to spam often. Need DNS records added to the GalleryZone domain.

8. **Email coverage (#8)**: push notifications on mobile — have APNs (iOS) and FCM (Android) credentials been provisioned?

9. **Invoice (#9)**: confirm these legal values for the seller block — company legal name, registered address, PAN, GSTIN, CIN. Also the HSN code (default would be `9701` for paintings; `9703` for sculpture; `4911` for prints — different per category?).

10. **Invoice (#9)**: upload a PNG of the authorized signatory's signature (300x100 px, transparent bg) for embedding in every PDF.

11. **Invoice (#9)**: do artists and aggregators also need to download the invoice for their records (for GST filing)? If yes, grant them read access to the invoice PDF on their respective order views.

12. **Invoice (#9)**: on refund, issue a Credit Note (standard GST practice) with its own sequential number? Or just mark the invoice "refunded"?

13. **Excel export (#10)**: admin-only for v1, or also expose per-role (artist exports their sales, aggregator exports their commissions)?

14. **GST reject (#7)**: can you try to reject a pending GST on prod right now, open DevTools → Network tab, and share a screenshot of the failing request + response? That reveals the specific bug.

15. **Mobile iOS (#11)**: do you have an active Apple Developer account ($99/yr)? Required to build release IPAs and submit to App Store.

16. **Mobile iOS (#11)**: Apple's App Store Review Guideline 4.8 *may* require Apple Sign-In because we have Google Sign-In. Confirm with your reviewer; if required, we'll need to add it (Flutter supports via `sign_in_with_apple` package).

17. **Notification preferences (#8)**: should transactional emails (order paid, settlement released) be forcibly on, with only "marketing" being opt-out-able? (This is standard, RBI/GDPR-compliant.)

18. **Beyond-list items**: any of the "flow gaps I spotted" above (customer refund button, aggregator calendar, admin bulk approve, etc.) you want me to add to the build queue?

---

# My recommended build order (if green-lit)

**Week 1:** #4 Razorpay fee from webhook, #3 ShipRocket real-time rate, #7 GST reject bug fix (after you reproduce)
**Week 2:** #9 Invoice generation, #8 `notify()` abstraction + customer-side emails
**Week 3:** #6 Cart + abandoned-checkout, #8 artist-side emails
**Week 4:** #8 aggregator + admin emails, #10 Excel exports (admin first)
**Week 5:** #5 Payment UI cleanup (after owner answer), gap items (customer refund button, aggregator calendar)
**Week 6:** #11 Mobile iOS physical verification + fixes, Apple review prep

~6 weeks of focused engineering for all P0+P1 items + half the P2. Realistic.
