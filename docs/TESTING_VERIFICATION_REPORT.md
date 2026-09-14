# Testing Infrastructure Verification

Repo: `GalleryZone/frontend-web` (Yash13606/GalleryZone, personal repo)
Date: 2026-09-11
Package manager: npm 11.6.2 (only lock file present is `package-lock.json`)
Node: v24.13.0

Starting state, confirmed before touching anything: `package.json` had **no**
Playwright, no axe test runner, no `tests/` directory, and no playwright
config. `axe-core@4.13.0` existed in `node_modules` only as a transitive dep
of `eslint-plugin-jsx-a11y` (lint-time, not test-time). `@playwright/test` only
appeared in `package-lock.json` as Next.js's own optional peerDependency
listing — never actually installed. The infrastructure did not exist prior to
this session; everything below was installed and built from scratch, then run.

## Package Installation

PASS

- Installed via `npm install --save-dev @playwright/test @axe-core/playwright`.
- `npm ls @playwright/test @axe-core/playwright axe-core`:
  ```
  frontend-web@0.1.0
  +-- @axe-core/playwright@4.13.0
  |   `-- axe-core@4.13.0
  +-- @playwright/test@1.63.0
  `-- eslint-config-next@16.3.0
      `-- eslint-plugin-jsx-a11y@6.10.2
          `-- axe-core@4.13.0 deduped
  ```
- `package.json` devDependencies now contain `@axe-core/playwright: ^4.13.0`,
  `@playwright/test: ^1.63.0` — versions confirmed installed, not just listed.

## Playwright CLI

PASS

- `npx playwright --version` → `Version 1.63.0`
- `npx playwright test --list` → loaded `playwright.config.ts`, discovered
  **33 tests in 5 files** (5 spec files × 3 browser projects each). Full list
  printed correctly with file:line references.

## Chromium

PASS — `chromium: LAUNCH_OK version=153.0.8010.12`, ran and passed all assigned specs.

## Firefox

PASS — `firefox: LAUNCH_OK version=155.0`, ran and passed all assigned specs.

## WebKit

PASS — `webkit: LAUNCH_OK version=26.6`, ran and passed all assigned specs.

Proof beyond "package downloaded": a standalone script launched each engine
directly via `playwright-core`, opened a `data:` page, read back the title,
and closed — before any spec file existed. All three returned `LAUNCH_OK`
with real version strings. Binaries confirmed on disk at
`C:\Users\yashm\AppData\Local\ms-playwright\{chromium-1243,firefox-1543,webkit-2359}`.

## Application Smoke Test

PASS

File: `tests/smoke/browser-installation.spec.ts`. Loads `/`, asserts response
is ok, title matches `/GalleryZone/`, body visible, zero uncaught `pageerror`
events, then saves a full-page screenshot.

```
ok [chromium] app loads, has expected title, no fatal page errors (3.8s)
ok [firefox]  app loads, has expected title, no fatal page errors (4.6s)
ok [webkit]   app loads, has expected title, no fatal page errors (5.3s)
3 passed
```

Screenshots on disk, non-zero size, distinct per browser:
`test-results/screenshots/smoke-{chromium,firefox,webkit}.png` (188KB /
259KB / 463KB).

## Multi-Viewport Test

PASS

File: `tests/responsive/viewports.spec.ts`. Covers 320 / 390 / 430 / 768 /
1024 / 1280 / 1440px, one test per size, run against all 3 browsers = 21
tests. Each: sets viewport, loads `/`, asserts body visible, checks
`scrollWidth <= clientWidth`, screenshots full page.

```
21 passed (22–24s)
```

21 screenshots on disk at `test-results/screenshots/viewport-{width}-{browser}.png`.

## Horizontal Overflow Check

PASS

Same file as above — `document.documentElement.scrollWidth` vs `clientWidth`,
+1px tolerance for scrollbar rounding. On failure the assertion message
reports route, viewport, browser, and up to 10 offending selectors with their
right-edge pixel position (computed via `getBoundingClientRect()` over
`body *`).

**This was verified to actually catch overflow, not just always pass.**
Negative control: a throwaway spec injected a 900px-wide element into a
320px viewport. Result: `Expected: <= 321, Received: 908` — the check failed
correctly. Control file deleted after confirming. The current homepage has
**zero** overflow at any of the 7 sizes across all 3 browsers — this is a
real clean result, not an untested assertion.

## Screenshot Regression Test

PASS

File: `tests/visual/screenshot.spec.ts`, target `/privacy` (static legal
content, no animation/no client-side randomness — chosen so repeat runs are
deterministic instead of fighting hero-section motion on `/`).

- **Run 1** (no baseline): failed as expected —
  `A snapshot doesn't exist ... writing actual` — and wrote
  `tests/visual/screenshot.spec.ts-snapshots/privacy-page-{chromium,firefox,webkit}-win32.png`
  (confirmed on disk, 300–418KB each).
- **Run 2** (baseline exists, no changes): `3 passed` — real pixel comparison
  succeeded.
- **Tolerance was not touched** — default Playwright thresholds throughout.
- Negative control: temporarily added `document.body.style.paddingTop =
  '80px'` before the assertion. Result:
  `Expected an image 1280px by 2648px, received 1280px by 2728px. 198223
  pixels (ratio 0.06) are different` — comparison correctly failed. Change
  reverted; suite passes clean again (confirmed by a 3rd run, `3 passed`).

## axe Accessibility Test

PASS

File: `tests/a11y/axe.spec.ts`, target `/` (representative page), using
`AxeBuilder` from `@axe-core/playwright`, tags `wcag2a` + `wcag2aa`. Result
attached as JSON to the test report and violations printed with impact,
selector, and rule id.

- Current result: **0 violations, 21 rules passed**, on all 3 browsers. No
  pre-existing issues to report at this tag level.
- Negative control (tool-execution proof, not a fix task): injected an
  `<img>` with no `alt` before scanning. axe correctly reported
  `[critical] image-alt: Images must have alternative text` on
  `img[src$="favicon.ico"]`. Reverted afterward. This confirms axe is really
  walking the live DOM, not returning an empty/stubbed result.

## Console Error Detection

PASS

File: `tests/smoke/console-errors.spec.ts`. Listens for `console` (type
`error`), `pageerror`, and `requestfailed`, attaches full JSON detail, fails
only on uncaught `pageerror`s (0 found).

The listeners are demonstrably live — they caught real dev-server output:

```
chromium: 13 console errors, 0 page errors, 12 failed requests
firefox:   1 console error,  0 page errors,  0 failed requests
webkit:   12 console errors, 0 page errors, 12 failed requests
```

## Test Commands

PASS — all four run for real, from `package.json`:

| Command | Result |
|---|---|
| `npm run test:responsive` | 21 passed (22.1s) |
| `npm run test:visual` | 3 passed (6.2s) |
| `npm run test:a11y` | 3 passed (6.4s) |
| `npm run test:all` | **33 passed (28.1s)** |

(`test:smoke` also added, not requested but symmetrical with the others —
`playwright test tests/smoke`.)

## Known Issues

Not blockers, pre-existing, surfaced by the console-error capture (not by me
going looking):

1. **~~12 `net::ERR_ABORTED` requests per load~~ — UPDATE 2026-09-11, this was
   under-diagnosed, not actually harmless.** Originally logged as "classic
   Turbopack dev-mode noise... treated as non-fatal." That was wrong about
   the impact, right that the page still rendered. Root cause, found while
   building the first real interaction test (Select open/close —
   `tests/responsive/select.spec.ts`): `next dev`'s default cross-origin
   dev-asset protection only allows `Origin: http://localhost:*` by default,
   but `playwright.config.ts`'s `baseURL` is `http://127.0.0.1:3000` (chosen
   for this environment's curl/Playwright connectivity — see repo history).
   Every async chunk request the browser makes (framer-motion, `@base-ui/react`,
   anything code-split) got silently **403'd specifically because of the
   Origin header** — confirmed by the same URL returning `200` from `curl`
   (no `Origin` header sent, check skipped) and `403` from a real browser
   navigation. Effect: pages render correctly (SSR/RSC HTML unaffected) but
   are **completely inert** — no click, no keyboard interaction, nothing
   base-ui/framer-motion-driven works. This did not surface earlier because
   every test up to this point was structural/visual (overflow, screenshots,
   computed styles) — nothing had actually tried to click something yet.
   **Fixed:** added `allowedDevOrigins: ["127.0.0.1"]` to `next.config.ts`
   (Next's documented escape hatch for this exact scenario), restarted the
   dev server (required — `next.config.ts` isn't hot-reloaded). Verified:
   the same base-ui chunk request that 403'd now returns 200 in-browser, and
   `tests/responsive/select.spec.ts`'s open/select/close interactions pass
   for real (`aria-expanded` toggles, option list populates, selection
   reflects in the trigger). This was a testing-infrastructure gap, not an
   app bug — no application code changed for this fix.
2. **HMR websocket handshake 403** (`ws://127.0.0.1:3000/_next/hmr?...`) —
   same root cause as #1 (Origin mismatch), same fix, not independently
   re-verified after the `allowedDevOrigins` change but expected resolved by
   the same mechanism. Not present in production (`next start`).

Both were dev-server artifacts of `npm run dev`, not app bugs — noted for
visibility since the tooling's whole job is not to hide this kind of thing,
including hiding its own earlier wrong conclusion about severity.

No other failures, retries, skips, or flaky runs occurred during this
verification.
