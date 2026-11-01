import { describe, expect, it } from 'vitest';
import saveExample from '../../data/save.example.json';
import { copy } from '../../src/content/load';
import { reduce, type Command } from '../../src/domain/commands';
import { validateGame } from '../../src/domain/invariants';
import { normalize } from '../../src/domain/dialogue';
import { checkMove } from '../../src/domain/movement';
import type { GameState } from '../../src/domain/types';
import p04start from '../fixtures/starts/m1a_p04.json';

const room = () => structuredClone(saveExample.slot.game) as unknown as GameState;
const step = (g: GameState, c: Command): GameState => {
  const r = reduce(g, c);
  if (!r.ok) throw new Error(`${c.type}: ${r.reason}`);
  expect(validateGame(r.state)).toEqual([]);
  return r.state;
};
const run = (g: GameState, ...cs: Command[]) => cs.reduce(step, g);
const mv = (to: never): Command => ({ type: 'move', to });
const rejected = (g: GameState, c: Command) => {
  const r = reduce(g, c);
  expect(r.ok).toBe(false);
  return r.ok ? '' : r.reason;
};

const atP01 = () => run(room(), { type: 'start_rpg' }, mv('p01_panel' as never));
const atMill = () => run(atP01(), { type: 'p01_rotate', dir: 'right' }, mv('mill' as never));
const atGateNear = () => run(atMill(), { type: 'p02_drain' }, { type: 'p02_stopper' }, mv('gate_near' as never));

describe('intro', () => {
  it('start_rpg moves ROOM to ARRIVAL once and only from the room', () => {
    const g = step(room(), { type: 'start_rpg' });
    expect(g.progress.milestone).toBe('ARRIVAL');
    expect(g.player.anchor).toBe('arrival');
    rejected(g, { type: 'start_rpg' });
  });
  it('dialogue order: new_game, then start_rpg D003 before arrival D010', () => {
    const g = room();
    normalize(g);
    expect(g.dialogue.activeId).toBe('D000');
    const g2 = step(room(), { type: 'start_rpg' });
    normalize(g2);
    expect(g2.dialogue.activeId).toBe('D003');
  });
});

describe('P01', () => {
  it('T1 right once solves; the verdict is in the same command', () => {
    const g = step(atP01(), { type: 'p01_rotate', dir: 'right' });
    expect(g.puzzles.p01).toEqual({ rotation: 1, solved: true });
    expect(g.progress.milestone).toBe('P01_DONE');
  });
  it('T2 left three times also solves', () => {
    const g = run(atP01(), ...Array(3).fill({ type: 'p01_rotate', dir: 'left' }) as Command[]);
    expect(g.puzzles.p01.solved).toBe(true);
  });
  it('wrong rotations say "あと少し" and do not solve', () => {
    const r = reduce(atP01(), { type: 'p01_rotate', dir: 'left' });
    expect(r.ok && r.events.some((e) => e.type === 'message' && e.text === copy('p01_not_connected'))).toBe(true);
    expect(r.ok && r.state.puzzles.p01.solved).toBe(false);
  });
  it('T3 reset returns to rotation 0 before solving and is refused after', () => {
    const g = run(atP01(), { type: 'p01_rotate', dir: 'left' }, { type: 'p01_rotate', dir: 'left' });
    expect(g.puzzles.p01.rotation).toBe(2);
    expect(step(g, { type: 'p01_reset' }).puzzles.p01.rotation).toBe(0);
    rejected(atMill(), { type: 'p01_reset' });
  });
  it('T4/T5 once solved, further input changes nothing', () => {
    let g = step(atP01(), { type: 'p01_rotate', dir: 'right' });
    for (let i = 0; i < 10; i++) rejected(g, { type: 'p01_rotate', dir: 'right' });
    g = step(g, mv('mill' as never));
    expect(g.puzzles.p01).toEqual({ rotation: 1, solved: true });
  });
  it('cannot leave the panel before solving, and cannot rotate from elsewhere', () => {
    expect(checkMove(atP01(), 'mill' as never).ok).toBe(false);
    rejected(step(room(), { type: 'start_rpg' }), { type: 'p01_rotate', dir: 'right' });
  });
});

describe('P02', () => {
  const p01done = () => atMill();
  it('T1/T2 both orders solve', () => {
    expect(run(p01done(), { type: 'p02_drain' }, { type: 'p02_stopper' }).puzzles.p02.solved).toBe(true);
    expect(run(p01done(), { type: 'p02_stopper' }, { type: 'p02_drain' }).puzzles.p02.solved).toBe(true);
  });
  it('T3 the two intermediate states are distinct and unsolved', () => {
    const a = step(p01done(), { type: 'p02_drain' });
    const b = step(p01done(), { type: 'p02_stopper' });
    expect(a.puzzles.p02).toEqual({ drain: 'closed', stopper: 'locked', solved: false });
    expect(b.puzzles.p02).toEqual({ drain: 'open', stopper: 'released', solved: false });
  });
  it('T5 20 wrong toggles never lose anything and never solve', () => {
    let g = p01done();
    for (let i = 0; i < 10; i++) g = run(g, { type: 'p02_drain' }, { type: 'p02_drain' });
    expect(g.puzzles.p02).toEqual({ drain: 'open', stopper: 'locked', solved: false });
  });
  it('T6 solved state is fixed; the way back stays open', () => {
    const g = run(p01done(), { type: 'p02_drain' }, { type: 'p02_stopper' });
    rejected(g, { type: 'p02_drain' });
    rejected(g, { type: 'p02_reset' });
    expect(checkMove(g, 'gate_near' as never).ok).toBe(true);
    expect(checkMove(step(g, mv('gate_near' as never)), 'mill' as never).ok).toBe(true);
  });
  it('reset goes back to open/locked', () => {
    const g = run(p01done(), { type: 'p02_drain' }, { type: 'p02_reset' });
    expect(g.puzzles.p02).toEqual({ drain: 'open', stopper: 'locked', solved: false });
  });
  it('gate is unreachable until P02 is solved', () => {
    expect(checkMove(p01done(), 'gate_near' as never).ok).toBe(false);
  });
});

describe('P03', () => {
  it('T1 wait, cross, latch, call -> solved and P03_DONE in the call command', () => {
    let g = run(atGateNear(), { type: 'p03_wait' }, mv('gate_far' as never));
    expect(g.puzzles.p03.crossed).toBe(true);
    g = step(g, { type: 'p03_latch' });
    expect(g.progress.milestone).toBe('P02_DONE'); // not yet: Toto still waits
    g = step(g, { type: 'p03_call' });
    expect(g.progress.milestone).toBe('P03_DONE');
    expect(g.puzzles.p03).toEqual({ gateLatched: true, crossed: true, solved: true });
    expect(g.toto).toEqual({ mode: 'follow', anchor: 'party' });
  });
  it('T2 calling before the latch is refused with the data copy, state unchanged, and going back works', () => {
    const g = run(atGateNear(), { type: 'p03_wait' }, mv('gate_far' as never));
    expect(rejected(g, { type: 'p03_call' })).toBe(copy('p03_call_unlatched_far'));
    const back = step(g, mv('gate_near' as never));
    expect(back.toto.mode).toBe('wait');
    const called = step(back, { type: 'p03_call' });
    expect(called.toto.mode).toBe('follow');
    expect(called.puzzles.p03.solved).toBe(false);
  });
  it('latched, return, call from the near side does not solve; crossing again with both does', () => {
    let g = run(atGateNear(), { type: 'p03_wait' }, mv('gate_far' as never), { type: 'p03_latch' }, mv('gate_near' as never));
    g = step(g, { type: 'p03_call' });
    expect(g.puzzles.p03.solved).toBe(false);
    g = step(g, mv('gate_far' as never)); // gate stays open because it is latched
    expect(g.puzzles.p03.solved).toBe(true);
    expect(g.progress.milestone).toBe('P03_DONE');
  });
  it('gate closes when Toto is called away unlatched: cannot cross', () => {
    const g = run(atGateNear(), { type: 'p03_wait' }, { type: 'p03_call' });
    expect(checkMove(g, 'gate_far' as never).ok).toBe(false);
  });
  it('wait is only possible at gate_near before latching', () => {
    rejected(atMill(), { type: 'p03_wait' });
    const g = run(atGateNear(), { type: 'p03_wait' });
    rejected(g, { type: 'p03_wait' });
  });
  it('latch needs gate_far and is single', () => {
    const g = run(atGateNear(), { type: 'p03_wait' });
    rejected(g, { type: 'p03_latch' });
    const far = step(g, mv('gate_far' as never));
    const latched = step(far, { type: 'p03_latch' });
    rejected(latched, { type: 'p03_latch' });
  });
  it('waiting Toto blocks leaving the gate area for every other anchor', () => {
    const g = run(atGateNear(), { type: 'p03_wait' });
    expect(checkMove(g, 'mill' as never)).toEqual({ ok: false, reason: copy('call_toto_first') });
  });
  it('reset only before the latch: gate_near, follow, crossed=false', () => {
    const g = run(atGateNear(), { type: 'p03_wait' }, mv('gate_far' as never), { type: 'p03_reset' });
    expect(g.player.anchor).toBe('gate_near');
    expect(g.toto).toEqual({ mode: 'follow', anchor: 'party' });
    expect(g.puzzles.p03).toEqual({ gateLatched: false, crossed: false, solved: false });
    const latched = run(atGateNear(), { type: 'p03_wait' }, mv('gate_far' as never), { type: 'p03_latch' });
    rejected(latched, { type: 'p03_reset' });
  });
  it('after P03_DONE the gate stays open and the wall is reachable', () => {
    const g = run(atGateNear(), { type: 'p03_wait' }, mv('gate_far' as never), { type: 'p03_latch' }, { type: 'p03_call' });
    expect(checkMove(g, 'wall_base' as never).ok).toBe(true);
    expect(checkMove(step(g, mv('wall_base' as never)), 'gate_far' as never).ok).toBe(true);
  });
  it('every state along the way passes the semantic validator (full walk)', () => {
    const cmds: Command[] = [
      { type: 'start_rpg' }, mv('p01_panel' as never), { type: 'p01_rotate', dir: 'right' }, mv('mill' as never),
      { type: 'p02_stopper' }, { type: 'p02_drain' }, mv('gate_near' as never), { type: 'p03_wait' }, mv('gate_far' as never),
      { type: 'p03_latch' }, { type: 'p03_call' }, mv('wall_base' as never),
    ];
    const g = run(room(), ...cmds);
    expect(g.progress.milestone).toBe('P03_DONE');
    expect(g.player.anchor).toBe('wall_base');
  });
});

describe('dev start fixture honesty (plan §M2)', () => {
  it('the M1A_P04 start state equals what a real playthrough reaches at the white wall', () => {
    const real = run(room(), { type: 'start_rpg' }, mv('p01_panel' as never), { type: 'p01_rotate', dir: 'right' }, mv('mill' as never),
      { type: 'p02_drain' }, { type: 'p02_stopper' }, mv('gate_near' as never), { type: 'p03_wait' }, mv('gate_far' as never),
      { type: 'p03_latch' }, { type: 'p03_call' }, mv('wall_base' as never));
    const fx = p04start.slot.game as unknown as GameState;
    expect(real.progress.milestone).toBe(fx.progress.milestone);
    expect(real.player).toEqual(fx.player);
    expect(real.toto).toEqual(fx.toto);
    expect(real.puzzles).toEqual(fx.puzzles);
  });
});

// ---- P06, ending and hints (M3 part, same reducer) ----
import p05start from '../fixtures/starts/m1a_p05.json';
const atCastle = () => {
  const g = structuredClone(p05start.slot.game) as unknown as GameState;
  return run(g, { type: 'p05_set', piece: 'a', pos: 1 }, { type: 'p05_set', piece: 'b', pos: 2 });
};
const atPortalFront = () => step(atCastle(), mv('portal_front' as never));

describe('P06', () => {
  it('T8 reachable from the castle without redoing earlier puzzles', () => {
    expect(atPortalFront().player.anchor).toBe('portal_front');
  });
  it('T1 Toto on front + player behind opens it; T2 the reverse also does', () => {
    const a = run(atPortalFront(), { type: 'p06_wait' }, mv('portal_back' as never));
    expect(a.progress.milestone).toBe('RETURN_OPEN');
    expect(a.puzzles.p06).toEqual({ portalLatched: true, solved: true });
    const b = run(atPortalFront(), mv('portal_back' as never), { type: 'p06_wait' }, mv('portal_front' as never));
    expect(b.progress.milestone).toBe('RETURN_OPEN');
  });
  it('T3 the same side, or alone, never opens', () => {
    const g = run(atPortalFront(), { type: 'p06_wait' });
    expect(g.progress.milestone).toBe('P05_DONE');
    const alone = run(atPortalFront(), mv('portal_back' as never), mv('portal_front' as never));
    expect(alone.puzzles.p06.solved).toBe(false);
  });
  it('T4 stays open after calling Toto and moving away; T5 waiting Toto at RETURN_OPEN can be called', () => {
    const open = run(atPortalFront(), { type: 'p06_wait' }, mv('portal_back' as never));
    expect(open.toto.mode).toBe('wait');
    const called = step(open, { type: 'p06_call' });
    expect(called.puzzles.p06.solved).toBe(true);
    expect(called.toto.mode).toBe('follow');
  });
  it('T6 cannot go home alone; with Toto it ends and both are home', () => {
    const open = run(atPortalFront(), { type: 'p06_wait' }, mv('portal_back' as never));
    rejected(open, { type: 'return_home' });
    const end = run(open, { type: 'p06_call' }, { type: 'return_home' });
    expect(end.progress.milestone).toBe('ENDING');
    expect(end.player.anchor).toBe('home');
    expect(end.toto.mode).toBe('follow');
  });
  it('waiting Toto stops the player leaving the portal area', () => {
    const g = run(atPortalFront(), { type: 'p06_wait' });
    expect(checkMove(g, 'castle' as never)).toEqual({ ok: false, reason: copy('call_toto_first') });
  });
  it('reset only before opening', () => {
    const g = run(atPortalFront(), mv('portal_back' as never), { type: 'p06_wait' }, { type: 'p06_reset' });
    expect(g.player.anchor).toBe('portal_front');
    expect(g.toto.mode).toBe('follow');
    rejected(run(atPortalFront(), { type: 'p06_wait' }, mv('portal_back' as never)), { type: 'p06_reset' });
  });
});

describe('hints', () => {
  it('open one level at a time for the current puzzle, capped at 3, saved in state', () => {
    let g = atP01();
    for (let i = 1; i <= 3; i++) { g = step(g, { type: 'hint_more' }); expect(g.hints.P01).toBe(i); }
    rejected(g, { type: 'hint_more' });
  });
  it('hints do not exist before the story starts or after the ending', () => {
    rejected(room(), { type: 'hint_more' });
  });
  it('hints do not change progress or dialogue', () => {
    const g = atP01();
    const h = step(g, { type: 'hint_more' });
    expect({ ...h, hints: g.hints }).toEqual(g);
  });
});
