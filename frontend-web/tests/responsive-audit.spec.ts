/**
 * Responsive Audit (Iris-Style) — Playwright QA Automation
 * ---------------------------------------------------------
 * Captures a full matrix of viewports and color schemes for the NFC Verify page
 * mimicking the capabilities of the `iris` CLI / responsive-audit skill.
 *
 * Matrix:
 * - Desktop (1440x900): Light + Dark
 * - iPhone 14 Pro (393x852 @3x): Light + Dark
 * - iPad (1024x1366 @2x): Light + Dark
 */

import { test, type Page } from "@playwright/test";
import type { Browser } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "audit");

// Ensure output directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent?: string;
}

const VIEWPORTS: ViewportConfig[] = [
  {
    name: "desktop",
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
  },
  {
    name: "iphone",
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  },
  {
    name: "ipad",
    width: 1024,
    height: 1366,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  },
];

/**
 * Smart Wait: mimics iris's deterministic readiness checks.
 * Waits for network idle, web fonts to load, and lazy images to render.
 */
async function waitForSmartReadiness(page: Page) {
  // 1. Wait for standard network idle
  await page.waitForLoadState("networkidle");

  // 2. Wait for document.fonts.ready
  await page.evaluate(async () => {
    if (document.fonts) {
      await document.fonts.ready;
    }
  });

  // 3. Ensure any NFC banner animations have fired
  await page.waitForTimeout(500);
}

/**
 * Capture a single configuration.
 */
async function runAuditCapture(
  browser: Browser,
  viewport: ViewportConfig,
  theme: "light" | "dark"
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    userAgent: viewport.userAgent,
    colorScheme: theme,
  });

  const page = await context.newPage();
  
  // Set Next.js theme explicitly if it relies on localStorage or class toggles instead of prefers-color-scheme
  await page.addInitScript((mode: string) => {
    // If the app uses next-themes (like globals.css suggests with .dark)
    window.localStorage.setItem("theme", mode);
  }, theme);

  const testArtworkId = process.env.TEST_ARTWORK_ID ?? "aw-5";
  await page.goto(`${BASE_URL}/verify/${testArtworkId}`);

  // Force dark class if needed by globals.css
  if (theme === "dark") {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
  } else {
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
  }

  await waitForSmartReadiness(page);

  const filename = `${viewport.name}-${theme}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);

  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Audit Captured: ${filepath}`);

  await context.close();
}

test.describe("Responsive Audit (Iris-Style)", () => {
  test("Capture full matrix", async ({ browser }) => {
    // We execute these sequentially to avoid overloading the local dev server
    for (const viewport of VIEWPORTS) {
      await runAuditCapture(browser, viewport, "light");
      await runAuditCapture(browser, viewport, "dark");
    }
  });
});
