import { test, expect, type Page } from '@playwright/test';
import { dismissCookieConsent } from '../support/settle';

// The client's list of 18 Nov 2026 (a voice note): sign-up order, the footer, the home page order, the About
// team, the Artist Terms date, and photos you can swipe through. The API is stubbed.

const cors = { 'access-control-allow-origin': '*' };
const ok = (body: unknown) => ({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });

async function open(page: Page, path: string) {
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  await page.goto(path);
}

const topOf = (page: Page, text: string | RegExp) =>
  page.getByText(text, { exact: typeof text === 'string' }).first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

test('sign-up lists Customer, then Artist, then Aggregator', async ({ page }) => {
  await open(page, '/register');
  const order: { label: string; y: number; x: number }[] = [];
  for (const label of ['Customer', 'Artist', 'Aggregator']) {
    const box = await page.getByText(label, { exact: true }).first().boundingBox();
    expect(box, `${label} is on the sign-up page`).not.toBeNull();
    order.push({ label, y: Math.round(box!.y), x: Math.round(box!.x) });
  }
  const sorted = [...order].sort((a, b) => a.y - b.y || a.x - b.x).map((o) => o.label);
  expect(sorted).toEqual(['Customer', 'Artist', 'Aggregator']);
});

test('the footer: Careers and Newsroom say coming soon; the unwanted links are gone', async ({ page }) => {
  await open(page, '/');
  const footer = page.getByRole('contentinfo');
  for (const gone of ['Sculptures', 'Digital Art', 'MOU Agreement', 'Artist Terms', 'Aggregator Terms']) {
    await expect(footer.getByText(gone, { exact: true }), `${gone} is not in the footer`).toHaveCount(0);
  }
  // Still there: the pages the client did not ask to remove.
  await expect(footer.getByRole('link', { name: 'Terms & Conditions' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Paintings' })).toBeVisible();

  await footer.getByRole('button', { name: /Careers/ }).click();
  await expect(page.getByText('Careers is coming soon')).toBeVisible();
  await footer.getByRole('button', { name: /Newsroom/ }).click();
  await expect(page.getByText('Newsroom is coming soon')).toBeVisible();
});

test('the home page runs FAQ, then the Early Artist programme, then Get in touch', async ({ page }) => {
  await open(page, '/');
  const faq = await topOf(page, 'FAQs');
  const early = await topOf(page, 'Limited to early members only');
  const touch = await topOf(page, 'GET IN TOUCH');
  expect(faq).toBeLessThan(early);
  expect(early).toBeLessThan(touch);
});

test('About names both founders as Co-founders; the Artist Terms say when they took effect', async ({ page }) => {
  await open(page, '/about');
  await expect(page.getByText('Co-founder', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Founder', { exact: true })).toHaveCount(0);

  await page.goto('/artist-terms');
  await expect(page.getByText('Effective Date: 18 August 2026')).toBeVisible();
});

// ---- photos you can swipe through ---------------------------------------------------------------------------

const photos = ['/ecosystem/artwork-1.png', '/ecosystem/artwork-2.png', '/ecosystem/artwork-3.png'].map((url, i) => ({
  url, thumbnailUrl: url, altText: 'Monsoon Light', sortOrder: i,
}));
const listing = {
  id: 'a1', productCode: 'GZ000001', artistId: 'art1', artistName: 'Devika Rao', title: 'Monsoon Light', description: 'Oil on canvas.',
  category: 'Painting', medium: 'Oil', dimensions: '24x36 in', yearCreated: 2025, images: photos, displayPricePaise: 4_500_000,
  insured: true, status: 'marketplace', listingType: 'marketplace_only', rarityType: null, createdAt: '2026-01-01T00:00:00.000Z',
  artistLocation: 'Hyderabad', sizeBand: 'medium',
};

async function stubListing(page: Page) {
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  await page.route(/\/v1\/artworks(\?|$)/, (route) =>
    route.fulfill(ok({
      artworks: [listing], total: 1, page: 1, pageSize: 20,
      facets: { categories: ['Painting'], mediums: ['Oil'], rarities: [], rarityCounts: {}, locations: ['Hyderabad'], artists: [{ id: 'art1', name: 'Devika Rao' }], priceRangePaise: { min: 4_500_000, max: 4_500_000 } },
    })),
  );
  await page.route(/\/v1\/artworks\/a1$/, (route) => route.fulfill(ok(listing)));
}

test('a marketplace card holds every photo of the piece, and the arrows move between them', async ({ page }) => {
  await stubListing(page);
  await page.goto('/marketplace');
  const card = page.locator('a[href="/marketplace/a1"]').first();
  await expect(card).toBeVisible();
  // Three slides, announced one by one, and three dots.
  await expect(card.getByRole('img', { name: /Monsoon Light, photo \d of 3/ })).toHaveCount(3);
  await expect(card.getByTestId('photo-dots').locator('span')).toHaveCount(3);

  const track = card.locator('div.snap-x').first();
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);
  await card.hover();
  await card.getByRole('button', { name: 'Next photo' }).click();
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
  // Tapping an arrow does not open the piece.
  await expect(page).toHaveURL(/\/marketplace$/);
});

// The product page's swipe and arrows (ArtworkGallery) render on the server, so the API has to be real or a stub
// server; they are covered by hand in the PR notes rather than here.

test("the footer's Our Mission is its own page, with the Vision and the Mission as supplied", async ({ page }) => {
  await open(page, '/');
  const link = page.getByRole('contentinfo').getByRole('link', { name: 'Our Mission', exact: true });
  expect(await link.getAttribute('href')).toBe('/our-mission');
  await link.click();
  await expect(page).toHaveURL(/\/our-mission$/, { timeout: 30_000 }); // the first visit compiles the page in dev

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Vision');
  await expect(page.getByRole('heading', { name: 'Vision', exact: true })).toBeVisible();
  await expect(page.getByText("India's most trusted art ecosystem", { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mission', exact: true })).toBeVisible();
  await expect(page.getByText('GalleryZone is committed to building a technology-driven platform')).toBeVisible();
  // The five commitments, in order.
  await expect(page.locator('main ul li')).toHaveText([
    'Support artists by providing greater visibility and market access.',
    'Offer customers authentic, high-quality artwork through a transparent purchasing experience.',
    'Build partnerships with businesses that showcase original art in commercial spaces.',
    'Deliver professional services covering artwork verification, logistics, documentation, and customer support.',
    'Promote sustainable growth within the art community through ethical business practices.',
  ]);
});
