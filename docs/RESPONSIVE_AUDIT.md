# Responsive Audit — GalleryZone frontend-web

**Status: IN PROGRESS.** This file is kept as a running regression history,
not a final summary — fixed issues stay recorded with their evidence rather
than being deleted, so future changes have something real to check against.
Findings are confirmed by automated Playwright runs, not manual guesses — see
the exact command in each entry. A full P1 sweep, intermediate-width sweep,
and manual pass have not happened yet; do not treat an empty severity bucket
below as "no issues" — it means "not checked yet." Use these labels
precisely: **CONFIRMED CLEAN** = actually tested and passed, **NOT CHECKED**
= not tested yet, **PRE-EXISTING** = existed before this responsive work,
**NEW REGRESSION** = introduced by a change made during this work.

---

## Testing infrastructure findings (2026-09-11/12)

Three cross-cutting issues found and fixed while building the Select
regression suite and re-running the full baseline suite — none are
route-specific, so they're logged here rather than under any one route.
All three are testing-infrastructure or dev-server config fixes; **no
application/product code changed for any of them.**

1. **`next dev`'s cross-origin dev-asset protection silently broke all
   client interactivity.** `playwright.config.ts`'s `baseURL` is
   `127.0.0.1`, but `next dev`'s default allowed origin is `localhost` —
   every async JS chunk request (framer-motion, `@base-ui/react`, anything
   code-split) 403'd in the browser (confirmed: same URL returns 200 from
   `curl`, which sends no `Origin` header and skips the check). Pages
   rendered fine (SSR/RSC HTML unaffected) but nothing was clickable — no
   `Select` opened, no button responded. This had been silently misdiagnosed
   in `TESTING_VERIFICATION_REPORT.md`'s original "Known Issues" as harmless
   Turbopack noise, because nothing had actually tried to click anything
   until this pass (Phase 4/6 functional testing hadn't started). **Fixed:**
   `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts` (Next's documented
   fix for this), dev server restarted (required — config isn't
   hot-reloaded). Verified: the same chunk request now returns 200 in a real
   browser navigation, and `tests/responsive/select.spec.ts`'s open/select/
   close interactions pass for real.
2. **Cookie-consent banner: a hydration-timing race, not a given.**
   `components/cookie-consent-banner.tsx` (site-wide, unmodified, already
   committed — not new code) defaults hidden on first paint and flips
   visible in a `useEffect` once it confirms `localStorage['gz-cookie-consent']`
   is empty, which it always is in a fresh Playwright context. Whether that
   effect fires before or after Playwright's screenshot-stability check
   settles is a race — the dev-server restart above (fix #1) made every
   route's first compile slower, which tipped every single screenshot in the
   suite the same way at once: **157 of 157 `test:visual` tests failed**,
   including `/privacy` (pure static legal page, shares nothing with the
   other 156 except this banner) — a systemic, page-independent diff with no
   code change behind it, which is itself the signature that ruled out a
   real regression. **Fixed:** `tests/support/settle.ts`'s new
   `dismissCookieConsent(page)` seeds the consent value via
   `page.addInitScript` before any page script runs, applied to every spec
   file that navigates a real page (10 of 11 — `console-errors.spec.ts`
   skipped, its assertions don't depend on page content). Spot-checked the
   banner's own responsiveness once before suppressing it everywhere (320/
   375/768/1440px, edge-to-edge, 0 overflow at any width) — confirming this
   is a test-determinism fix, not hiding a real layout bug.
3. **`lib/mock-utils.ts`'s `mockDelay()` (flat `setTimeout(..., 600)`,
   default on every one of the 32 files that use it, no call site overrides
   it) is invisible to `page.waitForLoadState('networkidle')` — it's a
   timer, not a network request.** Any page that fetches content this way
   renders twice: an empty/loading first paint, then the real content
   ~600ms later. Found via a `/artists/[artistId]` visual-baseline diff that
   looked like the entire page had shifted vertically — the *baseline* had
   been captured with the "Story" bio section still empty (pre-fetch), the
   new run captured it fully populated (post-fetch), so every pixel below
   that section differed. This threatens more than the screenshot it
   surfaced on: **any prior "CONFIRMED CLEAN" overflow/structural result on
   a data-fetching P0 route may have been checked against a partially-loaded
   page** (fewer/narrower elements than the real, fully-loaded content would
   produce) — see the re-verification note under each affected section
   below. **Fixed:** `tests/support/settle.ts`'s new `waitForMockData(page)`
   (900ms — 600ms base + margin), applied to both visual-baseline specs and
   both overflow specs (`p0-routes.spec.ts`, `p0-fine-sweep.spec.ts`,
   `header-breakpoint.spec.ts`); those three overflow-checking suites were
   then **re-run in full** rather than assumed still valid — see their
   entries below for the actual re-verified result, not just the fix.

**Re-verification result:** `p0-fine-sweep.spec.ts` re-run in full — 305/312
passed outright, 7 more (`account-home` @ 640-1024px) failed with
`Test timeout of 30000ms exceeded`, several inside a plain
`page.waitForTimeout(900)` call with no assertion anywhere near it. That
shape (a no-op timer itself failing to resolve) doesn't fit "real overflow
bug" — investigated rather than accepted or dismissed: an isolated
single-page script hitting the same route/width/cookie in ~1s (no hang),
then the identical failing subset re-run through the actual test runner at
`--workers=1` (24/24 passed, ~1.6s each) and again at `--workers=2` (24/24
passed, ~1.8s each) settled it — **not a real bug.** This machine had 24
accumulated `node.exe` processes by this point in the session (long-running:
Turbopack dev servers and Playwright workers from many rounds of this same
engagement, some possibly older/unrelated — command-line inspection wasn't
available to tell them apart safely, so none were killed rather than risk
the wrong one); 8-way-parallel Playwright runs were tipping the single
heaviest route/width combination over the default 30s test timeout under
that load, nothing more. **Net result: 312/312 real passes** (305 direct +
7 reconfirmed at lower parallelism) — P0's fine-sweep conclusion is
unchanged, now on firmer evidence than before. Lesson kept for future runs
in this session: a `Test timeout exceeded` failure with no assertion
message is a load/parallelism signal to investigate at reduced `--workers`
before recording as a finding, not proof of one either way.

`p0-routes.spec.ts` (the coarser 11-viewport x engine-policy suite,
143 real tests) re-run in full too, twice: first pass 6 failed, second pass
1 failed, both times exclusively `[webkit] marketplace @ <mobile-width>px`,
both times with a *different* error shape than the fine-sweep's —
`Error: page.screenshot: Cannot take screenshot larger than 32767 pixels on
any dimension`, thrown from the diagnostic full-page PNG this spec saves
*after* `assertNoHorizontalOverflow` already ran and passed. Investigated,
not dismissed: a direct chromium-vs-webkit height comparison on a fresh
`/marketplace` load showed normal, near-identical heights (17020 vs 17916px,
same 81-card count) in both engines; grepped `features/marketplace/*` for
any infinite-scroll/load-more mechanism — none exists, the grid is a fixed
81-item render; the exact failing case re-run in full isolation
(`--workers=1`, one test) passed cleanly in 3.6s. Conclusion: some sequential
navigations within one long-lived WebKit worker process (this suite runs
many routes back-to-back per worker) occasionally leaves that one process's
`/marketplace` render pathologically tall — a WebKit/Playwright
worker-process artifact, not a real app bug, and notably **the actual
required assertion (no horizontal overflow) never failed even in the runs
where this happened.** No code or infrastructure fix applied — recorded
here so it's recognized immediately if seen again, not re-investigated from
scratch. **Net result: 143/143 real overflow assertions pass** (137 + 6
direct, then 142 + 1 direct across the two runs — the diagnostic-screenshot
flake is the only thing that varied, 0-6 occurrences, never the assertion
itself).

**Full visual-baseline regeneration (2026-09-12).** Fixing the mockDelay
race (finding #3 above) meant every baseline for a route that fetches
content was captured at the WRONG moment relative to the old test code —
before the fix, mid-load; the fix makes `test:visual` correctly wait for
real content, which is a legitimate, expected diff against every such old
baseline, not a regression. Rather than trust that framing on reasoning
alone, it was verified directly, image by image, before touching anything:

- `verify-passport` @ 1280px: old baseline literally reads **"Loading
  passport…"**; the new capture shows the complete, correct artwork
  passport (certificate number, provenance timeline, everything).
- `artist-profile` @ 1280px: old baseline's "Story" section is empty; new
  capture shows the full two-paragraph bio (this is the same diff that
  originally surfaced the mockDelay race, see above).
- `artist-dashboard` @ 1280px: old baseline shows two empty
  loading-skeleton cards where "Recent activity" and a chart panel belong;
  new capture shows them populated.

Three different portals, three different route types (public passport
page, public artist profile, authenticated dashboard), same exact
signature every time — confirms this is the general mockDelay race, not
something route-specific, and confirms it's safe to regenerate broadly.
Two more distinct, smaller issues turned up along the way, both fixed
before generating anything for real:

1. **The dev-tools-badge fix from earlier (finding #2 in the infra section
   above) didn't actually work.** A `/account/collection` diff kept
   showing a literal **"Compiling…"** badge (Turbopack's cold-route
   indicator — a *different*, previously-unseen state of the same
   `<nextjs-portal>` element) even with `hideDevToolsBadge()` wired in.
   Checked directly with `getComputedStyle`: the portal's `display` was
   still `block`. Root cause: the original fix injected a stylesheet rule
   (`nextjs-portal{display:none!important}`) via `addInitScript`, which
   runs early — but Next's own dev-overlay script re-asserts the element's
   visibility later (almost certainly via `el.style.setProperty(...,
   'important')`), and an inline `!important` always beats a stylesheet
   `!important` regardless of injection order. **Real fix:** write the
   inline style directly, with `!important`, right before the screenshot
   (last write wins) instead of once at page-load — confirmed via
   `getComputedStyle` immediately after that this actually forces
   `display:none`. `tests/support/settle.ts`'s `hideDevToolsBadge()`
   updated; both baseline specs' call site moved from before-`goto` to
   right-before-screenshot.
2. **`/marketplace` has its own image-re-encoding noise, independent of
   home's.** `responsive-baseline.spec.ts`'s `marketplace @ 390/430px`
   never reached a stable screenshot even fully isolated (`--workers=1`,
   nothing else running) — "Failed to take two consecutive stable
   screenshots" at a small, ~0.01 ratio that never converged. Same
   signature as home's already-documented dev-mode image-reencoding
   noise, different route. Extended the existing `isHome`-scoped tolerance
   into an explicit `NOISY_ROUTES = new Set(['home', 'marketplace'])` in
   `responsive-baseline.spec.ts` only (desktop-baseline's marketplace
   entries were already stable, no change there) — kept narrow and named,
   not a blanket tolerance.

Also hit, repeatedly, the same worker-process-accumulation flakiness
already characterized above (P0 re-verification): several routes failed
their *first* baseline-write attempt with "Failed to take two consecutive
stable screenshots" inside a batch run, then wrote cleanly the moment they
were retried with fewer/zero other tests sharing the worker. Handled the
same way — isolate, retry, don't record as a finding.

**Process:** deleted all three spec files' `-snapshots` folders (157
files) rather than patch individual baselines, given virtually all of them
were affected by at least one of the two real fixes; regenerated in one
pass (151/157 wrote cleanly first try, 6 needed isolated retries for the
worker-accumulation reason above); ran the full comparison twice more
after that — **157/157 passed both times**, confirming both determinism
and that the regeneration was correct, not a fluke.

- Reproduce: `npx playwright test tests/visual`
- Files touched: `tests/support/settle.ts` (`waitForMockData`,
  `hideDevToolsBadge` — both new), `tests/visual/desktop-baseline.spec.ts`,
  `tests/visual/responsive-baseline.spec.ts` (also gained the
  `NOISY_ROUTES` set), `tests/visual/screenshot.spec.ts`. No application
  code changed for any of this — every fix here is test-infrastructure or
  dev-server config.

---

## Functional testing (Phase 6, 2026-09-12)

Nothing had been clicked-and-verified before this pass — every prior phase
checked layout, not behavior. New directory `tests/functional/`, 24 tests
across 6 files, **24/24 passed**, real assertions throughout (resulting
state checked — URL, `aria-*` attributes, cookie values, visible text —
never just "the click didn't throw"). Every selector below was confirmed
live against the dev server before being written into a test, the same
discipline as the Select suite; several real mistakes were caught this way
before they became false test failures (documented per-file below since
they're useful context for extending these suites later).

- **`tests/functional/mobile-nav.spec.ts` (9 tests).** Public `SiteHeader`
  drawer (a real `role="dialog"`) and all three customer-facing portal
  shells (`DashboardShell`/`AccountShell`/`AggregatorShell` — a plain
  `<aside>` that translates on/off-screen, no dialog role). Each: closed by
  default, opens on trigger, a nav link both navigates AND closes it,
  explicit close dismisses without navigating. Verified independently per
  shell rather than assumed shared, per CRITICAL #3's precedent (three
  separate copy-and-adapt implementations, not one shared component).
- **`tests/functional/auth-forms.spec.ts` (6 tests) — found and fixed a
  real bug.** Login: valid sign-in redirects and sets the `gz_session`
  cookie; password show/hide toggle; "Simulate invalid credentials"
  produces a real error and blocks sign-in. Register: empty submit shows
  5 field-specific messages (not a generic "required") and 4
  `aria-invalid` fields; valid submission shows an in-place "Check your
  email" success state (no redirect — there's no account to send you into
  until email is verified, confirmed this is the real, intended flow, not
  a missed navigation); "Demo Artist" is a one-click sign-in shortcut, not
  a form autofill (confirmed by watching what it actually does before
  writing an assertion around it).
  **Real bug found:** `features/auth/components/login-form.tsx`'s
  dev-only "Simulate invalid credentials" checkbox (inside `<DevPanel>`,
  which despite the name is NOT environment-gated — it renders in every
  build) had its label as a bare `<span>` with no `htmlFor`/`id`
  association and no `aria-label` — confirmed live: clicking the visible
  text did nothing (`isChecked()` stayed `false`), only clicking the tiny
  checkbox control itself worked, and the checkbox had no accessible name
  at all. **Fixed:** turned the span into a `<label htmlFor="simulateError">`
  and gave the `Checkbox` a matching `id`. Verified: clicking the label
  text now toggles it. Checked the same `DevPanel` pattern in
  `register-form.tsx` and `forgot-password-form.tsx` — both use a `Link`
  there instead of a checkbox, not affected. One-line, isolated,
  non-shared-component fix, applied directly rather than deferred (unlike
  HIGH #1's Select fix) because the blast radius is exactly one file.
- **`tests/functional/checkout-flow.spec.ts` (2 tests).** The full money
  path, walked step by step live before writing anything: Address (can't
  continue without picking one) → Review (real order total shown) →
  Confirm → opens a payment-simulation dialog → completing payment shows
  an in-place "Order placed" state with a real simulated payment
  reference — again no URL redirect, confirmed as the actual intended
  behavior. `Back` from Review returns to Address with the selection
  preserved.
- **`tests/functional/marketplace-interactions.spec.ts` (3 tests).** The
  "View full size" image lightbox (opens, closes on Escape, closes on its
  own Close button) and the main artwork's wishlist toggle.
  **Selector trap worth recording:** the page has 3 icon-only "Add to
  wishlist" buttons (the related-artworks rail's cards) plus an icon-only
  header "Wishlist" button (links to `/account/wishlist`) — none of those
  four is the artwork's own action. The real one is a *text* button
  labeled "Wishlist" (toggling to "Wishlisted", with a real
  `aria-pressed`); `getByRole('button', {name:'Wishlist', exact:true}).filter({hasText:'Wishlist'})`
  is what actually disambiguates it.
- **`tests/functional/faq.spec.ts` (2 tests).** Tabs (General/Artists/Buyers
  — switching changes `aria-selected` AND the actual panel content, not
  just the tab styling) and an Accordion item (`aria-expanded` toggles
  both ways).
- **`tests/functional/marketplace-filters.spec.ts` (2 tests).** Art Type
  filter (a shared `Select`, not a native `<select>` — same component as
  HIGH #1) narrows the grid and `Reset Filters` restores it; search
  narrows to real title/artist substring matches and shows 0 for a
  nonsense query.
  **Environment discovery, not a bug:** the mock artwork catalog is a
  shared, mutable, server-side in-memory store — not reset per test run or
  per browser context (confirmed via `aggregatorService.ts`'s own comment:
  "a live store, not a frozen fixture"). A first version of this test
  hardcoded "selecting Sculpture shows >0 results," which passed
  initially and then failed on a later run with no code change anywhere —
  traced to this suite's own `checkout-flow.spec.ts` purchase test having
  run several times by that point and shifted catalog state. Rewritten to
  assert the filter *contract* (narrows-or-holds the set, reset restores
  the original count) instead of a specific category's count, which holds
  regardless of what currently exists in the shared store. Worth carrying
  forward: any future functional test that both mutates state (a
  purchase, a listing change) and later runs alongside tests that count
  or assume specific catalog contents needs this same care.
- Reproduce: `npx playwright test tests/functional`
- **Not covered yet** (see NOT CHECKED): forms beyond login/register
  (artwork upload's non-Select fields, checkout address-add, profile
  forms), other dialogs (aggregator's record-sale/return-holding, admin's
  moderation actions), P1/P2 portal-specific interactions beyond the nav
  shells already covered, keyboard-only navigation, touch-specific
  gestures.

---

## Accessibility expansion (Phase 8, 2026-09-12)

axe had only ever run against `/`. New `tests/a11y/p0-routes.spec.ts`
covers all 13 P0 routes — same non-gating contract as the original
`axe.spec.ts` (proves the scan runs and reports; doesn't fail the suite on
violations, so a fresh finding here is a discovery, not a broken test).
**5 real, confirmed bugs found and fixed** — every one verified by
inspecting axe's own violation data (colors, HTML, computed styles), not
guessed, and re-scanned afterward to confirm the specific violation
cleared:

1. **Marketplace sort trigger had no accessible name (critical,
   `button-name`).** `role="combobox"` requires its name to come from
   `aria-label`/`aria-labelledby`/an associated `<label>` — it does NOT
   count visible child text the way a plain `role="button"` does, per the
   ARIA accessible-name spec. Confirmed both ways: Playwright's own
   accessibility-tree read (`ariaSnapshot()`) reported a name fine from
   the visible "Sort: newest" text, but that's Chromium being lenient in
   its own UI, not a spec guarantee other browsers/AT honor — axe
   correctly flagged it as not using a valid naming mechanism. **Fixed:**
   `aria-label="Sort artworks"` on `marketplace-grid.tsx`'s `SelectTrigger`.
2. **Artwork-upload's dimension-unit select had no accessible name at
   all (critical, `button-name`).** Its 5 sibling selects on the same
   form (Category/Medium/Type/Framing/Format) all correctly announce
   "Category: Select category" etc.; this one alone announced as bare
   `combobox: in` — no label prefix, confirmed via `ariaSnapshot()`
   directly comparing all 6 triggers side by side. Root cause: no `id` on
   its `SelectTrigger` and no associated `<Label>` (unlike its siblings).
   **Fixed:** `aria-label="Dimension unit"` on that trigger in
   `artwork-submit-form.tsx`.
3. **Shared `ArtworkCard`'s category/medium line failed contrast
   (serious, `color-contrast`), on every route showing a card grid.**
   `text-muted-foreground/80` measured 4.01:1 against the dark-mode card
   background; WCAG AA requires 4.5:1 for 12px text. One shared component,
   fixed once: dropped the `/80` opacity modifier (`text-muted-foreground`
   at full opacity) in `components/shared/artwork-card.tsx`. Verified
   clean afterward on all three routes that had shown it
   (`marketplace-detail` and `artist-profile` went to 0 violations
   outright; `marketplace` improved but see the unresolved item below).
4. **Artist-profile's stat strip wasn't a valid `<dl>` (serious,
   `definition-list`).** Each stat's optional caption ("1 on gallery
   display", "Listed price, GST included") was a `<p>` sibling of
   `<dt>`/`<dd>` directly inside the `<dl>`, which HTML doesn't allow —
   `<dl>`'s direct children must be `dt`/`dd` groups only. **Fixed:**
   moved the caption `<p>` inside the `<dd>` in
   `features/artists/artist-stat-strip.tsx` (added `font-sans
   font-normal` to it, since it now inherits the `<dd>`'s
   `font-display text-lg font-semibold` otherwise) — screenshot-confirmed
   identical visual output before/after.
5. **A terms link embedded mid-paragraph relied on color alone (serious,
   `link-in-text-block`).** `features/dashboard/artwork-submit-form.tsx`'s
   "Read the full terms" link used `text-gold-bright hover:underline` —
   indistinguishable from surrounding body text except by hue until
   hovered. **Not a blanket fix:** this exact class combination appears in
   28 files, but axe flagged only this one — the rule specifically targets
   links *embedded within a running block of text*, which the other 27
   aren't (standalone buttons/nav links/card actions, not mid-sentence).
   Fixed only this one instance: `underline underline-offset-2
   hover:no-underline`.

**Found, real, NOT fixed this pass (documented, not swept under):**

- **A second, different `text-muted-foreground/60` contrast failure on
  home** (a `02`-style step-number badge in a dark section, 3.06:1,
  confirmed live — different element from #3 above, same family of bug).
  One clean instance fixed doesn't mean every opacity-modified
  muted-foreground text in the app is safe; this needs its own dedicated
  sweep, not a guess extended from one fix.
- **Marketplace's card-grid color-contrast reading is inconclusive, not
  cleared.** Investigated hard before setting it aside: axe reported
  dozens of nodes with progressively darkening foreground/background pairs
  (contrast ratios from ~4 down to ~1, i.e. text approaching invisible) —
  traced directly to a wrapping `motion.div` caught mid-animation
  (computed `opacity: 0.598`, a live `transform` still in flight, matching
  CRITICAL #2's scroll-reveal pattern exactly, just on the marketplace
  grid instead of landing/about). Widened `settleScrollReveal()` (see
  below) to catch any inline opacity below 1, not just the literal
  starting "0" — this measurably helped (home's much larger violation set
  dropped to one small, unrelated, real finding) but did not fully resolve
  marketplace: elements whose `whileInView` trigger has never fired at all
  (never scrolled past, so React's own state still says "not visible yet")
  get their un-animated style reasserted on the next render regardless of
  a one-time DOM override — motion's internal state, not the DOM, drives
  what gets painted next frame. This is the same wall the original
  scroll-reveal investigation hit. **Not chased further and not fixed in
  application code** — explicitly out of scope per this project's standing
  instruction not to touch the scroll-reveal animation before a real-device
  check. The takeaway for now: marketplace's card-grid contrast cannot be
  reliably evaluated by axe in headless automation as currently built; a
  real determination needs either a real-device/real-scroll check or a
  from-the-DOM-values contrast check that doesn't depend on the animation
  having settled.
- **`settleScrollReveal()` widened** (`tests/support/settle.ts`): now
  matches `[style*="opacity"]` generally and forces any element with a
  parsed inline opacity below 1 to `1` (was: exact string match on
  `opacity:0`/`opacity: 0` only). Re-ran the full `test:visual` suite
  after this change specifically to check for regressions from the wider
  match — clean (the only diffs were from the 2 real a11y code fixes
  above plus 2 unrelated shared-mock-backend content changes, see the
  Baseline maintenance log).

Reproduce: `npx playwright test tests/a11y`

**Still NOT CHECKED:** P1 routes beyond home (a11y has never run against
any of them), P2/P3, keyboard-only navigation, screen-reader-specific
testing (axe catches programmatic/structural issues, not everything a
real AT session would surface), the two documented-but-open findings
above.

---

## P1 structural diagnostic (Phase 4, 2026-09-12)

The overlap/text-clip/image-distortion diagnostic that found CRITICAL #3
and HIGH #1 on P0 was a one-off Node script until now — promoted into a
real spec, `tests/responsive/p1-structural.spec.ts`, and run against all
46 P1 routes × the same 7 representative widths as the P1 overflow sweep.
Non-gating like axe (a discovery tool needing human triage, not a strict
assertion) — logs findings per route/width for review rather than failing
the suite on them.

**Result: 45 of 46 routes clean outright. 1 route (`dashboard-settlements`)
flagged 7 candidates — a third false-positive pattern, not a bug.** Every
candidate was the identical signature: a `span.sr-only` element ("Open
settlement for Whispers in Bronze" — Tailwind's screen-reader-only utility,
1×1px, `position:absolute`, deliberately invisible but kept in the
accessibility tree for the row's icon-only action button) read as "text
clipped with no ellipsis" by the same geometry the checker uses to catch
real silent clipping. This is the OPPOSITE of a bug — it's correct
accessibility markup the checker didn't know about yet. **Fixed in the
shared checker**, not per-route: `tests/support/layout-health.ts`'s
text-clip-x check now skips any leaf text element whose rendered box is
≤1×1px before evaluating anything else, a geometry-based exclusion (not a
literal `sr-only` class-name match, so it also covers any other
visually-hidden-but-accessible text using the same standard technique
under a different class name). Re-ran `dashboard-settlements` alone after
the fix: clean.

This is now the third documented false-positive pattern for this checker
(multi-line inline-element union-rects and scroll-clipped-element geometry
were the first two, found on P0) — each one found via a real run against
real pages, fixed once in the shared logic, not patched around per-instance.

Reproduce: `npx playwright test tests/responsive/p1-structural.spec.ts --project=chromium`

**Still NOT CHECKED:** Firefox/WebKit for this diagnostic (Chromium-only,
same documented policy as everywhere else this session — geometry bugs
found so far have not been engine-specific). P2/P3 routes.

---

## Production build validation (2026-09-12)

Everything up to this point ran against `next dev` — and this round found
four genuinely `next dev`-specific artifacts (the cross-origin chunk block,
Turbopack cold-compile races, the dev-tools badge, dev-mode image
re-encoding noise), so this was worth doing for real rather than assuming
production is fine by default.

- `npm run build`: **clean.** `Compiled successfully in 2.1s`, TypeScript
  passed across the whole app, all 77 static pages generated, 0 errors, 0
  warnings — a real signal that none of this session's edits (`select.tsx`,
  the 3 shells, `site-header.tsx`, `artwork-card.tsx`, `artist-stat-strip.tsx`,
  `marketplace-grid.tsx`, `artwork-submit-form.tsx`, `login-form.tsx`,
  `next.config.ts`) introduced a type or build error.
- `next start` on a separate port (3005, dev server on 3000 left
  untouched/running), then checked directly:
  - Smoke: 200, correct title, **0 console errors, 0 page errors.**
  - **`<nextjs-portal>` count: 0** — confirms the dev-tools-badge finding
    really was dev-only, not something that needed a code fix.
  - Horizontal overflow at 320/768/1440 on home: **0**, all clean.
  - axe on home: **0 violations** (dev currently shows 1 — the `02`
    step-number contrast finding documented as open above; getting 0 here
    without even calling `settleScrollReveal` is consistent with that
    finding being *also* a scroll-reveal-timing artifact rather than a
    static color choice, reinforcing rather than contradicting that
    write-up — not treated as "production fixed it," since the same
    non-determinism could go either way on a different run).
  - Functional: mobile nav drawer opened correctly; the marketplace sort
    `Select` opened with all 3 real options — production's minified/
    tree-shaken JS bundle didn't break interactivity.
  - Cross-engine (Chromium/Firefox/WebKit) overflow check on `/checkout` at
    375px: clean on all three.
  - Two `requestfailed` events showed up in an initial pass
    (`journey/studio.png`, a `/register` RSC prefetch) — investigated
    before dismissing: `curl` confirmed the image itself is a real 200, and
    a follow-up script that actually scrolled the image into view loaded it
    successfully (`naturalWidth: 599`). Both were the browser context
    closing mid-request (a lazy-loaded image and a hover-triggered Next.js
    prefetch that my own verification script never gave time to finish),
    not real broken requests.
  - Production server stopped after verification — nothing left running
    on port 3005.

**Conclusion: this session's dev-only findings really are dev-only.**
Nothing new turned up in production that wasn't already known from dev
testing, and the dev-specific artifacts (dev-tools badge, cross-origin
block symptoms) are confirmed absent as expected.

**Not done:** a full P0/P1 sweep against production (this was a
representative spot-check — home, checkout, cross-engine overflow, axe,
one functional interaction — not the complete matrix); production visual
baselines (none exist; dev baselines aren't expected to pixel-match
production due to real differences like font-hinting/image-optimization
pipeline, so a separate baseline set would be needed if this becomes a
recurring check rather than a one-time validation).

---

## CRITICAL

### 1. Public header overflows horizontally on every non-landing page at 320–?px

**STATUS: FIXED and verified 2026-09-11.** `components/site-header.tsx`'s
wishlist button now carries `hidden sm:inline-flex` (was just `size-10`),
matching the search button beside it. Verified with a dedicated suite,
`tests/responsive/header-breakpoint.spec.ts`:
- All 6 affected routes × 10 widths (320/360/375/390/430/480/639/640/768/1024)
  × the established engine policy (mobile: Chromium+WebKit, tablet: Chromium,
  desktop: Chromium+Firefox) — **129 passed, 0 failed** (96 correctly skipped
  by policy). No overflow anywhere in the matrix; wishlist icon visibility
  matches the `sm` (640px) breakpoint exactly at every width, including the
  639/640 boundary pixels.
- A separate fine-grained sweep of `/marketplace` alone (CSS breakpoints are
  engine-invariant, so one engine is enough) at 321/330/340/350/360/375/390/
  402/414/430/480/512/600/639/640 — all clean, confirming no hidden failure
  between the coarser widths above.
- Reproduce: `npx playwright test tests/responsive/header-breakpoint.spec.ts`
- **Test-writing gotcha worth recording**: `/marketplace/[artworkId]` and
  `/artists/[artistId]` each have a SECOND control also named "Wishlist" — a
  page-level `aria-pressed` favorite-toggle button in the artwork/artist
  content, unrelated to the header icon. An unscoped `getByRole('button',
  {name:'Wishlist'})` matches both; the working locator scopes to
  `page.locator('header')` first. Also note the header's Button renders as
  `role="button"` even though the underlying element is an `<a href>` — a
  shadcn/base-ui Button characteristic, not something this fix touched.

Original finding, preserved below for record:

- **Route:** `/marketplace`, `/marketplace/[artworkId]`, `/artists/[artistId]`, `/checkout`, `/verify/[artworkId]`, `/transfer/[transferId]` — every public route except `/` (6 of 13 P0 routes)
- **Viewport:** 320px confirmed failing. Not yet confirmed clean at 321–479px (untested gap — the passing suite jumps 320 → 360; a follow-up run at 321/347/360 would pin the exact fixed threshold, this is exactly what Phase 9 is for).
- **Browser:** Chromium and WebKit (both engines that ran at 320px per the mobile coverage policy)
- **Component:** `components/site-header.tsx`, the icon cluster at lines 209–264 (`<div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2.5">`), specifically the wishlist `Button` at lines 252–262
- **Observed behavior:** `document.documentElement.scrollWidth` = 344 vs `clientWidth` = 320 (24px overflow) on every affected route. Reproduce: `npx playwright test tests/responsive/p0-routes.spec.ts -g "checkout @ 320px"`.
- **Root cause:** The search button four lines above (line ~213–224) is correctly hidden below the `sm` breakpoint: `className="hidden size-10 sm:inline-flex"`. The wishlist heart button right after it has no such class — just `className="size-10"` — so it stays visible at every width. On `/` this doesn't matter because both buttons are wrapped in `{!isLandingPage && (...)}` and hidden entirely; on every other public page, the full wordmark (`GZ` + tracked-out `GALLERYZONE`, no truncation) plus a permanently-visible wishlist icon plus the theme toggle plus the hamburger button don't fit in the ~272px available at 320px (`max-w-[1440px]` row, but `px-6` — 24px — padding is constant at every width, not reduced below `sm`).
- **Recommended fix:** Give the wishlist button the same `hidden sm:inline-flex` treatment as its neighboring search button — it's already reachable from the mobile drawer (`/account/wishlist` is linked there too, site-header.tsx:405–414), so hiding the header icon below `sm` loses no functionality, just matches a pattern already established two elements away in the same file. One-line class change, one shared component, fixes all 6 routes at once (per Phase 7's "fix shared components first" instruction — this *is* that fix, just not applied yet).
- **Not yet done:** none — see STATUS above. All of this was resolved and verified.

### 2. Scroll-reveal animations can leave whole sections invisible — found via visual baseline review, not overflow checks

- **Route:** `/` (home) and `/about` confirmed directly; `/account` (and likely any route using the same fade-up-on-mount pattern) shows the identical signature. Not yet checked across the rest of the app.
- **Viewport:** Not viewport-specific — reproduced at both 390px and 1280px in raw diagnostics.
- **Browser:** Chromium (only one checked so far)
- **Component:** Every `features/landing/*.tsx` and `features/about/*.tsx` section uses framer-motion `initial={{opacity:0,...}} whileInView={{opacity:1,...}} viewport={{once:true, margin:"-10%"}}`. `/account`'s card grid shows the same inline `style="opacity:0;transform:translateY(12px)"` signature without necessarily using the same component.
- **Observed behavior:** A `fullPage` screenshot taken right after `page.goto()` + `networkidle` can capture these sections still at `opacity:0` — confirmed directly on the committed home-390 baseline (before the fix): ~1000px of a 1156px-tall section rendered as empty background, with only the section's "swipe to explore" caption (a sibling, not framer-motion-wrapped) visible.
- **Root cause:** IntersectionObserver-driven reveal not firing reliably in headless Playwright automation. This was investigated hard: `window.scrollTo()` stepping, `page.mouse.wheel()` stepping (both coarse and fine-grained), and native `element.scrollIntoView()` in a loop were all tried and **none** reliably triggered the observers (37 of 37 sampled elements stayed stuck every time). What actually fixed it for testing purposes: directly mutating the affected elements' inline styles to their end state (`tests/support/settle.ts`), not waiting for the animation to fire. Root mechanism not fully isolated — plausibly a rAF/IntersectionObserver timing quirk specific to headless automation.
- **Real-user risk: likely low, not zero.** Real touch/wheel scroll is continuous, which is generally what IntersectionObserver is built to handle reliably; my failed attempts used discrete synthetic jumps, which is a meaningfully different input pattern from a real scroll gesture. This is flagged HIGH rather than CRITICAL because I could not reproduce it under anything resembling real user scrolling, only under automated/synthetic scrolling. **Recommend the user manually check**: open `/` or `/about` on an actual phone, scroll at a normal pace, and watch for any section that stays blank or pops in late.
- **Recommended fix:** No application code change recommended yet — this needs a human on a real device before touching `features/landing/*` or `features/about/*`, since "fix" here could mean anything from "nothing, it's fine" to "add a fallback for browsers/timings where the observer doesn't fire." Do not remove the animations preemptively; they're presumably intentional art direction.
- **Testing-infrastructure impact (already fixed):** `tests/visual/desktop-baseline.spec.ts` and `responsive-baseline.spec.ts` now call `settleScrollReveal(page)` before every screenshot, which force-resolves any element still at `opacity:0` to its end state. All 154 baselines were regenerated with this fix and re-verified deterministic (2 clean runs, 0 diffs). Home's baselines also needed `maxDiffPixelRatio: 0.001` and a 20s screenshot timeout — a real, tiny (159px / 0.01%), visually-confirmed-identical noise source from Next dev-mode's on-demand image re-encoding on one densely-detailed image, not loosened to hide a real regression (see the file's inline comment for the evidence).

### 3. Portal sidebar nav overlaps the pinned profile card at real laptop viewport heights

**STATUS: FIXED and verified 2026-09-11.** Found by an automated structural
diagnostic (`tests/support/layout-health.ts` — overlap/text-clip/image-distortion
checks, built this session because pure overflow-checking can't see this class
of bug), not by eyeballing screenshots.

- **Route:** `/dashboard` (artist), `/aggregator/dashboard`, `/account` — every route inside the three affected portal shells, i.e. most of P1 too, not just these P0 homes.
- **Viewport:** Not triggered at my original 900px-tall test height. Triggered at 900/700/650px on `aggregator-dashboard` (its 14-item nav is the tightest fit); 700/650px on `artist-dashboard` and `account-home`. Real laptops with browser chrome routinely have less than 700px of usable vertical space, so this was live risk, not a theoretical one.
- **Browser:** Chromium (geometry bug, not engine-specific — not cross-checked on Firefox/WebKit, low priority to do so given the mechanism).
- **Component:** `features/dashboard/dashboard-shell.tsx` (nav had neither `min-h-0` nor `overflow-y-auto`), `features/aggregator/aggregator-shell.tsx` and `features/account/account-shell.tsx` (both had `overflow-y-auto` on the nav wrapper but were missing `min-h-0` — the classic flexbox gotcha where a flex child won't shrink below its content's natural height without it, so `overflow-y-auto` never actually activates).
- **Observed behavior:** With the sidebar's `<aside>` at a fixed `lg:h-[100dvh]`, the nav list (13-14 items) grew past its allotted space instead of scrolling, so its later items rendered underneath/inside the profile card pinned at the bottom of the sidebar — confirmed by exact bounding-rect containment (e.g. on aggregator, "Support" link's rect sat entirely inside the profile card button's rect).
- **Root cause / reference fix already in the codebase:** `features/admin/admin-shell.tsx` has the identical 100dvh sidebar shape with an even longer nav (15 items across groups) and already solves this correctly: `<nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto ...">`, with a comment explaining exactly why (`"15 sections don't fit a 100dvh sidebar on a laptop, so the nav scrolls independently while the brand header and profile card stay pinned"`). That fix was never backported to the other three shells when they were built (per `AdminShell`'s own header comment, these four shells are deliberately independent copies, not a shared component — so the bug had to be introduced three times, and gets fixed three times too).
- **Fix applied:** Added `min-h-0` to `aggregator-shell.tsx`'s and `account-shell.tsx`'s nav-wrapper `<div className="flex-1 overflow-y-auto ...">`; added both `min-h-0` and `overflow-y-auto` to `dashboard-shell.tsx`'s `<nav>` (it had neither, unlike the other two). All three now match `AdminShell`'s already-proven pattern.
- **Verified:** Re-ran the diagnostic at 900/700/650px on all three routes post-fix — 0 overlaps at every height, with visible-item counts correctly decreasing as height shrinks (confirms items are being clipped/scrolled, not spilling out). The diagnostic itself had a false-positive bug caught in the process — see the note in `tests/support/layout-health.ts` about `getBoundingClientRect()` on scrolled-out elements — fixed there too.
- **Not yet done:** Cross-check Firefox/WebKit (low priority — CSS flexbox behavior here isn't expected to be engine-specific), and confirm no other route inside these three shells has content tall enough to reveal a *different* scroll-container bug now that this one's fixed.

### Checked and confirmed NOT a bug (structural diagnostic false positives, ruled out by direct visual inspection)

- **Search/password "eye" icon buttons overlapping their input** (marketplace search box, login/register password field) — flagged by the overlap heuristic at every width uniformly, which is itself the tell: a real responsive bug appears/disappears across widths, this didn't. Visually confirmed as the standard "icon button positioned inside an input" pattern, present by design.
- **Checkout breadcrumb "overlap" at 320px** — the heuristic's `getBoundingClientRect()` union-of-line-fragments limitation on a breadcrumb link that wraps to 2 lines (see the note added to `tests/support/layout-health.ts`). Screenshot confirms normal, correctly-wrapping breadcrumb text with no visual overlap at all.

## HIGH

### 1. Select-trigger placeholder text clips with no ellipsis

**STATUS: FIXED and verified 2026-09-11.** Found by the same structural
diagnostic as CRITICAL #3, in the same P0 sweep. Not CRITICAL: the select
still opens and works correctly when clicked — this was a
readability/typography problem, not a broken primary action.

**Inventory done before touching the shared component:** grepped every
`SelectTrigger`/`SelectValue` usage — 7 files, 17 call sites (marketplace
sort and filters, 6 selects in the artwork upload form, admin data-table
filter, admin report-generator, aggregator record-sale-dialog ×2, aggregator
profile-form ×4). None use an icon inside `SelectValue`'s children (checked
directly — every call site passes either a plain placeholder string or a
render-prop function returning a plain label string), and none set
`disabled`. That matters for the fix below: it only needed to solve for
text, not icon+text, because icon+text has zero real usage to preserve.

- **Route:** `/dashboard/artworks/upload` confirmed (Framing and Format/surface selects) at 1024px specifically — `artwork-submit-form.tsx`'s outer form is `grid-cols-1 lg:grid-cols-[1.6fr_1fr]` (switches to 2-column exactly at `lg`=1024px) with a `grid gap-5 sm:grid-cols-3` row inside the left column, so three compounding column-widths bottom out right at this one breakpoint.
- **Root cause (confirmed via computed styles, not guessed):** `select.tsx`'s trigger className applied `*:data-[slot=select-value]:line-clamp-1` to the value span for truncation, but the *same* selector also applied `*:data-[slot=select-value]:flex`. Tailwind's `line-clamp-N` only produces its ellipsis via `display:-webkit-box`, and `flex` overrides that — confirmed live pre-fix: computed `display` was `flex`, `-webkit-line-clamp` was `1` but inert, `text-overflow` was `clip`. Net effect: text was silently cut with no `…`.
- **Fix applied:** `SelectValue` itself now carries `min-w-0 flex-1 truncate text-left` instead of `flex flex-1 text-left` (dropped the inner flex-container behavior; kept the outer flex-*item* sizing via `flex-1`, added `min-w-0` since a flex item's automatic minimum size still blocks shrinking below content size without it — same flexbox family as CRITICAL #3). `text-overflow:ellipsis` (Tailwind's `truncate`) now actually applies because the element is no longer itself a flex container. The now-dead `*:data-[slot=select-value]:line-clamp-1 / flex / items-center / gap-1.5` selectors were removed from `SelectTrigger` (nothing else in the codebase references those slots — checked).
- **Verified — computed styles, before/after, at the exact repro (1024px, artist-upload):**
  - `framing` placeholder "Select framing": `scrollWidth=96 clientWidth=64` (box is still only 64px — that's the grid-crunch layout issue, a separate, lower-severity concern, see below) but now `textOverflow: "ellipsis"` (was `"clip"`).
  - Selected the real longest reachable value, "Stretched on canvas" (`types/artwork.ts` `FRAMING_LABEL` — the default `listingType` gates `FRAMING_LABEL`'s other 3 options including the actual-longest "Freestanding (sculpture)" behind an aggregator-listing toggle, out of scope here, noted in the new spec): `scrollWidth=136 clientWidth=64`, `textOverflow: "ellipsis"`.
  - Screenshot-confirmed visually, not just computed-style-confirmed: placeholder renders "Select f…", selected value renders "Stretch…" — a real, visible ellipsis where before it was a hard, unindicated cut ("Select fra").
- **Residual, separate, lower-severity finding (not part of this fix): the 64px box itself.** Even with a correct ellipsis, a 64px-wide trigger showing 1-2 characters of a label is a content-density problem from the 3-column grid at exactly 1024px, not a truncation-mechanism problem. Not fixed here — different root cause (page layout, not the shared Select component), deliberately out of scope for this pass. Logged as **NOT CHECKED / candidate MEDIUM** — needs its own look at `artwork-submit-form.tsx`'s grid breakpoints, not a Select change.
- **Dedicated regression suite:** `tests/responsive/select.spec.ts` (new) — structural sweep (no-silent-clipping check) across 12 widths (320–1440) on both the upload form (6 `w-full` "normal" triggers) and marketplace sort (1 `w-auto min-w-[140px]` "wide" trigger), plus a narrow-trigger negative control (aggregator profile's `w-24` dial-code select, always-short "+91"-style values, 320/768px), plus 3 functional tests (open → choose → verify selected text + `aria-expanded` + popup closes + trigger geometry stays in-bounds, for both a long value and a short value, on two different Select instances). **29/29 passed.** Reproduce: `npx playwright test tests/responsive/select.spec.ts --project=chromium`.
- **Not yet done:** the residual 64px-box density issue (separate finding, see above); a sweep of admin's 2 Select usages (P2, out of P0/P1 priority order so far).

Otherwise not yet assessed — needs the P1 route sweep and a pass through the HIGH checklist (grids, cards, images, headings, buttons, nav, tables, sticky elements) beyond what the P0 structural diagnostic already covered.

## MEDIUM

Not yet assessed.

## LOW

Not yet assessed.

---

## CONFIRMED CLEAN so far (automated, re-verified after the header fix)

- `/` (home/landing): 0 overflow across all 7 original viewports (320–1440) × 3 engines, and again at all 11 P0-sweep viewports × its engine policy.
- `/login`, `/register`, `/account`, `/dashboard`, `/dashboard/artworks/upload`, `/aggregator/dashboard`: 0 overflow across the full 11-viewport × engine-policy sweep. These don't use `SiteHeader` (auth pages use `AuthLayoutPanel`; portal pages use their own shell).
- `/marketplace`, `/marketplace/[artworkId]`, `/artists/[artistId]`, `/checkout`, `/verify/[artworkId]`, `/transfer/[transferId]`: previously CRITICAL #1 (see above), now 0 overflow across 320–1024px (10 widths) + a 15-width fine sweep, all engines per policy.
- **All 13 P0 routes, 0 horizontal overflow across the 24-width intermediate sweep** (321 through 1024, `tests/responsive/p0-fine-sweep.spec.ts`) — 312/312 passed, Chromium. No hidden breakpoint gaps anywhere in P0.
- **All 13 P0 routes, structural diagnostic (overlap / text-clip / image-distortion) at all 12 Phase-1 widths (320-1440), Chromium** — 156 route/width combinations checked. 50 initially flagged; triaged down to 1 confirmed real bug (CRITICAL #3, now fixed) and 1 confirmed real bug deferred (HIGH #1); the other 48 were two distinct false-positive patterns (documented above and fixed in the shared checker for future runs). Zero image-distortion issues found anywhere in P0.
- All three portal shells (`/dashboard`, `/aggregator/dashboard`, `/account`) re-verified overlap-free at 900/700/650px viewport heights after the CRITICAL #3 fix.
- axe (`wcag2a`+`wcag2aa`) on `/`: 0 violations, tool proven to actually execute (see `TESTING_VERIFICATION_REPORT.md`).
- **`components/ui/select.tsx` (HIGH #1's fix):** dedicated regression suite `tests/responsive/select.spec.ts` — 29/29 passed. Structural (no-silent-clipping) across 12 widths × 2 routes + a narrow-trigger negative control; functional open/choose/verify/close for both a long and a short selected value. See HIGH #1 above for the full fix writeup.
- **All 47 P1 routes, 0 horizontal overflow across 7 representative widths** (320/390/430/768/1024/1280/1440, `tests/responsive/p1-routes.spec.ts`) — 322/322 passed, Chromium (documented engine policy — CSS-geometry overflow confirmed engine-invariant on P0 already). No structural diagnostic or visual baselines run on P1 yet — see NOT CHECKED.
- Full `test:visual` (157 screenshots, both baseline specs + `/privacy` × 3 engines): 157/157, confirmed deterministic across 2 consecutive runs post-regeneration.
- `test:a11y`: 3/3 (all 3 engines), 0 violations, 21-24 rules passed depending on engine.

## Baseline maintenance log

- **2026-09-11, header fix:** After CRITICAL #1's fix, `npm run test:visual`
  correctly flagged 18 diffs — the 9 `SiteHeader`-using routes
  (marketplace, marketplace-detail, artist-profile, checkout,
  verify-passport, transfer-accept-not-found, artists-list, about, faq) at
  390px and 430px, where the wishlist icon is now hidden. Inspected the diff
  image before touching anything: the highlighted region was exactly the
  40px heart icon, nothing else. No diffs at 768/1024/1280/1440 (icon
  unaffected there) and no diffs on non-`SiteHeader` routes — confirms the
  change did only what it meant to. Updated those 18 baseline files,
  re-verified deterministic (2 clean runs).
- **Process bug caught in the same pass:** `maxDiffPixelRatio: 0.001` (added
  for `home`'s known dev-image-optimization noise) had been written as a
  blanket option applied to every route in the loop, not gated to `home`
  specifically. It was large enough, as a *ratio*, to silently swallow the
  18 real diffs above on first check (157 passed, 0 failed — wrong). Caught
  by knowing what to expect and checking anyway, not by the test failing.
  Fixed in both `tests/visual/desktop-baseline.spec.ts` and
  `responsive-baseline.spec.ts` to apply only when `route.name === 'home'`.
  Worth remembering: an unscoped tolerance is exactly the kind of thing that
  looks harmless and isn't — re-check the blast radius of any tolerance
  before trusting a clean run.
- **2026-09-11, sidebar fix (CRITICAL #3):** After adding `min-h-0`/
  `overflow-y-auto` to the three portal shells, `npm run test:visual` flagged
  4 diffs, all at 1280px: `artist-dashboard`, `artist-upload`,
  `dashboard-artworks`, `dashboard-profile` — the 4 baselines that render
  `DashboardShell`. (`account-home` and `aggregator-dashboard` also use an
  affected shell but their nav lists are short enough at 1280×800 that
  nothing had scrolled/shifted — no diff, correctly.) Inspected each diff
  image before touching anything: a uniform few-pixel vertical shift in the
  nav item stack, nothing missing, nothing overlapping, nothing added —
  exactly what "the nav can now scroll instead of silently overflowing"
  should look like when it wasn't actually overflowing enough to differ
  visually at this particular height. Updated those 4 baselines, re-verified
  deterministic (8/8 clean re-run). No diffs anywhere else in the suite from
  this change.
- **2026-09-11, Select fix (HIGH #1):** No visible baseline impact expected
  (the fix only changes *whether* an ellipsis renders when text already
  overflows — no P0/P1 baseline route happens to have a Select showing
  overflowing text at a baselined viewport) and none occurred: confirmed
  clean across the full regeneration below.
- **2026-09-12, full regeneration (mockDelay race + dev-tools-badge fix +
  marketplace noise + Turbopack cold-compile race):** See "Testing
  infrastructure findings" at the top of this file for the complete
  investigation. Net effect on baselines: all 157 files deleted and
  regenerated from a genuinely fixed, deterministic capture path (not
  patched individually — verified first, on 3 representative routes
  spanning 3 different portals, that every affected baseline showed the
  identical "old = mid-load skeleton/spinner, new = fully-loaded real
  content" pattern before regenerating anything). Re-verified with 2 full
  consecutive comparison runs post-regeneration: **157/157 passed both
  times.**

## NOT CHECKED yet

- MEDIUM/LOW severities generally (no dedicated pass yet beyond what the structural diagnostic and Select suite incidentally covered).
- P1 routes: overflow (322/322) and the structural diagnostic (45/46 clean, 1 false-positive fixed) are now both checked, see above. Visual baselines exist only for the 9-route P1 sample already in `IMPORTANT_ROUTES`, not the full 46.
- P2 (`/admin/*`) and P3 (legal pages) — out of P0/P1 priority order so far.
- Firefox/WebKit for both the structural diagnostic and the P1 overflow sweep (Chromium-only by documented policy — geometry bugs found so far have not been engine-specific).
- Functional interactions: Select (29/29), mobile nav across public header + 3 portal shells, login/register, full checkout funnel, marketplace lightbox/wishlist/filters/search, and FAQ tabs/accordion are now covered (24/24, see "Functional testing" above). Still NOT covered: other forms (artwork upload's text fields, checkout address-add, profile/settings forms), other dialogs (aggregator record-sale/return-holding, admin moderation actions), P1/P2-specific interactions beyond the shared nav shells, keyboard-only navigation, touch-specific gestures.
- Accessibility: all 13 P0 routes now covered (see "Accessibility expansion" above, 5 real bugs fixed). P1/P2/P3 routes still not scanned.
- Production build: now validated (see "Production build validation" above) — build clean, representative spot-check clean, dev-only artifacts confirmed absent. Not done: a full P0/P1 matrix against production, or production-specific visual baselines.
- Real-device manual check for HIGH-classified scroll-reveal issue (#2 under CRITICAL) — still needed, not automatable, still explicitly not touched.

## Commands used to produce this file's findings

```
npx playwright test tests/responsive/p0-routes.spec.ts --reporter=list
npx playwright test tests/responsive/p0-routes.spec.ts -g "checkout @ 320px"
npx playwright test tests/responsive/header-breakpoint.spec.ts --reporter=list
npx playwright test tests/responsive/p0-fine-sweep.spec.ts --project=chromium --reporter=list
npx playwright test tests/responsive/select.spec.ts --project=chromium --reporter=list
npx playwright test tests/responsive/p1-routes.spec.ts --project=chromium --reporter=list
npx playwright test tests/visual --reporter=list
npm run test:a11y
npx playwright test tests/functional --project=chromium --reporter=list
```

The structural diagnostic (overlap / text-clip / image-distortion) that found
CRITICAL #3 and HIGH #1 was run as a one-off Node script using
`tests/support/layout-health.ts`'s logic (not a committed spec file yet —
its output needed human triage before becoming a permanent assertion; now
that the false-positive patterns are known and fixed in the shared helper,
promoting it to a real spec for the P1 sweep is the natural next step —
still not done; the P1 sweep so far is overflow-only).

**Closing combined run (2026-09-12):** ran the entire `tests/responsive`
directory together as one invocation (viewports, p0-routes, p0-fine-sweep,
header-breakpoint, select, p1-routes — 1128 passed, 1528 skipped-by-policy,
8 failed). All 8 were `[firefox]`, all with the identical error
`browserContext.close: ENOENT: no such file or directory, open
'...test-results\.playwright-artifacts-N\traces\...recording.trace'` — a
Playwright trace-file write failure, not a test assertion failure of any
kind. Cause: this specific run overlapped with a separate, smaller
`mobile-nav.spec.ts` invocation started in parallel against the same
`test-results/` output directory, and the two processes' trace writers
collided. Not investigated further — every one of these 8 route/width
combinations already has an independently-confirmed clean result from its
own dedicated run earlier in this file (P0 fine-sweep 312/312, P0 routes
143/143, P1 routes 322/322), so this is a redundant-run artifact, not a new
data point. Lesson for future sessions: don't run a second `playwright test`
invocation against the same `test-results/` directory while a large one is
still writing traces.

**A note on flakiness encountered while producing this round's results:**
this machine accumulated many long-lived `node.exe`/Playwright-worker
processes over the course of this session, and several genuine-looking
failures during this round turned out to be caused by that load, not real
bugs — a `Test timeout exceeded` with no assertion nearby, or a
`toHaveScreenshot`/stability-negotiation failure that doesn't reproduce
when the exact same test is re-run with `--workers=1` and nothing else
running, are the two signatures seen repeatedly. Every number recorded in
this file as CONFIRMED CLEAN was checked this way before being trusted —
see the "Testing infrastructure findings" section and the P0
re-verification entries above for the specific instances.
