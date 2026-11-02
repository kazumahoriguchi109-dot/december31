import type { GameState } from '../domain/types';
import { SaveError, type SlotRecord } from '../persistence/types';
import type { SaveStore } from '../persistence/store';
import { diag } from './diag';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'slow' | 'stuck' | 'failed' | 'halted';
export interface RunInfo { runId: string; createdAt: string; playTimeMs: () => number }

/**
 * Serial autosave writer (SAVE.md): commits are coalesced for 250 ms, a chapter boundary writes at once, only one write is
 * ever in flight, and a failure never stops the game in memory. Errors that mean "this tab must not write" halt it.
 */
export class AutoSaver {
  status: SaveStatus = 'idle';
  lastError: SaveError | null = null;
  generation = 0;
  private pending: GameState | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private stuckTimer: ReturnType<typeof setTimeout> | null = null;
  halted = false;
  onStatus: (s: SaveStatus, e: SaveError | null) => void = () => {};
  saves = 0;

  constructor(private store: SaveStore, private info: () => RunInfo, private debounceMs = 250) {}

  private set(s: SaveStatus, e: SaveError | null = null) { this.status = s; this.lastError = e; this.onStatus(s, e); }

  /** Queue the committed state. `now` skips the debounce (chapter boundary). */
  schedule(game: GameState, now = false) {
    if (this.halted) { diag('sched-halted'); return; }
    this.pending = structuredClone(game);
    diag('sched', `${now ? 'now' : 'debounce'} status=${this.status} inFlight=${this.inFlight ? 1 : 0}`);
    if (this.timer) clearTimeout(this.timer);
    const armed = performance.now();
    if (now) { this.timer = null; void this.pump(); } else this.timer = setTimeout(() => { this.timer = null; diag('timer', `lag=${Math.round(performance.now() - armed - this.debounceMs)}ms`); void this.pump(); }, this.debounceMs);
    if (this.status !== 'saving' && this.status !== 'slow' && this.status !== 'stuck') this.set('saving');
  }

  /** Drop anything queued from before a Load/New (stale generation) and allow writing again. */
  reset() {
    this.generation++;
    this.pending = null;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.halted = false;
    this.set('idle');
  }

  /** Waits for the write in flight and for anything queued: used before manual save / pause barriers. */
  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; void this.pump(); }
    while (this.inFlight) await this.inFlight;
  }

  private pump(): Promise<void> {
    if (this.inFlight) { diag('pump-joins-inflight'); return this.inFlight; }
    diag('pump-start');
    this.inFlight = (async () => {
      try {
        while (this.pending && !this.halted) {
          const snap = this.pending; this.pending = null;
          const gen = this.generation;
          const t0 = performance.now();
          diag('write-begin');
          this.set('saving');
          this.slowTimer = setTimeout(() => this.set('slow'), 5000);
          this.stuckTimer = setTimeout(() => this.set('stuck'), 10000);
          try {
            const i = this.info();
            const rec: SlotRecord = await this.store.saveSlot('auto', snap, { runId: i.runId, createdAt: i.createdAt, playTimeMs: i.playTimeMs() }, { lastPlayed: 'auto' });
            diag('write-done', `${Math.round(performance.now() - t0)}ms`);
            if (gen !== this.generation) { diag('stale'); continue; } // a Load/New happened meanwhile; this result is stale
            this.saves++;
            void rec;
            if (!this.pending) this.set('saved');
          } catch (e) {
            const err = e instanceof SaveError ? e : new SaveError('E_STORAGE', String(e));
            diag('write-failed', `${err.code} ${Math.round(performance.now() - t0)}ms`);
            if (gen !== this.generation) { diag('stale-failure'); continue; } // the failed write belonged to a run that was replaced by Load/New: it says nothing about the new one
            // E_STORAGE: keep playing in memory, try again on the next commit. Everything else: this tab must stop writing.
            if (err.code !== 'E_STORAGE') this.halted = true;
            this.set(this.halted ? 'halted' : 'failed', err);
          } finally {
            if (this.slowTimer) clearTimeout(this.slowTimer);
            if (this.stuckTimer) clearTimeout(this.stuckTimer);
          }
        }
      } finally { this.inFlight = null; diag('pump-end', `pending=${this.pending ? 1 : 0}`); }
    })();
    return this.inFlight;
  }
}
