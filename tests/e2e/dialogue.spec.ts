import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// Dialogue flow in a real browser (dev start, no storage involved).
const st = (p: Page) => p.evaluate(() => (window as any).__d31.state());
const pause = (p: Page) => p.waitForTimeout(350);
const dlg = (p: Page) => p.locator('#dlg:not([hidden])');

async function open(page: Page) {
  await page.goto('/?start=M1A_P05');
  await expect(dlg(page)).toBeVisible();             // D050 is unread at this start
}
async function solveP05(page: Page) {
  await page.locator('[data-action-id="view_peek"]').click(); await pause(page);
  await page.locator('[data-action-id="p05_a1"]').click(); await pause(page);
  await page.locator('[data-action-id="p05_b2"]').click();
}

test('exploration input is not accepted while a dialogue is on screen', async ({ page }) => {
  await open(page);
  expect((await st(page)).dialogue.activeId).toBe('D050');
  await expect(page.locator('[data-action-id^="p05_"], [data-action-id^="view_"], [data-action-id^="move_"]')).toHaveCount(0);
  const accepted = await page.evaluate(() => { const g = (window as any).__d31.game; return [g.perform('p05_a1', 'api'), g.perform('move_castle', 'api'), g.perform('view_peek', 'api')]; });
  expect(accepted).toEqual([false, false, false]);
  expect((await st(page)).puzzles.p05.a).toBe(0);
});

test('keyboard: focus lands on 継続 button, Enter reads on; one press moves one line', async ({ page }) => {
  await open(page);
  await expect(page.locator('#dlg [data-action-id="dlg_next"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dlg(page)).toBeHidden();                // D050 is a single-line event
  expect((await st(page)).dialogue.seenIds).toContain('D050');
});

test('p05 solve: the ring shows first, D051-D053 play in order, then castle_clear starts by itself (no overlap)', async ({ page }) => {
  await open(page);
  await page.locator('#dlg [data-action-id="dlg_next"]').click(); await pause(page);
  await solveP05(page);
  await expect(page.locator('#dlg-text')).toBeVisible({ timeout: 4000 });
  expect((await st(page)).dialogue.activeId).toBe('D051');
  const order: string[] = [];
  for (let i = 0; i < 12; i++) {
    const id = (await st(page)).dialogue.activeId;
    if (!id) break;
    order.push(id);
    await page.locator('#dlg [data-action-id="dlg_next"]').click(); await pause(page);
  }
  expect(order).toEqual(['D051', 'D052', 'D053', 'D060', 'D061', 'D062', 'D063']);
  const s = await st(page);
  expect(s.dialogue.activeId).toBeNull();
  expect(s.progress.milestone).toBe('P05_DONE');
});

test('skip ends only the current event: skipping p05_solved leaves castle_clear unread', async ({ page }) => {
  await open(page);
  await page.locator('#dlg [data-action-id="dlg_next"]').click(); await pause(page);
  await solveP05(page);
  await expect(page.locator('#dlg-text')).toBeVisible({ timeout: 4000 });
  await page.locator('#dlg [data-action-id="dlg_skip"]').click(); await pause(page);
  const s = await st(page);
  expect(s.dialogue.seenIds).toEqual(expect.arrayContaining(['D051', 'D052', 'D053']));
  expect(s.dialogue.seenIds).not.toContain('D060');
  expect(s.dialogue.activeId).toBe('D060');            // the next event starts, from its first line
  expect(s.dialogue.queue).toEqual(['D061', 'D062', 'D063']);
});

test('the same next button pressed twice quickly advances only one line', async ({ page }) => {
  await open(page);
  await page.locator('#dlg [data-action-id="dlg_next"]').click(); await pause(page);
  await solveP05(page);
  await expect(page.locator('#dlg-text')).toBeVisible({ timeout: 4000 });
  await page.evaluate(() => { const g = (window as any).__d31.game; g.perform('dlg_next', 'mouse'); g.perform('dlg_next', 'mouse'); });
  expect((await st(page)).dialogue.activeId).toBe('D052');
});
