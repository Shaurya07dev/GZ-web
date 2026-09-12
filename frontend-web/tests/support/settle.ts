import type { Page } from '@playwright/test';

// Several landing/about sections (features/landing/*, features/about/*) use
// framer-motion `whileInView` scroll-reveal (initial opacity:0 -> animate on
// intersection, once:true). A direct fullPage screenshot right after goto
// can capture those sections still at opacity:0 — confirmed on the actual
// baseline PNG (inline style="opacity:0;transform:...").
//
// Tried and rejected: window.scrollTo() stepping, page.mouse.wheel()
// stepping (both fine-and-coarse-grained), and native scrollIntoView() in a
// loop — none reliably fired the IntersectionObservers in this headless
// Chromium; 37 of 37 sampled elements stayed stuck at opacity:0 every time.
// Root cause not fully isolated (likely a rAF/IntersectionObserver timing
// quirk specific to headless automation, not something real users hit —
// real touch/wheel scroll is continuous, not discrete jumps). Rather than
// keep guessing at scroll timing, this forces the known end state directly:
// visual regression testing should validate layout, not animation timing.
export async function settleScrollReveal(page: Page): Promise<void> {
  // A one-time direct mutation of just the affected elements' inline styles,
  // not a live stylesheet rule — a global attribute-selector rule got
  // re-evaluated during toHaveScreenshot's own internal stability retries on
  // the tallest pages (home, ~8-11k px) and never produced two identical
  // consecutive captures ("failed to take two consecutive stable
  // screenshots"). Mutating once, before any screenshot attempt starts, and
  // leaving nothing live for the browser to keep re-matching, was stable.
  //
  // Matches ANY inline opacity below 1, not just the literal "opacity:0"
  // starting state — widened 2026-09-12 after an axe scan on /marketplace
  // reported real-looking color-contrast violations (text color fading
  // toward the background) that turned out to be a card grid's wrapping
  // motion.div caught mid-animation (computed opacity 0.598, a live
  // transform still in flight) — a state the exact-"0" string match never
  // caught, since framer-motion writes the current interpolated value as
  // it animates, not just the start and end points.
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('[style*="opacity"]').forEach((el) => {
      const current = parseFloat(el.style.opacity);
      if (!Number.isNaN(current) && current < 1) {
        el.style.setProperty('opacity', '1');
        el.style.setProperty('transform', 'none');
      }
    });
  });
  await page.waitForTimeout(100);
}

// components/cookie-consent-banner.tsx (site-wide, app/layout.tsx) defaults
// to hidden on first paint (SSR-safe) and flips visible in a useEffect that
// reads localStorage['gz-cookie-consent'] — absent in every fresh Playwright
// context, so it always WANTS to show. Whether it actually lands in a
// screenshot turned out to be a timing race, not a given: Playwright's
// stability check (two consecutive matching frames) can settle either before
// or after that effect fires, depending on how long hydration takes. Found
// when a dev-server restart (for the unrelated allowedDevOrigins fix) made
// every route's first compile slower, which tipped every single screenshot
// in the suite — 157 of 157, including routes with nothing else in common —
// from "banner not yet mounted" to "banner mounted", a systemic diff with no
// code changes behind it. Seeding consent before the page's own scripts run
// removes the race entirely, rather than hoping stability-detection timing
// keeps landing the same way it happened to before.
export async function dismissCookieConsent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('gz-cookie-consent', 'accepted');
  });
}

// lib/mock-utils.ts's mockDelay() wraps every services/*Service.ts response
// in `setTimeout(..., 600)` — a plain timer, not a network request, so
// page.waitForLoadState('networkidle') cannot see it (confirmed: grepped
// every mockDelay() call site, none override the 600ms default). A page
// that fetches its content this way genuinely renders twice: an
// empty/loading first paint, then the real content ~600ms later. Found via
// a visual-baseline diff on /artists/[artistId] that looked like a full
// vertical page shift — the *baseline* had an empty "Story" bio section
// (screenshotted before its mock fetch resolved), the new run had the real
// two-paragraph bio (screenshotted after), and every pixel below that point
// consequently differed. Same family as settleScrollReveal/
// dismissCookieConsent: a real, load-bearing timing race, not a one-off
// fluke — call this before any assertion that depends on fetched content
// (screenshots, structural/overflow checks), not just networkidle.
export async function waitForMockData(page: Page): Promise<void> {
  await page.waitForTimeout(900);
}
