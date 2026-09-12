import { test, expect, type Page } from '@playwright/test';
import { signInAs } from '../support/auth';
import { dismissCookieConsent } from '../support/settle';

// Dedicated regression suite for components/ui/select.tsx — RESPONSIVE_AUDIT.md
// HIGH #1: SelectValue's `line-clamp-1` was inert because the same element
// also had `flex` applied (line-clamp needs display:-webkit-box, flex wins),
// so overflowing text clipped with zero visual indication. Fix moved
// truncation onto SelectValue itself (min-w-0 + truncate, no inner flex
// container) — see components/ui/select.tsx.
//
// Covers the checklist RESPONSIVE_AUDIT.md's Phase 2 asked for: short/long
// placeholder, short/long selected value, narrow/normal/wide triggers,
// open -> choose -> verify -> close. Not covered, deliberately: icon+text
// inside SelectValue, and a disabled Select — grepped every SelectTrigger/
// SelectValue usage in the codebase (7 files, 17 call sites) and neither
// pattern exists anywhere yet, so there is nothing real to test.
//
// Real content is used throughout, not synthetic strings: FRAMING_LABEL's
// "Freestanding (sculpture)" / "Stretched on canvas" (types/artwork.ts) and
// marketplace's "Price: Low to High" (features/marketplace/marketplace-grid.tsx)
// are the actual longest values a user can select in these fields.

const WIDTHS = [320, 375, 390, 430, 480, 640, 768, 820, 947, 1024, 1280, 1440];

// The HIGH #1 defect, generalized: any select-value on the page whose text
// overflows its box must show the ellipsis affordance, not clip silently.
async function assertNoSilentClipping(page: Page, context: string) {
  const offenders = await page.evaluate(() => {
    const bad: string[] = [];
    document.querySelectorAll<HTMLElement>('[data-slot="select-value"]').forEach((e) => {
      const cs = getComputedStyle(e);
      const clipped = e.scrollWidth > e.clientWidth + 1;
      if (clipped && cs.textOverflow !== 'ellipsis') {
        bad.push(
          `"${e.textContent?.trim()}" clipped with no ellipsis (scrollWidth=${e.scrollWidth} clientWidth=${e.clientWidth} textOverflow=${cs.textOverflow})`,
        );
      }
    });
    return bad;
  });
  expect(offenders, `${context}:\n${offenders.join('\n')}`).toEqual([]);
}

test.describe('Select structural — no silent clipping across widths', () => {
  for (const width of WIDTHS) {
    // artist-upload: 6 Selects, all w-full "normal" triggers, inside the
    // 2-column grid that bottoms out at exactly 1024px (the confirmed
    // HIGH #1 repro route/width).
    test(`artwork upload form selects @ ${width}px`, async ({ page, context, baseURL }) => {
      await signInAs(context, 'artist', baseURL!);
      await dismissCookieConsent(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dashboard/artworks/upload');
      await page.waitForLoadState('networkidle');
      await assertNoSilentClipping(page, `upload form @ ${width}px`);
    });

    // marketplace: 1 Select, w-auto min-w-[140px] "wide/auto" trigger, with
    // a sibling label that itself hides below sm (640px) — different sizing
    // family from the upload form's w-full triggers.
    test(`marketplace sort select @ ${width}px`, async ({ page }) => {
      await dismissCookieConsent(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/marketplace');
      await page.waitForLoadState('networkidle');
      await assertNoSilentClipping(page, `marketplace sort @ ${width}px`);
    });
  }

  // aggregator profile: w-24 shrink-0 "narrow" trigger carrying a
  // permanently-short "+91"-style value — negative control, should never
  // clip at any width including the smallest.
  for (const width of [320, 768]) {
    test(`aggregator profile dial-code select (narrow trigger) @ ${width}px`, async ({
      page,
      context,
      baseURL,
    }) => {
      await signInAs(context, 'aggregator', baseURL!);
      await dismissCookieConsent(page);
      await page.setViewportSize({ width, height: 1800 });
      await page.goto('/aggregator/profile');
      await page.waitForLoadState('networkidle');
      await assertNoSilentClipping(page, `aggregator profile @ ${width}px`);
    });
  }
});

test.describe('Select functional — open, choose, verify, close', () => {
  test('long selected value: ellipsis affordance, trigger stays in-bounds, closes on select', async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, 'artist', baseURL!);
    await dismissCookieConsent(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/dashboard/artworks/upload');
    await page.waitForLoadState('networkidle');

    const trigger = page.getByRole('combobox', { name: 'Framing' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const options = page.getByRole('option');
    await expect(options).toHaveCount(2); // AGGREGATOR_READY_FRAMING gates the rest by default listingType — see artwork-submit-form.tsx:1042-1045, out of scope here

    await page.getByRole('option', { name: 'Stretched on canvas' }).click();

    // base-ui closes the popup on selection
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('option')).toHaveCount(0);
    // selected value is reflected in the trigger
    await expect(trigger).toContainText('Stretched on canvas');

    // trigger geometry never exceeds the viewport
    const box = await trigger.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(1024 + 1);

    // and whatever doesn't fit shows the affordance, not a silent cut
    await assertNoSilentClipping(page, 'framing trigger after selecting long value @ 1024px');
  });

  test('short selected value never needs to clip (negative control)', async ({ page, context, baseURL }) => {
    await signInAs(context, 'artist', baseURL!);
    await dismissCookieConsent(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/dashboard/artworks/upload');
    await page.waitForLoadState('networkidle');

    const trigger = page.getByRole('combobox', { name: 'Framing' });
    await trigger.click();
    await page.getByRole('option', { name: 'Framed', exact: true }).click();

    await expect(trigger).toContainText('Framed');
    const valueEl = page.locator('#framing [data-slot="select-value"]');
    const clipped = await valueEl.evaluate((e) => e.scrollWidth > e.clientWidth + 1);
    expect(clipped).toBe(false);
  });

  test('marketplace sort: choose a different option, trigger text updates, closes', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    const trigger = page.locator('[data-slot="select-trigger"]').first();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('option', { name: 'Price: Low to High' }).click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('price_asc'); // raw value, not label — SelectValue has no render-prop here; pre-existing content quirk, not a responsive bug, not touched
    await assertNoSilentClipping(page, 'marketplace sort after choosing long option @ 768px');
  });
});
