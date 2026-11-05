import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function fits(page: Page) {
  const issues = await page.evaluate(() => {
    const width = innerWidth;
    const issues: string[] = [];
    if (document.documentElement.scrollWidth > width + 1) issues.push('horizontal scroll');
    for (const el of document.querySelectorAll<HTMLElement>('button, select, input, h1, .dlg-text')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.closest('[hidden]')) continue;
      if (r.left < -1 || r.right > width + 1) issues.push(el.id || el.tagName);
    }
    return issues;
  });
  expect(issues).toEqual([]);
}

for (const width of [320, 640, 1440]) {
  test(`winter UI stays usable at ${width}px with large text`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.locator('#b-set').click();
    await page.locator('#s-size').selectOption('large');
    await fits(page);
    await page.locator('#set-save').click();
    await expect(page.locator('#b-new')).toBeVisible();
    await fits(page);
    await page.screenshot({ path: testInfo.outputPath('title.png'), fullPage: true });
    await page.locator('#b-new').click();
    await fits(page);
    await page.locator('[data-new="manual-1"]').click();
    await expect(page.locator('#dlg')).toBeVisible();
    await fits(page);
    await page.screenshot({ path: testInfo.outputPath('dialogue.png'), fullPage: true });
  });
}
