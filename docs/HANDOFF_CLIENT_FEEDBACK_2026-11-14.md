# Handoff: client feedback of 14 Nov 2026

Branch: `fix/client-feedback-14nov` on the fork `Yash13606/GZ-web`, 14 commits on top of `main` at `f38ec99`.
Compare: https://github.com/Shaurya07dev/GZ-web/compare/main...Yash13606:fix/client-feedback-14nov?expand=1

The author has read-only access to `Shaurya07dev/GZ-web`, so nothing here is merged or deployed. Whoever has
write access and production access (Railway, Vercel, Firestore) takes it from here: review, open the pull
request into `main`, deploy, do the production tasks in section 4, and pick up the open items in section 5.

Nothing in this branch has been tried on galleryzone.in, against real Firebase, or by hand in a real browser.
It was checked with type-checks, the backend `npm run check`, small `*.check.ts` files and Playwright tests with
the API stubbed (section 6).

---

## 1. How to get it and land it

```bash
git remote add yash https://github.com/Yash13606/GZ-web.git   # once
git fetch yash
git switch -c fix/client-feedback-14nov yash/fix/client-feedback-14nov
git log --oneline main..HEAD        # 14 commits (13 of code, the last is this file): each message says what and why
```

Then either open the pull request from the compare link above, or push the branch to `origin` yourself.

- **Order of deployment: backend (Railway) first, then web (Vercel).** The new backend is safe with the old
  website. The new website without the new backend would leave the certificate public on the tag page and give
  the Broadcasts page nothing to call.
- No new environment variables, no database migration, no Firestore index was needed (see 4.3).
- PR #40 (`fix/error-messages-and-cart-ux`) is open upstream and also edits `frontend-web/services/adminService.ts`
  (a comment). Expect, at most, a trivial conflict there.
- Line endings: the repo is CRLF on Windows (`core.autocrlf=true`). Git warnings about LF/CRLF are harmless.

## 2. What the branch contains

| Client item | What changed | Main files |
|---|---|---|
| Price block UI break | Prices use lining numerals; medium shown as "Acrylic on canvas", not the slug | `components/shared/price-tag.tsx`, `features/marketplace/artwork-info-panel.tsx`, `lib/utils.ts` (`humanize`) |
| 1 Art types | Dropdown lists 28 Indian + 97 world forms + Other, grouped, searchable. Stored value is the label (API takes free text, max 80) | `features/dashboard/artwork-submit-data.ts`, `artwork-submit-form.tsx` |
| 2, 6 Wallet | "Wallet balance" card removed; the word removed from site, admin, aggregator labels, 12 emails. Earnings pages moved to `/dashboard/earnings` and `/aggregator/earnings`, old paths 308-redirect | `features/dashboard/dashboard-data.ts`, `backend/apps/api/src/mail/templates.ts`, `frontend-web/next.config.ts`, `app/*/earnings/page.tsx` |
| 3 Photos | Form recommends at least 3 photos (guidance only) | `artwork-submit-form.tsx` |
| 7 Certificate | Tag page shows the Display card to strangers. Only the current owner, the artist and admins get the certificate (number, issue date, artist signature) from `GET /v1/verify/:id`, using an optional Bearer token. Public answer is cached, authorised answer is `private, no-store`, `Vary: Authorization` | `backend/apps/api/src/verify.controller.ts`, `verify-view.ts`, `frontend-web/features/verify/nfc-artwork-passport-view.tsx`, `hooks/useVerify.ts` |
| 8 Profile photo | Visible "Upload photo" button (the old camera icon was hover-only) | `features/dashboard/profile-kyc-form.tsx` |
| 9 MOU signatory | Designation default "Director & COO"; signature image drawn on signed MOUs (screen and PDF), both artist and aggregator. Name stays "GalleryZone Private Limited" | `features/mou/mou-document.ts`, `mou-pdf.ts`, `public/brand/mou-signatory-signature.png`, `backend/packages/config/src/env.ts` |
| 10 Reviewed by | See section 3 | `features/admin/moderation/*`, `backend/packages/db/src/reviews.ts` |
| 11 Messages | Admin Broadcasts (section 3b) | `backend/packages/db/src/broadcasts.ts`, `features/admin/broadcasts/` |
| 12 Landing cards | Whole card clickable. Certificate opens `/dashboard/coa-nfc` (artist) or `/account/coa-nfc` (collector); others keep the explainers. Legacy shows certificate number and date | `features/landing/identity-section.tsx`, `features/passport/passport-viewer-panel.tsx` |
| 13 Must buy | "Must buy" category is a top segment on `/art-supplies`, ordered NFC, hangers, nylon thread, sticky nail, rolling paper, bubble wrap, cardboard. Draws nothing when empty. "Newest" pill added; Trending was dropped by decision | `features/art-supplies/supplies-shelf.tsx` |
| 14 Click-through | Live artwork cards open their page (My artworks, Portfolio) | `features/dashboard/artworks-board.tsx`, `portfolio-board.tsx`, `types/artwork.ts` (`HAS_PUBLIC_PAGE`) |
| Aggregator Browse | Search, Filters sheet, category chips, Sort, Saved chip, working heart (server wishlist) | `features/aggregator/inventory-browser.tsx`, `reservable-inventory-grid.tsx`, `lib/inventory-filters.ts` |
| Aggregator UI | Dashboard "Recent activity" empty card now shows the newest pieces; profile form GST row full width | `features/aggregator/aggregator-activity-feed.tsx`, `profile-form.tsx` |
| Build fix | `hooks/useVerify.ts` had been saved in a legacy encoding and would not compile | commit `6c57339` |

## 3. The two builds in this branch you will want to read first

### 3a. "Reviewed by" on the six admin queues

Every queue has a **Waiting / Reviewed** switch (`features/admin/moderation/queue-view.tsx`). Reviewed lists what an
admin already decided. A **Reviewed by** column sits right before the action column: "Approved by Priya Sharma,
12 Nov 2026". Reviewed rows have no Review button and are not clickable (except artworks, which open the
catalogue page `/admin/artworks/:id`).

Where the reviewer comes from:

| Queue | Source | Notes |
|---|---|---|
| GST, KYC | audit log rows `gst.approved/rejected`, `kyc.approved/rejected` (written by `moderation.ts`) | `GET /v1/admin/moderation/gst\|kyc?state=waiting\|reviewed`; a waiting row that was rejected earlier shows who rejected it |
| Deactivations | audit log `deactivation.approved/rejected` | `decidedByName` on each row |
| External fees | audit log `external_sale_fee.approved/waived` | `decidedByName` on each row |
| Withdrawals | new field `processedBy` on `withdrawalRequests` | recorded from now on; older rows show a dash. The withdrawal flow itself is not live (client said no withdrawals) |
| Artworks | the piece's status history, in the browser (`lib/artwork-review.ts`) | an admin approving (status `marketplace`) or returning with a reason counts. Moves by an artist or an aggregator, and "Delisted by admin", do not. History events now carry `changedByRole` (`artist-artworks.ts`) to tell them apart |

Backend: `backend/packages/db/src/reviews.ts` (`loadReviews`, `latestPerEntity`, `adminNames`) with
`reviews.check.ts`. One audit-log read per queue request, filtered by action. Fine at this size; if the audit
log gets large, index by entity or copy the reviewer onto the record.

### 3b. Admin Broadcasts (client item 11)

Admin, System, **Broadcasts** (`/admin/broadcasts`): tick Artists, Aggregators or both (it shows how many
people each reaches), title, message (2000 characters), optional page to open, live preview, confirm, send. A
history list shows what was sent, by whom, to how many.

- `POST /v1/admin/broadcasts`, `GET /v1/admin/broadcasts`, `GET /v1/admin/broadcasts/reach`
  (`backend/apps/api/src/broadcasts.controller.ts`, db logic in `packages/db/src/broadcasts.ts`).
- Each recipient gets a thread in `messageThreads` (the source of the Messages page, which nothing wrote to
  before) and a bell notification under `users/{uid}/notifications`. Doc ids are deterministic
  (`bc_<broadcastId>_<uid>`), so a retry cannot double-deliver. Suspended and blocked accounts are skipped.
- The link a message points at must be a page on this site (one leading slash).
- The fan-out is inline, 200 recipients per batch. Move it to a job if the audience grows past a few thousand.
- Not emailed. The client has not been asked whether it should be (open question Q5).

## 4. Production tasks (need Railway, Vercel, Firestore access)

1. **Deploy** backend then web.
2. **Railway:** if `MOU_SIGNATORY_DESIGNATION` is set, change it to `Director & COO` or delete it, otherwise
   the old value wins over the new default. `MOU_SIGNATORY_NAME` can stay unset ("GalleryZone Private Limited").
3. **Firestore:** nothing to create. `broadcasts` is a new collection created on first send and is closed to
   browsers by the existing catch-all deny rule. The new queries are single-field (`where action in [...]`,
   `where role in [...]`, `where userId ==`), so no composite index should be needed. If Firestore does ask
   for one in the logs, deploy it with `backend/scripts/deploy-indexes.mjs`.
4. **Art supplies, `/admin/art-supplies`:**
   - Give the category `Must buy` to the existing bubble wrap and cardboard products. Candidates from the seed
     file (production may differ; the client should confirm): bubble wrap `B0FNNFVQ9R`, `B07QPJK2GS`,
     `B0CQD1MKKF`; cardboard and corrugated `B0BWNCPBYT`, `B0DVQ4RHPB`, `B0HL6Z42T1`, `B0GVJ8C469`,
     `B0CCW3V66W`.
   - Add the one new product from the client's chat: `https://link.amazon/B01M2lDtc` (ASIN `B0BMGM1R35`).
     Use "Fill in from Amazon"; Amazon blocked the automated lookup from the author's machine, so fill title
     and photo by hand if it blocks you too. Keep the link exactly as given (the affiliate tag is in it).
   - The other 141 links in the client's chat are already on the shelf.
5. **Smoke test after deploy** (a phone is best for the first one):
   - Tap or scan a tag **signed out**: Display card, no certificate. Then as the owner, the artist and an admin:
     certificate. Then as another collector: Display card.
   - Admin, Broadcasts: send one to a single test account first (tick one audience that holds it), then check
     its Messages page and bell.
   - Open a signed artist MOU and a signed aggregator MOU: "Director & COO" and the signature image show,
     and the downloaded PDF has the image.
   - Admin queues: switch to Reviewed on each of the six and check the names.
   - `/dashboard/wallet` and `/aggregator/wallet` redirect to `/earnings`.
6. The signature image is a **public file** in the repository and on the website (the owner chose that,
   knowing the repository is public).

## 5. Still open (for you to pick up, or to put to the client)

| # | Item | State and what is needed |
|---|---|---|
| Q1 | NFC video in the artist's NFC steps | No video file exists in the repo or `GZ-videos`. Client must send it. Place: the artist dashboard NFC steps (`features/dashboard/coa-nfc-board.tsx`, `link-nfc-dialog.tsx`). Do not ship an empty slot |
| Q2 | Admin sees where an artwork is, from NFC scans | Not built. A scan stores no place today. Recommended: GPS if the scanner allows it, else city from the request's IP; a record on each scan; an admin screen with the last known place and history; a line in the privacy policy. Needs the client's decision on GPS vs IP only |
| Q3 | Must buy: the five missing products | Client to send Amazon affiliate links for NFC tags, hangers, nylon thread, sticky nail, rolling paper. Add them via the admin screen with category `Must buy` |
| Q4 | MOU wallet wording | Left as signed on purpose (client decision). Clauses: artist 11.2, 11.3, 11.4, 20.6, 35.3 and all of 36; aggregator 9.9, 24.3 and all of 25. Texts: `docs/legal/`, `frontend-web/features/dashboard/mou-data.ts`, `features/aggregator/aggregator-mou-data.ts`, `mobile/lib/features/*/mou_data.dart`. Any change needs the lawyer and a new MOU version (everyone signs again). Clause 9.9 of the aggregator MOU contains a broken character ("Aggregator�s") |
| Q5 | Should a broadcast also be emailed? | Currently Messages inbox and bell only. Email needs real sending switched on (`docs/EMAIL_GO_LIVE.md`) |
| Q6 | Landing "Identity" card | Unchanged (client did not mention it) |
| Mobile | Flutter app (client said: after the website is live) | Not touched: wallet wording and screens, the 3-photo hint, the 125 art types, the MOU signature image (the app already gets the new designation from the API). The app calls `GET /v1/verify/:id` with its token when signed in, so owners should still see their certificate; verify on a device. Check that broadcasts show in the app's Messages. Needs a new APK |

## 6. Checks and how to run them

```bash
cd backend && npm ci && npm run check            # all checks incl. reviews, broadcasts, verify-view, email
cd backend && npx tsc -b tsconfig.build.json && npm run build --workspace=@galleryzone/api
cd frontend-web && npx tsc --noEmit -p . && node --experimental-strip-types lib/inventory-filters.check.ts \
  && node --experimental-strip-types lib/artwork-review.check.ts \
  && node --experimental-strip-types features/mou/mou-document.check.ts
```

Browser tests (API stubbed, nothing leaves the machine). The Firebase values are placeholders, no real keys:

```bash
cd frontend-web
NEXT_PUBLIC_FIREBASE_API_KEY=placeholder NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=placeholder.firebaseapp.com \
NEXT_PUBLIC_FIREBASE_PROJECT_ID=placeholder NEXT_PUBLIC_FIREBASE_APP_ID=placeholder npx next dev --webpack -H 127.0.0.1 -p 3000
# in another terminal, same variables:
npx playwright test tests/functional/admin-reviewed-by.spec.ts --workers=2 --project=chromium
```

Use `next dev --webpack`: Turbopack's dev server failed on `next/font/google` on the author's machine. The first
run after a cold start can time out on first-compile pages; rerun the failures alone.

New or changed specs: `admin-reviewed-by`, `admin-broadcast`, `landing-cards`, `art-supplies`,
`aggregator-money`, `mou-signing`.

**Failing on a clean `main` too (not from this branch):** `mou-signing.spec.ts:92` (artist signs, PDF download),
`profile-states.spec.ts:61` (login logo), `aggregator-money.spec.ts:386` (closing Razorpay is still verified).

## 7. Traps the author hit

- Python on Windows writes files as cp1252 by default. An em dash in a comment made `hooks/useVerify.ts`
  invalid UTF-8. Next cannot compile it, and `tsc` and eslint do not catch it. Write with `encoding="utf-8"`
  or an editor, and scan changed files before pushing.
- Playwright clicks on the profile pages stall ("element is not stable") in this setup. The MOU tests open the
  `<details>` with `evaluate` and trigger the download with `evaluate(b => b.click())`.
- jsPDF lists a shared image on every page. Count unique image ids, not per-page images.
- The Messages inbox reads `messageThreads`, not `users/{uid}/notifications`. Two different features.

## 8. Message to send (WhatsApp)

> Hi! I have a branch with the client's 14 Nov feedback ready for review: `fix/client-feedback-14nov` on my fork
> `Yash13606/GZ-web` (14 commits on top of main f38ec99). Everything is explained in
> `docs/HANDOFF_CLIENT_FEEDBACK_2026-11-14.md` on that branch. Could you:
> 1) pull it and read that file, 2) review the code and run the checks in section 6, 3) open the PR into main
> (compare link is at the top of the file), 4) deploy backend first, then web, 5) do the production tasks in
> section 4 (Railway MOU setting, the Must buy products in /admin/art-supplies, a smoke test), and 6) pick up
> the open items in section 5. The three older failing tests listed in section 6 also fail on main, so ignore them.

## 9. Prompt for an AI coding assistant (optional)

```text
Read docs/HANDOFF_CLIENT_FEEDBACK_2026-11-14.md in this repository (branch fix/client-feedback-14nov), then:
1. Review the 14 commits on top of main (git log --oneline main..HEAD). Focus on backend/apps/api/src/verify.controller.ts
   (certificate gating by optional Bearer token), backend/packages/db/src/broadcasts.ts, backend/packages/db/src/reviews.ts,
   and the six queue tables under frontend-web/features/admin/moderation/.
2. Run the checks in section 6 of the file and report anything that fails other than the three tests it lists as already failing.
3. Do not change the MOU wallet wording. Do not commit secrets. Keep changes small and say what you skipped.
4. Then work through section 5 in order. For anything marked as needing the client's decision, stop and list the
   exact question instead of guessing.
```
