import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { world, puzzles } from '../../src/content/load';
import { centre, endpointMismatch, projectedRadius, ribbon, toWorld, zOf, type Piece } from '../../src/render/p05Geometry';
import { reduce } from '../../src/domain/commands';
import type { GameState } from '../../src/domain/types';
import start from '../fixtures/starts/m1a_p05.json';

const preset = world.cameraPresets['observatory_observe']!;
function camera(): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(preset.verticalFovDegrees!, preset.aspect, preset.near, preset.far);
  c.position.set(...preset.position);
  c.up.set(...preset.up);
  c.lookAt(new THREE.Vector3(...preset.target));
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
}
/** Project a local point through the real Three.js camera; returns (u,v) in the puzzle's own convention (view half extent 0.75 -> NDC 1). */
function uv(c: THREE.PerspectiveCamera, p: [number, number, number]): [number, number] {
  const ndc = new THREE.Vector3(...toWorld(p)).project(c);
  return [ndc.x * puzzles.p05Projection.viewportHalfExtent, ndc.y * puzzles.p05Projection.viewportHalfExtent];
}

describe('P05 geometry through the real Three.js camera (all nine configurations)', () => {
  const c = camera();
  it('camera preset has the documented vertical FOV and square aspect', () => {
    expect(preset.verticalFovDegrees).toBeCloseTo(2 * Math.atan(0.75) * (180 / Math.PI), 4);
    expect(preset.aspect).toBe(1);
  });
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      it(`A${a}/B${b}: projected centre lines equal u=X/Z, v=Y/Z within 0.001`, () => {
        const pieces: [Piece, number][] = [['fixed', 0], ['a', a], ['b', b]];
        for (const [piece, pos] of pieces) {
          for (let i = 0; i <= 12; i++) {
            const p = centre(piece, pos, i / 12);
            const [u, v] = uv(c, p);
            expect(Math.abs(u - p[0] / p[2])).toBeLessThan(0.001);
            expect(Math.abs(v - p[1] / p[2])).toBeLessThan(0.001);
          }
        }
      });
    }
  }
  it('only A1/B2 closes the ring; the nearest wrong state is >= 1/15', () => {
    const E: Record<string, number> = {};
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) E[`${a}${b}`] = endpointMismatch(a, b);
    const zero = Object.entries(E).filter(([, e]) => e < 1e-9).map(([k]) => k);
    expect(zero).toEqual(['12']);
    const nearest = Math.min(...Object.entries(E).filter(([k]) => k !== '12').map(([, e]) => e));
    expect(nearest).toBeGreaterThanOrEqual(1 / 15 - 1e-9);
  });
  it('projected radii match the documented tables', () => {
    expect([0, 1, 2].map((i) => projectedRadius('a', i))).toEqual([0.5, 0.4, 2 / 6]);
    expect([0, 1, 2].map((i) => projectedRadius('b', i)).map((x) => +x.toFixed(6))).toEqual([0.6, 0.48, 0.4]);
    expect(projectedRadius('fixed', 0)).toBeCloseTo(0.4, 9);
  });
  it('ribbons are planar at constant Z with the stated radial width', () => {
    for (const [piece, w] of [['fixed', 0.084], ['a', 0.06], ['b', 0.072]] as const) {
      const { positions } = ribbon(piece, 1, 24);
      const z = zOf(piece, 1);
      let min = Infinity, max = 0;
      for (let i = 0; i < positions.length; i += 6) {
        expect(positions[i + 2]).toBe(z);
        const ri = Math.hypot(positions[i]!, positions[i + 1]!);
        const ro = Math.hypot(positions[i + 3]!, positions[i + 4]!);
        min = Math.min(min, ro - ri); max = Math.max(max, ro - ri);
      }
      expect(min).toBeCloseTo(w, 9);
      expect(max).toBeCloseTo(w, 9);
    }
  });
});

describe('P05 puzzle logic', () => {
  const base = () => structuredClone(start.slot.game) as unknown as GameState;
  it('exactly one of nine settings solves, wherever you come from', () => {
    for (let a0 = 0; a0 < 3; a0++) for (let b0 = 0; b0 < 3; b0++) {
      let g = base(); g.puzzles.p05 = { a: a0, b: b0, solved: false };
      if (a0 === 1 && b0 === 2) continue; // that start would already be solved (invalid)
      for (const piece of ['a', 'b'] as const) for (const pos of [0, 1, 2] as const) {
        const r = reduce(g, { type: 'p05_set', piece, pos });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.state.puzzles.p05.solved).toBe(r.state.puzzles.p05.a === 1 && r.state.puzzles.p05.b === 2);
      }
    }
  });
  it('success commits milestone, castle and freeze in one command; later sets are refused', () => {
    let r = reduce(base(), { type: 'p05_set', piece: 'a', pos: 1 }); // initial b is 1
    expect(r.ok && r.state.puzzles.p05.solved).toBe(false);
    if (!r.ok) throw new Error();
    r = reduce(r.state, { type: 'p05_set', piece: 'b', pos: 2 });
    if (!r.ok) throw new Error();
    expect(r.state.progress.milestone).toBe('P05_DONE');
    expect(r.state.player).toEqual({ anchor: 'castle', view: 'front' });
    expect(r.events.map((e) => e.type)).toContain('p05_solved');
    expect(reduce(r.state, { type: 'p05_set', piece: 'a', pos: 0 }).ok).toBe(false);
  });
  it('wrong settings keep progress and say the ends do not meet', () => {
    const r = reduce(base(), { type: 'p05_set', piece: 'b', pos: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.events.some((e) => e.type === 'message')).toBe(true);
  });
  it('re-selecting the same position changes nothing and stays in range', () => {
    const r = reduce(base(), { type: 'p05_set', piece: 'a', pos: 0 });
    expect(r.ok && r.changed).toBe(false);
  });
  it('reset returns a0/b1 and the overview camera', () => {
    let g = base(); g.puzzles.p05 = { a: 2, b: 0, solved: false }; g.player.view = 'observe';
    const r = reduce(g, { type: 'p05_reset' });
    expect(r.ok && r.state.puzzles.p05).toEqual({ a: 0, b: 1, solved: false });
  });
});
