import { describe, expect, it } from 'vitest';
import { jointGaps } from '../../src/render/p05Geometry';

// The text readout for P05 reports each joint as meeting or not. It must agree with the geometry for every configuration.
const MEET = 0.005;
describe('P05 joint gaps', () => {
  it('only a=1, b=2 meets at all three joints', () => {
    const all: string[] = [];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const g = jointGaps(a, b);
      const meets = [g.upperLeft, g.upperRight, g.bottom].every((x) => x < MEET);
      if (meets) all.push(`${a},${b}`);
    }
    expect(all).toEqual(['1,2']);
  });
  it('every wrong configuration has a joint clearly apart (not borderline)', () => {
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      if (a === 1 && b === 2) continue;
      const g = jointGaps(a, b);
      expect(Math.max(g.upperLeft, g.upperRight, g.bottom)).toBeGreaterThan(MEET * 4);
    }
  });
  it('the solution has zero gaps to numerical precision', () => {
    const g = jointGaps(1, 2);
    expect(Math.max(g.upperLeft, g.upperRight, g.bottom)).toBeLessThan(1e-9);
  });
});
