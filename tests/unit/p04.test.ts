import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { puzzles, world, copy } from '../../src/content/load';
import { reduce, type Command } from '../../src/domain/commands';
import { checkMove, EDGES } from '../../src/domain/movement';
import { currentObjective } from '../../src/domain/objectives';
import type { GameState } from '../../src/domain/types';
import { validateGame } from '../../src/domain/invariants';
import p04start from '../fixtures/starts/m1a_p04.json';

const base = () => structuredClone(p04start.slot.game) as unknown as GameState;
const run = (g: GameState, ...cmds: Command[]) => {
  let s = g;
  for (const c of cmds) { const r = reduce(s, c); if (!r.ok) throw new Error(r.reason); s = r.state; }
  return s;
};

describe('P04 two views of one geometry', () => {
  it('front mask equals the union of the boxes seen along +X (area and outline)', () => {
    const { boxes, frontMaskPolygonUV } = puzzles.p04Geometry;
    // rasterise the union of the boxes' (Z-14, Y) rectangles and the mask polygon on a fine grid
    const inPoly = (x: number, y: number) => {
      let c = false; const P = frontMaskPolygonUV as [number, number][];
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, yi] = P[i]!, [xj, yj] = P[j]!;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const inBoxes = (x: number, y: number) => boxes.some((b) => x >= b.min[2]! - 14 && x <= b.max[2]! - 14 && y >= b.min[1]! && y <= b.max[1]!);
    let diff = 0, total = 0;
    for (let x = 0.0025; x < 4; x += 0.005) for (let y = 0.0025; y < 2.2; y += 0.005) {
      const a = inPoly(x, y), b = inBoxes(x, y);
      if (a || b) total++;
      if (a !== b) diff++;
    }
    expect(diff / total).toBeLessThan(0.001);
  });
  it('the real orthographic wall cameras see the front mask flat and the side view shows thickness', () => {
    const mk = (id: string) => {
      const p = world.cameraPresets[id]!, f = p.frustum!;
      const c = new THREE.OrthographicCamera(f.left, f.right, f.top, f.bottom, p.near, p.far);
      c.position.set(...p.position); c.up.set(...p.up); c.lookAt(new THREE.Vector3(...p.target));
      c.updateMatrixWorld(true); c.updateProjectionMatrix(); return c;
    };
    const front = mk('wall_base_front'), side = mk('wall_base_wall_side');
    // front: the near and far faces of a box project to the same screen point (depth is invisible)
    for (const b of puzzles.p04Geometry.boxes) {
      const near = new THREE.Vector3(b.min[0]!, b.max[1]!, (b.min[2]! + b.max[2]!) / 2).project(front);
      const far = new THREE.Vector3(b.max[0]!, b.max[1]!, (b.min[2]! + b.max[2]!) / 2).project(front);
      expect(Math.abs(near.x - far.x)).toBeLessThan(1e-9);
      expect(Math.abs(near.y - far.y)).toBeLessThan(1e-9);
      // side: the same two points are clearly apart on screen, i.e. thickness is readable
      const n2 = new THREE.Vector3(b.min[0]!, b.max[1]!, (b.min[2]! + b.max[2]!) / 2).project(side);
      const f2 = new THREE.Vector3(b.max[0]!, b.max[1]!, (b.min[2]! + b.max[2]!) / 2).project(side);
      expect(Math.hypot(n2.x - f2.x, n2.y - f2.y)).toBeGreaterThan(0.03);
    }
  });
});

describe('P04 flow and label boundary', () => {
  it('front inspect gives only an observation; progress needs the side view first', () => {
    const r = reduce(base(), { type: 'p04_inspect' });
    expect(r.ok && r.changed).toBe(false);
    if (r.ok) expect(r.events).toEqual([{ type: 'message', text: copy('p04_front_observation') }]);
  });
  it('side view then inspect: one command recognises and climbs (anchor wall_top, P04_DONE)', () => {
    const s = run(base(), { type: 'view', view: 'wall_side' });
    expect(s.puzzles.p04).toEqual({ sideSeen: true, climbed: false, solved: false });
    const done = run(s, { type: 'p04_inspect' });
    expect(done.puzzles.p04).toEqual({ sideSeen: true, climbed: true, solved: true });
    expect(done.progress.milestone).toBe('P04_DONE');
    expect(done.player.anchor).toBe('wall_top');
    expect(validateGame(done)).toEqual([]);
  });
  it('side seen, back to front, inspect still climbs; sideSeen survives 20 view switches', () => {
    let s = base();
    for (let i = 0; i < 10; i++) s = run(s, { type: 'view', view: 'wall_side' }, { type: 'view', view: 'front' });
    expect(s.puzzles.p04.sideSeen).toBe(true);
    expect(run(s, { type: 'p04_inspect' }).puzzles.p04.solved).toBe(true);
  });
  it('descend and re-climb after solving; wall_top to observatory needs solved', () => {
    const solved = run(base(), { type: 'view', view: 'wall_side' }, { type: 'p04_inspect' });
    const down = run(solved, { type: 'move', to: 'wall_base' });
    expect(down.player.anchor).toBe('wall_base');
    expect(run(down, { type: 'move', to: 'wall_top' }).player.anchor).toBe('wall_top');
    expect(checkMove(base(), 'observatory').ok).toBe(false);
    expect(run(solved, { type: 'move', to: 'observatory' }).player.anchor).toBe('observatory');
  });
  it('reset only before it is solved', () => {
    const s = run(base(), { type: 'view', view: 'wall_side' });
    expect(run(s, { type: 'p04_reset' }).puzzles.p04.sideSeen).toBe(false);
    const solved = run(s, { type: 'p04_inspect' });
    expect(reduce(solved, { type: 'p04_reset' }).ok).toBe(false);
  });
  it('objectives follow the data table', () => {
    expect(currentObjective(base())?.text).toBe('城へ続く高い道を探そう');
    const solved = run(base(), { type: 'view', view: 'wall_side' }, { type: 'p04_inspect' });
    expect(currentObjective(solved)?.text).toBe('城の輪を調べる');
    expect(currentObjective(run(solved, { type: 'move', to: 'observatory' }))?.text).toBe('観測台から、輪をつなげよう');
  });
});

describe('movement table mirrors data/world.json', () => {
  it('every coded edge exists in world.json (either direction listed or bidirectional)', () => {
    const listed = new Set<string>();
    for (const e of world.edges) { listed.add(`${e.from}>${e.to}`); if (e.bidirectional) listed.add(`${e.to}>${e.from}`); }
    for (const e of EDGES) expect(listed.has(`${e.from}>${e.to}`)).toBe(true);
  });
  it('waiting toto blocks leaving the plate area', () => {
    const g = base();
    g.toto = { mode: 'wait', anchor: 'p03_plate' };
    const r = checkMove(g, 'observatory');
    expect(r.ok).toBe(false);
  });
});
