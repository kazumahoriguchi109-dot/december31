import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// Browser zoom 200% on a 1280x720 window is a 640x360 CSS px viewport at device scale 2 (backlog Q08, automated part).
// Checks: no horizontal scrolling, every control inside the viewport width, text not clipped, the whole opening to P03 playable.
// The real browser's zoom feature and a person's judgement of legibility remain a human check (PLAYTEST.md section C).
test.use({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });

const dedup = (p: Page) => p.waitForTimeout(320);
async function readAll(page: Page) {
  for (let i = 0; i < 60; i++) {
    const next = page.locator('#dlg:not([hidden]) [data-action-id="dlg_next"]');
    if (await next.count() === 0) return;
    await next.first().scrollIntoViewIfNeeded(); await next.first().click(); await dedup(page);
  }
  throw new Error('dialogue never ended');
}
async function act(page: Page, id: string) {
  const loc = page.locator(`#targets [data-action-id="${id}"], #controls [data-action-id="${id}"]`).first();
  await loc.scrollIntoViewIfNeeded(); await loc.click(); await dedup(page); await readAll(page);
}
async function layoutProblems(page: Page, where: string) {
  const p = await page.evaluate(() => {
    const W = window.innerWidth, bad: string[] = [];
    const st = document.getElementById('stage');
    if (st && !st.closest('[hidden]') && st.getBoundingClientRect().width < W * 0.6) bad.push(`stage too small: ${st.getBoundingClientRect().width}`);
    if (document.documentElement.scrollWidth > W + 1) bad.push(`horizontal scroll: ${document.documentElement.scrollWidth} > ${W}`);
    for (const el of document.querySelectorAll<HTMLElement>('button, a, select, input, [data-action-id]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest('[hidden]')) continue;
      if (r.left < -1 || r.right > W + 1) bad.push(`outside width: ${el.id || el.textContent?.trim().slice(0, 20)} [${Math.round(r.left)},${Math.round(r.right)}]`);
    }
    for (const el of document.querySelectorAll<HTMLElement>('.btn, .dlg-text, #obj-text')) {
      if (el.closest('[hidden]')) continue;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') bad.push(`clipped text: ${el.textContent?.trim().slice(0, 20)}`);
    }
    return bad;
  });
  expect(p, where).toEqual([]);
}

test('200% zoom: title, settings, credits and the opening through P03 have no overflow and stay playable', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.locator('#b-new').waitFor();
  await layoutProblems(page, 'title');
  await page.locator('#b-set').click(); await layoutProblems(page, 'settings');
  await page.locator('#set-cancel').click();
  await page.locator('#b-credits').click(); await layoutProblems(page, 'credits');
  await page.locator('#b-back').click();
  await page.locator('#b-new').click(); await layoutProblems(page, 'new game');
  await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg')).toBeVisible();
  await layoutProblems(page, 'room dialogue');
  await readAll(page);
  await act(page, 'start_rpg'); await layoutProblems(page, 'arrival');
  await act(page, 'move_p01_panel'); await layoutProblems(page, 'P01');
  await act(page, 'p01_right');
  await act(page, 'move_mill'); await layoutProblems(page, 'mill');
  await page.screenshot({ path: testInfo.outputPath('zoom-mill.png') });
  await act(page, 'p02_drain'); await act(page, 'p02_stopper');
  await act(page, 'move_gate_near'); await act(page, 'p03_wait'); await act(page, 'move_gate_far');
  await act(page, 'p03_latch'); await act(page, 'p03_call'); await layoutProblems(page, 'gate far');
  await act(page, 'move_wall_base'); await layoutProblems(page, 'wall');
  await page.keyboard.press('h'); await dedup(page);
  await expect(page.locator('#hint')).toBeVisible(); await layoutProblems(page, 'hint');
  const hr = await page.locator('#hint').boundingBox();
  expect(hr!.width).toBeLessThanOrEqual(640);
  await page.keyboard.press('Escape');
});
