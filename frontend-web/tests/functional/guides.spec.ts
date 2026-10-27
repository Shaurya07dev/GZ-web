import { test, expect, type Page } from '@playwright/test';
import { signInAs } from '../support/auth';
import { dismissCookieConsent } from '../support/settle';
import { GUIDES, GUIDES_FOR } from '../../lib/guides';

// The five explainers in public/guides/ and the five places that offer them:
// artist Orders, the upload form under the aggregator terms, the artist
// Profile's GSTIN field, the GST card on Earnings, and Support -> FAQs for each
// portal. The API is stubbed.

const cors = { 'access-control-allow-origin': '*' };
const ok = (body: unknown) => ({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });

const me = (role: string) => ({ uid: 'u1', role, status: 'active', name: 'Meera Kulkarni', email: 'meera@example.in', phone: '9876543210', roleGrants: [] });
const PROFILE = {
  uid: 'u1', fullName: 'Meera Kulkarni', email: 'meera@example.in', phone: '9876543210', role: 'artist', status: 'active',
  createdAt: '2026-01-10T00:00:00.000Z', bio: null, profileImageUrl: null, headline: null, location: null, instagram: null,
  website: null, pan: 'ABCDE1234F', gstin: null, gstStatus: 'not_submitted', aadhaarStatus: 'not_submitted', aadhaarMasked: null,
  bankAccountMasked: null, ifsc: null, pickupLine1: null, pickupLine2: null, pickupCity: null, pickupState: null, pickupPincode: null,
  earningsAbove5L: false, socialProofVideoUrl: null, companyName: null,
};
const MOU = { acceptance: null, draft: { version: '2026.4', parties: { party: { name: 'Meera Kulkarni', businessName: null, address: null, mobile: null, email: 'meera@example.in', governmentId: null, gstNo: null }, company: { name: 'Anand Rao', designation: 'Director' } }, missing: [], asOf: '2026-09-29T13:15:00.000Z' } };

async function open(page: Page, baseURL: string, role: 'artist' | 'aggregator', path: string) {
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  // The first-visit walkthrough would sit over every page below. Top window
  // only: init scripts also run in the sandboxed guide frames, which have no storage.
  await page.addInitScript((r) => {
    if (window === window.top) window.localStorage.setItem(`gz_tour_completed_${r}`, 'seen');
  }, role);
  await signInAs(page.context(), role, baseURL);
  await page.route('**/v1/auth/me', (route) => route.fulfill(ok(me(role))));
  await page.route('**/v1/me/profile', (route) => route.fulfill(ok(PROFILE)));
  await page.route('**/v1/artist/mou', (route) => route.fulfill(ok(MOU)));
  await page.goto(path);
}

const guideButton = (page: Page, title: string) => page.getByRole('button', { name: new RegExp(title) });

test('every guide is served, and the order-fulfilment video is its own file', async ({ request }) => {
  for (const guide of Object.values(GUIDES)) {
    const res = await request.get(guide.src);
    expect(res.status(), guide.src).toBe(200);
    expect(res.headers()['content-type'], guide.src).toContain('text/html');
  }

  // Inlined, the video made that page 2.9 MB before anything could play.
  const html = await (await request.get(GUIDES.orderFulfilment.src)).text();
  expect(html).not.toContain('data:video');
  expect(html).toContain('media/order-fulfilment-edge-protection.mp4');
  const video = await request.get('/guides/media/order-fulfilment-edge-protection.mp4');
  expect(video.status()).toBe(200);
  expect(video.headers()['content-type']).toContain('video/mp4');
});

test('artist Orders offers the fulfilment guide, which plays in a dialog and ends when closed', async ({ page, baseURL }) => {
  await open(page, baseURL!, 'artist', '/dashboard/orders');

  await guideButton(page, GUIDES.orderFulfilment.title).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: GUIDES.orderFulfilment.title })).toBeVisible();

  // The page ran its own script: it opens in Hindi, and the switch gives English.
  const frame = dialog.frameLocator('iframe');
  await expect(frame.locator('#edgevid')).toHaveAttribute('src', 'media/order-fulfilment-edge-protection.mp4');
  await frame.getByRole('button', { name: 'English' }).click();
  await expect(frame.getByRole('heading', { name: 'Artwork Order Fulfilment' })).toBeVisible();

  // Focus is inside the guide now, so Escape would go to it, not to the dialog.
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('the upload form keeps its place: the aggregator guide opens over it without leaving', async ({ page, baseURL }) => {
  await open(page, baseURL!, 'artist', '/dashboard/artworks/upload');

  const title = page.getByLabel(/^Title/);
  await title.fill('Fragments of Dawn');
  await guideButton(page, GUIDES.aggregatorProcess.title).click();
  const frame = page.getByRole('dialog').frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: 'Galleryzone' })).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page).toHaveURL(/\/dashboard\/artworks\/upload$/);
  await expect(title).toHaveValue('Fragments of Dawn');
});

test('the artist Profile offers the GST guide beside the GSTIN field', async ({ page, baseURL }) => {
  await open(page, baseURL!, 'artist', '/dashboard/profile');

  await guideButton(page, GUIDES.gstRegistration.title).click();
  const frame = page.getByRole('dialog').frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: 'Before you start' })).toBeVisible();
  // Hindi is one tap away, as the guide's own switch.
  await frame.getByRole('button', { name: 'हिन्दी' }).click();
  await expect(frame.getByRole('heading', { name: 'शुरू करने से पहले' })).toBeVisible();
});

test('the artist Earnings page carries the same GST guide on its GST card', async ({ page, baseURL }) => {
  await open(page, baseURL!, 'artist', '/dashboard/wallet');
  await expect(guideButton(page, GUIDES.gstRegistration.title)).toBeVisible();
});

for (const [role, path] of [['artist', '/dashboard/support'], ['aggregator', '/aggregator/support']] as const) {
  const audience = role === 'artist' ? 'artists' : 'aggregators';
  const other = role === 'artist' ? 'aggregators' : 'artists';

  test(`${role} Support lists that portal's own video walkthroughs`, async ({ page, baseURL }) => {
    await open(page, baseURL!, role, path);

    await expect(page.getByRole('heading', { name: 'Video walkthroughs' })).toBeVisible();
    for (const guide of GUIDES_FOR[audience]) await expect(guideButton(page, guide.title)).toBeVisible();
    // The GST guide is for both; everything else is for one portal.
    for (const guide of GUIDES_FOR[other]) {
      if (GUIDES_FOR[audience].includes(guide)) continue;
      await expect(guideButton(page, guide.title)).toHaveCount(0);
    }
  });
}
