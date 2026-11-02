# Email events

Every email GalleryZone sends, who receives it, and what is not built. The catalogue
in `backend/apps/api/src/mail/templates.ts` is the source of truth (66 emails); this
page is its readable form, and `npm run check:email` fails if an email is in the
catalogue but missing here. Rewritten 2 Nov 2026. It replaces the 19/22 Sep version,
which still listed the insurance emails and showed the admin-delist email as live
although nothing called it.

**Status key**

- **Live**: written, wired to its event, and sent when it happens.
- **Built, not triggered**: written, but nothing fires it.
- **Not built**: no template and no trigger.

## How sending works

1. Something happens, and a controller, a payment webhook or a timer calls one method
   on `Emails` (`mail/emails.ts`) as `void this.emails.x(...).catch(this.emails.swallow("label"))`.
   It never waits: a mail failure is logged and never becomes an API error.
2. The method looks up the people and facts from ids and picks the idempotency key.
3. A template in `templates.ts` writes the email: a pure function that returns a subject
   and a description of the body. `layout.ts` renders it as HTML and as a plain-text twin.
4. The in-app inbox copy is saved first, so an email outage cannot lose it. One-time
   links (password reset, confirmation link) are kept out of the inbox.
5. `mailer.ts` sends through Resend with `EMAIL_REPLY_TO` as the reply address, and
   retries rate limits and server errors. With no `RESEND_API_KEY` it logs `[dry-run]`.

**The idempotency key** is what stops a retried request or a repeated webhook from sending
twice. Resend keeps a key for 24 hours, answers a repeat with the original result, and
refuses the same key with different content (409). An email that can legitimately happen
again (a second rejection, a resent link) therefore carries a part that changes: see
`again()` in `emails.ts`.

## What gates real delivery

1. **`www.galleryzone.art` must serve the current build.** Every button links there, and the
   header logo is `/brand/gz-email-logo.png`. On 1 Nov 2026 the domain served an old build
   on which all the member-area pages the emails link to were 404.
2. **`EMAIL_FROM`** must be an address on the verified domain, for example
   `GalleryZone <hello@galleryzone.art>`. `galleryzone.art` is verified in Resend (DKIM and
   return-path records were present on 1 Nov). The default, `onboarding@resend.dev`, only
   delivers to the Resend account owner.
3. **`EMAIL_REPLY_TO`** must be a mailbox someone reads. Several emails say "reply to this
   email", and `galleryzone.art` had no MX record on 1 Nov, so a reply would bounce.
4. **The Resend plan.** Free is 3,000 emails a month and 100 a day; one order sends 9.
5. **`PUBLIC_SITE_URL`** is `https://www.galleryzone.art`.
6. Admin-recipient emails go to every user with `role == "admin"`. With no admin account
   they are skipped.

Then read them in real inboxes: `npm run email:send-sample -- you@example.com --all`.

## The catalogue

### Everyone with an account (9)

| Email | Sends when | Status | Template id |
| --- | --- | --- | --- |
| Welcome, with a link to confirm the address | Someone registers | Live | `welcome` |
| Confirm your email address (link sent again) | They ask for the confirmation link again | Live | `verify-email` |
| Reset your password | They ask to reset their password | Live | `password-reset` |
| Your account is suspended | An admin suspends the account | Live | `account-suspended` |
| Your account is active again | An admin restores the account | Live | `account-restored` |
| Your payout account was changed | The payout bank account is changed or removed | Live | `bank-account-changed` |
| We've received your deactivation request | They ask to deactivate their account | Live | `deactivation-requested` |
| Your deactivation was approved or put on hold | An admin decides the request | Live | `deactivation-decided` |
| We've got your message | They send a support message | Live | `support-ack` |

### Collectors (13)

| Email | Sends when | Status | Template id |
| --- | --- | --- | --- |
| Order confirmed, payment received | Their payment is captured | Live | `order-paid-buyer` |
| Order confirmed with the artist | An admin confirms the order | Live | `order-confirmed-buyer` |
| Packed and ready to ship | The artist has packed it | Live | `order-packed-buyer` |
| On its way, with the courier and an estimate | The courier has it | Live | `order-transit-buyer` |
| Delivered, and how to open the passport | It is marked delivered | Live | `order-delivered-buyer` |
| Order cancelled | The order is cancelled | Live | `order-cancelled-buyer` |
| Payment didn't go through | The gateway declines their payment | Live | `payment-failed` |
| Someone wants to transfer or lend them a piece | Someone invites them to take or borrow a piece | Live | `transfer-invite` |
| Your transfer or loan was accepted | The person they invited accepts | Live | `transfer-accepted` |
| The transfer or loan was cancelled | The sender cancels an invite | Live | `transfer-cancelled` |
| Your transfer or loan was declined | The person they invited says no | Live | `transfer-declined` |
| Your printed certificate is on its way | The artist posts the printed certificate | Live | `coa-dispatched` |
| Your cart is waiting | A cart sits unpaid (built, nothing fires it yet) | Built, not triggered | `abandoned-cart` |

### Artists (25)

| Email | Sends when | Status | Template id |
| --- | --- | --- | --- |
| Your artwork is in review | They submit an artwork | Live | `artwork-submitted` |
| Your artwork is live | An admin approves it | Live | `artwork-approved` |
| Your artwork was returned, with the reviewer's note | An admin returns it | Live | `artwork-rejected` |
| Your artwork was removed from the marketplace | An admin removes a live piece | Live | `artwork-delisted` |
| Your artwork sold | Their piece sells | Live | `order-paid-artist` |
| Order confirmed: pack the piece | The order is confirmed | Live | `order-confirmed-artist` |
| Your piece is in transit | The courier has the piece | Live | `order-transit-artist` |
| Your piece was delivered | The piece is delivered | Live | `order-delivered-artist` |
| The order was cancelled | The order is cancelled | Live | `order-cancelled-artist` |
| Lock the NFC tag | A linked tag is still unlocked after 48 hours | Live | `nfc-reminder-48h` |
| Your tag is still not locked | The tag is still unlocked after 7 days | Live | `nfc-reminder-7d` |
| We're waiting on your NFC tag | An admin chases the tag by hand | Live | `nfc-nudge` |
| A collector wants the printed certificate | A collector asks for the printed certificate | Live | `coa-requested` |
| KYC verified (or needs another look) | An admin approves their KYC | Live | `kyc-verified` |
| GSTIN needs another look (or is verified) | An admin rejects their GSTIN | Live | `gst-needs-another-look` |
| Your agreement is signed | They sign the artist agreement | Live | `mou-signed-artist` |
| Your blog post is published | An admin publishes their blog post | Live | `blog-published` |
| Your blog post was returned | An admin returns their blog post | Live | `blog-returned` |
| A gallery has reserved your artwork | A gallery reserves their piece | Live | `holding-reserved-artist` |
| A gallery returned your artwork | A gallery sends the piece back | Live | `holding-returned-artist` |
| Your artwork sold at a gallery | A gallery sells their piece | Live | `sale-recorded-artist` |
| External-sale fee confirmed or waived | An admin decides an external-sale fee | Live | `external-fee-decided` |
| Withdrawal request received | They request a withdrawal (aggregators too) | Live | `withdrawal-requested` |
| Payout sent | An admin pays it out | Live | `withdrawal-paid` |
| Withdrawal not approved | An admin declines it | Live | `withdrawal-declined` |

### Aggregators (11)

| Email | Sends when | Status | Template id |
| --- | --- | --- | --- |
| Your reservation is confirmed | Their reservation completes | Live | `holding-reserved-aggregator` |
| Extension approved or declined | An admin answers an extension request | Live | `holding-extension-decided` |
| Your display period has ended | A placement window runs out | Live | `holding-period-ended` |
| Your return is recorded | They return an unsold piece | Live | `holding-returned-aggregator` |
| Your sale is recorded, and what to remit | They record a sale | Live | `sale-recorded-aggregator` |
| Wallet top-up received | A wallet top-up is paid | Live | `wallet-topup` |
| Cash remittance received | A cash remittance is paid | Live | `remittance-received` |
| Reservation couldn't be completed: refund | A paid reservation can't be completed and is refunded | Live | `reservation-refunded` |
| Your problem report is resolved | An admin resolves their problem report | Live | `holding-report-resolved` |
| Your agreement is signed | They sign the aggregator agreement | Live | `mou-signed-aggregator` |
| GSTIN verified (or needs another look) | An admin approves their GSTIN | Live | `gst-verified` |

### Admins (8)

| Email | Sends when | Status | Template id |
| --- | --- | --- | --- |
| New artwork awaiting approval | An artist submits a piece | Live | `artwork-submitted-admin` |
| Withdrawal awaiting approval | Someone requests a withdrawal | Live | `withdrawal-requested-admin` |
| Deactivation request | Someone asks to deactivate | Live | `deactivation-requested-admin` |
| New support ticket (reply goes to the person) | A support ticket arrives | Live | `support-new-admin` |
| A piece was priced far above the offer | A piece is reserved far above the offer | Live | `holding-price-warning` |
| An aggregator wants more time | An aggregator asks for more time | Live | `holding-extension-requested` |
| An aggregator reported a problem | An aggregator reports a problem with a piece | Live | `holding-report-filed` |
| A refund needs doing by hand | An automatic reservation refund fails | Live | `refund-failed-admin` |

## Not built

| Email | Why not yet |
| --- | --- |
| Password changed, email address changed (to the old and the new address) | Both happen inside Firebase Auth, not in our handlers: they need a Firebase Function on the auth events, or a server step on the reset page. |
| Order refunded | There is no refund action for marketplace orders. The cancelled email only says a refund is on its way. |
| Payout actually paid out (bank reference) | Approval and the bank transfer are separate events and only approval is mailed. Needs the payout integration. |
| GST invoice issued | The invoice PDF now exists (`invoice-pdf.ts`), so this is a small addition to the order-confirmed email. |
| Settlement released after delivery | Nothing holds a payout: the artist's ledger credit posts when the order is paid. The artist emails still say it is released after delivery and after the return window, so the owner must decide the rule first. |
| Payment captured, to admins | No ops notification on a sale. |
| Cart reminder | Built (`abandoned-cart`), nothing fires it. Needs a daily job over carts and the owner's go-ahead; the preference is on by default for every collector. |
| Placement window closing (7 days out), cash sale due or overdue | Needs a daily job. The sale already stores `remitDueAt`. |
| Free edit window closing, listing expiring (180 days) | Needs a daily job. |
| Artist or aggregator MOU version bumped, re-signature required | Today they find out at next sign-in. |
| Sales crossed the TDS threshold in the financial year | The artist should know why a payout came in lower. |
| KYC or GSTIN submitted, to admins | Admins find submissions by opening the queue. |
| Artist declares a sale made elsewhere | The fee decision is emailed; the declaration is not. |
| Admin pulled a piece back from a gallery | Neither side is told. |
| Shipping instructions after a reservation | |
| Support ticket replied to | There is no admin reply action; support answers by replying to the email. |
| Pricing rule proposed or approved | The second admin is not nudged; a change is not recorded by mail. |
| NFC tag linked | Low priority; the app confirms it. |
| Free access ending | Nothing bills artists yet. |
| Sign-in or verification code by email or WhatsApp | On the client's list. Today people confirm with a link. |
| Bounce and complaint alerts | Resend reports them as webhook events; nothing here listens, so nobody hears that a customer's address does not work. |

## Removed

- The two insurance emails (approved, rejected): the product no longer offers insurance, and
  they told artists a piece was "covered in transit and on display". The admin endpoints for
  insurance are untouched.
- Three emails that were written but never called: the courier hand-over and the delivery
  email (their wording now lives in `order-transit-buyer` and `order-delivered-buyer`), and
  "payout released" (see the settlement row above).

## Adding one

1. Write a function in `templates.ts` that returns `{ subject, category, layout }`, and add a
   row to `catalogue` (the id, who gets it, when, and a sample).
2. Add a row here. `npm run check:email` fails until you do.
3. Add a method to `Emails` that looks the facts up from ids and calls
   `this.deliver(key, to, T.yourEmail(...))`. Choose the key so that a repeat of the same event
   is the same key, and a legitimate second occurrence is not.
4. Call it from the controller that owns the event with
   `void this.emails.yourEvent(...).catch(this.emails.swallow("label"))`.
5. `npm run check:email` renders every email and checks escaping, the plain-text part, links and
   colour contrast. `npm run email:preview` writes them all as HTML. `npm run check:email-demo`
   runs the real service against the seeded demo data.
