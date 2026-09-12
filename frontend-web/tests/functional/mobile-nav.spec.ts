import { test, expect } from '@playwright/test';
import { signInAs } from '../support/auth';
import { dismissCookieConsent } from '../support/settle';

// Phase 6 functional testing: mobile navigation. Every assertion here
// checks resulting STATE (URL changed, drawer closed/open, right links
// present) — not just "the click didn't throw". Real selectors only,
// confirmed live via ariaSnapshot/getBoundingClientRect before being
// written here, not guessed:
//   - public SiteHeader: a role="dialog" full-screen drawer (Radix/base-ui
//     Dialog), "Open menu" trigger, "Close" button inside.
//   - portal shells: a plain <aside> that translates on/off-screen
//     (no dialog role), "Open menu" trigger, closes on link click by
//     navigating away (checked via aside.getBoundingClientRect().left).

const MOBILE = { width: 390, height: 844 };

test.describe('Mobile nav — public SiteHeader drawer', () => {
  test('closed by default, opens on trigger, shows expected links', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.setViewportSize(MOBILE);
    await page.goto('/marketplace');

    await expect(page.getByRole('dialog', { name: 'Navigation menu' })).toBeHidden();

    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Navigation menu' });
    await expect(drawer).toBeVisible();

    // A representative sample of what the drawer must carry, not every link.
    await expect(drawer.getByRole('link', { name: 'Artists' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'About' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });

  test('clicking a nav link navigates and closes the drawer', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.setViewportSize(MOBILE);
    await page.goto('/marketplace');

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('dialog', { name: 'Navigation menu' }).getByRole('link', { name: 'Artists', exact: true }).click();

    await expect(page).toHaveURL(/\/artists$/);
    await expect(page.getByRole('dialog', { name: 'Navigation menu' })).toBeHidden();
  });

  test('close button dismisses the drawer without navigating', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.setViewportSize(MOBILE);
    await page.goto('/marketplace');

    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Navigation menu' });
    await expect(drawer).toBeVisible();

    await drawer.getByRole('button', { name: 'Close' }).click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/\/marketplace$/);
  });
});

// Same open/navigate/close contract, verified independently per shell —
// these are three separate copy-and-adapt implementations (see
// RESPONSIVE_AUDIT.md CRITICAL #3: the sidebar-scroll bug had to be fixed
// in all three separately because they don't share a component), so a
// passing test on one shell says nothing about the others.
const PORTAL_SHELLS: {
  name: string;
  role: 'artist' | 'customer' | 'aggregator';
  path: string;
  navLinkName: string;
  expectedUrlPattern: RegExp;
}[] = [
  { name: 'DashboardShell (artist)', role: 'artist', path: '/dashboard', navLinkName: 'My Artworks', expectedUrlPattern: /\/dashboard\/artworks$/ },
  { name: 'AccountShell (customer)', role: 'customer', path: '/account', navLinkName: 'Wishlist', expectedUrlPattern: /\/account\/wishlist$/ },
  { name: 'AggregatorShell (aggregator)', role: 'aggregator', path: '/aggregator/dashboard', navLinkName: 'My Inventory', expectedUrlPattern: /\/aggregator\/collection$/ },
];

for (const shell of PORTAL_SHELLS) {
  test.describe(`Mobile nav — ${shell.name}`, () => {
    test('sidebar off-canvas by default, slides in on trigger, closes on nav', async ({ page, context, baseURL }) => {
      await signInAs(context, shell.role, baseURL!);
      await dismissCookieConsent(page);
      await page.setViewportSize(MOBILE);
      await page.goto(shell.path);

      const asideLeftBefore = await page.locator('aside').evaluate((el) => el.getBoundingClientRect().left);
      expect(asideLeftBefore, 'sidebar must start off-screen on mobile').toBeLessThan(0);

      await page.getByRole('button', { name: 'Open menu' }).click();
      const asideLeftOpen = await page.locator('aside').evaluate((el) => el.getBoundingClientRect().left);
      expect(asideLeftOpen, 'sidebar must be on-screen after opening').toBe(0);

      await page.locator('aside').getByRole('link', { name: shell.navLinkName, exact: true }).click();
      await expect(page).toHaveURL(shell.expectedUrlPattern);

      const asideLeftAfterNav = await page.locator('aside').evaluate((el) => el.getBoundingClientRect().left);
      expect(asideLeftAfterNav, 'sidebar must close again after navigating').toBeLessThan(0);
    });

    test('close (X) button dismisses the sidebar without navigating', async ({ page, context, baseURL }) => {
      await signInAs(context, shell.role, baseURL!);
      await dismissCookieConsent(page);
      await page.setViewportSize(MOBILE);
      await page.goto(shell.path);
      const startUrl = page.url();

      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.locator('aside').first()).toBeInViewport();

      // Two elements share the "Close menu" label (the full-screen backdrop
      // button and the in-sidebar X) — scope to the sidebar's own button.
      await page.locator('aside').getByRole('button', { name: 'Close menu' }).click();
      const asideLeftAfterClose = await page.locator('aside').evaluate((el) => el.getBoundingClientRect().left);
      expect(asideLeftAfterClose, 'sidebar must close on explicit close').toBeLessThan(0);
      expect(page.url()).toBe(startUrl);
    });
  });
}
