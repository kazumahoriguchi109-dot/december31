import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { SaveStore } from '../../src/persistence/store';
import { SaveError, type SlotRecord } from '../../src/persistence/types';
import type { GameState } from '../../src/domain/types';
import fx from '../fixtures/starts/m1a_p04.json';

// Node has no Web Locks: a minimal exclusive/ifAvailable stand-in so the real SaveStore code path runs.
function installLocks() {
  const held = new Set<string>();
  (globalThis as any).isSecureContext = true;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    locks: {
      request: async (name: string, _o: unknown, cb: (l: unknown) => unknown) => {
        if (held.has(name)) return cb(null);
        held.add(name);
        try { return await cb({ name }); } finally { held.delete(name); }
      },
    },
  } });
  return held;
}

const game = () => structuredClone(fx.slot.game) as unknown as GameState;
const info = { runId: 'unit-run', createdAt: '2026-11-01T00:00:00.000Z', playTimeMs: 0 };
let store: SaveStore;

beforeEach(async () => {
  (globalThis as any).indexedDB = new IDBFactory();
  installLocks();
  store = await SaveStore.open();
  await store.acquireWriter();
});

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e) => e instanceof SaveError && e.code === code);
}
/** Writes a raw (possibly invalid) record straight into a store, bypassing the SaveStore API. */
async function rawPut(storeName: string, key: string, value: unknown) {
  const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('december31', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise<void>((res, rej) => { const t = db.transaction(storeName, 'readwrite'); t.objectStore(storeName).put(value, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  db.close();
}

describe('SaveStore (fake-indexeddb: logic only, not proof of real-browser behaviour)', () => {
  it('first run New writes manual and auto with the same revision, no confirmation', async () => {
    const r = await store.newGame('manual-1', game(), { runId: 'r1' }, { confirmed: false });
    expect(r.manual.revision).toBe(1); expect(r.auto.revision).toBe(1);
    const all = await store.readAll();
    expect(all.meta).toMatchObject({ writeRevision: 1, lastPlayedSlotId: 'auto' });
    expect(all.slots['manual-1'].status).toBe('ok');
  });

  it('New over existing data needs confirmation and changes nothing when refused (T04)', async () => {
    await store.newGame('manual-1', game(), { runId: 'r1' }, { confirmed: false });
    const before = JSON.stringify(await store.readAll());
    await expectCode(store.newGame('manual-2', game(), { runId: 'r2' }, { confirmed: false }), 'E_CONFLICT');
    expect(JSON.stringify(await store.readAll())).toBe(before);
    await store.newGame('manual-2', game(), { runId: 'r2' }, { confirmed: true });
    expect((await store.readAll()).slots['manual-2'].status).toBe('ok');
  });

  it('autosave advances revision, keeps one backup, and a stale revision is a conflict (no retry)', async () => {
    await store.newGame('manual-1', game(), { runId: 'r1' }, { confirmed: false });
    const a = await store.saveSlot('auto', game(), info);
    expect(a.revision).toBe(2);
    expect((await store.readBackup('auto')).status).toBe('ok');
    // another path changes auto behind this store's back
    const other = (await store.readSlot('auto')) as { slot: SlotRecord };
    await rawPut('slots', 'auto', { ...other.slot, revision: 50 });
    await expectCode(store.saveSlot('auto', game(), info), 'E_CONFLICT');
    expect(((await store.readSlot('auto')) as { slot: SlotRecord }).slot.revision).toBe(50);
  });

  it('S-03: abort after the writes were issued but before complete leaves old data and reports failure', async () => {
    await store.newGame('manual-1', game(), { runId: 'r1' }, { confirmed: false });
    const before = JSON.stringify(await store.readAll());
    store.hooks.afterRequests = (tx, label) => { if (label === 'save:auto') tx.abort(); };
    await expectCode(store.saveSlot('auto', game(), info), 'E_STORAGE');
    store.hooks.afterRequests = undefined;
    expect(JSON.stringify(await store.readAll())).toBe(before);
    // and the same revision expectation still works afterwards
    expect((await store.saveSlot('auto', game(), info)).revision).toBe(2);
  });

  it('revision numbering: import continues from meta.writeRevision, not from the file', async () => {
    await store.newGame('manual-1', game(), { runId: 'r1' }, { confirmed: false });
    for (let i = 0; i < 4; i++) await store.saveSlot('auto', game(), info);       // writeRevision -> 5
    const text = await store.exportSlot('manual-1');
    const env = SaveStore.parseImport(text);
    expect(env.slot.revision).toBe(1);
    const imp = await store.importInto('manual-2', env, { confirmedOverwrite: false });
    expect(imp.revision).toBe(6);
    expect(imp.game.progress.activeManualSlot).toBe('manual-2');
  });

  it('T01: import / restore leave lastPlayedSlotId alone', async () => {
    await store.newGame('manual-1', game(), { runId: 'r1' }, { confirmed: false });
    const lp = (await store.meta()).lastPlayedSlotId;
    await store.importInto('manual-3', SaveStore.parseImport(await store.exportSlot('manual-1')), { confirmedOverwrite: false });
    expect((await store.meta()).lastPlayedSlotId).toBe(lp);
    await store.saveSlot('manual-1', game(), info, { lastPlayed: lp });            // creates manual-1's backup
    await store.restoreBackup('manual-1', 'manual-2');
    expect((await store.meta()).lastPlayedSlotId).toBe(lp);
  });

  it('TR01: a future-schema auto blocks New, Load, Auto save and import, and nothing changes', async () => {
    await store.newGame('manual-1', game(), { runId: 'r1' }, { confirmed: false });
    const cur = ((await store.readSlot('auto')) as { slot: SlotRecord }).slot;
    await rawPut('slots', 'auto', { ...cur, schemaVersion: 99 });
    const before = JSON.stringify(await store.readAll());
    await expectCode(store.newGame('manual-2', game(), { runId: 'r2' }, { confirmed: true }), 'E_VERSION');
    await expectCode(store.load('manual-1'), 'E_VERSION');
    await expectCode(store.saveSlot('auto', game(), info), 'E_VERSION');
    expect(JSON.stringify(await store.readAll())).toBe(before);
    // read and export of the valid manual still work
    expect((await store.readSlot('manual-1')).status).toBe('ok');
    expect(await store.exportSlot('manual-1')).toContain('december31-save');
  });

  it('T02: corrupt auto + valid manual -> Load archives raw auto, creates fresh auto, next autosave passes', async () => {
    await store.newGame('manual-1', game(), { runId: 'r1' }, { confirmed: false });
    const cur = ((await store.readSlot('auto')) as { slot: SlotRecord }).slot;
    const broken = { ...cur } as Partial<SlotRecord>; delete broken.revision;
    await rawPut('slots', 'auto', broken);
    await expectCode(store.load('manual-1'), 'E_CONFLICT');                         // needs confirmation first
    const r = await store.load('manual-1', { rebuildAutoConfirmed: true });
    expect(r.autoRebuilt).toBe(true);
    const all = await store.readAll();
    expect(all.quarantine).toHaveLength(1);
    expect(all.quarantine[0]!.rawAuto).toMatchObject({ slotId: 'auto' });
    expect(all.slots.auto.status).toBe('ok');
    expect((await store.saveSlot('auto', game(), info)).revision).toBeGreaterThan(all.meta.writeRevision - 1);
  });

  it('S-14: restore from backup goes to another empty manual and leaves source + backup untouched', async () => {
    await store.newGame('manual-1', game(), { runId: 'r1' }, { confirmed: false });
    await store.saveSlot('manual-1', game(), info);                                  // backup now exists
    const srcBefore = JSON.stringify(await store.readSlot('manual-1'));
    const bkBefore = JSON.stringify(await store.readBackup('manual-1'));
    await expectCode(store.restoreBackup('manual-1', 'manual-1'), 'E_CORRUPT');
    const out = await store.restoreBackup('manual-1', 'manual-2');
    expect(out.slotId).toBe('manual-2');
    expect(JSON.stringify(await store.readSlot('manual-1'))).toBe(srcBefore);
    expect(JSON.stringify(await store.readBackup('manual-1'))).toBe(bkBefore);
    await expectCode(store.restoreBackup('manual-1', 'manual-2'), 'E_CONFLICT');      // target no longer empty
  });

  it('S-12: a second tab that takes over later makes the first tab\'s write abort (epoch)', async () => {
    await store.newGame('manual-1', game(), { runId: 'r1' }, { confirmed: false });
    const held = installLocks();                                                      // fresh lock table = the old tab is "gone"
    void held;
    const tab2 = await SaveStore.open();
    await tab2.acquireWriter();
    await expectCode(store.saveSlot('auto', game(), info), 'E_TAB');
  });

  it('S-15: no Web Locks -> E_CAPABILITY; the store is still readable', async () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    const ro = await SaveStore.open();
    await expectCode(ro.acquireWriter(), 'E_CAPABILITY');
    expect((await ro.readAll()).meta.writeRevision).toBeGreaterThanOrEqual(0);
    await expectCode(ro.saveSlot('auto', game(), info), 'E_TAB');
  });

  it('import rejects bad input without touching the store', async () => {
    expect(() => SaveStore.parseImport('not json')).toThrow();
    expect(() => SaveStore.parseImport('x'.repeat(1024 * 1024 + 1))).toThrow();
    const env = JSON.parse(await (async () => { await store.newGame('manual-1', game(), { runId: 'r' }, { confirmed: false }); return store.exportSlot('manual-1'); })());
    env.slot.game.progress.milestone = 'P05_DONE';                                    // contradicts the solved flags
    expect(() => SaveStore.parseImport(JSON.stringify(env))).toThrow(SaveError);
    env.slot.schemaVersion = 99;
    try { SaveStore.parseImport(JSON.stringify(env)); } catch (e) { expect((e as SaveError).code).toBe('E_VERSION'); }
  });
});
