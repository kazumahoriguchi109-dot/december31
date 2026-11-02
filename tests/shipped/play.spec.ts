import { expect, test, type Page } from '@playwright/test';

// The shipped build, played only through the screen (no test hooks exist in it): opening -> P01..P06 -> ending -> credits,
// plus save/resume, settings, hints and keyboard. Against the live site: LIVE_URL=https://... npx playwright test -c playwright.shipped.config.ts

const dedup = (p: Page) => p.waitForTimeout(320);
async function readAll(page: Page) {
  for (let i = 0; i < 60; i++) {
    const next = page.locator('#dlg:not([hidden]) [data-action-id="dlg_next"]');
    if (await next.count() === 0) return;
    await next.first().click(); await dedup(page);
  }
  throw new Error('dialogue never ended');
}
async function act(page: Page, id: string) {
  const loc = page.locator(`#targets [data-action-id="${id}"], #controls [data-action-id="${id}"]`).first();
  await expect(loc).toBeVisible(); await loc.click(); await dedup(page); await readAll(page);
}
async function modal(page: Page, sel: string, id: string) {
  const b = page.locator(`${sel} [data-action-id="${id}"]`); await expect(b).toBeVisible(); await b.click(); await dedup(page); await readAll(page);
}
const obj = (p: Page) => p.locator('#obj-text').textContent();
function watch(page: Page) {
  const bad: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Navigated away/.test(m.text())) bad.push('console: ' + m.text()); });
  page.on('pageerror', (e) => bad.push('pageerror: ' + e.message + ' ' + (e.stack ?? '').slice(0, 400)));
  page.on('requestfailed', (r) => bad.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`http ${r.status()}: ${r.url()}`); });
  return bad;
}

test('the shipped game: title -> opening -> all six puzzles -> ending -> credits', async ({ page }) => {
  const bad = watch(page);
  await page.goto('./');
  await expect(page.locator('h1')).toHaveText('12月31日');
  await expect(page.locator('[data-dev]')).toHaveCount(0); // no development shortcuts in the shipped build
  await page.locator('#b-new').click();
  await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg')).toBeVisible();
  await readAll(page);
  await act(page, 'start_rpg');
  expect(await obj(page)).toBe('城へ続く道をつなぐ');
  await act(page, 'move_p01_panel'); await act(page, 'p01_right');
  await act(page, 'move_mill'); await act(page, 'p02_drain'); await act(page, 'p02_stopper');
  await act(page, 'move_gate_near'); await act(page, 'p03_wait'); await act(page, 'move_gate_far');
  await act(page, 'p03_latch'); await act(page, 'p03_call'); await act(page, 'move_wall_base');
  expect(await obj(page)).toBe('城へ続く高い道を探そう');
  // save and resume in the middle of the game (a real reload of the page)
  try { await expect(page.locator('#savestate')).toHaveText('保存しました', { timeout: 10000 }); }
  catch (e) { console.log('SAVER DIAG ' + (await page.locator('#savestate').getAttribute('data-diag'))); throw e; } // what the saver did, for a failing run
  await page.reload();
  await page.locator('#b-cont').click();
  await expect(page.locator('#obj-text')).toHaveText('城へ続く高い道を探そう');
  await readAll(page);
  await act(page, 'view_wall_side'); await act(page, 'p04_inspect');
  await act(page, 'move_observatory'); await act(page, 'p05_a1'); await act(page, 'p05_b2');
  await page.waitForTimeout(1500); await readAll(page);
  expect(await obj(page)).toBe('入ってきた枠へ戻ろう');
  await act(page, 'move_portal_front'); await act(page, 'p06_wait'); await act(page, 'move_portal_back');
  await act(page, 'p06_call'); await act(page, 'return_ask');
  await modal(page, '#confirm-actions', 'confirm_return_yes');
  await expect(page.locator('[data-action-id="credits_open"]').first()).toBeVisible();
  await act(page, 'credits_open');
  await expect(page.locator('[data-screen="CREDITS"]')).toContainText('three.js');
  await page.locator('#b-back').click();
  await expect(page.locator('#b-new')).toBeVisible();
  expect(bad).toEqual([]);
});

test('the shipped game: hints, settings and keyboard', async ({ page }) => {
  const bad = watch(page);
  await page.goto('./');
  await page.locator('#b-set').click();
  await page.locator('#s-speed').selectOption('instant');
  await page.locator('#s-labels').check();
  await page.locator('#set-save').click();
  await page.locator('#b-new').click();
  await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg')).toBeVisible();
  await readAll(page);
  await act(page, 'start_rpg'); await act(page, 'move_p01_panel');
  expect(await page.evaluate(() => document.documentElement.dataset['labels'])).toBe('always');
  await page.keyboard.press('h'); await dedup(page);
  await expect(page.locator('#hint')).toBeVisible();
  await expect(page.locator('#hint-body')).not.toContainText('右に1回回すとつながるよ'); // the answer is not shown until asked
  await page.keyboard.press('Escape');
  const right = page.locator('#targets [data-action-id="p01_right"], #controls [data-action-id="p01_right"]').first();
  await right.focus(); await page.keyboard.press('Enter'); await dedup(page);
  await readAll(page);
  await expect(page.locator('#obj-text')).toHaveText('水車の道を進む');
  expect(bad).toEqual([]);
});
