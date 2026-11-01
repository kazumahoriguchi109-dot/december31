import { describe, expect, it } from 'vitest';
import saveExample from '../../data/save.example.json';
import world from '../../data/world.json';
import { copy } from '../../src/content/load';
import { reduce, type Command } from '../../src/domain/commands';
import { acknowledge, events, isActive, normalize } from '../../src/domain/dialogue';
import { validateGame } from '../../src/domain/invariants';
import { checkMove } from '../../src/domain/movement';
import type { GameState } from '../../src/domain/types';

const room = () => structuredClone(saveExample.slot.game) as unknown as GameState;
const mv = (to: string): Command => ({ type: 'move', to: to as never });

/** Play like a person: run a command, then read every line with "next" before the next command. */
function play(cmds: Command[]) {
  let g = room();
  const reading = (s: GameState) => { while (isActive(s)) acknowledge(s); };
  normalize(g);
  reading(g);
  for (const c of cmds) {
    const r = reduce(g, c);
    if (!r.ok) throw new Error(`${c.type}: ${r.reason}`);
    g = r.state;
    normalize(g); // the Game does this in the same commit
    expect(validateGame(g)).toEqual([]);
    reading(g);
  }
  return g;
}

const TO_P03: Command[] = [
  { type: 'start_rpg' }, mv('p01_panel'), { type: 'p01_rotate', dir: 'right' },
  mv('mill'), { type: 'p02_drain' }, { type: 'p02_stopper' },
  mv('gate_near'), { type: 'p03_wait' }, mv('gate_far'), { type: 'p03_latch' }, { type: 'p03_call' },
];
const TO_P05: Command[] = [
  ...TO_P03, mv('wall_base'), { type: 'view', view: 'wall_side' }, { type: 'p04_inspect' },
  mv('observatory'), { type: 'p05_set', piece: 'a', pos: 1 }, { type: 'p05_set', piece: 'b', pos: 2 },
];

describe('dialogue reachability (plan section 5.3)', () => {
  it('a normal playthrough shows every automatic line; only the explicit practice reply is optional', () => {
    const g = play([...TO_P05, mv('portal_front'), { type: 'p06_wait' }, mv('portal_back'), { type: 'p06_call' }, { type: 'return_home' }]);
    expect(g.progress.milestone).toBe('ENDING');
    const all = events.flatMap((e) => e.rowIds);
    const missing = all.filter((id) => !g.dialogue.seenIds.includes(id));
    expect(missing).toEqual(['D041']); // D041 needs the explicit practice command, which the player may skip
    expect(new Set(g.dialogue.seenIds).size).toBe(g.dialogue.seenIds.length); // no duplicates
  });
});

describe('waiting-state movement guards (every anchor, not a sample)', () => {
  const anchors = (world.anchorDefinitions as { id: string }[]).map((a) => a.id);
  it('P03: with Toto on the plate only gate_near/gate_far are reachable; everything else says to call Toto', () => {
    const g = play(TO_P03.slice(0, 8)); // ... p03_wait
    expect(g.toto.mode).toBe('wait');
    const out = anchors.filter((a) => !['gate_near', 'gate_far'].includes(a));
    expect(out.length).toBeGreaterThan(10);
    for (const a of out) expect(checkMove(g, a as never).ok, `reachable while waiting: ${a}`).toBe(false);
  });
  it('P06: with Toto waiting on a plate only portal_front/portal_back are reachable', () => {
    const g = play([...TO_P05, mv('portal_front'), { type: 'p06_wait' }]);
    expect(g.toto.mode).toBe('wait');
    for (const a of anchors.filter((x) => !['portal_front', 'portal_back'].includes(x))) {
      const r = checkMove(g, a as never);
      expect(r.ok, `reachable while waiting: ${a}`).toBe(false);
      if (!r.ok && a !== 'room' && a !== 'home') expect(r.reason).toBe(copy('call_toto_first'));
    }
  });
});
