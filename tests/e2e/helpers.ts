import type { Page } from '@playwright/test';

/** Opens a dev start and clears the entry dialogue through the real UI (the same buttons a player uses). */
export async function openGame(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() => (window as unknown as { __d31?: unknown }).__d31 !== undefined);
  await clearDialogue(page);
}

export async function clearDialogue(page: Page) {
  for (let i = 0; i < 20; i++) {
    const skip = page.locator('[data-action-id="dlg_skip"]');
    if (await skip.count() === 0) return;
    await skip.first().click();
    await page.waitForTimeout(320); // same-action dedup window
  }
  throw new Error('dialogue never cleared');
}
