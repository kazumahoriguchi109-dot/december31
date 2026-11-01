// P05 apparatus geometry in the puzzle's local frame (+Z forward, 1 unit = 0.25 m), see docs/PUZZLES.md.
// Pure math: no Three.js import so unit tests and the renderer share exactly the same numbers.
import { puzzles, world } from '../content/load';

export type Piece = 'fixed' | 'a' | 'b';
export type Vec3 = [number, number, number];

const P = puzzles.p05Projection;
const deg = (d: number) => (d * Math.PI) / 180;

export const spec = (piece: Piece) => {
  if (piece === 'fixed') return { radius: P.fixed.radius, start: deg(P.fixed.startDegrees), end: deg(P.fixed.endDegrees), width: P.radialWidthLocal.fixed };
  const d = P[piece];
  return { radius: d.radius, start: deg(d.startDegrees), end: deg(d.endDegrees), width: P.radialWidthLocal[piece] };
};

/** Local Z of a piece: fixed piece at 7, movable pieces at one of the three stops (0 = nearest to the viewer). */
export const zOf = (piece: Piece, pos: number): number => (piece === 'fixed' ? P.fixed.z : P.zStops[pos]!);

/** Point on the arc centre line at parameter t in [0,1]. */
export function centre(piece: Piece, pos: number, t: number): Vec3 {
  const s = spec(piece);
  const th = s.start + (s.end - s.start) * t;
  return [s.radius * Math.cos(th), s.radius * Math.sin(th), zOf(piece, pos)];
}

/** Planar annular ribbon: triangle strip between radius ± width/2, every vertex built from the stated radial width. */
export function ribbon(piece: Piece, pos: number, segments = 48): { positions: number[]; indices: number[] } {
  const s = spec(piece);
  const z = zOf(piece, pos);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const th = s.start + ((s.end - s.start) * i) / segments;
    const c = Math.cos(th), n = Math.sin(th);
    const ri = s.radius - s.width / 2, ro = s.radius + s.width / 2;
    positions.push(ri * c, ri * n, z, ro * c, ro * n, z);
    if (i > 0) {
      const k = (i - 1) * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  return { positions, indices };
}

/** Local (X right, Y up, Z forward) to world, per WORLD_MAP: (22+.25X, 3.6+.25Y, 20-.25Z). */
export function toWorld(p: Vec3): Vec3 {
  const { origin, scale } = world.p05LocalToWorld;
  return [origin[0] + scale * p[0], origin[1] + scale * p[1], origin[2] - scale * p[2]];
}

/** Projected radius from the viewing point of a circle of radius r at depth z (u=X/Z, v=Y/Z). */
export const projectedRadius = (piece: Piece, pos: number): number => spec(piece).radius / zOf(piece, pos);

/** Endpoint mismatch E = max(|rA-R|, |rB-R|, |rA-rB|) from docs/PUZZLES.md. */
export function endpointMismatch(a: number, b: number): number {
  const R = P.targetRadius;
  const rA = projectedRadius('a', a), rB = projectedRadius('b', b);
  return Math.max(Math.abs(rA - R), Math.abs(rB - R), Math.abs(rA - rB));
}

/** Seam end points of the three joints for a configuration (local X,Y at each piece's own depth). */
export function seamEnds(a: number, b: number) {
  return {
    upperLeft: { fixed: centre('fixed', 0, 1), a: centre('a', a, 0) },
    upperRight: { fixed: centre('fixed', 0, 0), b: centre('b', b, 1) },
    bottom: { a: centre('a', a, 1), b: centre('b', b, 0) },
  };
}

export const ARM_STEMS = {
  // Radial stems start at mid-arc and run outward only, so they never cross the ring interior or touch an end point.
  a: { midAngle: deg(225), length: 2.5 },
  b: { midAngle: deg(315), length: 2.5 },
};
