import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { openGame } from './helpers';

type D31 = { state(): any; log(): any[]; objective(): string };
const st = (p: Page) => p.evaluate(() => (window as unknown as { __d31: D31 }).__d31.state());
const lg = (p: Page) => p.evaluate(() => (window as unknown as { __d31: D31 }).__d31.log());
const pick = (p: Page, id: string) => p.locator(`#controls [data-action-id="${id}"]`);
const pause = (p: Page) => p.waitForTimeout(350); // past the 300 ms same-action window

test.describe('P04 mouse vs keyboard', () => {
  test('mouse: side view, then inspect, climbs', async ({ page }) => {
    await openGame(page, '/?start=M1A_P04');
    await pick(page, 'view_wall_side').click();
    await page.locator('#targets [data-action-id="p04_inspect"]').click();
    const s = await st(page);
    expect(s.progress.milestone).toBe('P04_DONE');
    expect(s.player.anchor).toBe('wall_top');
  });
  test('keyboard reaches the same state with the same accepted actions', async ({ page }) => {
    await openGame(page, '/?start=M1A_P04');
    await pick(page, 'view_wall_side').focus();
    await page.keyboard.press('Enter');
    await page.locator('#targets [data-action-id="p04_inspect"]').focus();
    await page.keyboard.press('Space');
    const s = await st(page);
    expect(s.progress.milestone).toBe('P04_DONE');
    const acts = (await lg(page)).filter((e) => !e.actionId.startsWith('dlg_')).map((e) => `${e.actionId}:${e.accepted}`);
    expect(acts).toEqual(['view_wall_side:true', 'p04_inspect:true']);
  });
  test('front inspect alone never climbs', async ({ page }) => {
    await openGame(page, '/?start=M1A_P04');
    await page.locator('#targets [data-action-id="p04_inspect"]').click();
    expect((await st(page)).progress.milestone).toBe('P03_DONE');
  });
  test('names say 模様 on the front and 段 on the side; no 足場/階段/上る before solving', async ({ page }) => {
    await openGame(page, '/?start=M1A_P04');
    const leak = async () => (await page.locator('body').innerText() + await page.locator('[aria-label], [data-action-id]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? '').join(' ')));
    expect(await leak()).toContain('白い模様');
    expect(await leak()).not.toMatch(/足場|階段|上る/);
    await pick(page, 'view_wall_side').click();
    expect(await leak()).toContain('白い段');
    expect(await leak()).not.toMatch(/足場|階段|上る/);
  });
  test('skipping the practice post still solves', async ({ page }) => {
    await openGame(page, '/?start=M1A_P04');
    await pick(page, 'view_wall_side').click();
    await page.locator('#targets [data-action-id="p04_inspect"]').click();
    expect((await st(page)).puzzles.p04.solved).toBe(true);
  });
  test('mashing the final P05 setting 10 times records one accepted solve', async ({ page }) => {
    await openGame(page, '/?start=M1A_P05');
    await pick(page, 'view_peek').click();
    await pick(page, 'p05_a1').click(); await pause(page);
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) document.querySelector<HTMLElement>('[data-action-id="p05_b2"]')?.click();
    });
    const log = await lg(page);
    expect(log.filter((e) => e.actionId === 'p05_b2' && e.accepted).length).toBe(1);
    expect((await st(page)).progress.milestone).toBe('P05_DONE');
  });
});

test.describe('P05', () => {
  test('only A1/B2 solves; wrong settings keep playing', async ({ page }) => {
    await openGame(page, '/?start=M1A_P05');
    await pick(page, 'view_peek').click();
    for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) {
      if (a === 1 && b === 2) continue;
      await pick(page, 'p05_b0').click(); await pause(page); // park B so setting A alone can never close the ring
      await pick(page, `p05_a${a}`).click(); await pause(page);
      await pick(page, `p05_b${b}`).click(); await pause(page);
      expect((await st(page)).puzzles.p05.solved).toBe(false);
    }
    await pick(page, 'p05_b0').click(); await pause(page);
    await pick(page, 'p05_a1').click(); await pause(page);
    await pick(page, 'p05_b2').click();
    const s = await st(page);
    expect(s.puzzles.p05.solved).toBe(true);
    expect(s.player.anchor).toBe('castle');
  });
  test('keyboard arrows move focus only; Enter selects', async ({ page }) => {
    await openGame(page, '/?start=M1A_P05');
    await pick(page, 'p05_a0').focus();
    await page.keyboard.press('ArrowRight');
    expect((await st(page)).puzzles.p05.a).toBe(0);
    await page.keyboard.press('Enter');
    expect((await st(page)).puzzles.p05.a).toBe(1);
  });
  test('success shows the closed ring before leaving the observation camera', async ({ page }) => {
    await openGame(page, '/?start=M1A_P05');
    await pick(page, 'view_peek').click();
    await pick(page, 'p05_a1').click(); await pause(page);
    await pick(page, 'p05_b2').click();
    await expect(page.locator('#stage.square')).toBeVisible();
    await expect(page.locator('#place')).toContainText('城の前');
    await page.waitForTimeout(1500);
    await expect(page.locator('#stage.square')).toHaveCount(0);
  });
});

test('dialogs close with Escape and return control', async ({ page }) => {
  await openGame(page, '/?start=M1A_P04');
  await page.locator('#targets [data-action-id="practice_open"]').click();
  await expect(page.locator('#practice')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('#practice')).not.toHaveAttribute('open', '');
});

test('practice post: side/front toggle never changes game progress; the first side view plays D041 once', async ({ page }) => {
  await openGame(page, '/?start=M1A_P04');
  const strip = (s: any) => ({ ...s, dialogue: undefined });
  const before = await st(page);
  await page.locator('#targets [data-action-id="practice_open"]').click();
  await page.locator('#practice [data-action-id="practice_side"]').click();
  // view_tutorial_done (D041) is the explicit-command dialogue; it takes the screen, then the panel returns
  await expect(page.locator('#dlg-text')).toBeVisible();
  expect((await st(page)).dialogue.activeId).toBe('D041');
  await pause(page);
  await page.locator('#dlg [data-action-id="dlg_next"]').click();
  await expect(page.locator('#practice [data-action-id="practice_front"]')).toBeVisible();
  await pause(page);
  await page.locator('#practice [data-action-id="practice_front"]').click();
  await pause(page);
  await page.locator('#practice [data-action-id="practice_side"]').click(); // second time: nothing new to say
  await expect(page.locator('#dlg')).toBeHidden();
  await pause(page);
  await page.locator('#practice [data-action-id="practice_close"]').click();
  await expect(page.locator('#practice')).not.toHaveAttribute('open', '');
  const after = await st(page);
  expect(strip(after)).toEqual(strip(before));
  expect(after.dialogue.seenIds).toEqual([...before.dialogue.seenIds, 'D041']);
});
