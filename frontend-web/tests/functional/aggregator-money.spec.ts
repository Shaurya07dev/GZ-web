import { test, expect, type Page } from '@playwright/test';
import { signInAs } from '../support/auth';
import { dismissCookieConsent } from '../support/settle';

// The aggregator money flow as the client set it (30 Sep 2026): the aggregator
// prices a piece only when reserving in month 1, GST and a signed MOU are
// required before reserving, a piece can be kept past its 30 days only by
// asking GalleryZone, and returned pieces leave My Inventory. The API is
// stubbed, so this covers what the screens show and send; the arithmetic
// itself is covered by backend/packages/domain/src/pricing.check.ts.

const CORS = { 'access-control-allow-origin': '*' };
const AS_OF = '2026-09-30T06:00:00.000Z';

async function json(page: Page, pattern: string, body: unknown, method?: string) {
  await page.route(pattern, (route) => {
    if (method && route.request().method() !== method) return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  });
}

const profile = (over: Record<string, unknown> = {}) => ({
  uid: 'u1', fullName: 'Anand Rao', email: 'anand@example.in', phone: '9876543210', role: 'aggregator', status: 'active',
  createdAt: '2026-01-10T00:00:00.000Z', bio: null, profileImageUrl: null, headline: 'Director', location: null, instagram: null,
  website: null, pan: null, gstin: '36ABCDE1234F1Z5', gstStatus: 'approved', aadhaarStatus: 'not_submitted', aadhaarMasked: null,
  bankAccountMasked: null, ifsc: null, pickupLine1: '12 Banjara Hills Road', pickupLine2: null, pickupCity: 'Hyderabad',
  pickupState: 'Telangana', pickupPincode: '500034', earningsAbove5L: false, socialProofVideoUrl: null, companyName: 'Rao Gallery', ...over,
});

const mou = (signed: boolean) => ({
  acceptance: signed
    ? { party: 'aggregator', version: '2026.3', signatureName: 'Anand Rao', signatureDataUrl: 'data:image/png;base64,AAAA', acceptedAt: AS_OF, parties: null }
    : null,
  draft: { version: '2026.3', parties: { party: {}, company: { name: null, designation: null } }, missing: [], asOf: AS_OF },
});

const artworkDto = (id: string, over: Record<string, unknown> = {}) => ({
  id, productCode: `GZ-${id}`, artistId: 'artist1', artistName: 'Meera Kulkarni', title: `Piece ${id}`, description: 'A piece.',
  category: 'Abstract', medium: 'Oil on canvas', dimensions: '24 x 36 in', yearCreated: 2024, images: [], displayPricePaise: 13_650_000,
  insured: true, status: 'marketplace', listingType: 'marketplace_and_aggregator', rarityType: null, coaCertificateNumber: null,
  coaIssuedAt: null, createdAt: '2026-09-01T00:00:00.000Z', artistLocation: 'Hyderabad', sizeBand: 'medium', ...over,
});

// ₹1,00,000 artist price. Month 1: GalleryZone's price ₹1,30,000 before GST,
// ₹1,36,500 with it, advance 5% of the price, delivery ₹2,500.
const monthOne = {
  month: 1, sellingPricePaise: 13_000_000, offerPricePaise: 13_650_000, standardPricePaise: 13_650_000, monthlyReductionPaise: 0,
  marketplacePricePaise: 13_650_000, canSetPrice: true, gstRate: 0.05, priceWarnFromPaise: 26_000_000, advancePaise: 650_000,
  advanceRate: 0.05, advanceBasePaise: 13_000_000, advanceBasis: 'selling_price', daysLeftInListing: 180, deliveryChargePaise: 250_000,
  payablePaise: 900_000,
};
// Month 2: GalleryZone's price steps down 2% of the artist price, and the
// advance is 5% of the artist price, whatever anyone charges.
const monthTwo = {
  ...monthOne, month: 2, sellingPricePaise: 12_800_000, offerPricePaise: 13_440_000, monthlyReductionPaise: 210_000,
  canSetPrice: false, priceWarnFromPaise: null, advancePaise: 500_000, advanceBasePaise: 10_000_000, advanceBasis: 'artist_price',
  payablePaise: 750_000,
};
const listed = (id: string, offer: object, over: Record<string, unknown> = {}) => ({ ...artworkDto(id, over), offer: { artworkId: id, ...offer } });

const DAY = 86_400_000;
const holdingDto = (id: string, artworkId: string, over: Record<string, unknown> = {}) => ({
  id, artworkId, artwork: artworkDto(artworkId), cycleMonth: 1, advancePercent: 5, advancePaise: 650_000, deliveryDepositPaise: 250_000,
  displayPricePaise: 13_650_000, assignmentSource: 'self_reserved', assignedAt: new Date(Date.now() - 20 * DAY).toISOString(),
  expiresAt: new Date(Date.now() + 10 * DAY).toISOString(), windowExtended: false, status: 'reserved', returnedAt: null,
  appreciated: false, priceWarning: false, extensionRequest: null, ...over,
});

interface Stub {
  gstStatus?: string;
  mouSigned?: boolean;
  inventory?: unknown[];
  holdings?: unknown[];
}

async function open(page: Page, baseURL: string, stub: Stub = {}) {
  // Anything not stubbed below fails fast instead of reaching a real API.
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  await signInAs(page.context(), 'aggregator', baseURL);
  await json(page, '**/v1/auth/me', { uid: 'u1', role: 'aggregator', status: 'active', name: 'Anand Rao', email: 'anand@example.in', phone: '9876543210', roleGrants: [] });
  await json(page, '**/v1/me/profile', profile({ gstStatus: stub.gstStatus ?? 'approved' }));
  await json(page, '**/v1/aggregator/mou', mou(stub.mouSigned ?? true));
  await json(page, '**/v1/aggregator/inventory', { artworks: stub.inventory ?? [] });
  await json(page, '**/v1/aggregator/wallet', { accountType: 'aggregator_payable', balancePaise: 5_000_000, heldPaise: 0 });
  await json(page, '**/v1/aggregator/wallet/transactions', { transactions: [] });
  await json(
    page,
    '**/v1/aggregator/reservation-payments',
    { mode: 'simulated', paymentId: 'default-reservation-payment' },
    'POST',
  );
  await json(
    page,
    '**/v1/aggregator/reservation-payments/default-reservation-payment/simulate',
    { status: 'paid' },
    'POST',
  );
  await json(page, '**/v1/aggregator/holdings', { holdings: stub.holdings ?? [] }, 'GET');
}

/** The breakdown row whose label reads `label`. */
const row = (page: Page, label: string | RegExp) =>
  page.getByText(label, { exact: typeof label === 'string' }).locator('xpath=ancestor::div[contains(@class,"justify-between")][1]');

test('month 1: the aggregator sets the price and every figure follows it', async ({ page, baseURL }, testInfo) => {
  await open(page, baseURL!, { inventory: [listed('a1', monthOne)] });
  const bodies: unknown[] = [];
  await page.route('**/v1/aggregator/holdings', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(holdingDto('h1', 'a1', { displayPricePaise: 15_750_000 })) });
  });
  await json(page, '**/v1/aggregator/holdings/h1', holdingDto('h1', 'a1', { displayPricePaise: 15_750_000 }));
  await page.goto('/aggregator/inventory/a1/reserve');

  // It starts at GalleryZone's price, with GalleryZone's own numbers.
  const price = page.getByLabel('Your selling price, before GST (₹)');
  await expect(price).toHaveValue('130000');
  await expect(row(page, 'What customers see')).toContainText('₹1,36,500');
  await expect(row(page, 'Advance (5%)')).toContainText('₹6,500');

  // The client's own example: sell at ₹1,50,000 before GST.
  await price.fill('150000');
  await expect(row(page, 'What customers see')).toContainText('₹1,57,500');
  await expect(row(page, /^GST \(5%\)$/)).toContainText('₹7,500');
  await expect(row(page, /^Artist.s price$/)).toContainText('₹1,00,000');
  await expect(row(page, /GalleryZone \(80% of the markup\)/)).toContainText('₹40,000');
  await expect(row(page, /Your commission if it sells here \(20%\)/)).toContainText('₹10,000');
  await expect(row(page, 'Advance (5%)')).toContainText('₹7,500');
  await expect(row(page, 'Pay now through Razorpay')).toContainText('₹10,000');
  await expect(page.getByRole('status')).toHaveCount(0);

  // Below GalleryZone's price is refused before anything is sent.
  await price.fill('120000');
  await expect(page.getByText(/can.t be lower than GalleryZone.s price, ₹1,30,000/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay .* & reserve/ })).toBeDisabled();

  // Double GalleryZone's price still goes through: GalleryZone is told, the aggregator is too.
  await price.fill('260000');
  await expect(page.getByRole('status')).toContainText(/at least double/);
  await expect(page.getByRole('button', { name: /Pay .* & reserve/ })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('reserve-month-1-warning.png'), fullPage: true });

  await price.fill('150000');
  await page.getByRole('button', { name: /Pay .* & reserve/ }).click();
  await page.waitForURL('**/aggregator/collection/h1');
  expect(bodies).toEqual([{ artworkId: 'a1', sellingPricePaise: 15_000_000 }]);
});

test('later months: the price is GalleryZone’s and the advance is 5% of the artist price', async ({ page, baseURL }) => {
  await open(page, baseURL!, { inventory: [listed('a2', monthTwo)] });
  const bodies: unknown[] = [];
  await page.route('**/v1/aggregator/holdings', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(holdingDto('h2', 'a2', { cycleMonth: 2 })) });
  });
  await json(page, '**/v1/aggregator/holdings/h2', holdingDto('h2', 'a2', { cycleMonth: 2 }));
  await page.goto('/aggregator/inventory/a2/reserve');

  await expect(page.getByText('Price this month, before GST')).toBeVisible();
  await expect(page.getByLabel('Your selling price, before GST (₹)')).toHaveCount(0);
  await expect(row(page, 'Advance (5%)')).toContainText('₹5,000');
  await expect(page.getByText('of the artist price, ₹1,00,000')).toBeVisible();
  await expect(row(page, 'Pay now through Razorpay')).toContainText('₹7,500');

  await page.getByRole('button', { name: /Pay .* & reserve/ }).click();
  await page.waitForURL('**/aggregator/collection/h2');
  // No price is sent for a month the aggregator doesn't price.
  expect(bodies).toEqual([{ artworkId: 'a2' }]);
});

const GATES = [
  { name: 'no GST number yet', stub: { gstStatus: 'not_submitted' }, notice: 'Add your GST number to reserve artwork.', profileLink: true },
  { name: 'GST number under review', stub: { gstStatus: 'submitted' }, notice: 'Your GST number is being reviewed.', profileLink: false },
  { name: 'GST number rejected', stub: { gstStatus: 'rejected' }, notice: "Your GST number wasn't approved.", profileLink: true },
  { name: 'MOU not signed', stub: { mouSigned: false }, notice: 'Sign your Aggregator MOU to reserve artwork.', profileLink: true },
];
for (const gate of GATES) {
  test(`nothing can be reserved: ${gate.name}`, async ({ page, baseURL }) => {
    await open(page, baseURL!, { ...gate.stub, inventory: [listed('a1', monthOne)] });

    await page.goto('/aggregator/inventory');
    await expect(page.getByText(gate.notice)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to My Profile' })).toHaveCount(gate.profileLink ? 1 : 0);

    // Pressing Reserve explains why, in a popup, instead of doing nothing.
    await page.getByRole('button', { name: 'Reserve Artwork' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(gate.notice)).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Go to My Profile' })).toHaveCount(gate.profileLink ? 1 : 0);
    await expect(page).toHaveURL(/\/aggregator\/inventory$/);
    // The same wall stands on the reserve screen itself.
    await page.goto('/aggregator/inventory/a1/reserve');
    await expect(page.getByText(gate.notice)).toBeVisible();
    await expect(page.getByRole('button', { name: /Pay .* & reserve/ })).toBeDisabled();
  });
}

test('the grid says who sets the price, and suggests pieces like the ones already held', async ({ page, baseURL }) => {
  await open(page, baseURL!, {
    inventory: [
      listed('a1', monthOne, { title: 'Monsoon Study' }),
      listed('a2', monthTwo, { title: 'Tiny Harbour', category: 'Landscape', displayPricePaise: 1_000_000, sizeBand: 'small' }),
    ],
    holdings: [holdingDto('h1', 'held', { artwork: artworkDto('held', { title: 'Held Abstract' }) })],
  });
  await page.goto('/aggregator/inventory');

  await expect(page.getByText('Month 1 of 5 · you set the price')).toBeVisible();
  await expect(page.getByText('Month 2 of 5 · ₹2,100 off month 1')).toBeVisible();
  await expect(page.getByText('Fixed this month, incl. GST')).toBeVisible();

  // Same category, price and size as the held piece; the small landscape is none of those.
  const suggestions = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Suggested for you' }) });
  await expect(suggestions.getByText('Monsoon Study')).toBeVisible();
  await expect(suggestions.getByText('Tiny Harbour')).toHaveCount(0);
});

test('a returned piece leaves My Inventory completely', async ({ page, baseURL }) => {
  await open(page, baseURL!, {
    holdings: [
      holdingDto('h1', 'kept', { artwork: artworkDto('kept', { title: 'Still Here' }) }),
      holdingDto('h2', 'gone', { artwork: artworkDto('gone', { title: 'Sent Back' }), status: 'returned', returnedAt: AS_OF }),
    ],
  });
  await page.goto('/aggregator/collection');

  await expect(page.getByText('Still Here').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Sent Back')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Returned/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^All 1$/ })).toBeVisible();
});

test('asking to keep a piece longer takes an assurance and shows GalleryZone’s answer', async ({ page, baseURL }, testInfo) => {
  await open(page, baseURL!, { inventory: [] });
  const base = holdingDto('h1', 'a1');
  let asked: { assurance: string } | null = null;
  const pending = () => ({
    ...base,
    extensionRequest: { status: 'pending', assurance: asked!.assurance, requestedAt: AS_OF, decidedAt: null, note: null, previousExpiresAt: base.expiresAt },
  });
  await page.route('**/v1/aggregator/holdings/h1', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(asked ? pending() : base) }));
  await page.route('**/v1/aggregator/holdings/h1/extension', (route) => {
    asked = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(pending()) });
  });
  await page.goto('/aggregator/collection/h1');

  await page.getByRole('button', { name: 'Ask to keep it longer' }).click();
  const send = page.getByRole('button', { name: 'Send request' });
  await expect(send).toBeDisabled();
  await page.getByLabel('Your assurance that it will sell').fill('Too short');
  await expect(send).toBeDisabled();
  await page.getByLabel('Your assurance that it will sell').fill('A collector has viewed it twice and confirms this week.');
  await send.click();

  await expect(page.getByText('Waiting for GalleryZone')).toBeVisible();
  await expect(page.getByText(/A collector has viewed it twice/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask to keep it longer' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('extension-pending.png'), fullPage: true });
  expect(asked).toEqual({ assurance: 'A collector has viewed it twice and confirms this week.' });
});

test('a declined request stands for the window, and the piece cannot be asked about again', async ({ page, baseURL }) => {
  await open(page, baseURL!);
  const base = holdingDto('h1', 'a1');
  await json(page, '**/v1/aggregator/holdings/h1', {
    ...base,
    extensionRequest: { status: 'declined', assurance: 'It will sell.', requestedAt: AS_OF, decidedAt: AS_OF, note: 'Not this month.', previousExpiresAt: base.expiresAt },
  });
  await page.goto('/aggregator/collection/h1');

  await expect(page.getByText('GalleryZone said no')).toBeVisible();
  await expect(page.getByText(/Not this month\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask to keep it longer' })).toHaveCount(0);
});

// ---- Direct reservation payment through Razorpay -----------------------------------------------

const reservationSession = (
  paymentId: string,
  orderId: string,
  amountPaise: number,
) => ({
  mode: 'razorpay',
  paymentId,
  keyId: 'rzp_test_fake',
  razorpayOrderId: orderId,
  amountPaise,
  currency: 'INR',
  name: 'GalleryZone',
  description: 'GalleryZone artwork reservation',
  prefill: { name: '', email: '', contact: '' },
});

/** The signed success payload Checkout.js hands back. The API verifies its HMAC AND re-reads the order. */
const SUCCESS = {
  razorpay_order_id: 'order_test_1',
  razorpay_payment_id: 'pay_test_1',
  razorpay_signature: 'deadbeef',
};

/** Stands in for Razorpay Checkout.js: records what it was opened with, then completes or is dismissed. */
async function fakeRazorpay(page: Page, behaviour: 'pay' | 'close') {
  await page.addInitScript(([mode, success]) => {
    type Options = {
      key: string;
      order_id: string;
      amount: number;
      handler: (r: unknown) => void;
      modal: { ondismiss: () => void };
    };
    (window as unknown as { Razorpay: unknown }).Razorpay = class {
      private readonly options: Options;
      constructor(options: Options) {
        this.options = options;
        (window as unknown as { __rzp: Options }).__rzp = options;
      }
      on() {
        /* payment.failed is not exercised here */
      }
      open() {
        setTimeout(
          () =>
            mode === 'pay'
              ? this.options.handler(success)
              : this.options.modal.ondismiss(),
          50,
        );
      }
    };
  }, [behaviour, SUCCESS] as const);
}

test('reservation payment opens Razorpay, verifies, then creates the holding', async ({ page, baseURL }) => {
  await open(page, baseURL!, { inventory: [listed('a1', monthOne)] });
  await fakeRazorpay(page, 'pay');
  const started: unknown[] = [];
  const verified: unknown[] = [];
  const holdings: unknown[] = [];

  await page.route('**/v1/aggregator/reservation-payments', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    started.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(reservationSession('rp1', 'order_test_1', 900_000)),
    });
  });
  await page.route('**/v1/aggregator/reservation-payments/rp1/verify', (route) => {
    verified.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify({ status: 'paid', amountPaise: 900_000 }),
    });
  });
  await page.route('**/v1/aggregator/holdings', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    holdings.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(holdingDto('h1', 'a1')),
    });
  });
  await json(page, '**/v1/aggregator/holdings/h1', holdingDto('h1', 'a1'));

  await page.goto('/aggregator/inventory/a1/reserve');
  await page.getByRole('button', { name: /Pay .* & reserve/ }).click();
  await page.waitForURL('**/aggregator/collection/h1');

  expect(started).toEqual([{ amountPaise: 900_000 }]);
  expect(verified).toEqual([SUCCESS]);
  expect(holdings).toEqual([{ artworkId: 'a1', sellingPricePaise: 13_000_000 }]);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as {
          __rzp: { key: string; order_id: string; amount: number };
        }).__rzp,
    ),
  ).toMatchObject({
    key: 'rzp_test_fake',
    order_id: 'order_test_1',
    amount: 900_000,
  });
});

test('closing Razorpay is verified and creates no holding when the order is unpaid', async ({ page, baseURL }) => {
  await open(page, baseURL!, { inventory: [listed('a1', monthOne)] });
  await fakeRazorpay(page, 'close');
  const verified: unknown[] = [];
  let holdingPosts = 0;

  await json(
    page,
    '**/v1/aggregator/reservation-payments',
    reservationSession('rp2', 'order_test_2', 900_000),
    'POST',
  );
  await page.route('**/v1/aggregator/reservation-payments/rp2/verify', (route) => {
    verified.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify({ status: 'created' }),
    });
  });
  await page.route('**/v1/aggregator/holdings', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    holdingPosts += 1;
    return route.abort();
  });

  await page.goto('/aggregator/inventory/a1/reserve');
  await page.getByRole('button', { name: /Pay .* & reserve/ }).click();

  await expect(page.getByText('Payment was cancelled')).toBeVisible();
  expect(verified).toEqual([null]);
  expect(holdingPosts).toBe(0);
});

test('simulated mode uses the explicit reservation-payment simulation endpoint', async ({ page, baseURL }) => {
  await open(page, baseURL!, { inventory: [listed('a1', monthOne)] });
  const simulated: string[] = [];

  await json(
    page,
    '**/v1/aggregator/reservation-payments',
    { mode: 'simulated', paymentId: 'rp3' },
    'POST',
  );
  await page.route('**/v1/aggregator/reservation-payments/rp3/simulate', (route) => {
    simulated.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify({ status: 'paid', amountPaise: 900_000 }),
    });
  });
  await page.route('**/v1/aggregator/holdings', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(holdingDto('h3', 'a1')),
    });
  });
  await json(page, '**/v1/aggregator/holdings/h3', holdingDto('h3', 'a1'));

  await page.goto('/aggregator/inventory/a1/reserve');
  await page.getByRole('button', { name: /Pay .* & reserve/ }).click();
  await page.waitForURL('**/aggregator/collection/h3');

  expect(simulated).toHaveLength(1);
});

test('earnings are read-only and expose no top-up or withdrawal controls', async ({ page, baseURL }) => {
  await open(page, baseURL!);
  await json(page, '**/v1/aggregator/wallet/transactions', {
    transactions: [
      {
        id: 'e1',
        amountPaise: 2_500_000,
        reason: 'commission',
        holdingId: null,
        at: '2026-09-29T10:00:00.000Z',
      },
    ],
  });

  await page.goto('/aggregator/wallet');

  await expect(page.getByText('Owed to you')).toBeVisible();
  await expect(page.getByText('How the money moves')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to wallet' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /withdraw/i })).toHaveCount(0);
  await expect(page.getByText(/Commission/).last()).toBeVisible();
});

test('a paid reservation that loses the allocation race surfaces the failure', async ({ page, baseURL }) => {
  await open(page, baseURL!, { inventory: [listed('a1', monthOne)] });
  await page.route('**/v1/aggregator/holdings', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify({
        type: 'about:blank',
        title: 'This artwork was reserved by another aggregator after payment. Contact GalleryZone for reconciliation.',
        status: 409,
        code: 'conflict',
      }),
    });
  });

  await page.goto('/aggregator/inventory/a1/reserve');
  await page.getByRole('button', { name: /Pay .* & reserve/ }).click();

  await expect(page.getByText(/reserved by another aggregator after payment/)).toBeVisible();
  await expect(page).toHaveURL(/\/reserve$/);
});

// ---- Cash sales: the full price is due at GalleryZone within 2 days ----------------------------

const cashSale = (id: string, soldDaysAgo: number, over: Record<string, unknown> = {}) => ({
  id, holdingId: `h-${id}`, artworkId: 'a1', soldPricePaise: 15_750_000, buyerName: `Buyer ${id}`, buyerEmail: 'b@example.in', buyerPhone: '9000000000',
  deliveryAddress: '1 Road, Hyderabad, Telangana, 500034', deliveryMode: 'courier', paymentRoute: 'cash_at_premises', remittedAt: null,
  remitDueAt: new Date(Date.now() + (2 - soldDaysAgo) * DAY).toISOString(), remittedVia: null, shipmentStatus: 'preparing', dispatchedAt: null, deliveredAt: null,
  courierRef: null, soldAt: new Date(Date.now() - soldDaysAgo * DAY).toISOString(), ...over,
});

async function openSettlements(page: Page, baseURL: string) {
  await open(page, baseURL);
  const sales = [cashSale('s1', 1), cashSale('s2', 4)];
  const remaining = [...sales];
  await page.route('**/v1/aggregator/sales', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(sales) }));
  await page.route('**/v1/aggregator/sales/remittances-due', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(remaining) }));
  return { sales, remaining };
}

test('a cash sale shows when it is due, and an overdue one says so', async ({ page, baseURL }) => {
  await openSettlements(page, baseURL!);
  await page.goto('/aggregator/settlements');

  await expect(page.getByRole('heading', { name: 'Owed to GalleryZone' })).toBeVisible();
  await expect(page.getByText(/Pay in the full amount within 2 days/)).toBeVisible();
  const due = new Date(Date.now() + 1 * DAY).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  await expect(page.locator('li').filter({ hasText: 'Buyer s1' })).toContainText(`due ${due}`);
  await expect(page.locator('li').filter({ hasText: 'Buyer s2' })).toContainText('Overdue by 2 days');
});

test('a cash sale can be marked transferred only through the bank-remittance path', async ({ page, baseURL }) => {
  const { remaining } = await openSettlements(page, baseURL!);
  const bodies: Record<string, unknown> = {};
  for (const id of ['s1', 's2']) {
    await page.route(`**/v1/aggregator/sales/${id}/remit`, (route) => {
      bodies[id] = route.request().postDataJSON();
      const at = remaining.findIndex((s) => s.id === id);
      if (at >= 0) remaining.splice(at, 1);
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{}' });
    });
  }
  await page.goto('/aggregator/settlements');

  await expect(page.getByRole('button', { name: 'Pay from wallet' })).toHaveCount(0);
  await page.locator('li').filter({ hasText: 'Buyer s1' }).getByRole('button', { name: 'Mark transferred' }).click();
  await expect(page.getByText('Marked as transferred')).toBeVisible();
  expect(bodies).toEqual({ s1: { via: 'bank' } });
});

test('bank remittance stays available without a prepaid wallet balance', async ({ page, baseURL }) => {
  await openSettlements(page, baseURL!);
  await page.goto('/aggregator/settlements');

  await expect(page.getByRole('button', { name: 'Pay from wallet' })).toHaveCount(0);
  await expect(page.locator('li').filter({ hasText: 'Buyer s1' }).getByRole('button', { name: 'Mark transferred' })).toBeEnabled();
});
