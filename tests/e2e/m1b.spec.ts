import { expect, test, type Page, type BrowserContext } from '@playwright/test';

// Real-browser persistence tests. They use the real IndexedDB, real Web Locks and the real DOM of the dev build.
// Each test gets a fresh browser context, so the database starts empty.

const sh = (p: Page) => p.evaluate(() => {
  const s = (window as any).__d31shell.internals();
  return { screen: s.screen(), state: structuredClone(s.game.state), saver: { status: s.saver?.status, saves: s.saver?.saves } };
});
const pause = (p: Page) => p.waitForTimeout(350);

/** Reads a raw record from the real database, outside the game's own code. */
async function raw(page: Page, storeName: string, key: string) {
  return page.evaluate(([s, k]) => new Promise((res, rej) => {
    const r = indexedDB.open('december31');
    r.onsuccess = () => { const t = r.result.transaction(s!, 'readonly'); const g = t.objectStore(s!).get(k!); g.onsuccess = () => { r.result.close(); res(g.result); }; g.onerror = () => rej(g.error); };
    r.onerror = () => rej(r.error);
  }), [storeName, key]) as Promise<any>;
}
async function rawPut(page: Page, storeName: string, key: string, value: unknown) {
  await page.evaluate(([s, k, v]) => new Promise<void>((res, rej) => {
    const r = indexedDB.open('december31');
    r.onsuccess = () => { const t = r.result.transaction(s as string, 'readwrite'); t.objectStore(s as string).put(v, k as string); t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error); };
    r.onerror = () => rej(r.error);
  }), [storeName, key, value] as const);
}
async function skipDialogue(page: Page) {
  for (let i = 0; i < 12; i++) {
    const b = page.locator('#dlg:not([hidden]) [data-action-id="dlg_skip"]');
    if (await b.count() === 0) return;
    await b.first().click(); await pause(page);
  }
}
async function devStart(page: Page, which: 'M1A_P04' | 'M1A_P05') {
  await page.goto('/');
  await page.locator(`[data-dev="${which}"]`).click();
  await expect(page.locator('#obj-text')).toBeVisible();
}
const waitSaved = (page: Page) => page.waitForFunction(() => (window as any).__d31shell.internals().saver.status === 'saved', undefined, { timeout: 5000 });

test('title -> New (first run, no confirmation) -> play, and the first state is stored', async ({ page }) => {
  await page.goto('/');
  await page.locator('#b-new').click();
  await expect(page.locator('h1')).toHaveText('物語をはじめる');
  await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg-text')).toBeVisible();
  const s = await sh(page);
  expect(s.state.progress.milestone).toBe('ROOM');
  expect(s.state.dialogue.activeId).toBe('D000'); // the opening dialogue starts at once
  const a = await raw(page, 'slots', 'auto'); const m = await raw(page, 'slots', 'manual-1');
  expect(a.revision).toBe(1); expect(m.revision).toBe(1);
});

test('reload after each accepted P04 command restores exactly the saved state (S-01)', async ({ page }) => {
  await devStart(page, 'M1A_P04');
  await skipDialogue(page);
  for (const step of ['view_wall_side', 'p04_inspect']) {
    await page.locator(`[data-action-id="${step}"]`).first().click();
    await waitSaved(page);
    const before = (await sh(page)).state;
    const stored = (await raw(page, 'slots', 'auto')).game;
    expect(stored).toEqual(before);                         // what is stored is what is on screen
    await page.reload();
    await page.locator('#b-cont').click();
    await expect(page.locator('#obj-text')).toBeVisible();
    expect((await sh(page)).state).toEqual(before);         // and what comes back is what was stored
    await pause(page);
  }
  expect((await sh(page)).state.progress.milestone).toBe('P04_DONE');
});

test('reload in the middle of a dialogue resumes the same line without skipping ahead', async ({ page }) => {
  await devStart(page, 'M1A_P05');                           // starts with D050 unread
  await expect(page.locator('#dlg-text')).toBeVisible();
  await waitSaved(page).catch(() => {});
  const before = await sh(page);
  expect(before.state.dialogue.activeId).toBe('D050');
  await page.reload();
  await page.locator('#b-cont').click();
  await expect(page.locator('#dlg-text')).toBeVisible();
  const after = await sh(page);
  expect(after.state.dialogue.activeId).toBe('D050');
  expect(after.state.dialogue.seenIds).toEqual(before.state.dialogue.seenIds);
});

test('S-04: a second tab cannot become a writer (E_TAB); it can still read and export', async ({ context, page }) => {
  await devStart(page, 'M1A_P04');
  const tab2 = await context.newPage();
  await tab2.goto('/');
  await expect(tab2.locator('[data-error-code="E_TAB"]')).toBeVisible();
  await tab2.locator('#e-slots').click();
  await expect(tab2.locator('h1')).toHaveText('セーブ一覧');
  await expect(tab2.locator('[data-new], [data-save], [data-import], [data-restore]')).toHaveCount(0);
  await expect(tab2.locator('[data-export="manual-1"]')).toBeVisible();
  // the first tab is unaffected
  expect((await sh(page)).screen).toBe('PLAY');
});

test('S-07/T01: export -> import into another slot leaves the current game alone; Load then gives the same state', async ({ page }) => {
  await devStart(page, 'M1A_P04');
  await skipDialogue(page);
  await page.locator('[data-action-id="view_wall_side"]').first().click();
  await waitSaved(page);
  const playing = (await sh(page)).state;
  await page.locator('#pausebtn').click();
  await page.locator('#p-slots').click();
  await page.locator('[data-save="manual-1"]').click();         // explicit Save into the bound slot (no confirmation needed)
  await expect(page.locator('h1')).toHaveText('セーブ一覧');
  const dl = page.waitForEvent('download');
  await page.locator('[data-export="manual-1"]').click();
  const file = await (await dl).path();
  const text = (await import('node:fs')).readFileSync(file!, 'utf8');
  await page.locator('[data-import="manual-2"]').click();
  await page.locator('#imp-file').setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#imp-preview')).toContainText('読めました');
  await page.locator('#imp-go').click();
  await expect(page.locator('[data-slot-status="manual-2"]')).not.toHaveText('空き');
  // current game and its binding did not change
  const now = (await sh(page)).state;
  expect(now).toEqual(playing);
  expect(now.progress.activeManualSlot).toBe('manual-1');
  // explicit Load of the imported slot swaps the game in
  await page.locator('[data-load="manual-2"]').click();
  await expect(page.locator('#obj-text')).toBeVisible();
  const loaded = (await sh(page)).state;
  expect({ ...loaded, progress: { ...loaded.progress, activeManualSlot: null } }).toEqual({ ...playing, progress: { ...playing.progress, activeManualSlot: null } });
  expect(loaded.progress.activeManualSlot).toBe('manual-2');
});

test('S-03: an abort after the writes were issued shows no "saved", keeps old data, and play continues', async ({ page }) => {
  await devStart(page, 'M1A_P04');
  await skipDialogue(page);
  await waitSaved(page).catch(() => {});
  const oldAuto = await raw(page, 'slots', 'auto');
  await page.evaluate(() => { (window as any).__d31shell.internals().store.hooks.afterRequests = (tx: IDBTransaction, label: string) => { if (label === 'save:auto') tx.abort(); }; });
  await page.locator('[data-action-id="view_wall_side"]').first().click();
  await expect(page.locator('#savestate')).toHaveText('保存できませんでした', { timeout: 5000 });
  expect(await raw(page, 'slots', 'auto')).toEqual(oldAuto);       // old slot untouched
  expect((await sh(page)).state.player.view).toBe('wall_side');     // in-memory play went on
  await page.evaluate(() => { (window as any).__d31shell.internals().store.hooks.afterRequests = undefined; });
  await pause(page);
  await page.locator('[data-action-id="p04_inspect"]').first().click(); // the next commit saves again
  await waitSaved(page);
  expect((await raw(page, 'slots', 'auto')).game.progress.milestone).toBe('P04_DONE');
});

test('S-05 (simulated quota): a refused write keeps old data, says so, and does not stop the game', async ({ page }) => {
  await devStart(page, 'M1A_P04');
  await skipDialogue(page);
  await waitSaved(page).catch(() => {});
  const oldAuto = await raw(page, 'slots', 'auto');
  await page.evaluate(() => {
    const orig = IDBObjectStore.prototype.put;
    (window as any).__origPut = orig;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...a: any[]) {
      if (this.name === 'slots') throw new DOMException('quota', 'QuotaExceededError');
      return (orig as any).apply(this, a);
    } as any;
  });
  await page.locator('[data-action-id="view_wall_side"]').first().click();
  await expect(page.locator('#savestate')).toHaveText('保存できませんでした', { timeout: 5000 });
  expect(await raw(page, 'slots', 'auto')).toEqual(oldAuto);
  expect((await sh(page)).state.player.view).toBe('wall_side');
  await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__origPut; });
});

test('TR01: a future-schema auto blocks New and Load with E_VERSION and changes nothing', async ({ page }) => {
  await devStart(page, 'M1A_P04');
  await skipDialogue(page); await waitSaved(page).catch(() => {});
  const auto = await raw(page, 'slots', 'auto');
  await rawPut(page, 'slots', 'auto', { ...auto, schemaVersion: 99 });
  const metaBefore = await raw(page, 'meta', 'global');
  await page.reload();                                       // fresh tab session
  await page.locator('#b-new').click();
  await page.locator('[data-new="manual-2"]').click();
  await expect(page.locator('[data-error-code="E_VERSION"]')).toBeVisible();
  await page.locator('#e-title').click();
  await page.locator('#b-slots').click();
  await page.locator('[data-load="manual-1"]').click();
  await expect(page.locator('[data-error-code="E_VERSION"]')).toBeVisible();
  expect((await raw(page, 'slots', 'auto')).schemaVersion).toBe(99);
  expect(await raw(page, 'meta', 'global')).toMatchObject({ writeRevision: metaBefore.writeRevision });
  expect(await raw(page, 'slots', 'manual-2')).toBeUndefined();
});

test('T02: corrupt auto -> Load manual asks first, archives the raw auto, and the next autosave works', async ({ page }) => {
  await devStart(page, 'M1A_P04');
  await skipDialogue(page); await waitSaved(page).catch(() => {});
  const auto = await raw(page, 'slots', 'auto');
  const broken = { ...auto }; delete broken.revision;
  await rawPut(page, 'slots', 'auto', broken);
  await page.reload();
  await page.locator('#b-slots').click();
  await expect(page.locator('[data-slot-status="auto"]')).toHaveText('読めないデータがあります');
  await page.locator('[data-load="manual-1"]').click();
  await expect(page.locator('h1')).toHaveText('オートセーブを作り直します');
  await page.locator('#c-no').click();                        // refusing changes nothing
  expect(await raw(page, 'slots', 'auto')).toEqual(broken);
  await page.locator('[data-load="manual-1"]').click();
  await page.locator('#c-yes').click();
  await expect(page.locator('#obj-text')).toBeVisible();
  const q = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('december31'); r.onsuccess = () => { const g = r.result.transaction('quarantine').objectStore('quarantine').getAll(); g.onsuccess = () => { r.result.close(); res(g.result); }; }; })) as any[];
  expect(q).toHaveLength(1);
  expect(q[0].rawAuto).toEqual(broken);
  await skipDialogue(page);
  await page.locator('[data-action-id="view_wall_side"]').first().click();
  await waitSaved(page);
  expect((await raw(page, 'slots', 'auto')).game.player.view).toBe('wall_side');
});

test('S-15: without Web Locks the game is read-only (E_CAPABILITY) but slots stay readable', async ({ browser }) => {
  const ctx: BrowserContext = await browser.newContext();
  const seed = await ctx.newPage();
  await devStart(seed, 'M1A_P04'); await skipDialogue(seed); await waitSaved(seed).catch(() => {});
  await seed.close();
  const page = await ctx.newPage();
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined }); });
  await page.goto('/');
  await expect(page.locator('[data-error-code="E_CAPABILITY"]')).toBeVisible();
  await page.locator('#e-slots').click();
  await expect(page.locator('[data-export="manual-1"]')).toBeVisible();
  await expect(page.locator('[data-load], [data-save], [data-import], [data-restore], [data-new]')).toHaveCount(0);
  await ctx.close();
});

test('S-11: a database that cannot be opened ends the loading screen with an error instead of waiting forever', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.evaluate(() => new Promise<void>((res) => { const r = indexedDB.open('december31', 5); r.onsuccess = () => { r.result.close(); res(); }; r.onupgradeneeded = () => {}; }));
  await page.reload();                                          // DB is now version 5; this build opens version 1
  await expect(page.locator('[data-error-code="E_STORAGE"]')).toBeVisible({ timeout: 12000 });
  await ctx.close();
});

test('manual save: overwriting another slot asks first; refusing changes nothing', async ({ page }) => {
  await devStart(page, 'M1A_P04');
  await skipDialogue(page); await waitSaved(page).catch(() => {});
  // put something into manual-2 via import so it is occupied
  await page.locator('#pausebtn').click();
  await page.locator('#p-slots').click();
  await expect(page.locator('[data-save="manual-2"]')).toBeVisible();
  await page.locator('[data-save="manual-2"]').click();         // empty: saves directly
  await expect(page.locator('[data-slot-status="manual-2"]')).not.toHaveText('空き');
  await expect((await sh(page)).state.progress.activeManualSlot).toBe('manual-2');
  await page.locator('[data-save="manual-1"]').click();         // occupied, not the bound slot: asks
  await expect(page.locator('h1')).toHaveText('上書きの確認');
  const before = await raw(page, 'slots', 'manual-1');
  await page.locator('#c-no').click();
  expect(await raw(page, 'slots', 'manual-1')).toEqual(before);
});
