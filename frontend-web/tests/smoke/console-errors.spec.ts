import { test, expect } from '@playwright/test';

test('captures console errors, uncaught exceptions, and failed requests', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await testInfo.attach('captured-errors.json', {
    body: JSON.stringify({ consoleErrors, pageErrors, failedRequests }, null, 2),
    contentType: 'application/json',
  });

  // Proves the listeners actually observe the page: capture must run, not be skipped.
  expect(testInfo.attachments.length).toBeGreaterThan(0);

  console.log(`console errors: ${consoleErrors.length}, page errors: ${pageErrors.length}, failed requests: ${failedRequests.length}`);
  expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
