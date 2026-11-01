import type { Anchor, GameState, View } from './types';
import { anchorDef, copy } from '../content/load';
import { checkMove, defaultViewFor } from './movement';

export type Command =
  | { type: 'start_rpg' }
  | { type: 'view'; view: View }
  | { type: 'p01_rotate'; dir: 'right' | 'left' }
  | { type: 'p01_reset' }
  | { type: 'p02_drain' }
  | { type: 'p02_stopper' }
  | { type: 'p02_reset' }
  | { type: 'p03_wait' }
  | { type: 'p03_latch' }
  | { type: 'p03_call' }
  | { type: 'p03_reset' }
  | { type: 'p06_wait' }
  | { type: 'p06_call' }
  | { type: 'p06_reset' }
  | { type: 'return_home' }
  | { type: 'hint_more' }
  | { type: 'move'; to: Anchor }
  | { type: 'p04_inspect' }
  | { type: 'p04_reset' }
  | { type: 'p05_set'; piece: 'a' | 'b'; pos: 0 | 1 | 2 }
  | { type: 'p05_reset' };

export type GameEvent =
  | { type: 'moved'; from: Anchor; to: Anchor }
  | { type: 'view_changed'; view: View }
  | { type: 'p01_changed' }
  | { type: 'p01_solved' }
  | { type: 'p02_changed' }
  | { type: 'p02_solved' }
  | { type: 'p03_latched' }
  | { type: 'p03_solved' }
  | { type: 'toto_changed' }
  | { type: 'p06_solved' }
  | { type: 'ending' }
  | { type: 'hint_changed' }
  | { type: 'p04_side_seen' }
  | { type: 'p04_solved' }
  | { type: 'p05_changed' }
  | { type: 'p05_solved' }
  | { type: 'message'; text: string };

export type Result =
  | { ok: true; state: GameState; events: GameEvent[]; changed: boolean }
  | { ok: false; reason: string };

const fail = (reason: string): Result => ({ ok: false, reason });

/**
 * P03 merges on every accepted command, not only on the call (PUZZLES P03): player at gate_far, gate latched, Toto following.
 * Returns true when this call solved it.
 */
function evaluateP03(s: GameState, ev: GameEvent[]): void {
  const p = s.puzzles.p03;
  if (s.progress.milestone !== 'P02_DONE' || p.solved) return;
  if (s.player.anchor === 'gate_far' && p.gateLatched && s.toto.mode === 'follow') {
    p.solved = true;
    s.progress.milestone = 'P03_DONE';
    ev.push({ type: 'p03_solved' });
  }
}

const atPortal = (s: GameState) => s.player.anchor === 'portal_front' || s.player.anchor === 'portal_back';

/**
 * P06 opens when the two plates are held at once: Toto waits on one side and the player stands on the other.
 * Evaluated after every accepted command; the occupancy itself is derived and never stored.
 */
function evaluateP06(s: GameState, ev: GameEvent[]): void {
  const p = s.puzzles.p06;
  if (s.progress.milestone !== 'P05_DONE' || p.solved) return;
  const t = s.toto;
  const heldBoth = t.mode === 'wait' && ((t.anchor === 'p06_front' && s.player.anchor === 'portal_back') || (t.anchor === 'p06_back' && s.player.anchor === 'portal_front'));
  if (heldBoth) {
    p.portalLatched = true;
    p.solved = true;
    s.progress.milestone = 'RETURN_OPEN';
    ev.push({ type: 'p06_solved' });
  }
}

/** Puzzle whose hints apply at this milestone (hints are opened by the player, never automatically). */
export const hintKeyFor = (m: GameState['progress']['milestone']): keyof GameState['hints'] | null => ({
  ARRIVAL: 'P01', P01_DONE: 'P02', P02_DONE: 'P03', P03_DONE: 'P04', P04_DONE: 'P05', P05_DONE: 'P06', RETURN_OPEN: 'P06',
} as const)[m as 'ARRIVAL'] ?? null;

/** Pure reducer: validates preconditions, returns the next state; never mutates `prev`. */
export function reduce(prev: GameState, cmd: Command): Result {
  const r = reduceInner(prev, cmd);
  if (r.ok) { evaluateP03(r.state, r.events); evaluateP06(r.state, r.events); }
  return r;
}

function reduceInner(prev: GameState, cmd: Command): Result {
  const s: GameState = structuredClone(prev);
  const ev: GameEvent[] = [];
  const done = (changed = true): Result => ({ ok: true, state: s, events: ev, changed });
  const { milestone } = s.progress;

  switch (cmd.type) {
    case 'start_rpg': {
      if (milestone !== 'ROOM' || s.player.anchor !== 'room') return fail(copy('locked_generic'));
      s.progress.milestone = 'ARRIVAL';
      s.player.anchor = 'arrival';
      s.player.view = 'front';
      ev.push({ type: 'moved', from: 'room', to: 'arrival' });
      return done();
    }
    case 'p01_rotate': {
      const p = s.puzzles.p01;
      if (s.player.anchor !== 'p01_panel' || milestone !== 'ARRIVAL' || p.solved) return fail(copy('locked_generic'));
      p.rotation = (p.rotation + (cmd.dir === 'right' ? 1 : 3)) % 4;
      ev.push({ type: 'p01_changed' });
      if (p.rotation === 1) { // the verdict is part of the accepted command; the animation only shows it
        p.solved = true;
        s.progress.milestone = 'P01_DONE';
        ev.push({ type: 'p01_solved' });
      } else ev.push({ type: 'message', text: copy('p01_not_connected') });
      return done();
    }
    case 'p01_reset': {
      if (s.puzzles.p01.solved || s.player.anchor !== 'p01_panel' || milestone !== 'ARRIVAL') return fail(copy('locked_generic'));
      s.puzzles.p01.rotation = 0;
      return done();
    }
    case 'p02_drain': case 'p02_stopper': {
      const p = s.puzzles.p02;
      if (s.player.anchor !== 'mill' || milestone !== 'P01_DONE' || p.solved) return fail(copy('locked_generic'));
      if (cmd.type === 'p02_drain') p.drain = p.drain === 'open' ? 'closed' : 'open';
      else p.stopper = p.stopper === 'locked' ? 'released' : 'locked';
      ev.push({ type: 'p02_changed' });
      if (p.drain === 'closed' && p.stopper === 'released') {
        p.solved = true;
        s.progress.milestone = 'P02_DONE';
        ev.push({ type: 'p02_solved' });
      }
      return done();
    }
    case 'p02_reset': {
      if (s.puzzles.p02.solved || s.player.anchor !== 'mill' || milestone !== 'P01_DONE') return fail(copy('locked_generic'));
      s.puzzles.p02 = { drain: 'open', stopper: 'locked', solved: false };
      return done();
    }
    case 'hint_more': {
      const k = hintKeyFor(milestone);
      if (!k || s.hints[k] >= 3) return fail(copy('locked_generic'));
      s.hints[k] += 1;
      ev.push({ type: 'hint_changed' });
      return done();
    }
    case 'p06_wait': {
      if ((milestone !== 'P05_DONE' && milestone !== 'RETURN_OPEN') || !atPortal(s) || s.toto.mode !== 'follow') return fail(copy('locked_generic'));
      s.toto = { mode: 'wait', anchor: s.player.anchor === 'portal_front' ? 'p06_front' : 'p06_back' };
      ev.push({ type: 'toto_changed' });
      return done();
    }
    case 'p06_call': {
      if (!['p06_front', 'p06_back'].includes(s.toto.anchor) || !atPortal(s)) return fail(copy('locked_generic'));
      s.toto = { mode: 'follow', anchor: 'party' };
      ev.push({ type: 'toto_changed' });
      return done();
    }
    case 'p06_reset': {
      if (milestone !== 'P05_DONE' || !atPortal(s)) return fail(copy('locked_generic')); // only while unsolved
      s.toto = { mode: 'follow', anchor: 'party' };
      s.player.anchor = 'portal_front';
      s.player.view = 'portal_front';
      return done();
    }
    case 'return_home': {
      if (milestone !== 'RETURN_OPEN' || !atPortal(s) || s.toto.mode !== 'follow') return fail(copy('locked_generic')); // never alone
      s.progress.milestone = 'ENDING';
      s.player.anchor = 'home';
      s.player.view = 'front';
      ev.push({ type: 'ending' }, { type: 'moved', from: 'portal_front', to: 'home' });
      return done();
    }
    case 'p03_wait': {
      if (milestone !== 'P02_DONE' || s.player.anchor !== 'gate_near' || s.toto.mode !== 'follow' || s.puzzles.p03.gateLatched) return fail(copy('locked_generic'));
      s.toto = { mode: 'wait', anchor: 'p03_plate' };
      ev.push({ type: 'toto_changed' });
      return done();
    }
    case 'p03_latch': {
      const p = s.puzzles.p03;
      if (milestone !== 'P02_DONE' || s.player.anchor !== 'gate_far' || p.gateLatched) return fail(copy('locked_generic'));
      p.gateLatched = true;
      ev.push({ type: 'p03_latched' });
      return done();
    }
    case 'p03_call': {
      if (milestone !== 'P02_DONE' || s.toto.anchor !== 'p03_plate') return fail(copy('locked_generic'));
      if (s.player.anchor === 'gate_far' && !s.puzzles.p03.gateLatched) return fail(copy('p03_call_unlatched_far')); // state untouched
      s.toto = { mode: 'follow', anchor: 'party' };
      ev.push({ type: 'toto_changed' });
      return done();
    }
    case 'p03_reset': {
      const p = s.puzzles.p03;
      if (milestone !== 'P02_DONE' || p.gateLatched || !['gate_near', 'gate_far'].includes(s.player.anchor)) return fail(copy('locked_generic'));
      s.toto = { mode: 'follow', anchor: 'party' };
      p.crossed = false;
      s.player.anchor = 'gate_near';
      s.player.view = 'front';
      return done();
    }
    case 'view': {
      const def = anchorDef(s.player.anchor);
      if (!def.allowedViews.includes(cmd.view)) return fail(copy('locked_generic'));
      if (cmd.view === 'observe' && milestone !== 'P04_DONE') return fail(copy('locked_generic'));
      if (s.player.view === cmd.view) return done(false);
      s.player.view = cmd.view;
      ev.push({ type: 'view_changed', view: cmd.view });
      // P04: the first side view at the wall records the observation (the only view-driven progress).
      if (cmd.view === 'wall_side' && s.player.anchor === 'wall_base' && milestone === 'P03_DONE' && !s.puzzles.p04.sideSeen) {
        s.puzzles.p04.sideSeen = true;
        ev.push({ type: 'p04_side_seen' });
      }
      return done();
    }
    case 'move': {
      const chk = checkMove(s, cmd.to);
      if (!chk.ok) return fail(chk.reason);
      const from = s.player.anchor;
      const allowed = anchorDef(cmd.to).allowedViews;
      s.player.anchor = cmd.to;
      if (cmd.to === 'gate_far') s.puzzles.p03.crossed = true;
      s.player.view = (allowed.includes(s.player.view) ? s.player.view : defaultViewFor(cmd.to)) as View;
      ev.push({ type: 'moved', from, to: cmd.to });
      return done();
    }
    case 'p04_inspect': {
      if (s.player.anchor !== 'wall_base' || milestone !== 'P03_DONE') return fail(copy('locked_generic'));
      if (!s.puzzles.p04.sideSeen) {
        ev.push({ type: 'message', text: copy('p04_front_observation') });
        return done(false);
      }
      // Recognition and the automatic climb are one accepted command; the label only changes afterwards.
      s.puzzles.p04 = { sideSeen: true, climbed: true, solved: true };
      s.progress.milestone = 'P04_DONE';
      s.player.anchor = 'wall_top';
      ev.push({ type: 'message', text: copy('p04_side_observation') }, { type: 'p04_solved' }, { type: 'moved', from: 'wall_base', to: 'wall_top' });
      return done();
    }
    case 'p04_reset': {
      if (s.puzzles.p04.solved || milestone !== 'P03_DONE') return fail(copy('locked_generic'));
      s.puzzles.p04 = { sideSeen: false, climbed: false, solved: false };
      s.player.anchor = 'wall_base';
      s.player.view = 'front';
      return done();
    }
    case 'p05_set': {
      if (s.player.anchor !== 'observatory' || milestone !== 'P04_DONE' || s.puzzles.p05.solved) return fail(copy('locked_generic'));
      const p = s.puzzles.p05;
      const changed = p[cmd.piece] !== cmd.pos;
      p[cmd.piece] = cmd.pos;
      if (p.a === 1 && p.b === 2) {
        p.solved = true;
        s.progress.milestone = 'P05_DONE';
        s.player.anchor = 'castle';
        s.player.view = 'front';
        ev.push({ type: 'p05_changed' }, { type: 'p05_solved' });
      } else {
        if (changed) ev.push({ type: 'p05_changed' });
        ev.push({ type: 'message', text: copy('p05_mismatch') });
      }
      return done(changed);
    }
    case 'p05_reset': {
      if (s.puzzles.p05.solved || s.player.anchor !== 'observatory' || milestone !== 'P04_DONE') return fail(copy('locked_generic'));
      s.puzzles.p05 = { a: 0, b: 1, solved: false };
      s.player.view = 'front';
      return done();
    }
  }
}
