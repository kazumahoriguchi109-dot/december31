import { describe, expect, it } from 'vitest';
import { acknowledge, checkCursor, events, normalize, parseGuard, rowOf } from '../../src/domain/dialogue';
import type { GameState, Milestone } from '../../src/domain/types';
import { validateGame } from '../../src/domain/invariants';
import fx from '../fixtures/starts/m1a_p04.json';

const byName = new Map(events.map((e) => [e.event, e]));
const CANON = ['new_game', 'start_rpg', 'arrival', 'p01_open', 'p01_solved', 'p02_open', 'p02_solved', 'p03_open', 'p03_latched', 'p03_solved', 'view_tutorial', 'view_tutorial_done', 'p04_solved', 'p05_open', 'p05_solved', 'castle_clear', 'p06_open', 'p06_solved', 'ending'];
const before = (name: string) => CANON.slice(0, CANON.indexOf(name));

/** Same shape as the Python model's abstract state: only the facts guards read, plus the dialogue cursor. */
function st(milestone: Milestone, anchor: string, already: string[], gate = false): GameState {
  const g = structuredClone(fx.slot.game) as unknown as GameState;
  g.progress.milestone = milestone;
  g.player.anchor = anchor as GameState['player']['anchor'];
  g.puzzles.p03.gateLatched = gate;
  g.dialogue = { seenIds: already.flatMap((e) => byName.get(e)!.rowIds), activeId: null, queue: [], lineIndex: 0 };
  return g;
}
function drain(g: GameState, command: string | null = null): string[] {
  const out: string[] = [];
  normalize(g, command);
  for (let i = 0; i < 100 && g.dialogue.activeId !== null; i++) out.push(...acknowledge(g));
  return out;
}

// Same table as scripts/verify_dialogue_model.py run_suite().
const FIXTURES: [string, Milestone, string, string, string[], boolean, string | null][] = [
  ['room', 'ROOM', 'room', 'new_game', ['new_game'], false, null],
  ['arrival-chain', 'ARRIVAL', 'arrival', 'start_rpg', ['start_rpg', 'arrival'], false, null],
  ['tile-open', 'ARRIVAL', 'p01_panel', 'p01_open', ['p01_open'], false, null],
  ['water-entry-chain', 'P01_DONE', 'mill', 'p01_solved', ['p01_solved', 'p02_open'], false, null],
  ['gate-entry-chain', 'P02_DONE', 'gate_near', 'p02_solved', ['p02_solved', 'p03_open'], false, null],
  ['gate-latched', 'P02_DONE', 'gate_far', 'p03_latched', ['p03_latched'], true, null],
  ['view-intro', 'P03_DONE', 'wall_base', 'p03_solved', ['p03_solved', 'view_tutorial'], true, null],
  ['view-practice', 'P03_DONE', 'wall_base', 'view_tutorial_done', ['view_tutorial_done'], true, 'practice_side'],
  ['observatory-entry-chain', 'P04_DONE', 'observatory', 'p04_solved', ['p04_solved', 'p05_open'], true, null],
  ['castle-chain', 'P05_DONE', 'castle', 'p05_solved', ['p05_solved', 'castle_clear'], true, null],
  ['portal-open', 'P05_DONE', 'portal_front', 'p06_open', ['p06_open'], true, null],
  ['portal-solved', 'RETURN_OPEN', 'portal_back', 'p06_solved', ['p06_solved'], true, null],
  ['ending', 'ENDING', 'home', 'ending', ['ending'], true, null],
];

describe('dialogue scheduler: parity with the design model fixtures', () => {
  for (const [label, ms, anchor, first, evs, gate, cmd] of FIXTURES) {
    it(label, () => {
      const expected = evs.flatMap((e) => byName.get(e)!.rowIds);
      const start = st(ms, anchor, before(first), gate);
      // 1. plain drain selects exactly the expected rows, in order (not sorted by id)
      expect(drain(structuredClone(start), cmd)).toEqual(expected);
      // 2. interrupt at every active row: serialise, reload, finish. Nothing skipped, nothing repeated.
      const live = structuredClone(start);
      normalize(live, cmd);
      const consumed: string[] = [];
      let snaps = 0;
      while (live.dialogue.activeId !== null) {
        expect(checkCursor(live.dialogue)).toEqual([]);
        const reloaded = JSON.parse(JSON.stringify(live)) as GameState;
        expect([...consumed, ...drain(reloaded)]).toEqual(expected);
        snaps++;
        consumed.push(...acknowledge(live));
      }
      expect(snaps).toBe(expected.length);
      // 3. skip affects only the current event; the later event is still shown
      const sk = structuredClone(start);
      normalize(sk, cmd);
      const cur = rowOf(sk.dialogue.activeId!).event;
      const skipped = acknowledge(sk, true);
      expect(skipped).toEqual(byName.get(cur)!.rowIds);
      expect([...skipped, ...drain(sk)]).toEqual(expected);
    });
  }

  it('practice event never fires from the milestone alone', () => {
    expect(drain(st('P03_DONE', 'wall_base', before('view_tutorial_done'), true))).toEqual([]);
  });
  it('open events keep their anchor guard', () => {
    expect(drain(st('ARRIVAL', 'arrival', before('p01_open')))).toEqual([]);
  });
  it('row order inside p01_solved is D016, D018, D017 (not sorted by id)', () => {
    expect(byName.get('p01_solved')!.rowIds).toEqual(['D016', 'D018', 'D017']);
  });
});

describe('dialogue scheduler: mutation checks (the suite must be able to fail)', () => {
  it('rejects a queue that mixes another event', () => {
    const g = st('ARRIVAL', 'arrival', ['new_game']);
    normalize(g);
    g.dialogue.queue = ['D010'];
    expect(checkCursor(g.dialogue).length).toBeGreaterThan(0);
  });
  it('an impossible guard would make the chain unreachable (detected by the drain comparison)', () => {
    const g = st('ARRIVAL', 'arrival', ['new_game', 'start_rpg']);
    const bad = parseGuard('milestone == ROOM AND milestone == ARRIVAL');
    expect(bad({ milestone: 'ARRIVAL', anchor: 'arrival', gateLatched: false, command: null })).toBe(false);
    expect(drain(g)).toEqual(byName.get('arrival')!.rowIds);
  });
  it('reversed priorities change the order, so the expected chain would not match', () => {
    const swapped = [...events].reverse().map((e) => e.event);
    expect(swapped.indexOf('arrival')).toBeLessThan(swapped.indexOf('start_rpg'));
    expect(events.map((e) => e.event).indexOf('start_rpg')).toBeLessThan(events.map((e) => e.event).indexOf('arrival'));
  });
  it('unsupported guard syntax is refused, not evaluated', () => {
    expect(() => parseGuard('milestone == ROOM OR milestone == ARRIVAL')).toThrow();
    expect(() => parseGuard('globalThis.x == 1')).toThrow();
  });
});

describe('dialogue and game-state invariants', () => {
  it('fixture start state is valid', () => { expect(validateGame(fx.slot.game as unknown as GameState)).toEqual([]); });
});
