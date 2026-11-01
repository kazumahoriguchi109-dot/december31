import { MILESTONES, type GameState, type Milestone, milestoneIndex } from './types';
import { dialogueIds, world } from '../content/load';
import { checkCursor } from './dialogue';

const PREREQ: Record<string, Milestone> = {
  p01: 'ARRIVAL', p02: 'P01_DONE', p03: 'P02_DONE', p04: 'P03_DONE', p05: 'P04_DONE', p06: 'P05_DONE',
};
const SOLVED_AT: Record<string, Milestone> = {
  p01: 'P01_DONE', p02: 'P02_DONE', p03: 'P03_DONE', p04: 'P04_DONE', p05: 'P05_DONE', p06: 'RETURN_OPEN',
};
const INITIAL = {
  p01: { rotation: 0, solved: false },
  p02: { drain: 'open', stopper: 'locked', solved: false },
  p03: { gateLatched: false, crossed: false, solved: false },
  p04: { sideSeen: false, climbed: false, solved: false },
  p05: { a: 0, b: 1, solved: false },
  p06: { portalLatched: false, solved: false },
} as const;

/**
 * Semantic validation of a game state (SAVE.md "不変条件"). Structure is checked separately
 * against data/save.schema.json. Returns a list of violations; empty means valid.
 */
export function validateGame(g: GameState): string[] {
  const e: string[] = [];
  const mi = milestoneIndex(g.progress.milestone);
  if (mi < 0) return [`unknown milestone ${String(g.progress.milestone)}`];
  const reached = (m: Milestone) => mi >= milestoneIndex(m);

  // puzzle solved flags form a prefix determined by the milestone; unreached puzzles stay initial
  for (const k of Object.keys(PREREQ) as (keyof typeof INITIAL)[]) {
    const p = g.puzzles[k];
    const shouldBeSolved = reached(SOLVED_AT[k]!);
    if (p.solved !== shouldBeSolved) e.push(`${k}.solved=${p.solved} contradicts milestone ${g.progress.milestone}`);
    if (!reached(PREREQ[k]!) && JSON.stringify(p) !== JSON.stringify(INITIAL[k])) e.push(`${k} changed before it is reachable`);
  }
  const { p01, p02, p03, p04, p05, p06 } = g.puzzles;
  if (p01.solved && p01.rotation !== 1) e.push('p01 solved requires rotation=1');
  if (p01.rotation < 0 || p01.rotation > 3) e.push('p01.rotation out of range');
  if (p02.solved !== (p02.drain === 'closed' && p02.stopper === 'released')) e.push('p02.solved must equal drain=closed && stopper=released');
  if (p03.gateLatched && !p03.crossed) e.push('p03.gateLatched requires crossed');
  if (p03.solved && !p03.gateLatched) e.push('p03.solved requires gateLatched');
  if (p04.solved !== p04.climbed) e.push('p04.solved must equal climbed');
  if (p04.climbed && !p04.sideSeen) e.push('p04.climbed requires sideSeen');
  if (p05.a < 0 || p05.a > 2 || p05.b < 0 || p05.b > 2) e.push('p05 a/b out of range');
  if (p05.solved && !(p05.a === 1 && p05.b === 2)) e.push('p05.solved requires a=1,b=2');
  if (!p05.solved && p05.a === 1 && p05.b === 2) e.push('p05 a=1,b=2 must be solved');
  if (p06.solved !== p06.portalLatched) e.push('p06.solved must equal portalLatched');

  // player anchor/view
  const def = world.anchorDefinitions.find((a) => a.id === g.player.anchor);
  if (!def) e.push(`unknown anchor ${g.player.anchor}`);
  else {
    if (!def.allowedViews.includes(g.player.view)) e.push(`view ${g.player.view} not allowed at ${g.player.anchor}`);
    const minOk = reached(def.minMilestone as Milestone);
    if (!minOk) e.push(`anchor ${g.player.anchor} not reachable at ${g.progress.milestone}`);
    if (g.player.anchor === 'room' && g.progress.milestone !== 'ROOM') e.push('room only at ROOM');
    if (g.player.anchor === 'home' && g.progress.milestone !== 'ENDING') e.push('home only at ENDING');
    if (g.progress.milestone === 'ENDING' && g.player.anchor !== 'home') e.push('ENDING requires home');
    if (g.player.anchor === 'gate_far' && !(p03.gateLatched || g.toto.anchor === 'p03_plate')) e.push('gate_far requires gate open');
    if (g.player.anchor === 'gate_far' && !p03.crossed) e.push('gate_far requires crossed');
    if (g.player.anchor === 'wall_top' && !p04.solved) e.push('wall_top requires p04.solved');
  }

  // toto
  if ((g.toto.mode === 'follow') !== (g.toto.anchor === 'party')) e.push('toto follow iff anchor=party');
  if (g.toto.mode === 'wait') {
    if (g.toto.anchor === 'p03_plate') {
      if (!['gate_near', 'gate_far'].includes(g.player.anchor)) e.push('toto waits at p03_plate only while player is at the gate');
      if (reached('P03_DONE')) e.push('toto must not wait at p03_plate after P03_DONE');
    } else if (g.toto.anchor === 'p06_front' || g.toto.anchor === 'p06_back') {
      if (!reached('P05_DONE')) e.push('p06 wait before P05_DONE');
      if (!['portal_front', 'portal_back'].includes(g.player.anchor)) e.push('p06 wait requires player at portal');
    }
  }
  if (g.player.anchor === 'gate_far' && !p03.gateLatched && g.toto.anchor !== 'p03_plate') e.push('unlatched gate_far requires toto at plate');
  if (g.progress.milestone === 'ENDING' && g.toto.mode !== 'follow') e.push('ENDING requires toto follow');

  // hints: 0..3, future puzzles untouched
  for (const k of Object.keys(PREREQ)) {
    const h = g.hints[k.toUpperCase() as keyof GameState['hints']];
    if (!Number.isInteger(h) || h < 0 || h > 3) e.push(`hint ${k} out of range`);
    else if (h > 0 && !reached(PREREQ[k]!)) e.push(`hint ${k} opened before the puzzle is reachable`);
  }

  // dialogue cursor
  const d = g.dialogue;
  if (new Set(d.seenIds).size !== d.seenIds.length) e.push('dialogue.seenIds has duplicates');
  for (const id of d.seenIds) if (!dialogueIds.has(id)) e.push(`unknown seen id ${id}`);
  if (d.activeId !== null && !dialogueIds.has(d.activeId)) e.push(`unknown activeId ${d.activeId}`);
  for (const id of d.queue) if (!dialogueIds.has(id)) e.push(`unknown queue id ${id}`);
  if (new Set(d.queue).size !== d.queue.length) e.push('dialogue.queue has duplicates');
  if (d.activeId !== null && d.queue.includes(d.activeId)) e.push('activeId duplicated in queue');
  if (d.activeId === null && d.queue.length > 0) e.push('queue must be empty when activeId is null');
  if (d.lineIndex !== 0) e.push('lineIndex must be 0');
  if (e.length === 0 || d.activeId !== null) e.push(...checkCursor(d));
  if (!MILESTONES.includes(g.progress.milestone)) e.push('bad milestone');
  return e;
}
