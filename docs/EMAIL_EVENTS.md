# Email events

Every moment GalleryZone should send mail, who receives it, and what is
built today. Written 19 Sep 2026 against `backend/apps/api/src/mail/`.

**Status key**

- **Live** — template written and wired to the event; it sends today.
- **Template only** — the template exists but nothing calls it; no mail goes out.
- **Not built** — neither template nor trigger.

**How sending works.** `Mailer.send()` (`mail/mailer.ts`) is fire-and-forget
and never throws — a failed send is logged, never a failed request. Every
send carries an idempotency key (e.g. `order-paid-buyer/<orderId>`), so a
retried request cannot send the same mail twice. With no `RESEND_API_KEY`
the mailer dry-runs and logs instead of sending.

**Two things gate real delivery right now**

1. `galleryzone.art` is registered in Resend but its DNS records are not
   verified, so mail goes out from the sandbox sender and **only reaches
   shaurya8851@gmail.com**. Until those records are added, no customer,
   artist or aggregator receives anything.
2. Admin-recipient mails resolve to every user with `role == "admin"`. If no
   admin account exists, those sends are silently skipped.

---

## 1. Account

| Event | To | Status | Notes |
|---|---|---|---|
| Registered (email/password) | the new user | **Live** | Carries the "confirm my email" link. |
| Registered via Google (first sign-in bootstrap) | the new user | **Live** | No verify link — Google already verified the address. |
| Password reset requested | the account | **Live** | One-use link, one hour. Sent even when the address has no account? No — silently skipped, so the form can't be used to discover who has an account. |
| Email verification re-sent | the account | **Live** | `POST /v1/auth/resend-verification`. |
| Email address changed | old **and** new address | **Not built** | Security-relevant: the old address must be told. |
| Password changed | the account | **Not built** | Same reason. |
| Account suspended / reactivated by an admin | the user | **Not built** | `POST /v1/admin/users/:id/status` changes it silently today. |
| Deactivation requested by the artist | the artist + admins | **Not built** | Request is recorded, nobody is told. |
| Deactivation approved / rejected | the artist | **Not built** | |

## 2. Artist — listings

| Event | To | Status | Notes |
|---|---|---|---|
| Artwork submitted for review | the artist | **Live** | "It's in review." |
| Artwork submitted for review | admins | **Live** | The review queue prompt. |
| Artwork approved and listed | the artist | **Live** | Includes the CoA certificate number. |
| Artwork rejected | the artist | **Live** | Carries the admin's reason. |
| Artwork delisted by an admin | the artist | **Not built** | `POST /v1/admin/artworks/:id/delist` is silent. |
| Free edit window about to close | the artist | **Not built** | Needs a scheduled job. |
| Listing expiring (end of the 180-day window) | the artist | **Not built** | Needs a scheduled job. |
| "Sold elsewhere" declared → external-sale fee raised | the artist | **Not built** | The fee appears in their wallet with no warning. |
| External-sale fee decided by an admin | the artist | **Not built** | |

## 3. Artist — compliance

| Event | To | Status | Notes |
|---|---|---|---|
| GSTIN approved / rejected | the artist | **Not built** | Matters for money: approval switches on 0.1% TDS withholding. |
| KYC approved / rejected | the artist | **Not built** | Blocks payouts while unresolved. |
| Insurance approved / rejected on a piece | the artist | **Not built** | |
| Artist MOU version bumped → re-signature required | all artists | **Not built** | Today they only find out on next sign-in. |
| Earnings crossed the ₹5,00,000 §194-O threshold | the artist | **Not built** | Admin flags it; the artist should know why TDS changed. |

## 4. Orders and payment

| Event | To | Status | Notes |
|---|---|---|---|
| Payment captured — order confirmed | the buyer | **Live** | Receipt with the total paid. |
| Payment captured — piece sold | the artist | **Live** | Shows their net settlement. |
| Payment captured | admins | **Not built** | No ops notification on a sale. |
| Payment failed or abandoned | the buyer | **Not built** | Cart-recovery mail. |
| Order confirmed → packed → in transit → delivered | the buyer | **Template only** | `orderStatus()` is written but `POST /v1/admin/orders/:id/status` never calls it. **Closest gap to a real complaint** — a buyer currently hears nothing between paying and delivery. |
| Order status changed | the artist | **Not built** | The artist can't see where their piece is either. |
| Order cancelled / refunded | the buyer + the artist | **Not built** | There is no refund flow yet at all. |
| GST invoice issued | the buyer | **Not built** | Needs the invoice PDF first. |
| Settlement released (7 days after delivery) | the artist | **Not built** | Needs the payout job. |

## 5. Money — wallet and payouts

| Event | To | Status | Notes |
|---|---|---|---|
| Withdrawal requested | the requester | **Live** | Artist, aggregator or collector. |
| Withdrawal requested | admins | **Live** | The approval prompt. |
| Withdrawal approved | the requester | **Live** | |
| Withdrawal rejected | the requester | **Live** | |
| Payout actually paid out (NEFT/RazorpayX reference) | the requester | **Not built** | Approval and payment are separate events; only approval is mailed. |
| Bank account changed on a profile | the account | **Not built** | Security-relevant — a changed payout destination should always be mailed. |

## 6. Certificates, ownership and the passport

| Event | To | Status | Notes |
|---|---|---|---|
| Physical CoA requested by an owner | the artist | **Live** | They hand-sign and dispatch it. |
| Physical CoA dispatched | the requester | **Not built** | The person waiting for it is never told it shipped. |
| Ownership transfer invited | the recipient | **Live** | Works for an unregistered recipient — the link is the whole flow. |
| Transfer accepted | the sender | **Not built** | |
| Transfer cancelled or expired | both parties | **Not built** | |
| Display period ended | both parties | **Not built** | |
| NFC tag linked to a piece | the artist | **Not built** | Low priority; the UI confirms it. |

## 7. Aggregators

| Event | To | Status | Notes |
|---|---|---|---|
| Aggregator reserved a piece | the aggregator | **Not built** | Their own confirmation of terms and advance. |
| Aggregator reserved a piece | the artist | **Not built** | **The artist's work leaves their studio and nobody emails them.** Highest-value gap in this section. |
| Reserved piece — shipping instructions | the artist | **Not built** | |
| Placement window closing (7 days out) | the aggregator | **Not built** | Needs a scheduled job. |
| Placement expired, piece must return | the aggregator + the artist | **Not built** | Needs the expiry cron. |
| Piece returned unsold | the artist + admins | **Not built** | |
| Sale recorded at a partner gallery | the artist + admins | **Not built** | |
| Cash-at-premises sale awaiting remittance | the aggregator | **Not built** | Chaser for money owed to GalleryZone. |
| Admin pulled a piece back | the aggregator + the artist | **Not built** | |
| Aggregator MOU re-signature required | all aggregators | **Not built** | |

## 8. Support and admin

| Event | To | Status | Notes |
|---|---|---|---|
| Support ticket raised | the person who raised it | **Not built** | No acknowledgement at all today. |
| Support ticket raised | admins | **Not built** | Tickets are only visible if an admin opens the queue. |
| Support ticket replied to | the requester | **Not built** | |
| Pricing-rule change proposed | the other platform admins | **Not built** | The two-admin approval needs a nudge to reach the second admin. |
| Pricing-rule change approved | both admins | **Not built** | Every price on the site just moved — worth a record. |

---

## Recommended order of work

1. **Order status → buyer.** The template already exists; it needs one call in
   `admin-orders.controller.ts`. Cheapest fix with the largest effect on how
   the product feels.
2. **Aggregator reservation → artist.** A physical artwork leaves a studio
   with no email. This is the one gap with real-world consequences.
3. **Compliance decisions** (GST, KYC, insurance) → the artist. These block
   money and the artist cannot tell why.
4. **Security mails**: password changed, email changed, bank account changed.
   Expected by default, and their absence is what an audit flags.
5. **Support acknowledgement**, both directions.
6. **Scheduled mails** — placement expiry, listing expiry, settlement
   released. These need the cron work that is already on the launch list, so
   they come last.

## Adding one

Add a method to `Emails` (`apps/api/src/mail/emails.ts`) following the shape
of the existing ones — resolve the recipient from Firestore, build a
`Layout`, and pass a stable idempotency key. Then call it from the
controller that owns the event with
`void this.emails.yourEvent(...).catch(this.emails.swallow("label"))`, so a
mail failure can never fail the request that triggered it.
