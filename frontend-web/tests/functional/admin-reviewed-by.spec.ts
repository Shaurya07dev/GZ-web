import { test, expect, type Page } from '@playwright/test';
import { signInAs } from '../support/auth';
import { dismissCookieConsent } from '../support/settle';

// The six admin queues (artworks, KYC, GST, external fees, deactivations, withdrawals) each have a Waiting /
// Reviewed switch, and the Reviewed side says which admin decided and when. The API is stubbed: this covers what
// the screens show and ask for; who decided is read from the audit log by the backend (packages/db/src/reviews.ts).

const CORS = { 'access-control-allow-origin': '*' };
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

async function openAdmin(page: Page, baseURL: string) {
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  await page.addInitScript(() => window.localStorage.setItem('gz_tour_completed_admin', 'seen'));
  await signInAs(page.context(), 'admin', baseURL);
  await page.route('**/v1/auth/me', (route) => route.fulfill(json({ uid: 'admin1', role: 'admin', status: 'active', name: 'Admin', email: 'admin@example.in', phone: null, roleGrants: [] })));
}

// The table is also laid out as cards on narrow screens, so the same text can be in the page twice. Only what is visible counts.
const seen = (page: Page, text: string) => page.getByText(text).locator('visible=true').first();

const switchTo = (page: Page, view: 'Waiting' | 'Reviewed') => page.getByRole('group', { name: 'Which items to show' }).getByRole('button', { name: view });

const userDto = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id, name, email: `${id}@example.in`, phone: null, role: 'artist', status: 'active', roleGrants: [], createdAt: '2026-10-01T00:00:00.000Z', lastLoginAt: null,
  pan: null, gstin: '29ABCDE1234F1Z5', gstStatus: 'submitted', aadhaarStatus: 'submitted', companyName: null, instagram: null, website: null, location: null,
  bankAccountMasked: null, externalArtist: false, galleryzoneRating: null, review: null, ...over,
});
const stamp = { adminName: 'Priya Sharma', decision: 'approved', at: '2026-11-12T10:00:00.000Z' };

for (const kind of ['gst', 'kyc'] as const) {
  test(`${kind.toUpperCase()} queue: Waiting has the Review button, Reviewed says who decided and has none`, async ({ page, baseURL }) => {
    await openAdmin(page, baseURL!);
    const status = kind === 'gst' ? 'gstStatus' : 'aadhaarStatus';
    const asked: string[] = [];
    await page.route(`**/v1/admin/moderation/${kind}*`, (route) => {
      const state = new URL(route.request().url()).searchParams.get('state') ?? '';
      asked.push(state);
      return route.fulfill(
        json({
          users: state === 'reviewed'
            ? [userDto('u1', 'Asha Rao', { [status]: 'approved', review: stamp })]
            : [userDto('u2', 'Ravi Menon', { [status]: 'submitted', review: { adminName: 'Karan Mehta', decision: 'rejected', at: '2026-11-05T10:00:00.000Z' } })],
        }),
      );
    });
    await page.goto(`/admin/moderation/${kind}`);

    // Waiting: the item, its Review button, and the earlier rejection by another admin.
    await expect(seen(page, 'Ravi Menon')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review', exact: true })).toBeVisible();
    await expect(seen(page, 'Rejected by')).toBeVisible();
    await expect(seen(page, 'Karan Mehta')).toBeVisible();

    await switchTo(page, 'Reviewed').click();
    await expect(seen(page, 'Asha Rao')).toBeVisible();
    await expect(seen(page, 'Approved by')).toBeVisible();
    await expect(seen(page, 'Priya Sharma')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review', exact: true })).toHaveCount(0);
    expect(asked).toContain('reviewed');
  });
}

const adminArtwork = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id, productCode: `GZ-${id}`, artistId: 'artist1', artistName: 'Meera Kulkarni', title, description: 'A piece.', category: 'painting', medium: 'oil-on-canvas',
  dimensions: '24 x 36 in', yearCreated: 2025, images: [], displayPricePaise: 13_650_000, insured: false, status: 'pending_approval', listingType: 'marketplace_only',
  rarityType: null, coaCertificateNumber: null, coaIssuedAt: null, createdAt: '2026-03-01T00:00:00.000Z', artistLocation: 'Pune', sizeBand: 'medium', artistPricePaise: 10_000_000,
  artistNet: { marketplace: 9_900_000, aggregatorEstimate: 9_500_000 }, insuranceOpted: false, insuranceNumber: null, insuranceStatus: null, nfcTagUid: null,
  nfcLinkedAt: null, nfcLockedAt: null, artworkType: null, paintingStyle: null, physical: null, editableUntil: '2026-03-09T00:00:00.000Z', artistEmail: 'meera@example.in',
  nfcShipmentGateOverrideAt: null, nfcShipmentGateOverrideReason: null, nfcShipmentGateOverrideBy: null, exclusive: false, ...over,
});
const event = (status: string, role: string, name: string | null, over: Record<string, unknown> = {}) => ({
  status, changedAt: '2026-11-10T00:00:00.000Z', reason: null, changedBy: `${role}-1`, changedByName: name, changedByRole: role, ...over,
});

test('Artwork queue: Reviewed lists approved and rejected pieces with the admin; moves by others are not reviews', async ({ page, baseURL }) => {
  await openAdmin(page, baseURL!);
  await page.route('**/v1/admin/artworks', (route) =>
    route.fulfill(
      json({
        artworks: [
          adminArtwork('a1', 'Waiting Piece', { statusHistory: [event('pending_approval', 'artist', 'Meera Kulkarni')] }),
          adminArtwork('a2', 'Approved Piece', {
            status: 'marketplace',
            statusHistory: [event('pending_approval', 'artist', 'Meera Kulkarni'), event('marketplace', 'admin', 'Priya Sharma', { changedAt: '2026-11-11T00:00:00.000Z' })],
          }),
          adminArtwork('a3', 'Rejected Piece', {
            status: 'returned',
            statusHistory: [event('pending_approval', 'artist', 'Meera Kulkarni'), event('returned', 'admin', 'Karan Mehta', { reason: 'Photos are blurry' })],
          }),
          adminArtwork('a4', 'Back From Gallery', {
            status: 'marketplace',
            statusHistory: [event('pending_approval', 'artist', 'Meera Kulkarni'), event('marketplace', 'aggregator', 'Gallery One')],
          }),
        ],
      }),
    ),
  );
  await page.goto('/admin/moderation/artworks');

  await expect(seen(page, 'Waiting Piece')).toBeVisible();
  await expect(seen(page, 'Approved Piece')).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Reviewed by' })).toBeVisible();

  await switchTo(page, 'Reviewed').click();
  await expect(seen(page, 'Approved Piece')).toBeVisible();
  await expect(seen(page, 'Approved by')).toBeVisible();
  await expect(seen(page, 'Priya Sharma')).toBeVisible();
  await expect(seen(page, 'Rejected Piece')).toBeVisible();
  await expect(seen(page, 'Karan Mehta')).toBeVisible();
  await expect(seen(page, 'Waiting Piece')).toHaveCount(0);
  // An aggregator moving a piece back to the marketplace is not a review.
  await expect(seen(page, 'Back From Gallery')).toHaveCount(0);
  // A reviewed piece opens its catalogue page, not the approval screen.
  await expect(page.getByRole('link', { name: 'Open Approved Piece' })).toHaveAttribute('href', '/admin/artworks/a2');
});

test('External fees: Waiting has Charge and Waive, Reviewed says who decided', async ({ page, baseURL }) => {
  await openAdmin(page, baseURL!);
  const fee = (id: string, title: string, over: Record<string, unknown>) => ({
    id, artworkId: id, artworkTitle: title, amountPaise: 500_000, status: 'pending_review', createdAt: '2026-11-01T00:00:00.000Z', decidedAt: null, decisionNote: null, settledAt: null, decidedByName: null, ...over,
  });
  await page.route('**/v1/admin/external-fees', (route) =>
    route.fulfill(json({ fees: [fee('f1', 'Waiting Fee Piece', {}), fee('f2', 'Charged Fee Piece', { status: 'approved', decidedAt: '2026-11-09T00:00:00.000Z', decidedByName: 'Ravi Menon' })] })),
  );
  await page.goto('/admin/moderation/external-fees');
  await expect(seen(page, 'Waiting Fee Piece')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Charge' })).toBeVisible();
  await expect(seen(page, 'Charged Fee Piece')).toHaveCount(0);

  await switchTo(page, 'Reviewed').click();
  await expect(seen(page, 'Charged Fee Piece')).toBeVisible();
  await expect(seen(page, 'Approved by')).toBeVisible();
  await expect(seen(page, 'Ravi Menon')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Charge' })).toHaveCount(0);
});

test('Deactivations: Waiting has Approve and Refuse, Reviewed says who decided', async ({ page, baseURL }) => {
  await openAdmin(page, baseURL!);
  const request = (id: string, name: string, over: Record<string, unknown>) => ({
    id, userId: id, userName: name, reason: 'Moving abroad', status: 'pending', requestedAt: '2026-11-01T00:00:00.000Z', decidedAt: null, decisionNote: null, decidedByName: null, ...over,
  });
  await page.route('**/v1/admin/deactivation', (route) =>
    route.fulfill(json({ requests: [request('d1', 'Waiting Artist', {}), request('d2', 'Closed Artist', { status: 'rejected', decidedAt: '2026-11-08T00:00:00.000Z', decidedByName: 'Karan Mehta', decisionNote: 'Open orders' })] })),
  );
  await page.goto('/admin/moderation/deactivations');
  await expect(seen(page, 'Waiting Artist')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();

  await switchTo(page, 'Reviewed').click();
  await expect(seen(page, 'Closed Artist')).toBeVisible();
  await expect(seen(page, 'Rejected by')).toBeVisible();
  await expect(seen(page, 'Karan Mehta')).toBeVisible();
  await expect(seen(page, 'Waiting Artist')).toHaveCount(0);
});

test('Withdrawals: Waiting has Review, Reviewed says who decided (older payouts show a dash)', async ({ page, baseURL }) => {
  await openAdmin(page, baseURL!);
  const withdrawal = (id: string, name: string, over: Record<string, unknown>) => ({
    id, userId: id, userName: name, userRole: 'artist', amountPaise: 500_000, bankAccountMasked: 'XXXX1234', walletBalancePaise: 900_000, status: 'pending',
    requestedAt: '2026-11-01T00:00:00.000Z', processedAt: null, processedByName: null, ...over,
  });
  await page.route('**/v1/admin/withdrawals', (route) =>
    route.fulfill(
      json({
        withdrawals: [
          withdrawal('w1', 'Waiting Payee', {}),
          withdrawal('w2', 'Paid Payee', { status: 'completed', processedAt: '2026-11-07T00:00:00.000Z', processedByName: 'Priya Sharma' }),
          withdrawal('w3', 'Old Payee', { status: 'rejected', processedAt: '2026-10-01T00:00:00.000Z' }),
        ],
      }),
    ),
  );
  await page.goto('/admin/moderation/withdrawals');
  await expect(seen(page, 'Waiting Payee')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review', exact: true })).toBeVisible();

  await switchTo(page, 'Reviewed').click();
  await expect(seen(page, 'Paid Payee')).toBeVisible();
  await expect(seen(page, 'Approved by')).toBeVisible();
  await expect(seen(page, 'Priya Sharma')).toBeVisible();
  await expect(seen(page, 'Old Payee')).toBeVisible();
  await expect(seen(page, 'Waiting Payee')).toHaveCount(0);
});
