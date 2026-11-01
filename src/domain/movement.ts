import type { Anchor, GameState } from './types';
import { anchorDef, copy } from '../content/load';

type Guard = (g: GameState) => boolean;
const G: Record<string, Guard> = {
  always: () => true,
  never: () => false,
  p01: (g) => g.puzzles.p01.solved,
  p02: (g) => g.puzzles.p02.solved,
  gate: (g) => g.puzzles.p03.gateLatched || g.toto.anchor === 'p03_plate',
  p03: (g) => g.puzzles.p03.solved,
  p04: (g) => g.puzzles.p04.solved,
  p05: (g) => g.puzzles.p05.solved,
};

/** Directed edges mirroring data/world.json (a unit test checks the two stay in sync). */
export const EDGES: { from: Anchor; to: Anchor; guard: string }[] = [
  ['arrival', 'p01_panel', 'always'], ['p01_panel', 'arrival', 'always'],
  ['p01_panel', 'mill', 'p01'], ['mill', 'p01_panel', 'p01'],
  ['mill', 'gate_near', 'p02'], ['gate_near', 'mill', 'p02'],
  ['gate_near', 'gate_far', 'gate'], ['gate_far', 'gate_near', 'gate'],
  ['gate_far', 'wall_base', 'p03'], ['wall_base', 'gate_far', 'p03'],
  ['wall_base', 'wall_top', 'p04'], ['wall_top', 'wall_base', 'p04'],
  ['wall_top', 'observatory', 'p04'], ['observatory', 'wall_top', 'p04'],
  ['observatory', 'castle', 'p05'], ['castle', 'observatory', 'p05'],
  ['castle', 'portal_front', 'p05'], ['portal_front', 'castle', 'p05'],
  ['portal_front', 'portal_back', 'p05'], ['portal_back', 'portal_front', 'p05'],
].map(([from, to, guard]) => ({ from: from as Anchor, to: to as Anchor, guard: guard! }));

const WAIT_AREA: Record<string, Anchor[]> = {
  p03_plate: ['gate_near', 'gate_far'],
  p06_front: ['portal_front', 'portal_back'],
  p06_back: ['portal_front', 'portal_back'],
};

export type MoveCheck = { ok: true } | { ok: false; reason: string };

/** Global wait guard first (WORLD_MAP "待機中のエリア退出禁止"), then the edge's own guard. */
export function checkMove(g: GameState, to: Anchor): MoveCheck {
  const from = g.player.anchor;
  if (g.toto.mode === 'wait') {
    const area = WAIT_AREA[g.toto.anchor] ?? [];
    if (!area.includes(from) || !area.includes(to)) return { ok: false, reason: copy('call_toto_first') };
  }
  const edge = EDGES.find((e) => e.from === from && e.to === to);
  if (!edge) return { ok: false, reason: copy('locked_generic') };
  if (!G[edge.guard]!(g)) return { ok: false, reason: copy('locked_generic') };
  return { ok: true };
}

export const defaultViewFor = (anchor: Anchor): string => anchorDef(anchor).defaultView;
