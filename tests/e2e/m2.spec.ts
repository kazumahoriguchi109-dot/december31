import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// M2: a real new game from the title screen through the intro, P01, P02 and P03, in the real DOM.
// Dialogue is read line by line with the "next" button (as a player does); actions are clicked or pressed from the keyboard.

const st = (p: Page) => p.evaluate(() => structuredClone((window as any).__d31shell.internals().game.state));
const dedup = (p: Page) => p.waitForTimeout(320);

async function readAll(page: Page) {
  for (let i = 0; i < 40; i++) {
    const next = page.locator('#dlg:not([hidden]) [data-action-id="dlg_next"]');
    if (await next.count() === 0) return;
    await next.first().click();
    await dedup(page);
  }
  throw new Error('dialogue never ended');
}
async function act(page: Page, id: string, how: 'mouse' | 'keyboard' = 'mouse') {
  const loc = page.locator(`#targets [data-action-id="${id}"], #controls [data-action-id="${id}"]`).first();
  await expect(loc).toBeVisible();
  if (how === 'keyboard') { await loc.focus(); await page.keyboard.press('Enter'); } else await loc.click();
  await dedup(page);
  await readAll(page);
}
async function newGame(page: Page) {
  await page.goto('/');
  await page.locator('#b-new').click();
  await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#obj-text')).toBeAttached();
  await page.waitForFunction(() => (window as any).__d31shell?.internals().game);
}
const obj = (page: Page) => page.locator('#obj-text').textContent();

for (const how of ['mouse', 'keyboard'] as const) {
  test(`new game -> intro -> P01 -> P02 -> P03 (${how})`, async ({ page }) => {
    await newGame(page);
    // while playing, no menu screen may sit above or beside the game (hidden must really hide)
    await expect(page.locator('#screen-root')).toBeHidden();
    await expect(page.locator('#play-root')).toBeVisible();
    // ROOM: the opening dialogue first, then the start button; no puzzle is reachable
    await expect(page.locator('#dlg')).toBeVisible();
    await readAll(page);
    expect((await st(page)).progress.milestone).toBe('ROOM');
    await act(page, 'start_rpg', how);
    let s = await st(page);
    expect(s.progress.milestone).toBe('ARRIVAL');
    expect(s.dialogue.seenIds).toEqual(expect.arrayContaining(['D000', 'D001', 'D002', 'D003', 'D010', 'D011', 'D012', 'D013']));
    expect(await obj(page)).toBe('城へ続く道をつなぐ');
    // P01: a wrong turn says "あと少し", the right turn solves in the same command
    await act(page, 'move_p01_panel', how);
    expect(await obj(page)).toBe('線を門までつなごう');
    await act(page, 'p01_left', how);
    await expect(page.locator('#status')).toHaveText('門まで、あと少し。');
    expect((await st(page)).puzzles.p01).toEqual({ rotation: 3, solved: false });
    await expect(page.locator('#readout')).toContainText('タイルのつなぎ口：南と西');
    await act(page, 'p01_reset', how);
    await page.locator('#confirm-actions [data-action-id="confirm_yes"]').click(); await dedup(page);
    expect((await st(page)).puzzles.p01.rotation).toBe(0);
    await act(page, 'p01_right', how);
    s = await st(page);
    expect(s.progress.milestone).toBe('P01_DONE');
    expect(s.dialogue.seenIds).toEqual(expect.arrayContaining(['D016', 'D017', 'D018']));
    expect(s.dialogue.seenIds.indexOf('D018')).toBeLessThan(s.dialogue.seenIds.indexOf('D017'));
    // P02: the two intermediate states are told apart in words
    await act(page, 'move_mill', how);
    await act(page, 'p02_drain', how);
    await expect(page.locator('#readout')).toContainText('排水口：閉じている');
    await expect(page.locator('#readout')).toContainText('水は車輪に届いているが、止め具で動かない。');
    await act(page, 'p02_drain', how); // wrong toggles are harmless
    await act(page, 'p02_stopper', how);
    await expect(page.locator('#readout')).toContainText('水は排水口へ流れてしまっている。');
    await act(page, 'p02_drain', how);
    s = await st(page);
    expect(s.progress.milestone).toBe('P02_DONE');
    // P03
    await act(page, 'move_gate_near', how);
    expect(await obj(page)).toBe('二人で門を越えよう');
    await act(page, 'p03_wait', how);
    await expect(page.locator('#readout')).toContainText('トト：圧板で待っている');
    await act(page, 'move_gate_far', how);
    await act(page, 'p03_latch', how);
    expect(await obj(page)).toBe('トトと門の先へ');
    await act(page, 'p03_call', how);
    s = await st(page);
    expect(s.progress.milestone).toBe('P03_DONE');
    expect(s.puzzles.p03).toEqual({ gateLatched: true, crossed: true, solved: true });
    expect(s.toto).toEqual({ mode: 'follow', anchor: 'party' });
    await act(page, 'move_wall_base', how);
    expect((await st(page)).player.anchor).toBe('wall_base');
  });
}

test('P03: calling Toto before the latch keeps everything, offers the way back, and does not strand anyone', async ({ page }) => {
  await newGame(page);
  await readAll(page);
  await act(page, 'start_rpg');
  await act(page, 'move_p01_panel'); await act(page, 'p01_right');
  await act(page, 'move_mill'); await act(page, 'p02_drain'); await act(page, 'p02_stopper');
  await act(page, 'move_gate_near'); await act(page, 'p03_wait'); await act(page, 'move_gate_far');
  const before = await st(page);
  await act(page, 'p03_call');
  await expect(page.locator('#status')).toHaveText('まだ門が固定されていない。戻ってから呼ぼう。');
  expect(await st(page)).toEqual(before);
  await act(page, 'move_gate_near'); // 手前へ戻る
  expect((await st(page)).player.anchor).toBe('gate_near');
  await act(page, 'p03_call');
  const s = await st(page);
  expect(s.toto.mode).toBe('follow');
  expect(s.progress.milestone).toBe('P02_DONE');
});

test('P03 own-plate observation: opens the gate in view only, never changes progress, and is gone after pause/reload', async ({ page }) => {
  await newGame(page);
  await readAll(page);
  await act(page, 'start_rpg');
  await act(page, 'move_p01_panel'); await act(page, 'p01_right');
  await act(page, 'move_mill'); await act(page, 'p02_drain'); await act(page, 'p02_stopper');
  await act(page, 'move_gate_near');
  const before = await st(page);
  await act(page, 'self_on');
  await expect(page.locator('#status')).toHaveText('圧板が沈んで、門が開いた。');
  await expect(page.locator('#readout')).toContainText('門：開いている');
  await expect(page.locator('#targets [data-action-id="move_gate_far"]')).toHaveCount(0); // the visual opening is not passable
  await act(page, 'self_try');
  await expect(page.locator('#status')).toHaveText('離れると、門も閉まった。');
  await expect(page.locator('#readout')).toContainText('門：閉じている');
  expect(await st(page)).toEqual(before); // crossed untouched, still gate_near
  // handing over to Toto in one command
  await act(page, 'self_on');
  await act(page, 'p03_wait');
  const s = await st(page);
  expect(s.toto).toEqual({ mode: 'wait', anchor: 'p03_plate' });
  await expect(page.locator('[data-action-id="self_on"]')).toHaveCount(0); // hidden while Toto waits
  // pause while observing closes the observation first
  await act(page, 'p03_call');
  await act(page, 'self_on');
  await page.locator('#pausebtn').click();
  await page.locator('#p-resume').click();
  await expect(page.locator('[data-action-id="self_on"]').first()).toBeVisible();
  await expect(page.locator('#readout')).toContainText('門：閉じている');
});

test('P03 reset only before the latch', async ({ page }) => {
  await newGame(page);
  await readAll(page);
  await act(page, 'start_rpg');
  await act(page, 'move_p01_panel'); await act(page, 'p01_right');
  await act(page, 'move_mill'); await act(page, 'p02_drain'); await act(page, 'p02_stopper');
  await act(page, 'move_gate_near'); await act(page, 'p03_wait'); await act(page, 'move_gate_far');
  await act(page, 'p03_reset');
  await page.locator('#confirm-actions [data-action-id="confirm_yes"]').click(); await dedup(page);
  const s = await st(page);
  expect(s.player.anchor).toBe('gate_near');
  expect(s.toto.mode).toBe('follow');
  expect(s.puzzles.p03).toEqual({ gateLatched: false, crossed: false, solved: false });
  await act(page, 'p03_wait'); await act(page, 'move_gate_far'); await act(page, 'p03_latch');
  await expect(page.locator('[data-action-id="p03_reset"]')).toHaveCount(0);
});

test('reload mid-way resumes the same place, state and dialogue (P02 half-done)', async ({ page }) => {
  await newGame(page);
  await readAll(page);
  await act(page, 'start_rpg');
  await act(page, 'move_p01_panel'); await act(page, 'p01_right');
  await act(page, 'move_mill');
  await act(page, 'p02_stopper');
  // wait until the stored autosave really holds this action (earlier writes finishing late must not count)
  await page.waitForFunction(() => new Promise<boolean>((res) => {
    const r = indexedDB.open('december31');
    r.onsuccess = () => {
      const g = r.result.transaction('slots', 'readonly').objectStore('slots').get('auto');
      g.onsuccess = () => { r.result.close(); res(g.result?.game?.puzzles?.p02?.stopper === 'released'); };
      g.onerror = () => { r.result.close(); res(false); };
    };
    r.onerror = () => res(false);
  }), undefined, { polling: 100 });
  const before = await st(page);
  await page.reload();
  await page.locator('#b-cont').click();
  // the Game object exists from boot (as a fresh ROOM game); only PLAY means the saved game has replaced it
  await page.waitForFunction(() => (window as any).__d31shell?.internals().screen() === 'PLAY');
  await readAll(page);
  const after = await st(page);
  expect(after.puzzles.p02).toEqual(before.puzzles.p02);
  expect(after.player.anchor).toBe('mill');
  await expect(page.locator('#readout')).toContainText('止め具：外れている');
});

// ---- the whole story, from the title screen to the ending ----
async function modal(page: Page, sel: string, id: string) {
  const b = page.locator(`${sel} [data-action-id="${id}"]`);
  await expect(b).toBeVisible();
  await b.click(); await dedup(page); await readAll(page);
}
async function toWall(page: Page) {
  await newGame(page);
  await readAll(page);
  await act(page, 'start_rpg');
  await act(page, 'move_p01_panel'); await act(page, 'p01_right');
  await act(page, 'move_mill'); await act(page, 'p02_drain'); await act(page, 'p02_stopper');
  await act(page, 'move_gate_near'); await act(page, 'p03_wait'); await act(page, 'move_gate_far');
  await act(page, 'p03_latch'); await act(page, 'p03_call'); await act(page, 'move_wall_base');
}

for (const how of ['mouse', 'keyboard'] as const) {
  test(`the whole game: title -> ... -> P06 -> ending (${how})`, async ({ page }) => {
    test.setTimeout(90000); // the walk takes ~28 s before the era art pass and ~37 s after it on headless software GL (measured, cycle-010); real-GPU timing is unmeasured
    await toWall(page);
    await act(page, 'view_wall_side', how);
    await act(page, 'p04_inspect', how);
    expect((await st(page)).progress.milestone).toBe('P04_DONE');
    await act(page, 'move_observatory', how);
    await act(page, 'p05_a1', how);
    await act(page, 'p05_b2', how);
    await page.waitForTimeout(1500); // the closed ring is shown before the castle takes over
    await readAll(page);
    expect((await st(page)).progress.milestone).toBe('P05_DONE');
    expect(await obj(page)).toBe('入ってきた枠へ戻ろう');
    await act(page, 'move_portal_front', how);
    expect(await obj(page)).toBe('光る枠を調べよう');
    // same side as Toto does nothing; alone does nothing
    await act(page, 'p06_wait', how);
    await expect(page.locator('#readout')).toContainText('表の圧板：トトが乗っている');
    expect((await st(page)).progress.milestone).toBe('P05_DONE');
    await expect(page.locator('#targets [data-action-id="move_castle"][aria-disabled="true"]')).toBeVisible(); // leaving is refused while Toto waits
    await expect(page.locator('#targets')).toContainText('先にトトを呼ぼう。');
    await act(page, 'move_portal_back', how);
    let s = await st(page);
    expect(s.progress.milestone).toBe('RETURN_OPEN');
    expect(s.puzzles.p06.solved).toBe(true);
    expect(s.toto.mode).toBe('wait');
    // going home alone is not possible; with Toto it asks first, and "not yet" changes nothing
    await expect(page.locator('[data-action-id="return_ask"][aria-disabled="true"]').first()).toBeVisible();
    await act(page, 'p06_call', how);
    await act(page, 'return_ask', how);
    await modal(page, '#confirm-actions', 'confirm_return_no');
    expect((await st(page)).progress.milestone).toBe('RETURN_OPEN');
    await act(page, 'return_ask', how);
    await modal(page, '#confirm-actions', 'confirm_return_yes');
    s = await st(page);
    expect(s.progress.milestone).toBe('ENDING');
    expect(s.player.anchor).toBe('home');
    expect(s.toto.mode).toBe('follow');
    for (const id of ['D080', 'D081', 'D082', 'D083', 'D084', 'D085', 'D086', 'D087']) expect(s.dialogue.seenIds).toContain(id);
  });
}

test('hints open one level at a time, only when asked, with H or the button, and are saved in the state', async ({ page }) => {
  await newGame(page);
  await readAll(page);
  await expect(page.locator('[data-action-id="hint_open"]')).toHaveCount(0); // no hints before the story starts
  await act(page, 'start_rpg'); await act(page, 'move_p01_panel');
  await expect(page.locator('#hint')).not.toBeVisible(); // never opens on its own
  await page.keyboard.press('h'); await dedup(page);
  await expect(page.locator('#hint')).toBeVisible();
  await expect(page.locator('#hint-body')).toContainText('ヒントは、見たいときだけ開けます');
  await modal(page, '#hint-actions', 'hint_more');
  await expect(page.locator('#hint-body')).toContainText('入口と門の線は、どこで途切れてる？');
  await expect(page.locator('#hint-body')).not.toContainText('真ん中の石の線の端を');
  await modal(page, '#hint-actions', 'hint_more');
  await modal(page, '#hint-actions', 'hint_more');
  await expect(page.locator('#hint-body')).toContainText('右に1回回すとつながるよ');
  await expect(page.locator('[data-action-id="hint_more"][aria-disabled="true"]')).toBeVisible();
  await page.keyboard.press('Escape'); // closes only the hint, not into the pause menu
  await expect(page.locator('#hint')).not.toBeVisible();
  await expect(page.locator('#screen-root')).toBeHidden();
  expect((await st(page)).hints.P01).toBe(3);
  expect((await st(page)).puzzles.p01.solved).toBe(false); // hints never solve anything
});
