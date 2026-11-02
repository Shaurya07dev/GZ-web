# Email go-live

What stands between the email system and real customers, how it sends safely, how it was tested,
and the decisions that belong to the owner. Written 1 and 2 Nov 2026. The list of every email, and
how to add one, is in [`EMAIL_EVENTS.md`](EMAIL_EVENTS.md); the code is in
`backend/apps/api/src/mail/`.

Four things stop customers getting email today, and none of them is code: the site address in the
links, the sender address, a mailbox for replies, and the Resend plan.

## Go-live checklist

Checked on 1 Nov 2026 against public DNS and the live sites. The Railway and Resend dashboards were
not available to this check, so those rows say "confirm".

| Step | What was found | Who | Status |
| --- | --- | --- | --- |
| Point www.galleryzone.art at the current Vercel build | Every button in an email links to this site. All 19 email link pages tried returned 404 there. On gz-web-livid.vercel.app, 17 of the 19 load or send a signed-out visitor to sign-in; the other two are /cart, which ships with PR #33, and a made-up artwork id. | Shaurya (Vercel) | Blocking |
| Set `EMAIL_FROM` on Railway, for example `GalleryZone <hello@galleryzone.art>` | The default sender is `onboarding@resend.dev`. Resend refuses it for anyone but the account owner (403, "You can only send testing emails to your own email address"). | Developer sets it; owner picks the address | Confirm |
| Create a mailbox and set `EMAIL_REPLY_TO` | galleryzone.art has no mail server (no MX record), so a reply to any email would bounce. The bank-change, NFC-tag and support emails all tell people to reply. | Owner (mailbox), then developer | Missing |
| Move Resend from Free to Pro | Free stops at 100 emails a day with no overage. Pro is $20 a month for 50,000. One order sends 9 emails from payment to delivery, so about 11 orders a day would reach the Free cap. | Owner (billing) | Confirm |
| Set `RESEND_API_KEY` and `PUBLIC_SITE_URL` on Railway | With no key the API only writes emails to its log. `PUBLIC_SITE_URL` should be `https://www.galleryzone.art`; if it is unset, links use the first CORS origin. | Developer | Confirm |
| Check the domain says Verified in Resend | DNS already has the DKIM key (`resend._domainkey`), the return-path MX and SPF on `send.galleryzone.art`, and DMARC at `p=quarantine`. | Owner | DNS in place |
| Send real test emails | Run `npm run email:send-sample -- your@address --all` (needs the key and sender set), then read them in Gmail, Outlook, iCloud and Yahoo, and on a phone. Resend's `delivered@resend.dev` and `bounced@resend.dev` exercise the success and bounce paths safely. | Developer and owner | After the rows above |
| Point DMARC reports at a mailbox the team reads | The record sends reports to `dmarc_rua@onsecureserver.net`, GoDaddy's default address. | Owner (GoDaddy DNS) | Optional |

## Sending safely

A failed email never fails the request, and a repeat of the same event never sends twice. What is
still missing is hearing about bounces.

| Risk | What happens now |
| --- | --- |
| The same email sent twice | Every email carries an idempotency key naming the thing that happened (an order, a holding, a top-up). Resend keeps a key for 24 hours, answers a repeat with the original result, and refuses the same key with different content ([idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)). Emails that can happen again carry a part that changes. Two were wrong and are fixed: the resent confirmation link shared the welcome's key, so it sent nothing for a day, and a resubmitted artwork could miss the review queue. |
| Resend slows us down or has a bad moment | The limit is 10 requests a second per team, and it answers 429 with a retry-after ([rate limit](https://resend.com/docs/api-reference/rate-limit)). The mailer retries rate limits, server errors and an in-flight duplicate, up to three tries, and writes the failure to the log if it still fails. |
| The plan runs out | A daily or monthly quota error is not retried, because it would fail again. The log says the plan's limit is used up ([errors](https://resend.com/docs/api-reference/errors)). |
| An address bounces or marks us as spam | Resend reports these as bounced, complained and suppressed events ([webhook events](https://resend.com/docs/dashboard/webhooks/event-types)). Nothing in our app listens yet, so nobody on the team hears that a customer's address does not work. |
| People who do not want an email | Security and transaction emails always send. Only the cart reminder honours a preference, and only collectors have a settings page for it. Gmail's bulk-sender rules (over 5,000 a day) require one-click unsubscribe on marketing mail ([Google](https://support.google.com/a/answer/81126)); GalleryZone is far below that and sends no marketing email, but the headers are needed before newsletters or digests start. |
| Someone floods an inbox | Registration allows 3 a minute and 20 an hour, password reset 3 a minute and 10 an hour. Resending the confirmation link now has the same limit as a reset, because it really sends every time. |
| Private details in an email or a log | A bank account appears only as its last four digits. Password-reset addresses are hidden in the log. Admin emails go to every admin in one message, so admins can see each other's addresses. |

## Testing before launch

The email code is tested as far as it can be without a live Resend account and real inboxes; what is
left is the part only the owner can do, listed as tasks below.

Checked so far:

- The backend's full check (68 steps) passes with the new email check in it.
- The check renders all 66 emails and tests each for: names and titles escaped once, a plain-text
  part with no markup or entities, every link absolute and on the site, 14 text and background colour
  pairs at 4.5:1 or better in light and dark, a subject of 110 characters or fewer, one heading,
  balanced markup, under 60 KB, and a row for it in `EMAIL_EVENTS.md`.
- The real email service was run against the seeded demo database with a fake mailer
  (`npm run check:email-demo`). It produced 33 emails from real orders, sales, holdings, top-ups,
  reports and blogs, with the right names, titles and amounts, and saved the in-app copies.
- Six emails were opened in a browser at desktop and phone width, in light and dark mode.

Not checked: how Gmail, Outlook, Apple Mail and Yahoo draw them, a real send through Resend (no key was
available), where they land (inbox or spam), and whether Resend shows the domain as Verified.

Before launch:

- [ ] Shaurya points www.galleryzone.art at the current Vercel build, so the buttons and the logo load.
- [ ] Set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` and `PUBLIC_SITE_URL` on Railway, restart, and check the boot log shows no email warning.
- [ ] Run `npm run email:send-sample -- your@address --all` and read all 66 on a phone and in dark mode, in Gmail and one other client.
- [ ] Send one to `delivered@resend.dev` and one to `bounced@resend.dev` ([test addresses](https://resend.com/docs/dashboard/emails/send-test-emails)) and check the bounce shows in the Resend dashboard.
- [ ] Place a test order and move it through each status; each email should arrive once.
- [ ] Request a password reset and a resend of the confirmation link; both should arrive.

## Decisions needed from the owner

The payout rule matters most, because the emails and the code currently disagree. The rest are quick.

| Decision | Recommendation | Why |
| --- | --- | --- |
| What is the payout rule? | Decide whether an artist's money is held after delivery | The emails to artists say the payout is released once the piece is delivered, and the delivered email says after the return window closes. The code credits the wallet when the order is paid and no code holds it back or releases it later. Either the rule or those sentences should change. |
| Sender and reply address | One sender, `GalleryZone <hello@galleryzone.art>`, with replies to `support@galleryzone.art` | One name for customers, and less to set up. |
| Who reads the support mailbox, and on which service | Google Workspace, Zoho Mail or GoDaddy mail | The domain has no mail server today, so replies to any email would bounce. |
| Resend plan | Pro, $20 a month, before launch | The Free plan stops at 100 emails a day, and one order sends 9. |
| Insurance | Confirm it is gone for good | The two insurance emails are removed, but the admin endpoints that approve and reject insurance still exist and could be removed too. |
| Cart reminder | Keep it off until it has an unsubscribe link | It would email every collector with a stale cart, because the preference is on by default. It also needs a daily job. |
| Registered address and CIN in the footer | Add them if you want them shown, reading them from the `INVOICE_SELLER_*` settings | The footer shows the company name only. Those settings already hold the address and CIN, but default to placeholders until they are set in production. |
| Bounce alerts | Add a small Resend webhook that tells admins when an address bounces | Otherwise a customer with a mistyped address silently never gets their order emails. |
| Wording | Read the 66 emails once and mark anything to change | The wording was written fresh for this change, and the owner knows the brand's voice better. `npm run email:preview` writes them all as HTML to open in a browser. |

## Sources

Pages opened for the figures above, and what was read directly on 1 Nov 2026.

- [Resend pricing](https://resend.com/pricing): Free is 3,000 emails a month and 100 a day; Pro is $20 a month for 50,000.
- [Resend rate limit](https://resend.com/docs/api-reference/rate-limit): 10 requests a second per team, 429 with retry-after.
- [Resend errors](https://resend.com/docs/api-reference/errors): the test sender refuses anyone but the account owner (403); quota errors are 429.
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys): kept for 24 hours; the same key with different content is refused (409).
- [Resend webhook events](https://resend.com/docs/dashboard/webhooks/event-types): bounced, complained, suppressed and others.
- [Resend test addresses](https://resend.com/docs/dashboard/emails/send-test-emails): delivered, bounced, complained and suppressed at resend.dev.
- [Google's email sender guidelines](https://support.google.com/a/answer/81126): SPF or DKIM for every sender; one-click unsubscribe for bulk senders over 5,000 a day.
- DNS for galleryzone.art, read through Google Public DNS (8.8.8.8): DKIM key at `resend._domainkey`, return path and SPF at `send`, DMARC policy quarantine, no MX or TXT record on the main domain.
- The live sites www.galleryzone.art and gz-web-livid.vercel.app, 19 member-area and account pages, status codes read on the same day.
