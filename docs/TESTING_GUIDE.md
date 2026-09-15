# GalleryZone — testing guide (pre-launch)

Live: **https://www.galleryzone.art** (also https://gz-web-livid.vercel.app) → API https://api-production-9fd9.up.railway.app.
Payments are in **Razorpay test mode** — nothing real is charged.

## Accounts

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin #1 | `gz-test-admin@example.com` | `Passw0rd123` | promoted (platform_admin) |
| Admin #2 | `gz-admin-2@galleryzone.art` | `Passw0rd123` | **you must set** `role: admin`, `status: active`, `roleGrants: ["platform_admin"]` on `users/Bh5GphRZkWeXHQziqWNgFm93bZA2` |
| Artist | `gz-test-oauth@example.com` | `Passw0rd123` | has one artwork pending approval |
| Customer | `gz-test-customer@example.com` | `Passw0rd123` | |
| You | `shaurya8851@gmail.com` | (reset via email) | only inbox that receives mail until DNS is done |

Register fresh accounts at `/register` (artist / aggregator / customer). Admins are never self-serve: register as a customer, then flip the fields in Firestore.

Change any password with **Forgot password** on `/login` — the email is real (Resend).

## The one-time bootstrap (admin, ~5 minutes)

1. Sign in as Admin #1 → `/admin/settings` → **Pricing rules → Propose default rules**.
2. Sign in as Admin #2 → `/admin/settings` → **Approve** the pending version. Two different platform admins are required by design; checkout is impossible until this exists.
3. `/admin/categories` → create the categories artists may pick (Painting, Sculpture, Photography, …).

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
3. Razorpay test checkout opens. Use: card `4111 1111 1111 1111`, any future expiry, any CVV, any OTP; or UPI `success@razorpay`.
4. On success: order → **paid**, ownership transfers to the buyer, the piece leaves the marketplace, buyer gets a receipt email, artist gets a "Sold" email with the net payout.
5. `/verify/<artworkId>` (also the QR on the certificate) shows the new owner. `/account/orders` lists the order with the gateway payment id.
6. Webhook: in Razorpay dashboard → Webhooks → point `https://api-production-9fd9.up.railway.app/v1/payments/razorpay/webhook` with the secret you gave me, events `payment.captured`, `payment.failed`, `order.paid`. The verify callback already marks orders paid; the webhook makes it robust if the buyer closes the tab.

## Flow 3 — Certificates & provenance

- Artist dashboard → **Certificates** → download the PDF (with QR) for any approved piece.
- Collector → artwork → **Request physical certificate** → artist gets an email, sees it in Certificates → **Mark dispatched** with a courier ref.
- Collector → **Transfer ownership** to another email → that person gets an invite email → signs in with that email → accepts. Passport updates.

## Flow 4 — Money

- Artist → **Wallet**: balance = settled sales; **Withdraw** (min ₹1,000) → artist + admins emailed.
- Admin → `/admin/moderation/withdrawals` → approve/reject → artist emailed. (Actual bank transfer is still manual — see "left".)

## What to look at if something fails

- API errors are RFC 7807 JSON; the `code` field is the thing to quote.
- Sentry: `galleryzone-api` (backend) and `javascript-nextjs` (web) in your org.
- Railway → service `api` → Logs. Every email attempt is logged (`[Mailer]`), including provider rejections.
- Resend → Emails shows every delivery.
