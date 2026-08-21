# frontend-web — handoff

Read this before touching the website. It is the state of play as of
**21 Aug 2026**, commit `0d37384` on `main`.

Companion doc for the mobile app: `../mobile_flutter/NEXT_SESSION_PROMPT.md`.

---

## Where things live

| | |
|---|---|
| This repo | `Yash13606/GalleryZone` — personal, freeform. Build here. |
| Production | `galleryzone5-alt/gallery-web` — live at galleryzone.in. **Never push here** without Yash saying so, in that message. |
| Preview | `https://frontend-web-sigma-nine.vercel.app` — deploys this repo's `frontend-web/` from `main`. |
| Structure gotcha | Production has the Next app at the repo root; here it is nested under `frontend-web/`. Porting between them is never a directory copy. |

**There is no backend.** Every service under `services/` resolves fixture data
through `mockDelay()`, persisted to `localStorage` via `lib/mock-db.ts` and
`lib/mock-collections.ts`. State is per-browser: two people opening the preview
do not see each other's actions, and clearing site data resets everything.

---

## What is built

The August client meeting produced a 27-item list; a later handwritten note
added seven more. Everything on both is done except the items under
"Blocked" below.

Recent commits, newest first:

- `0d37384` — signed-in visitors are no longer trapped: `/login` and
  `/register` always reachable, header shows account link + Sign out, logo
  goes to the landing page when signed out and to your own side when signed in.
- `a367f7a` — aggregator coordinator block, MOU-gate on reserving, one-shot
  display price, artwork history in COA & NFC, walk-in buyers connecting to
  accounts by email, simulated Razorpay checkout.
- `020c0e2` — Demo Customer lands in the collector portal; checkout scrolls
  itself back into view between steps.
- `94350fd` — ported production's survey rewrite, 404 redesign, About colour
  fix and FAQ tab removal into this repo.
- `6bc7d4b` — physical COA fulfilment (MOU §12) and the aggregator MOU.
- `e1b65fc` — ownership transfer chain, artist MOU, edit-artwork route,
  persistent session.
- `0aeeb6a` — the first ten meeting items.

### Where to see each thing

Sign in through `/register` → the **Demo Artist / Aggregator / Customer**
buttons, which skip the form.

| Feature | Route | Role |
|---|---|---|
| Sales channel, physical fields, aggregator requirements, insurance, COA notice | `/dashboard/artworks/upload` | artist |
| Both prices, edit window, Sold on other platform | `/dashboard/artworks` | artist |
| Edit screen (7-day rule) | `/dashboard/artworks/<id>/edit` | artist |
| Artist MOU, GSTIN | `/dashboard/profile` | artist |
| Subscription card | `/dashboard/settings` | artist |
| COA, NFC, artwork history, transfer rights, paper-COA queue | `/dashboard/coa-nfc` | artist |
| Six-month listing model | `/dashboard/gallery-spaces` | artist |
| Aggregator MOU + coordinator | `/aggregator/profile` | aggregator |
| MOU gate on reserving | `/aggregator/inventory` | aggregator |
| One-shot display price | `/aggregator/collection` | aggregator |
| Paper COA request, ownership transfer (resale) | `/account/collection` | customer |
| Simulated Razorpay payment | `/checkout?artworkId=…` | customer |
| Passport, ownership history | `/verify/<artworkId>` | anyone |
| Transfer acceptance | `/transfer/<transferId>` | no account needed |

---

## Decisions that are settled — do not re-ask or re-derive

**From the signed MOUs** (`d:\ArtGllery\MOU of Artist.pdf`,
`d:\ArtGllery\GZ_MOU_ Aggregator.pdf`, both transcribed into
`features/dashboard/mou-data.ts` and `features/aggregator/aggregator-mou-data.ts`):

- Artist §9 — transit insurance mandatory; declining shifts all liability to
  the artist. Recommended threshold ₹20,000, partner HDFC ERGO.
- Artist §12 — work for aggregator display must be framed or stretched on
  canvas, with hangers, packed to standard. Also: a buyer may request the COA
  on paper after a sale, and the artist signs it by hand. That last clause is
  what the client's confusing "COA sign" comment meant.
- Artist §17/§18 — thirty-day aggregator display, six-month listing period.
- Aggregator §6 — one opportunity to set the selling price.
- Aggregator §7 — the aggregator **pays** a flat 5% security deposit plus
  delivery before taking possession.
- Aggregator §8 — the aggregator **earns** 20% × (Listed − Artist Price).
- Aggregator §10 — one nominated GalleryZone coordinator per premises.

**From Yash directly:**

- "Single-page website" meant session persistence, not hiding public pages: a
  signed-in person arriving at the site root goes to their own side. Buyers go
  to `/marketplace`, everyone else to their dashboard. The public pages stay
  public.
- Razorpay is a **simulation** for now. No keys, no gateway.
- Aggregators must sign their MOU in the website before reserving artwork.
- Keep interfaces ordinary. His customers are not advanced users — an earlier
  `?home=1` escape hatch was rejected for exactly this reason. If a solution
  needs explaining, it is the wrong solution.

---

## Blocked — do not guess these

1. **Commission.** The meeting said 5% month 1 and 3% months 2–6. The signed
   MOU says a flat 5% deposit paid and 20% of the markup earned, with no
   month-based tier anywhere. Yash is sending a separate document covering
   commission, GST and delivery. Until it arrives, leave the aggregator
   portal's numbers alone.
2. **GST.** Currently added on top at checkout (`CHECKOUT_GST_RATE = 0.05` in
   `services/orderService.ts`). The handwritten note says it should already be
   inside the display price. Same document.
3. **Delivery charges.** What the aggregator pays and how it is calculated.
   Same document.
4. **Bank account.** The note says "bank account"; artists and aggregators
   have one, collectors do not. Yash will confirm which he meant.

**Waiting on files**, each with its slot already built: logo, colour palette,
insurance partner URL (`INSURANCE_PARTNER_URL` in
`features/dashboard/artwork-submit-data.ts`), the aggregator explainer video
(placeholder under the aggregator terms), YouTube links for the Support FAQ
panel, and the artwork calculation sheet.

**Not code:** patent prior-art research, and porting anything to production.

---

## Conventions worth keeping

- **Page → Hook → Service.** Pages render, `hooks/` wrap React Query, only
  `services/` touch data. Adding a mock collection means adding it to
  `lib/mock-collections.ts`, not inventing local storage.
- **One rule, one place.** `artworkEditState()` and `WITHDRAWABLE_STATUSES` in
  `types/artwork.ts` are read by both the UI and the service, so a button and
  its guard can never disagree. `lib/session.ts` holds two deliberately
  different maps: `ROLE_LANDING` (arriving at the site root) and
  `ROLE_SECTION_HOME` (signing in, or being bounced off another role's
  section). Mixing them up is what sent Demo Customer to the marketplace.
- **Enforce in the service, not just the UI.** The edit window, the one-shot
  price and the MOU gate all refuse in `services/`, so a stale tab cannot get
  around a hidden button.
- **Both MOUs share one signing surface**, `features/mou/mou-agreement.tsx`.
  Each portal has a thin wrapper and its own transcribed document. Amend the
  source PDF and re-transcribe rather than editing the wording in code.

---

## Checks before you push

```bash
cd frontend-web
npx tsc --noEmit                                  # must be silent
npx eslint features hooks services lib types app components
npx next build --webpack                          # see the Turbopack note
node --experimental-strip-types types/artwork.check.ts
```

The last one covers the 7-day edit window (including "bought on day 2"), the
channel predicates, the 1% off-platform fee and custody derivation. It fails
loudly if someone breaks those rules.

`eslint` currently reports **9 warnings, 0 errors**, all pre-existing and in
files nobody has touched. Errors are not acceptable; that warning count is the
baseline.

---

## Gotchas

- **Turbopack panics on this machine** with a Windows process-spawn failure
  (`0xc0000142`). Not a code fault — `next build --webpack` works, and Vercel
  builds on its own machine. Don't chase it.
- **Another session commits to this repo concurrently.** Two commits appeared
  mid-work that this session did not make, including one that swept up work in
  progress. Run `git log` before assuming uncommitted changes are yours to
  commit, and stage paths explicitly rather than `git add -A`.
- **`mobile/`** is the abandoned Expo scaffold. Untracked on purpose. Don't
  revive it or commit it; the live mobile app is `mobile_flutter/`.
- **`tsconfig.json` sets `allowImportingTsExtensions`** so
  `types/artwork.check.ts` can import `./artwork.ts` and still run under
  `node --experimental-strip-types`. Leave it.
- **Line endings.** Git warns about LF → CRLF on almost every add. Harmless;
  compare files with `diff --strip-trailing-cr` or every line looks changed.
- **The preview lags.** Twice the deployment was serving an older commit than
  `main`. Confirm what is actually deployed before concluding a fix didn't
  work — and remember client-rendered blocks never appear in the server HTML,
  so `curl | grep` is a poor test for them.
