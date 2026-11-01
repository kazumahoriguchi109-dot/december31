// Automatic dialogue scheduler. Pure: no DOM, no storage. Mirrors scripts/verify_dialogue_model.py
// (same guard grammar, same priority rule, same active/queue recovery) so the two can be compared on shared fixtures.
import eventsJson from '../../data/dialogue_events.json';
import rowsJson from '../../data/dialogue.json';
import { MILESTONES, milestoneIndex, type GameState } from './types';

export interface DialogueEvent { event: string; guard: string; priority: number; rowIds: string[] }
export interface DialogueRow { id: string; event: string; speaker: string; text: string; repeat: 'once' | 'on_request'; skipAllowed: boolean }

export const events: readonly DialogueEvent[] = [...(eventsJson as unknown as { events: DialogueEvent[] }).events]
  .sort((a, b) => a.priority - b.priority); // order comes from priority only, never from row ids
export const rows = (rowsJson as unknown as { rows: DialogueRow[] }).rows;
const rowById = new Map(rows.map((r) => [r.id, r]));
const eventByName = new Map(events.map((e) => [e.event, e]));
export const rowOf = (id: string): DialogueRow => {
  const r = rowById.get(id);
  if (!r) throw new Error(`unknown dialogue row ${id}`);
  return r;
};

/** Facts a guard may look at. `command` is set only for the one commit that carries an explicit command. */
export interface GuardCtx { milestone: string; anchor: string; gateLatched: boolean; command: string | null }
export const ctxOf = (g: GameState, command: string | null = null): GuardCtx =>
  ({ milestone: g.progress.milestone, anchor: g.player.anchor, gateLatched: g.puzzles.p03.gateLatched, command });

export type Guard = (c: GuardCtx) => boolean;

/** Allowlisted guard grammar; anything else throws. No eval, no Function. */
export function parseGuard(expr: string): Guard {
  if (expr === 'explicit practice_side command only') {
    return (c) => c.command === 'practice_side' && c.milestone === 'P03_DONE' && c.anchor === 'wall_base';
  }
  const atoms = expr.split(' AND ').map((atom): Guard => {
    const m = /^(milestone|player\.anchor|p03\.gateLatched) (==|>=|in) (\[[A-Za-z0-9_, ]+\]|[A-Za-z0-9_]+)$/.exec(atom);
    if (!m) throw new Error(`Unsupported guard syntax: ${atom}`);
    const [, field, op, rhs] = m as unknown as [string, string, string, string];
    const read = (c: GuardCtx): string | boolean =>
      field === 'milestone' ? c.milestone : field === 'player.anchor' ? c.anchor : c.gateLatched;
    if (op === 'in') {
      if (!(rhs.startsWith('[') && rhs.endsWith(']'))) throw new Error(`Invalid membership guard: ${atom}`);
      const values = rhs.slice(1, -1).split(',').map((x) => x.trim());
      return (c) => values.includes(String(read(c)));
    }
    if (op === '>=') {
      if (field !== 'milestone' || !(MILESTONES as readonly string[]).includes(rhs)) throw new Error(`Invalid ordered guard: ${atom}`);
      const min = milestoneIndex(rhs as (typeof MILESTONES)[number]);
      return (c) => milestoneIndex(c.milestone as (typeof MILESTONES)[number]) >= min;
    }
    const want = rhs === 'true' ? true : rhs === 'false' ? false : rhs;
    return (c) => read(c) === want;
  });
  return (c) => atoms.every((a) => a(c));
}

const compiled = new Map<string, Guard>();
const guardFor = (e: DialogueEvent): Guard => {
  let g = compiled.get(e.event);
  if (!g) { g = parseGuard(e.guard); compiled.set(e.event, g); }
  return g;
};

/** Throws on an inconsistent cursor (SAVE.md: queue must equal the unseen suffix of the active row's own event). */
export function checkCursor(d: GameState['dialogue']): string[] {
  const errs: string[] = [];
  if (d.activeId === null) { if (d.queue.length) errs.push('queue without active id'); return errs; }
  const row = rowById.get(d.activeId);
  if (!row) return [`unknown active id ${d.activeId}`];
  const ev = eventByName.get(row.event);
  if (!ev) return [`active row ${d.activeId} belongs to no automatic event`];
  if (d.seenIds.includes(d.activeId)) errs.push('active id already seen');
  const i = ev.rowIds.indexOf(d.activeId);
  const suffix = ev.rowIds.slice(i + 1).filter((x) => !d.seenIds.includes(x));
  if (JSON.stringify(d.queue) !== JSON.stringify(suffix)) errs.push('active queue does not match the event suffix');
  return errs;
}

/**
 * Picks the first event (by priority) whose guard holds and which still has unseen rows.
 * An existing active row is kept (resume); nothing is selected while one is active.
 */
export function normalize(g: GameState, command: string | null = null): boolean {
  const d = g.dialogue;
  if (d.activeId !== null) return false;
  const c = ctxOf(g, command);
  for (const e of events) {
    if (!guardFor(e)(c)) continue;
    const remaining = e.rowIds.filter((id) => !d.seenIds.includes(id));
    if (remaining.length) {
      d.activeId = remaining[0]!;
      d.queue = remaining.slice(1);
      d.lineIndex = 0;
      return true;
    }
  }
  return false;
}

/**
 * Acknowledge the current row (next) or the rest of its event (skip), then select the next event in the same commit.
 * Returns the ids marked seen. Skip never crosses an event boundary.
 */
export function acknowledge(g: GameState, skip = false): string[] {
  const d = g.dialogue;
  if (d.activeId === null) return [];
  const consumed = [d.activeId, ...(skip ? d.queue : [])];
  for (const id of consumed) if (!d.seenIds.includes(id)) d.seenIds.push(id);
  if (!skip && d.queue.length) { d.activeId = d.queue[0]!; d.queue = d.queue.slice(1); }
  else { d.activeId = null; d.queue = []; }
  d.lineIndex = 0;
  normalize(g);
  return consumed;
}

export const isActive = (g: GameState): boolean => g.dialogue.activeId !== null;
