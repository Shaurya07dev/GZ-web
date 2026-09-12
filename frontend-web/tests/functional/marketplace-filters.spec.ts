import { test, expect } from '@playwright/test';
import { dismissCookieConsent } from '../support/settle';

// Phase 6 functional testing: the marketplace filter sidebar and search —
// client-side filter state, no URL sync (confirmed against
// ROUTE_INVENTORY.md's note on this). Assertions poll via a toPass() count
// check rather than a flat wait — the result grid updates on the
// mockDelay-backed data path (same 600ms-class race as everywhere else in
// this app), and polling resolves as soon as it's actually done instead of
// guessing a fixed delay.
//
// Does NOT assert a specific category has a specific non-zero count: the
// mock artwork catalog is a shared, mutable, server-side in-memory store
// (confirmed via aggregatorService.ts's own comment: "a live store, not a
// frozen fixture"), not reset per test run or per browser context. Running
// checkout-flow.spec.ts's purchase repeatedly across a session measurably
// changes availability/counts over time — a hardcoded "Sculpture has 4
// results" assumption here broke for exactly that reason on a later run.
// The filter contract this asserts instead — a selected filter narrows or
// holds the set, never grows it, and reset restores the original count —
// holds regardless of which artworks currently exist.

const ARTWORK_LINKS = 'a[href^="/marketplace/"]';

test('Art Type filter narrows the grid, Reset Filters restores it', async ({ page }) => {
  await dismissCookieConsent(page);
  await page.goto('/marketplace');

  const gridLocator = page.locator(ARTWORK_LINKS);
  await expect(async () => {
    expect(await gridLocator.count()).toBeGreaterThan(0);
  }).toPass({ timeout: 5000 });
  const fullCount = await gridLocator.count();

  await page.getByRole('button', { name: 'Art Type All Art Types' }).click();
  // Not name-scoped to the region: the heading's accessible name IS the
  // current selection state ("Art Type All Art Types" -> "Art Type
  // Sculpture" once picked), so a name-based re-query goes stale the
  // moment the value changes. Structural instead: Art Type's disclosure is
  // the only one open, so it's the only combobox rendered in the sidebar.
  const artTypeSelect = page.locator('aside').getByRole('combobox').first();
  await artTypeSelect.click();
  await page.getByRole('option', { name: 'Sculpture', exact: true }).click();

  await expect(artTypeSelect).toContainText('sculpture', { ignoreCase: true });
  const filteredLocator = page.locator(ARTWORK_LINKS);
  await expect(async () => {
    expect(await filteredLocator.count()).toBeLessThanOrEqual(fullCount);
  }).toPass({ timeout: 5000 });

  await page.getByRole('button', { name: 'Reset Filters' }).click();
  await expect(async () => {
    expect(await page.locator(ARTWORK_LINKS).count()).toBe(fullCount);
  }).toPass({ timeout: 5000 });
});

test('search narrows results to actual title/artist matches', async ({ page }) => {
  await dismissCookieConsent(page);
  await page.goto('/marketplace');

  const search = page.getByPlaceholder(/Search artworks/);
  const gridLocator = page.locator(ARTWORK_LINKS);

  await search.fill('Monsoon');
  await expect(async () => {
    expect(await gridLocator.count()).toBe(2);
  }).toPass({ timeout: 5000 });
  await expect(page.getByText('Monsoon Over Madurai')).toBeVisible();
  await expect(page.getByText('Monsoon Reverie')).toBeVisible();

  await search.fill('zzz-no-such-artwork-zzz');
  await expect(async () => {
    expect(await gridLocator.count()).toBe(0);
  }).toPass({ timeout: 5000 });
});
