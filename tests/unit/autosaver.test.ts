import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoSaver } from '../../src/app/autosaver';
import { SaveStore } from '../../src/persistence/store';
import type { GameState } from '../../src/domain/types';
import fx from '../fixtures/starts/m1a_p04.json';

const game = () => structuredClone(fx.slot.game) as unknown as GameState;
let store: SaveStore;
const info = () => ({ runId: 'r', createdAt: '2026-11-01T00:00:00.000Z', playTimeMs: () => 0 });

beforeEach(async () => {
  (globalThis as any).indexedDB = new IDBFactory();
  (globalThis as any).isSecureContext = true;
  const held = new Set<string>();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: async (n: string, _o: unknown, cb: (l: unknown) => unknown) => { if (held.has(n)) return cb(null); held.add(n); return cb({}); } } } });
  store = await SaveStore.open(); await store.acquireWriter();
  await store.newGame('manual-1', game(), { runId: 'r' }, { confirmed: false });
});

describe('AutoSaver', () => {
  it('coalesces rapid commits into one write after the debounce', async () => {
    const a = new AutoSaver(store, info, 20);
    for (let i = 0; i < 5; i++) a.schedule(game());
    await new Promise((r) => setTimeout(r, 80)); await a.flush();
    expect(a.saves).toBe(1); expect(a.status).toBe('saved');
  });
  it('a chapter boundary writes at once, without waiting for the debounce', async () => {
    const a = new AutoSaver(store, info, 10_000);
    a.schedule(game(), true); await a.flush();
    expect(a.saves).toBe(1);
  });
  it('E_STORAGE keeps the tab writing later; the next commit succeeds', async () => {
    const a = new AutoSaver(store, info, 0);
    store.hooks.afterRequests = (tx, l) => { if (l === 'save:auto') tx.abort(); };
    a.schedule(game(), true); await a.flush();
    expect(a.status).toBe('failed'); expect(a.halted).toBe(false);
    store.hooks.afterRequests = undefined;
    a.schedule(game(), true); await a.flush();
    expect(a.status).toBe('saved');
  });
  it('a conflict halts the writer instead of overwriting (no retry)', async () => {
    const a = new AutoSaver(store, info, 0);
    a.schedule(game(), true); await a.flush();
    // someone else bumps auto: simulate with another store instance writing through the same DB
    const other = await SaveStore.open(); // read-only handle: use raw put to change the revision
    void other;
    const db = await new Promise<IDBDatabase>((res) => { const r = indexedDB.open('december31'); r.onsuccess = () => res(r.result); });
    const cur: any = await new Promise((res) => { const g = db.transaction('slots').objectStore('slots').get('auto'); g.onsuccess = () => res(g.result); });
    await new Promise<void>((res) => { const t = db.transaction('slots', 'readwrite'); t.objectStore('slots').put({ ...cur, revision: cur.revision + 10 }, 'auto'); t.oncomplete = () => res(); });
    db.close();
    a.schedule(game(), true); await a.flush();
    expect(a.halted).toBe(true); expect(a.lastError?.code).toBe('E_CONFLICT');
    const before = a.saves;
    a.schedule(game(), true); await a.flush();
    expect(a.saves).toBe(before);
  });
  it('reset() drops a queued snapshot from before a Load', async () => {
    const a = new AutoSaver(store, info, 10_000);
    a.schedule(game()); a.reset(); await a.flush();
    expect(a.saves).toBe(0);
  });
  it('reports a slow write after 5 s and an unfinished one after 10 s', async () => {
    vi.useFakeTimers();
    try {
      const a = new AutoSaver(store, info, 0);
      const seen: string[] = []; a.onStatus = (s) => seen.push(s);
      const orig = store.saveSlot.bind(store);
      store.saveSlot = (() => new Promise(() => {})) as never; // never completes
      a.schedule(game(), true);
      await vi.advanceTimersByTimeAsync(5100); expect(seen).toContain('slow');
      await vi.advanceTimersByTimeAsync(5100); expect(seen).toContain('stuck');
      store.saveSlot = orig;
    } finally { vi.useRealTimers(); }
  });
});
