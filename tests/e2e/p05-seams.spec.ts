import { expect, test } from './fixtures';
import { openGame } from './helpers';
import { mkdirSync, writeFileSync } from 'node:fs';

// The ORIGINAL M1a criteria (plan section M1a, P05 pixels), measured on the real rendered canvas at a 300 CSS px observation frame:
//  (1) seam gap: for each of the three joints, the longest run WITHOUT a ribbon pixel on the straight line between the two
//      projected centre-line end points (CSS px). Solution A1/B2: every seam 0. Every other configuration: the nearest wrong
//      configuration must still show a seam of at least 11 CSS px (we take the worst seam of each configuration).
//  (2) line widths: ribbon thickness across the arc, in CSS px, against the specified F 2.4, A 2-3, B 2.4-3.6 (+-0.5).
// This is NOT the earlier "uncovered arc of the target circle" metric (that one is p05-pixels.spec.ts and is a different measure).
const OUT = 'handoff/evidence/cycle-008';
mkdirSync(OUT, { recursive: true });
const results: unknown[] = [];

for (const dpr of [1, 2]) {
  test.describe(`seams DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr, viewport: { width: 1000, height: 700 } });
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      test(`A${a}/B${b}`, async ({ page }, info) => {
        await openGame(page, `/?start=M1A_P05&cam=observatory_observe&p05=${a},${b}`);
        await page.addStyleTag({ content: '.stage.square{width:300px !important;max-width:300px !important;min-width:300px !important}' });
        await page.waitForTimeout(250);
        const m = await page.evaluate(async ([A, B]) => {
          const geo = await import(/* @vite-ignore */ '/src/render/p05Geometry.ts') as typeof import('../../src/render/p05Geometry');
          const cv = document.getElementById('world') as HTMLCanvasElement;
          const css = cv.getBoundingClientRect().width, k = cv.width / css;
          const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
          const g = c2.getContext('2d')!; g.drawImage(cv, 0, 0);
          const data = g.getImageData(0, 0, cv.width, cv.height).data;
          const near = (i: number, t: number[]) => Math.hypot(data[i]! - t[0]!, data[i + 1]! - t[1]!, data[i + 2]! - t[2]!) < 60;
          const COL: Record<string, number[]> = { fixed: [255, 255, 255], a: [0xff, 0xd1, 0x66], b: [0x66, 0xd9, 0xef] };
          const isRibbon = (x: number, y: number) => {
            const px = Math.round(x * k), py = Math.round(y * k);
            if (px < 0 || py < 0 || px >= cv.width || py >= cv.height) return false;
            const i = (py * cv.width + px) * 4;
            return near(i, COL['fixed']!) || near(i, COL['a']!) || near(i, COL['b']!);
          };
          const scr = (p: [number, number, number]) => ({ x: css / 2 + (p[0] / p[2]) * (css / 1.5), y: css / 2 - (p[1] / p[2]) * (css / 1.5) });
          const ends = geo.seamEnds(A!, B!);
          const joints = [ends.upperLeft, ends.upperRight, ends.bottom].map((j) => Object.values(j) as [number, number, number][]);
          const seams = joints.map(([p, q]) => {
            const s = scr(p!), t = scr(q!);
            const len = Math.hypot(t.x - s.x, t.y - s.y), N = Math.max(2, Math.round(len * 10));
            let best = 0, run = 0;
            for (let i = 0; i <= N; i++) {
              const x = s.x + ((t.x - s.x) * i) / N, y = s.y + ((t.y - s.y) * i) / N;
              if (isRibbon(x, y)) run = 0; else { run += len / N; best = Math.max(best, run); }
            }
            return { centreDistanceCssPx: len, visibleGapCssPx: best };
          });
          // line width: across the ribbon at t=0.25 of each arc, along the projected radial direction
          const widths: Record<string, number> = {};
          for (const piece of ['fixed', 'a', 'b'] as const) {
            const pos = piece === 'a' ? A! : piece === 'b' ? B! : 0;
            const c = geo.centre(piece, pos, 0.25);
            const s = geo.spec(piece);
            const th = s.start + (s.end - s.start) * 0.25;
            const z = c[2];
            const dir = { x: Math.cos(th), y: -Math.sin(th) };
            const mid = scr(c);
            // coverage-weighted width: each sample counts by how much of the ribbon colour it contains over the background
            const bgAt = (d: number) => { const x = mid.x + dir.x * d, y = mid.y + dir.y * d; const i = (Math.round(y * k) * cv.width + Math.round(x * k)) * 4; return [data[i]!, data[i + 1]!, data[i + 2]!]; };
            const bgs = [bgAt(-6), bgAt(6)], col = COL[piece]!; // the scene behind the ribbon differs on its two sides
            let w = 0;
            for (let d = -6; d <= 6; d += 0.05) {
              const bg = d < 0 ? bgs[0]! : bgs[1]!;
              const dv = [col[0]! - bg[0]!, col[1]! - bg[1]!, col[2]! - bg[2]!], dd = dv[0]! ** 2 + dv[1]! ** 2 + dv[2]! ** 2;
              const x = mid.x + dir.x * d, y = mid.y + dir.y * d;
              const px = Math.round(x * k), py = Math.round(y * k), i = (py * cv.width + px) * 4;
              const f = ((data[i]! - bg[0]!) * dv[0]! + (data[i + 1]! - bg[1]!) * dv[1]! + (data[i + 2]! - bg[2]!) * dv[2]!) / dd;
              w += Math.max(0, Math.min(1, f)) * 0.05;
            }
            widths[piece] = w;
            void z;
          }
          return { seams, widths };
        }, [a, b] as [number, number]);
        const worst = Math.max(...m.seams.map((s) => s.visibleGapCssPx));
        const row = { dpr, a, b, worstSeamGapCssPx: +worst.toFixed(2), seams: m.seams.map((s) => ({ centre: +s.centreDistanceCssPx.toFixed(2), gap: +s.visibleGapCssPx.toFixed(2) })), widthsCssPx: Object.fromEntries(Object.entries(m.widths).map(([k2, v]) => [k2, +v.toFixed(2)])) };
        results.push(row);
        console.log('SEAM ' + JSON.stringify(row));
        info.annotations.push({ type: 'seam', description: JSON.stringify(row) });
        writeFileSync(`${OUT}/${info.project.name}-dpr${dpr}-A${a}B${b}.json`, JSON.stringify(row, null, 1));
        const spec = { fixed: 0.084 / 7 * 200, a: 0.06 / (a === 0 ? 4 : a === 1 ? 5 : 6) * 200, b: 0.072 / (b === 0 ? 4 : b === 1 ? 5 : 6) * 200 };
        const dev = Object.entries(spec).map(([k2, v]) => Math.abs(m.widths[k2]! - v));
        info.annotations.push({ type: 'width-deviation', description: JSON.stringify({ spec, dev }) });
        console.log('WIDTH ' + JSON.stringify({ dpr, a, b, spec, measured: m.widths }));
        if (dpr === 2) for (const d of dev) expect(d).toBeLessThanOrEqual(0.5);
        if (a === 1 && b === 2) expect(worst).toBeLessThan(1.5);
        else expect(worst).toBeGreaterThanOrEqual(11);
      });
    }
  });
}
