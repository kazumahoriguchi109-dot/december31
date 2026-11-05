import { chromium } from '@playwright/test';

// Warm the dev server so Vite's first-load dependency optimisation (which reloads the page) finishes before any test runs.
export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const start of ['M1A_P04', 'M1A_P05']) {
    await page.goto(`${process.env['E2E_URL'] ?? 'http://127.0.0.1:5173'}/?start=${start}`);
    await page.waitForTimeout(1500);
  }
  await browser.close();
}
