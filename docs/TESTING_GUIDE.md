# GalleryZone — testing guide (pre-launch)

Live: **https://www.galleryzone.art** (also https://gz-web-livid.vercel.app) → API https://api-production-9fd9.up.railway.app.
Payments run on **Razorpay**. With `PAYMENTS_MODE=simulated` (the default) there is no gateway at all; with `PAYMENTS_MODE=razorpay` and `rzp_test_` keys it is Razorpay test mode. Nothing real is charged either way.

Cashfree is still in the stack, but only for **Aadhaar and GSTIN verification** (Secure ID) — it is not the payment gateway. The gateway moved to Cashfree on 4 Oct 2026 and back on 5 Oct 2026.

## Accounts

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin #1 | `gz-test-admin@example.com` | `Passw0rd123` | promoted (platform_admin) |
| Admin #2 | `gz-admin-2@galleryzone.art` | `Passw0rd123` | platform_admin (done) |
| Artist | `gz-test-oauth@example.com` | `Passw0rd123` | owns "Test Canvas" (live); profile has PAN, bank mask, location |
| Customer | `gz-test-customer@example.com` | `Passw0rd123` | has a saved Pune address |
| Aggregator | `gz-test-aggregator@galleryzone.art` | `Passw0rd123` | "Verandah Art House"; sign the partner MOU first |
| You | `shaurya8851@gmail.com` | (reset via email) | only inbox that receives mail until DNS is done |

Register fresh accounts at `/register` (artist / aggregator / customer). Admins are never self-serve: register as a customer, then flip the fields in Firestore.

Change any password with **Forgot password** on `/login` — the email is real (Resend).

## Bootstrap — DONE on 2026-09-16

- Pricing rules v1 proposed by Admin #1 and approved by Admin #2 (`/admin/settings` shows them). Checkout works.
- The test artist's piece "Test Canvas" is **approved and live** (certificate `GZ-COA-2026-0001`) — `/marketplace`, `/artists`, `/verify/KPLfLUGiuoj0GFXpkJRG` all show it.
- Still to do by hand: `/admin/categories` → create the categories artists may pick (Painting, Sculpture, Photography, …).

## Flow 1 — Artist lists a piece

1. Register as an artist (or use the test artist) → `/dashboard`.
2. Profile → sign the **MOU** (v2026.2). Signature name must match the account name.
3. Add artwork → fill details, upload 1–8 photos (JPEG/PNG/WebP), set your price → **Submit for review**.
   - You receive "in review"; every admin receives "Review: …".
4. Admin → `/admin/moderation/artworks` → open → **Approve** (or reject with a reason).
   - Approval issues the certificate number `GZ-COA-2026-nnnn` and emails the artist.
5. The piece appears on `/marketplace` within 60 s (read cache) with real facets/filters; `/artists` now lists the artist; `/about` counts update.

## Flow 2 — Collector buys

1. Register as a customer → `/marketplace` → open the piece → **Buy now**.
2. Add a delivery address → review → **Pay**.
3. Razorpay Checkout opens in a modal. In test mode use card `4111 1111 1111 1111`, any future expiry, any CVV, and approve the 3-D Secure page — or pick **UPI** and use the `success@razorpay` VPA. (Razorpay's test-card page lists the rest, including cards that deliberately fail.)
4. On success: order → **paid**, ownership transfers to the buyer, the piece leaves the marketplace, buyer gets a receipt email, artist gets a "Sold" email with the net payout.
5. `/verify/<artworkId>` (also the QR on the certificate) shows the new owner. `/account/orders` lists the order with the gateway payment id.
6. Webhook: dashboard.razorpay.com → Account & Settings → Webhooks → add
   `https://api-production-9fd9.up.railway.app/v1/payments/razorpay/webhook`,
   events `payment.captured`, `order.paid`, `payment.failed`. The secret is one
   **you choose** here, and it must match `RAZORPAY_WEBHOOK_SECRET` — it is a
   third credential, not the API secret.

   Worth knowing, because it is not how the old Razorpay integration worked:
   the browser does post a signed result back, and its HMAC is checked, but
   that alone no longer settles anything. The API then re-reads the order from
   Razorpay over its own connection and compares the amount against our own
   total, so an order is marked paid because **Razorpay** said it was paid for
   the right amount. The webhook is what makes it robust if you close the tab;
   both paths are idempotent, so whichever lands second does nothing.

   Two things worth trying deliberately: close the modal without paying (you
   should see "Payment cancelled — nothing was charged", and the order stays
   pending), and pay with a UPI app in a way that completes after the modal
   gives up — the order should still end up paid, via the webhook.

## Flow 2b — Artist verifies GSTIN and Aadhaar

Needs the Secure ID keys **and** `CASHFREE_VERIFICATION_PUBLIC_KEY` (2FA set to
Public Key in the Cashfree dashboard). Without a 2FA factor both actions answer
503 and the UI says the check is unavailable — which is deliberate: a
misconfiguration on our side must never be shown as "your GSTIN is invalid".

1. Artist → `/dashboard/profile` → enter a real GSTIN → **Save** (the check runs
   against the saved value, so the button stays disabled until you save).
2. **Verify with the GST registry** → on a pass you see the registered legal
   name and the badge moves to *Pending GalleryZone approval*. It does NOT move
   to Approved: a machine check is evidence, and an admin still decides, because
   the GST flag drives invoicing and the §194-O TDS threshold.
3. **Verify with DigiLocker** → you are sent to DigiLocker, consent there, and
   come back to the profile. The result arrives on the webhook, so the badge may
   take a moment; only your verified name and the last four Aadhaar digits are
   stored — the full number never reaches GalleryZone.
4. Webhook: merchant.cashfree.com → Developers → Webhooks, under **Secure ID**
   → `https://api-production-9fd9.up.railway.app/v1/verification/cashfree/webhook`,
   the `DIGILOCKER_VERIFICATION_*` events. This is a different endpoint and a
   different secret from the payment webhook.

## Flow 3 — Certificates & provenance

- Artist dashboard → **Certificates** → download the PDF (with QR) for any approved piece.
- Collector → artwork → **Request physical certificate** → artist gets an email, sees it in Certificates → **Mark dispatched** with a courier ref.
- Collector → **Transfer ownership** to another email → that person gets an invite email → signs in with that email → accepts. Passport updates.

## Flow 3b — Partner gallery (aggregator)

1. Artist: list a piece with listing type **Marketplace + Aggregator** (or Aggregator only) → admin approves.
2. Sign in as the aggregator → **Profile → sign the partner MOU** → **Browse inventory** shows the piece with this month's terms (offer price, advance, delivery deposit) → **Reserve**.
   - The artwork leaves the marketplace (`with_aggregator`); the advance is recorded against the gallery's account.
3. **My inventory** → open the holding → optionally set the selling price once (never below the offer) → **Record sale** (buyer name/email, cash or paid-to-GalleryZone) or **Return** (advance refunded, piece back on the marketplace).
4. Sales → mark dispatched/delivered; cash sales → **Remit** when transferred. Admin can pull a piece back from `/admin/aggregators/<id>`.

## Flow 4 — Money

- Artist → **Wallet**: balance = settled sales; **Withdraw** (min ₹1,000) → artist + admins emailed.
- Admin → `/admin/moderation/withdrawals` → approve/reject → artist emailed. (Actual bank transfer is still manual — see "left".)

## What to look at if something fails

- API errors are RFC 7807 JSON; the `code` field is the thing to quote.
- Sentry: `galleryzone-api` (backend) and `javascript-nextjs` (web) in your org.
- Railway → service `api` → Logs. Every email attempt is logged (`[Mailer]`), including provider rejections.
- Resend → Emails shows every delivery.
