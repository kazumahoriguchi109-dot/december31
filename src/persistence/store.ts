// IndexedDB save store (docs/SAVE.md). Domain code never touches this; the app layer calls it after a commit.
// Success is reported only on transaction.complete. Nothing here repairs or overwrites data it cannot read.
import type { GameState, SlotId } from '../domain/types';
import { classifySlot, checkEnvelope } from './semantic';
import {
  defaultSettings, MANUAL_IDS, SaveError, type ExportEnvelope, type MetaRecord, type QuarantineRecord,
  type SettingsRecord, type SlotRead, type SlotRecord,
} from './types';

const DB_NAME = 'december31';
const LOCK_NAME = 'december31-writer';
const STORES = ['slots', 'backups', 'settings', 'meta', 'quarantine'] as const;
type StoreName = (typeof STORES)[number];

const reqP = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export interface StoreHooks {
  /** Test seam: runs after every request of a transaction has been issued, before it can complete. */
  afterRequests?: (tx: IDBTransaction, label: string) => void;
  now?: () => Date;
}

export class SaveStore {
  private epoch = 0;
  private lockRelease: (() => void) | null = null;
  /** The revision this tab last read or wrote for each slot: the CAS expectation. */
  private expected = new Map<SlotId, number | null>();
  hooks: StoreHooks = {};
  /** Set when the browser asks this tab to let go of the database (another tab is upgrading it). */
  versionChanged = false;

  private constructor(private db: IDBDatabase) {
    db.onversionchange = () => { this.versionChanged = true; db.close(); };
  }

  /** Opens (and on first run creates) the database. Gives up after `timeoutMs` instead of loading forever. */
  static async open(timeoutMs = 10000): Promise<SaveStore> {
    if (typeof indexedDB === 'undefined') throw new SaveError('E_CAPABILITY', 'IndexedDB is not available');
    return new Promise<SaveStore>((resolve, reject) => {
      let settled = false;
      const done = (f: () => void) => { if (!settled) { settled = true; clearTimeout(timer); f(); } };
      const timer = setTimeout(() => done(() => reject(new SaveError('E_STORAGE', 'database open timed out (blocked)'))), timeoutMs);
      let req: IDBOpenDBRequest;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return done(() => reject(new SaveError('E_STORAGE', String(e)))); }
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); // out-of-line keys
        const meta: MetaRecord = { writeRevision: 0, writerEpoch: 0, lastPlayedSlotId: null };
        req.transaction!.objectStore('meta').put(meta, 'global');
      };
      req.onblocked = () => { /* wait for the timer: the other tab may close */ };
      req.onerror = () => done(() => reject(new SaveError('E_STORAGE', String(req.error))));
      req.onsuccess = () => done(() => resolve(new SaveStore(req.result)));
    });
  }

  close() { this.db.close(); this.lockRelease?.(); this.lockRelease = null; }

  // ---------------------------------------------------------------- writer lock
  /** Takes the single-writer lock for this tab's play session. Without it the tab is read-only. */
  async acquireWriter(): Promise<void> {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks || !isSecureContext) throw new SaveError('E_CAPABILITY', 'Web Locks / secure context unavailable');
    const got = await new Promise<boolean>((resolve) => {
      void locks.request(LOCK_NAME, { ifAvailable: true, mode: 'exclusive' }, (lock) => {
        if (!lock) { resolve(false); return undefined; }
        resolve(true);
        return new Promise<void>((release) => { this.lockRelease = release; }); // held until this session ends
      });
    });
    if (!got) throw new SaveError('E_TAB', 'another tab holds the writer lock');
    // new epoch: older tabs that somehow still hold a handle can no longer pass the epoch check
    await this.txn(['meta'], 'epoch', async (t) => {
      const meta = await this.getMeta(t);
      this.epoch = meta.writerEpoch + 1;
      t.objectStore('meta').put({ ...meta, writerEpoch: this.epoch }, 'global');
    });
  }
  get canWrite() { return this.epoch > 0; }

  // ---------------------------------------------------------------- transaction helper
  /** Runs `body` in one transaction. Resolves only on `complete`; rejects with the SaveError thrown or on abort/error. */
  private txn<T = void>(stores: StoreName[], label: string, body: (tx: IDBTransaction) => Promise<T>, write = true): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = this.db.transaction(stores, write ? 'readwrite' : 'readonly'); }
      catch (e) { return reject(new SaveError('E_STORAGE', `cannot open transaction: ${String(e)}`)); }
      let result: T; let failure: SaveError | null = null;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => {
        const err = tx.error;
        reject(failure ?? new SaveError(err?.name === 'QuotaExceededError' ? 'E_STORAGE' : 'E_STORAGE', `transaction aborted${err ? `: ${err.name}` : ''}`));
      };
      body(tx).then((r) => {
        result = r;
        try { this.hooks.afterRequests?.(tx, label); } catch { /* seam must not break the txn */ }
      }, (e) => {
        failure = e instanceof SaveError ? e : new SaveError('E_STORAGE', String(e));
        try { tx.abort(); } catch { /* already finished */ }
      });
    });
  }
  private async getMeta(tx: IDBTransaction): Promise<MetaRecord> {
    return (await reqP(tx.objectStore('meta').get('global'))) as MetaRecord;
  }
  private requireWriter(tx: IDBTransaction, meta: MetaRecord) {
    if (!this.canWrite) throw new SaveError('E_TAB', 'this tab is read-only');
    if (meta.writerEpoch !== this.epoch) throw new SaveError('E_TAB', 'writer epoch changed');
    void tx;
  }

  // ---------------------------------------------------------------- reads
  async readSlot(id: SlotId): Promise<SlotRead> {
    return this.txn(['slots'], 'read', async (t) => classifySlot(await reqP(t.objectStore('slots').get(id)), id), false);
  }
  async readBackup(id: SlotId): Promise<SlotRead> {
    return this.txn(['backups'], 'read-backup', async (t) => classifySlot(await reqP(t.objectStore('backups').get(id)), id), false);
  }
  async readAll(): Promise<{ meta: MetaRecord; slots: Record<SlotId, SlotRead>; quarantine: QuarantineRecord[] }> {
    return this.txn(['slots', 'meta', 'quarantine'], 'read-all', async (t) => {
      const meta = await this.getMeta(t);
      const slots = {} as Record<SlotId, SlotRead>;
      for (const id of ['auto', ...MANUAL_IDS] as SlotId[]) slots[id] = classifySlot(await reqP(t.objectStore('slots').get(id)), id);
      const quarantine = (await reqP(t.objectStore('quarantine').getAll())) as QuarantineRecord[];
      return { meta, slots, quarantine };
    }, false);
  }
  async meta(): Promise<MetaRecord> { return this.txn(['meta'], 'meta', (t) => this.getMeta(t), false); }
  /** True only for a brand-new database: nothing was ever written (SAVE.md "firstRunAllEmpty"). */
  async isFirstRun(): Promise<boolean> {
    return this.txn(['slots', 'backups', 'quarantine', 'meta'], 'first-run', async (t) => {
      const meta = await this.getMeta(t);
      const n = async (s: string) => (await reqP(t.objectStore(s).count()));
      return meta.writeRevision === 0 && (await n('slots')) === 0 && (await n('backups')) === 0 && (await n('quarantine')) === 0;
    }, false);
  }
  async getSettings(): Promise<SettingsRecord> {
    return this.txn(['settings'], 'settings', async (t) => {
      const s = (await reqP(t.objectStore('settings').get('global'))) as SettingsRecord | undefined;
      return s ?? defaultSettings();
    }, false);
  }

  // ---------------------------------------------------------------- writes
  private now() { return (this.hooks.now?.() ?? new Date()).toISOString(); }

  private build(slotId: SlotId, game: GameState, base: { runId: string; createdAt: string; playTimeMs: number }, revision: number): SlotRecord {
    const g = structuredClone(game);
    return { schemaVersion: 1, contentVersion: '1.0', slotId, runId: base.runId, revision, createdAt: base.createdAt, updatedAt: this.now(), playTimeMs: base.playTimeMs, game: g };
  }
  private assertValid(rec: SlotRecord) {
    const errs = checkEnvelope({ format: 'december31-save', exportedAt: this.now(), unsaved: false, slot: rec, settings: defaultSettings() });
    if (errs.length) throw new SaveError('E_CORRUPT', `refusing to write an invalid slot: ${errs.join('; ')}`);
  }

  /**
   * Normal save of one slot (autosave to `auto`, Save to a manual). CAS against the revision this tab last saw.
   * The previous valid slot becomes its one-generation backup in the same transaction.
   */
  async saveSlot(slotId: SlotId, game: GameState, info: { runId: string; createdAt: string; playTimeMs: number }, opts: { lastPlayed?: SlotId | null } = {}): Promise<SlotRecord> {
    let written!: SlotRecord;
    await this.txn(['slots', 'backups', 'meta'], `save:${slotId}`, async (t) => {
      const meta = await this.getMeta(t);
      this.requireWriter(t, meta);
      const curRaw = await reqP(t.objectStore('slots').get(slotId));
      const cur = classifySlot(curRaw, slotId);
      if (cur.status === 'future') throw new SaveError('E_VERSION', `${slotId} was written by a newer version`);
      const have = cur.status === 'empty' ? null : (curRaw as SlotRecord).revision;
      const exp = this.expected.has(slotId) ? this.expected.get(slotId)! : null;
      if (cur.status === 'corrupt') throw new SaveError('E_CORRUPT', `${slotId} is unreadable; use the recovery flow`);
      if (have !== exp) throw new SaveError('E_CONFLICT', `${slotId} revision is ${have}, expected ${exp}`);
      const R = meta.writeRevision + 1;
      const rec = this.build(slotId, game, info, R);
      this.assertValid(rec);
      if (cur.status === 'ok') t.objectStore('backups').put(curRaw, slotId);
      t.objectStore('slots').put(rec, slotId);
      t.objectStore('meta').put({ ...meta, writeRevision: R, lastPlayedSlotId: opts.lastPlayed === undefined ? slotId : opts.lastPlayed }, 'global');
      written = rec;
    });
    this.expected.set(slotId, written.revision);
    return written;
  }

  // ---------------------------------------------------------------- New / Load
  /** Reads a slot and makes what was read the CAS baseline for the next normal save (used right before an overwrite confirmation). */
  async observe(slotId: SlotId): Promise<SlotRead> {
    const r = await this.readSlot(slotId);
    this.expected.set(slotId, r.status === 'ok' ? r.slot.revision : r.status === 'empty' ? null : (this.expected.get(slotId) ?? null));
    return r;
  }

  /** Adopt a slot as this tab's CAS baseline (after a successful Load). */
  private adopt(slot: SlotRecord) { this.expected.set(slot.slotId, slot.revision); }

  /**
   * Start a new run: selected manual and auto get the same initial state in one transaction, same revision.
   * Existing data is never overwritten without `confirmed`; a corrupt auto is quarantined first (T02); a future/corrupt
   * target manual is refused outright.
   */
  async newGame(manual: SlotId, game: GameState, info: { runId: string }, opts: { confirmed: boolean }): Promise<{ manual: SlotRecord; auto: SlotRecord }> {
    if (!MANUAL_IDS.includes(manual)) throw new SaveError('E_CORRUPT', 'new game needs a manual slot');
    const first = await this.isFirstRun();
    let out!: { manual: SlotRecord; auto: SlotRecord };
    await this.txn(['slots', 'backups', 'quarantine', 'meta'], 'new', async (t) => {
      const meta = await this.getMeta(t);
      this.requireWriter(t, meta);
      const st = t.objectStore('slots');
      const rawM = await reqP(st.get(manual)); const rawA = await reqP(st.get('auto'));
      const m = classifySlot(rawM, manual); const a = classifySlot(rawA, 'auto');
      if (a.status === 'future') throw new SaveError('E_VERSION', 'auto was written by a newer version');
      if (m.status === 'future') throw new SaveError('E_VERSION', `${manual} was written by a newer version`);
      if (m.status === 'corrupt') throw new SaveError('E_CORRUPT', `${manual} is unreadable and is not overwritten by New`);
      if (!first && !opts.confirmed) throw new SaveError('E_CONFLICT', 'confirmation required', { needsConfirm: true });
      const R = meta.writeRevision + 1;
      const createdAt = this.now();
      const mk = (id: SlotId): SlotRecord => {
        const g = structuredClone(game); g.progress.activeManualSlot = manual;
        const r: SlotRecord = { schemaVersion: 1, contentVersion: '1.0', slotId: id, runId: info.runId, revision: R, createdAt, updatedAt: createdAt, playTimeMs: 0, game: g };
        this.assertValid(r); return r;
      };
      if (a.status === 'corrupt') await this.quarantineAuto(t, rawA, R);
      else if (a.status === 'ok') t.objectStore('backups').put(rawA, 'auto');
      if (m.status === 'ok') t.objectStore('backups').put(rawM, manual);
      out = { manual: mk(manual), auto: mk('auto') };
      st.put(out.manual, manual); st.put(out.auto, 'auto');
      t.objectStore('meta').put({ ...meta, writeRevision: R, lastPlayedSlotId: 'auto' }, 'global');
    });
    this.adopt(out.manual); this.adopt(out.auto);
    return out;
  }

  /** Non-destructive archive of an unreadable auto (and its backup) into the append-only quarantine store. */
  private async quarantineAuto(t: IDBTransaction, rawAuto: unknown, R: number) {
    const rawBackup = await reqP(t.objectStore('backups').get('auto'));
    const rec: QuarantineRecord = {
      archiveKey: `auto/${this.epoch}/${R}`, sourceSlotId: 'auto', archivedAt: this.now(), archiveRevision: R,
      rawAuto, backupPresent: rawBackup !== undefined, rawBackup: rawBackup ?? null,
    };
    t.objectStore('quarantine').add(rec, rec.archiveKey); // add, not put: never replaces an earlier archive
    t.objectStore('backups').delete('auto'); // its content now lives in the archive
  }

  /**
   * Explicit Load. Returns the validated slot; the caller swaps it in. Only meta.lastPlayedSlotId changes in the
   * store, except that a corrupt auto is archived and re-created from the loaded state so the next autosave can pass CAS.
   */
  async load(slotId: SlotId, opts: { rebuildAutoConfirmed?: boolean } = {}): Promise<{ slot: SlotRecord; autoRebuilt: boolean }> {
    const all = await this.readAll();
    const target = all.slots[slotId];
    if (target.status === 'empty') throw new SaveError('E_CORRUPT', `${slotId} is empty`);
    if (target.status === 'future') throw new SaveError('E_VERSION', `${slotId} was written by a newer version`);
    if (target.status === 'corrupt') throw new SaveError('E_CORRUPT', `${slotId} is unreadable`, target.reasons);
    const auto = all.slots.auto;
    if (auto.status === 'future') throw new SaveError('E_VERSION', 'auto was written by a newer version');
    let rebuilt = false;
    if (slotId !== 'auto' && auto.status === 'corrupt') {
      if (!opts.rebuildAutoConfirmed) throw new SaveError('E_CONFLICT', 'confirmation required', { needsConfirm: 'rebuild-auto' });
      await this.rebuildAuto(target.slot);
      rebuilt = true;
    } else if (this.canWrite) {
      await this.txn(['meta'], 'load-meta', async (t) => {
        const meta = await this.getMeta(t); this.requireWriter(t, meta);
        t.objectStore('meta').put({ ...meta, lastPlayedSlotId: slotId }, 'global');
      });
    }
    this.adopt(target.slot);
    if (!rebuilt) this.expected.set('auto', auto.status === 'ok' ? auto.slot.revision : null);
    return { slot: target.slot, autoRebuilt: rebuilt };
  }

  /** Archive the unreadable auto and write a fresh valid auto from `source`, one transaction. */
  async rebuildAuto(source: SlotRecord): Promise<SlotRecord> {
    let fresh!: SlotRecord;
    await this.txn(['slots', 'backups', 'quarantine', 'meta'], 'rebuild-auto', async (t) => {
      const meta = await this.getMeta(t); this.requireWriter(t, meta);
      const rawA = await reqP(t.objectStore('slots').get('auto'));
      const a = classifySlot(rawA, 'auto');
      if (a.status === 'future') throw new SaveError('E_VERSION', 'auto was written by a newer version');
      if (a.status !== 'corrupt') throw new SaveError('E_CONFLICT', 'auto is no longer corrupt');
      const R = meta.writeRevision + 1;
      await this.quarantineAuto(t, rawA, R);
      fresh = { ...structuredClone(source), slotId: 'auto', revision: R, updatedAt: this.now() };
      this.assertValid(fresh);
      t.objectStore('slots').put(fresh, 'auto');
      t.objectStore('meta').put({ ...meta, writeRevision: R, lastPlayedSlotId: meta.lastPlayedSlotId === 'auto' ? null : meta.lastPlayedSlotId }, 'global');
    });
    this.expected.set('auto', fresh.revision);
    return fresh;
  }

  // ---------------------------------------------------------------- Export / Import / Restore
  async exportSlot(slotId: SlotId, unsavedGame?: { game: GameState; runId: string; createdAt: string; playTimeMs: number }): Promise<string> {
    const settings = await this.getSettings();
    let env: ExportEnvelope;
    if (unsavedGame) {
      const slot: SlotRecord = { schemaVersion: 1, contentVersion: '1.0', slotId, runId: unsavedGame.runId, revision: 0, createdAt: unsavedGame.createdAt, updatedAt: this.now(), playTimeMs: unsavedGame.playTimeMs, game: structuredClone(unsavedGame.game) };
      env = { format: 'december31-save', exportedAt: this.now(), unsaved: true, slot, settings };
    } else {
      const r = await this.readSlot(slotId);
      if (r.status !== 'ok') throw new SaveError(r.status === 'future' ? 'E_VERSION' : 'E_CORRUPT', `${slotId} cannot be exported as a save`);
      env = { format: 'december31-save', exportedAt: this.now(), unsaved: false, slot: r.slot, settings };
    }
    return JSON.stringify(env, null, 2);
  }
  /** Raw export of anything stored (including unreadable data) so nothing is ever trapped. */
  async exportRaw(slotId: SlotId, which: 'slot' | 'backup' = 'slot'): Promise<string> {
    const raw = await this.txn([which === 'slot' ? 'slots' : 'backups'], 'raw', (t) => reqP(t.objectStore(which === 'slot' ? 'slots' : 'backups').get(slotId)), false);
    if (raw === undefined) throw new SaveError('E_CORRUPT', 'nothing stored');
    return JSON.stringify({ format: 'december31-raw', slotId, which, raw }, null, 2);
  }

  /** Parse + validate an import file without touching anything. Returns the envelope or throws a SaveError. */
  static parseImport(text: string): ExportEnvelope {
    if (text.length > 1024 * 1024) throw new SaveError('E_CORRUPT', 'file is larger than 1 MiB');
    let env: unknown;
    try { env = JSON.parse(text); } catch { throw new SaveError('E_CORRUPT', 'not valid JSON'); }
    const v = (env as { slot?: { schemaVersion?: unknown } } | null)?.slot?.schemaVersion;
    if (typeof v === 'number' && v > 1) throw new SaveError('E_VERSION', 'save from a newer version');
    const errs = checkEnvelope(env);
    if (errs.length) throw new SaveError('E_CORRUPT', 'save file failed validation', errs);
    return env as ExportEnvelope;
  }

  /** Import into a chosen manual slot. The current game and its bindings are not touched (R2-T01). */
  async importInto(manual: SlotId, env: ExportEnvelope, opts: { confirmedOverwrite: boolean }): Promise<SlotRecord> {
    if (!MANUAL_IDS.includes(manual)) throw new SaveError('E_CORRUPT', 'import needs a manual slot');
    let out!: SlotRecord;
    await this.txn(['slots', 'backups', 'meta'], 'import', async (t) => {
      const meta = await this.getMeta(t); this.requireWriter(t, meta);
      const rawM = await reqP(t.objectStore('slots').get(manual));
      const m = classifySlot(rawM, manual);
      if (m.status === 'future') throw new SaveError('E_VERSION', `${manual} was written by a newer version`);
      if (m.status === 'corrupt') throw new SaveError('E_CORRUPT', `${manual} is unreadable and is not overwritten by import`);
      if (m.status === 'ok' && !opts.confirmedOverwrite) throw new SaveError('E_CONFLICT', 'confirmation required', { needsConfirm: true });
      const R = meta.writeRevision + 1; // continues from the DB-wide counter, never from the file's own revision
      const game = structuredClone(env.slot.game); game.progress.activeManualSlot = manual;
      out = { ...structuredClone(env.slot), slotId: manual, revision: R, updatedAt: this.now(), game };
      this.assertValid(out);
      if (m.status === 'ok') t.objectStore('backups').put(rawM, manual);
      t.objectStore('slots').put(out, manual);
      t.objectStore('meta').put({ ...meta, writeRevision: R }, 'global'); // lastPlayedSlotId unchanged
    });
    this.expected.set(manual, out.revision);
    return out;
  }

  /** Restore a valid one-generation backup into a different, empty manual slot. Source and current game stay as they are. */
  async restoreBackup(from: SlotId, toEmptyManual: SlotId): Promise<SlotRecord> {
    if (!MANUAL_IDS.includes(toEmptyManual) || toEmptyManual === from) throw new SaveError('E_CORRUPT', 'restore target must be another manual slot');
    let out!: SlotRecord;
    await this.txn(['slots', 'backups', 'meta'], 'restore', async (t) => {
      const meta = await this.getMeta(t); this.requireWriter(t, meta);
      const b = classifySlot(await reqP(t.objectStore('backups').get(from)), from);
      if (b.status !== 'ok') throw new SaveError(b.status === 'future' ? 'E_VERSION' : 'E_CORRUPT', 'no valid backup to restore');
      const target = await reqP(t.objectStore('slots').get(toEmptyManual));
      if (target !== undefined) throw new SaveError('E_CONFLICT', 'restore target is not empty');
      const R = meta.writeRevision + 1;
      const game = structuredClone(b.slot.game); game.progress.activeManualSlot = toEmptyManual;
      out = { ...structuredClone(b.slot), slotId: toEmptyManual, revision: R, updatedAt: this.now(), game };
      this.assertValid(out);
      t.objectStore('slots').put(out, toEmptyManual);
      t.objectStore('meta').put({ ...meta, writeRevision: R }, 'global');
    });
    this.expected.set(toEmptyManual, out.revision);
    return out;
  }

  /** Explicit deletion of one manual slot (used by the "make room" recovery step, after export + confirmation). */
  async deleteManual(manual: SlotId): Promise<void> {
    if (!MANUAL_IDS.includes(manual)) throw new SaveError('E_CORRUPT', 'only manual slots can be deleted');
    await this.txn(['slots', 'meta'], 'delete', async (t) => {
      const meta = await this.getMeta(t); this.requireWriter(t, meta);
      t.objectStore('slots').delete(manual);
      t.objectStore('meta').put({ ...meta, lastPlayedSlotId: meta.lastPlayedSlotId === manual ? null : meta.lastPlayedSlotId }, 'global');
    });
    this.expected.set(manual, null);
  }

  async putSettings(next: Omit<SettingsRecord, 'settingsRevision'>): Promise<SettingsRecord> {
    let out!: SettingsRecord;
    await this.txn(['settings', 'meta'], 'settings-put', async (t) => {
      const meta = await this.getMeta(t); this.requireWriter(t, meta);
      const cur = ((await reqP(t.objectStore('settings').get('global'))) as SettingsRecord | undefined) ?? defaultSettings();
      out = { ...next, settingsRevision: cur.settingsRevision + 1 };
      t.objectStore('settings').put(out, 'global');
    });
    return out;
  }
}
