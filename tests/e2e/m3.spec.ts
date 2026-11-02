import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { openGame } from './helpers';

// Evolution cues, settings that really change the screen, and the credits screen.

const dedup = (p: Page) => p.waitForTimeout(320);
async function readAll(page: Page) {
  for (let i = 0; i < 40; i++) {
    const next = page.locator('#dlg:not([hidden]) [data-action-id="dlg_next"]');
    if (await next.count() === 0) return;
    await next.first().click(); await dedup(page);
  }
  throw new Error('dialogue never ended');
}
async function act(page: Page, id: string) {
  const loc = page.locator(`#targets [data-action-id="${id}"], #controls [data-action-id="${id}"]`).first();
  await expect(loc).toBeVisible(); await loc.click(); await dedup(page);
}
async function setSettings(page: Page, f: (p: Page) => Promise<void>) {
  await page.goto('/');
  await page.locator('#b-set').click();
  await f(page);
  await page.locator('#set-save').click();
  await expect(page.locator('#b-new')).toBeVisible();
}
async function start(page: Page) {
  await page.locator('#b-new').click();
  await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg')).toBeVisible();
  await readAll(page);
}
const cueName = (p: Page) => p.locator('#cue').getAttribute('data-last');

test('the entry and P01 cues play once per event, and never on reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('#b-new').click();
  await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg')).toBeVisible();
  await readAll(page);
  await page.locator('[data-action-id="start_rpg"]').first().click();
  await expect.poll(() => cueName(page), { timeout: 600 }).toBe('CUE_ENTRY');
  await expect(page.locator('#cue')).toBeHidden({ timeout: 3000 });
  await readAll(page);
  await act(page, 'move_p01_panel'); await readAll(page);
  await act(page, 'p01_right');
  await expect.poll(() => cueName(page), { timeout: 600 }).toBe('CUE_EVOLVE_P01');
  await expect(page.locator('#cue')).toBeHidden({ timeout: 3000 });
  await readAll(page);
  // reload and continue: nothing replays
  await page.reload();
  await page.locator('#b-cont').click();
  await page.waitForFunction(() => (window as any).__d31shell.internals().screen() === 'PLAY');
  await page.waitForTimeout(400);
  expect(await cueName(page)).toBeNull(); // nothing played after the load
  await expect(page.locator('#cue')).toBeHidden();
});

test('reduced motion: the cue is a short still image', async ({ page }) => {
  await setSettings(page, async (p) => { await p.locator('#s-motion').check(); });
  await start(page);
  await page.locator('[data-action-id="start_rpg"]').first().click();
  await expect.poll(() => cueName(page), { timeout: 600 }).toBe('CUE_ENTRY');
  expect(await page.locator('#cue').getAttribute('data-dur')).toBe('150');
  await expect(page.locator('#cue')).toBeHidden({ timeout: 1000 });
});

test('text speed "slow" reveals characters gradually; "instant" shows everything', async ({ page }) => {
  await setSettings(page, async (p) => { await p.locator('#s-speed').selectOption('slow'); });
  await page.locator('#b-new').click();
  await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg')).toBeVisible();
  const visible = () => page.evaluate(() => [...document.querySelectorAll('#dlg-text span')].filter((s) => (s as HTMLElement).style.visibility !== 'hidden').length);
  const total = await page.evaluate(() => document.querySelectorAll('#dlg-text span').length);
  expect(total).toBeGreaterThan(3);
  const a = await visible();
  expect(a).toBeLessThan(total);
  await expect.poll(visible, { timeout: 15000 }).toBe(total);
  // the whole line is always in the text content, for find-in-page and tests
  expect((await page.locator('#dlg-text').textContent())!.length).toBe(total);
});

test('labels-always shows the place names; quality low is applied', async ({ page }) => {
  await setSettings(page, async (p) => { await p.locator('#s-labels').check(); await p.locator('#s-quality').selectOption('low'); });
  await start(page);
  await page.locator('[data-action-id="start_rpg"]').first().click(); await dedup(page); await readAll(page);
  await act(page, 'move_p01_panel'); await readAll(page);
  const lab = page.locator('#hotspots .hot-label').first();
  await expect(lab).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset['labels'])).toBe('always');
  expect(await page.evaluate(() => document.documentElement.dataset['quality'])).toBe('low');
});

test('credits are reachable from the title, carry the required three.js notice and no placeholders, and return to the title', async ({ page }) => {
  await page.goto('/');
  await page.locator('#b-credits').click();
  await expect(page.locator('[data-screen="CREDITS"]')).toBeVisible();
  await expect(page.locator('[data-screen="CREDITS"]')).toContainText('three.js');
  await expect(page.locator('[data-screen="CREDITS"]')).not.toContainText('確認中');
  await page.locator('#b-back').click();
  await expect(page.locator('#b-new')).toBeVisible();
});

test('screen readers get each line once and whole, even while the text is being revealed', async ({ page }) => {
  await setSettings(page, async (p) => { await p.locator('#s-speed').selectOption('slow'); });
  await page.locator('#b-new').click();
  await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg')).toBeVisible();
  await expect(page.locator('#dlg-text')).toHaveAttribute('aria-hidden', 'true');
  const sr = page.locator('#dlg-sr');
  await expect(sr).toHaveAttribute('aria-live', 'polite');
  const full = (await page.locator('#dlg-text').textContent())!;
  expect(await sr.textContent()).toContain(full); // complete from the first moment, not typed out
  // it changes only when the line changes (not on every revealed character)
  const changes = await page.evaluate(() => new Promise<number>((res) => {
    let n = 0; const mo = new MutationObserver(() => n++);
    mo.observe(document.getElementById('dlg-sr')!, { childList: true, characterData: true, subtree: true });
    setTimeout(() => { mo.disconnect(); res(n); }, 1500);
  }));
  expect(changes).toBe(0);
});

test('review fix: focus returns to the trigger after the hint modal closes', async ({ page }) => {
  await openGame(page, '/?start=M1A_P04');
  const hint = page.locator('#controls [data-action-id="hint_open"], #targets [data-action-id="hint_open"]').first();
  await hint.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(350);
  await expect(page.locator('#hint')).toBeVisible();
  await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  await expect(page.locator('#hint')).toBeHidden();
  expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-action-id'))).toBe('hint_open');
});

test('P05 readout states each joint in words and never names the answer', async ({ page }) => {
  await openGame(page, '/?start=M1A_P05&cam=observatory_observe&p05=0,0');
  const read = async () => (await page.locator('#readout').innerText()).replace(/\s+/g, ' ');
  expect(await page.locator('#readout').innerText()).not.toContain('つなぎ目'); // not shown until the player looks from the observation mark
  await page.locator('[data-action-id="view_peek"]').first().click(); await page.waitForTimeout(350);
  const t0 = await read();
  expect(t0).toContain('輪A：');
  expect(t0).toMatch(/はなれている/);
  const set = async (id: string) => { await page.locator(`[data-action-id="${id}"]`).first().click(); await page.waitForTimeout(350); };
  await set('p05_a1');                        // a=1 alone must still leave a joint apart
  expect(await read()).toMatch(/はなれている/);
  expect(await read()).not.toMatch(/正解|答え|a1|b2/i);
});

test('review fix: pressing Q while a world hotspot is focused keeps keyboard focus on it', async ({ page }) => {
  await openGame(page, '/?start=M1A_P04');
  const hot = page.locator('#hotspots .hot').first();
  await expect(hot).toBeVisible();
  const id = await hot.getAttribute('data-action-id');
  await hot.focus();
  await page.keyboard.press('q');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset['actionId'])).toBe(id);
  await page.waitForTimeout(2500); // the highlight fades and the buttons are rebuilt again
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset['actionId'])).toBe(id);
});

test('review fix: focus the player moved elsewhere is not pulled back to an earlier control, and routine saving is not announced', async ({ page }) => {
  await openGame(page, '/?start=M1A_P04');
  const side = page.locator('[data-action-id="view_wall_side"]').first();
  await side.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  const other = page.locator('[data-action-id="hint_open"]').first();
  await other.focus();
  await page.keyboard.press('q'); await page.waitForTimeout(400);
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset['actionId'])).toBe('hint_open');
});

test('review fix: routine saving is not announced by the live region (only problems and unsaved play are)', async ({ page }) => {
  await page.goto('/');
  await page.locator('#b-new').click(); await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg')).toBeVisible(); await readAll(page);
  await expect(page.locator('#savestate')).toHaveText('保存しました', { timeout: 10000 });
  expect(await page.locator('#savestate').getAttribute('aria-live')).toBe('off');
});
