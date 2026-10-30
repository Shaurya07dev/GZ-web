# GalleryZone — decisions & inputs needed (2026-10-30)

**Read [`FINAL_STATUS_2026-10-30.md`](FINAL_STATUS_2026-10-30.md) first.** Milestone 0 (audit + baseline) and the Firebase check are done. Work on Phase B is paused on the answers below. Each item says **what we found**, **what we need from you**, **what we recommend**, and **what happens once it's answered**. Full evidence, with file and line references, is in [`REPOSITORY_AUDIT_2026.md`](REPOSITORY_AUDIT_2026.md).

Reply with item numbers, e.g. `D1: a, ₹X · D4: recommended · D6: yes`.

---

## 1. Where things stand

### Verified (each check run twice)

| Area | Result |
|---|---|
| Firebase account | `galleryzone5@gmail.com` (Google-verified email) has **Editor** on `galleryzone-prod`. Owner: `shaurya8851@gmail.com`. It is the only project the account can see; project number `558316713525` matches the web config. |
| Firestore rules | The deployed ruleset is byte-identical to `backend/firestore.rules`. All client writes are denied. |
| Firestore indexes | 10 in the repo, 10 deployed, all `READY`. No drift. |
| Auth | Email/password and Google sign-in enabled. |
| Registered apps | **Web only.** No Android or iOS app is registered (see D10). |
| Backend suite | 23 checks + type-check + API build: pass ×2 |
| Web build / smoke | Pass ×2 (one smoke screenshot flake, pre-existing) |
| Firebase MCP | Configured for this project (token-based, local Claude config, not in the repo). Answers `list_projects` / `list_apps` correctly. Its tools appear after a VS Code window reload. |

### Fixed (uncommitted, waiting on D15)

1. **Admin GST + KYC Approve/Reject never worked.** The web called `/v1/moderation/...` but the API serves `/v1/admin/moderation/...`, so every decision returned 404.
2. **Every buyer was shown a placeholder bank account** ("Pay GalleryZone directly") under the Razorpay button, on web and mobile. Removed from checkout.
3. **A platform admin could mark any order paid** while live Razorpay was on. Closed.
4. **The aggregator bank form never saved the account number** but said "Bank details updated". Fixed.
5. **New CI check**: every web and mobile API call must match a real backend route (255 calls, 181 routes).

---

## 2. Urgent — production risk right now

### D1 · Every checkout charges ₹25 delivery 🔴
**Found.** The live pricing config (version `STv4fmpNKMgOeartydNx`) has `deliveryChargePaise: 2500`, which is ₹25. It is an old rupee value that is now read as paise, and it is charged flat on every order. ShipRocket is never asked for a rate: the integration only books shipments, and no ShipRocket credentials were supplied.
**Need.**
- (a) Immediate stop-gap: what flat delivery charge should apply until live quotes work? A platform admin must propose and approve a new rate version in the admin panel. This is a production data change, so I won't make it myself.
- (b) For real quotes: ShipRocket API user email/password, webhook secret and pickup-location name. Also: where each artwork's weight and dimensions come from; which pickup pincode applies (artist? aggregator?); who pays shipping; any approved free-shipping rule.
- (c) When ShipRocket can't quote (unserviceable pincode, outage), should checkout **refuse to take payment**, or put the order into admin review?

**Recommend.** (a) now, then (b) with (c) = refuse and show "delivery to this pincode can't be priced right now, retry". Never charge a guessed amount.
**Then.** I build the ShipRocket serviceability quote, recompute it server-side when the address changes and again just before the Razorpay order is created, and snapshot it on the order.

### D2 · Payment webhooks may be going to a dead server 🔴
**Found.** The docs register the Razorpay and Cashfree webhooks at `api-production-9fd9.up.railway.app`, which answers "Application not found". The live API is `gz-web-production.up.railway.app`. If the dashboards still point at the old host, a buyer who pays and closes the tab is charged and never gets their order.
**Need.** Someone with dashboard access checks **Razorpay → Settings → Webhooks** and **Cashfree → Developers → Webhooks**, and confirms the URL. Or give me read access.
**Then.** I fix the docs and add the webhook URL to the release checklist.

### D3 · Aggregators are still shown the placeholder bank account 🔴
**Found.** When an aggregator remits a sale to GalleryZone, the settlements screen (web and mobile) shows the same fake HDFC account (`50200098765432`).
**Need.** The real GalleryZone collection account (and UPI VPA, if any). Otherwise approve removing the panel until the account exists.
**Recommend.** Remove it now and add the real account as server config, not hard-coded in two apps.

### D9 · Transactional emails only reach the Resend account owner 🔴
**Found.** `EMAIL_FROM=onboarding@resend.dev`. Resend only delivers that sender to the account owner's own address, so if production uses the same value, no customer, artist or aggregator receives order, approval or security mail.
**Need.** Verify `galleryzone.art` in Resend (add its SPF/DKIM DNS records) and set `EMAIL_FROM=GalleryZone <hello@galleryzone.art>` on Railway. Also confirm what production uses today.

### D10 · Firebase project setup 🟠
| Finding | Decision |
|---|---|
| **No billing (Spark plan).** Firestore is capped at 50k reads and 20k writes per day; one busy day can take the marketplace down. Backups are unavailable. | Upgrade to Blaze, with a budget alert? **Recommended.** |
| Point-in-time recovery **off**, delete protection **off**, **no backup schedule** | Enable all three after Blaze? **Recommended.** |
| No Android app registered (`in.galleryzone.app`) and no iOS app | Approve registering both (needs the Android release SHA-256 and the iOS bundle ID + Apple Team ID). Required for mobile Google sign-in and push. |
| Authorized auth domain `gallery-zone-six.vercel.app`: not in our CORS list, origin unknown | Is it ours? If not, remove it, because it can host a sign-in page for your users. |
| Database location `nam5` (USA) | Info only. Moving it means a full migration. Flag it if Indian data-residency (DPDP) advice requires India hosting. |

---

## 3. Business rules (I won't guess on money)

### D4 · Aggregator commission tiers
**Found.** Tiers are 20% up to ₹10L, 35% above ₹10L and 50% above ₹50L, applied to GalleryZone's markup. The tier is decided by the aggregator's **previous calendar month** of sales, counted in **UTC**. **Refunded or cancelled sales still count**, and marketplace orders don't count. The rate is snapshotted on each sale.
**Need.**
- (a) Keep "previous month decides this month's rate" (shipped in PR #26), or switch to the **current** month?
- (b) Month boundaries in **India time (IST)** instead of UTC?
- (c) Exclude refunded/cancelled sales?
- (d) If a sale is refunded after the month closes, adjust next month, or leave closed months untouched?

**Recommend.** (a) keep previous month, (b) IST, (c) exclude, (d) leave closed months as they are and record the adjustment in the current month.

### D5 · Artwork categories
**Found.** The spec mentions "four existing categories", but none exist. The upload form offers six fixed options (Painting, Sculpture, Printmaking, Mixed media, Textile Art, Ceramics). An admin "Categories" list exists but nothing uses it, and browse labels differ from upload labels.
**Need.** The final category list, and whether "Standard / General Painting" is a new seventh option or replaces "Painting".
**Recommend.** One server-owned list, driven by the admin Categories page, used by upload, browse, filters and exports. Existing artworks keep their values.

### D6 · Amazon button label
**Found.** There is no "Shop on Amazon" button. The buttons are "View on Amazon" (cards, web and mobile) and "Buy on Amazon" (quick view). The affiliate disclosure is present.
**Need.** Rename **both** to "Buy Now"? **Recommend** yes, with "on Amazon" kept in small text or the icon beside it, so buyers know they're leaving GalleryZone.

### D7 · Cart
**Found.** There is no cart today; checkout handles one artwork at a time. Most works are one-of-one.
**Need.**
- (a) Should buyers **pay for several artworks in one payment**, or save them in a cart and check out one at a time?
- (b) Should adding to the cart **hold** a piece, and for how long? Or is it only held during payment?

**Recommend.** (a) one payment for several artworks, with a 15-minute hold that starts only when payment begins. A cart that holds pieces lets one buyer block the inventory.

### D8 · Excel exports
**Need.**
- (a) Can the admin export include collector names, phones and addresses, or a minimized set?
- (b) Should bank, GST and Aadhaar fields be masked (last 4 digits) in exports?
- (c) Is there a maximum date range per export?

**Recommend.** (a) minimized, (b) mask, (c) 12 months.

### D11 · Payout bank account storage
**Found.** Bank account numbers are stored **in plain text** in a field named `bankAccountEncrypted`.
**Need.** Approval to encrypt them with Google Cloud KMS. This needs Blaze (D10), plus a one-time migration of existing records.

### D12 · Mobile sign-in
**Need.** Should mobile offer Google sign-in? If so, Apple's rules require **Sign in with Apple** on iOS as well. **Recommend** yes to both; it needs the Firebase app registrations in D10.

---

## 4. Access, credentials, housekeeping

| # | Item | Why |
|---|---|---|
| D13 | **Rotate** every secret pasted in chat: Razorpay live key secret, Razorpay webhook secret, Resend key, S3 key, Cashfree secret, and the Firebase CI token once this work is done (Google Account → Security → Third-party access → Firebase CLI). Send Razorpay **test** keys (`rzp_test_…`) for local work. | Chat transcripts aren't a secret store. With test keys, payment flows can be tested without charging anyone. |
| D14 | Firebase Admin SDK key for the local API (the `.env` names a JSON file that isn't on this machine), **or approval to create a separate `galleryzone-staging` project** | The local API can't reach Firestore without it. **Recommend staging**, so tests never touch real customers. |
| D15 | Commit the fixes to a branch `fix/milestone-0-audit` and open a PR? Include the web lockfile repair (`npm ci` currently fails)? | Nothing is committed yet. |
| D16 | Which repo is canonical: `Shaurya07dev/GZ-web` (this checkout) or `Mouriyan-gandhi/GalleryZone` (named in the spec)? | Avoids pushing to the wrong place. |
| D17 | Install the Flutter SDK on this machine, or name the machine/CI that has it | Every mobile change is unverified until `flutter analyze` / `flutter test` run. |

---

## 5. Done without waiting (2026-10-30, second pass)

All of these are uncommitted (D15). Every check was run twice. Full list in [`SECURITY_REVIEW_AND_RISKS.md`](SECURITY_REVIEW_AND_RISKS.md).

- **Money and security fixes found by a dedicated review:**
  - Artists were paid the *live* price instead of the price the buyer paid (P0).
  - Anyone could order another owner's physical certificate (P1).
  - Ownership transfers could be hijacked via an unverified email (P1).
  - Admins could mark orders paid by hand (P1).
  - Listing choice (marketplace-only / gallery-only) was ignored on write paths.
  - Transfers were allowed while a piece was for sale.
  - Withdrawals were allowed without KYC.
  - A return racing a sale paid the hold back twice.
  - Paid Cashfree calls and sign-ups were open to abuse.
  - Unbounded cache, no security headers on web or API, `%2F` path ids, Amazon redirect SSRF, Cashfree webhook replay.
- **Dependencies:** critical and high production CVEs patched (`proxy-addr`, Sentry, multer, body-parser, qs and others).
- **GST/KYC:** the rejection reason is stored and shown to the applicant; every decision gets its own email.
- **Onboarding tour:** completion is saved per account and per tour version; "Replay the tour" is on each Support page and in the admin top bar; a new admin tour was added.
- **In-app notifications:** every transactional email also lands in a persistent inbox behind the bell, on all four portals (deduped, read/unread, mark-all-read, deep links). Mobile inbox: Phase C.
- **Mobile:** a release build refuses to start in demo mode; the dead collector-wallet call is gone. Flutter is installed on this machine: `flutter analyze` is clean and 739 tests pass.
- **Webhook replay:** settlement was already idempotent and failure emails are deduped per order. DigiLocker events now ignore anything older than the outcome already recorded.

## 5b. New decisions from the security review

### D18 · Gallery sales credit the artist before money is proven 🔴
**Found.** Recording a gallery sale immediately credits the artist and the aggregator. "Paid GalleryZone directly" is never checked against a real payment, and "remitted by bank" is self-declared. An aggregator working with an artist could record a fake sale and the artist could withdraw it.
**Need.** Pick one:
- (a) Credits stay **pending until an admin confirms** the remittance or transfer arrived.
- (b) Gallery buyers pay **through Razorpay** (a link or QR the aggregator shows), so the gateway confirms it.
- (c) Both: Razorpay by default, admin confirmation for cash.

**Recommend** (c). **Until then:** check remittances before approving any artist withdrawal tied to a gallery sale.

### D19 · Collector resale can be self-completed
**Found.** A collector can mark their own resale listing "sold" at any price and credit their wallet, with no buyer or payment. It's harmless today, because that wallet can't be spent or withdrawn, but it becomes critical the day it can.
**Need.** How a resale completes: a buyer pays through checkout (recommended), or an admin confirms. Until it's decided, should I disable self-completion?

### D20 · Planned major upgrades
Nest 10→11 and zod 3→4 each fix remaining moderate/high advisories. The practical risk is low today (see the security doc), but each is a migration that needs a full regression pass. Approve scheduling them as separate PRs?

## 6. Order after your answers

D1 + D2 + D3 + D9 (live risk) → D10/D14 (environment) → Phase B features: cart (D7), exports (D8), commission (D4), taxonomy (D5), Amazon (D6), emails and notifications → Phase C mobile → D security → E iOS → F stores. After each phase I report results, with every check run twice.
