import { test } from '@playwright/test';
import { signInAs } from '../support/auth';
import { P1_ROUTES } from '../support/routes';
import { dismissCookieConsent, waitForMockData, settleScrollReveal } from '../support/settle';
import { auditLayoutHealth } from '../support/layout-health';

// Phase 4: the structural diagnostic (overlap / text-clip / image-distortion)
// that found CRITICAL #3 and HIGH #1 on P0, promoted from a one-off Node
// script into a real spec, now run against P1. Non-gating like axe.spec.ts:
// this is a discovery tool needing human triage before anything becomes a
// hard assertion — the P0 pass alone had two distinct false-positive
// patterns that needed identifying and filtering (documented and fixed
// in layout-health.ts) before its 2 real findings were trustworthy. A P1
// route could just as easily introduce a THIRD false-positive pattern
// (tables, tabs, dialogs — component types P0 barely exercised), so this
// logs findings for review rather than failing the suite on them.
//
// Representative widths only, per the same reasoning as p1-routes.spec.ts:
// P0's 24-width intermediate sweep already proved these are CSS-geometry
// facts, not per-pixel surprises.
const WIDTHS = [320, 390, 430, 768, 1024, 1280, 1440];

for (const route of P1_ROUTES) {
  test(`structural: ${route.name}`, async ({ page, context, browserName, baseURL }, testInfo) => {
    test.skip(browserName !== 'chromium', 'structural diagnostic is Chromium-only (geometry, not engine-rendering — confirmed on P0)');

    if (route.role) {
      await signInAs(context, route.role, baseURL!);
    }
    await dismissCookieConsent(page);

    const allIssues: { width: number; issue: { kind: string; detail: string } }[] = [];

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(route.path);
      if (!response?.ok()) continue;
      await waitForMockData(page);
      await settleScrollReveal(page);

      const issues = await auditLayoutHealth(page);
      for (const issue of issues) {
        allIssues.push({ width, issue });
      }
    }

    if (allIssues.length > 0) {
      await testInfo.attach(`structural-${route.name}.json`, {
        body: JSON.stringify(allIssues, null, 2),
        contentType: 'application/json',
      });
      console.log(`structural ${route.name}: ${allIssues.length} candidate(s) across ${WIDTHS.length} widths`);
      for (const { width, issue } of allIssues) {
        console.log(`  @${width}px [${issue.kind}] ${issue.detail}`);
      }
    } else {
      console.log(`structural ${route.name}: clean across ${WIDTHS.length} widths`);
    }
  });
}
