import { expect, test } from './fixtures';

import { openGame } from './helpers';
import { mkdirSync } from 'node:fs';

// Real rendered output for all nine settings at a 300 CSS px observation frame, DPR 1 and 2.
// Measures, on the actual canvas pixels, how much of the 0.4-radius target circle is covered by the three ribbons.
const OUT = 'handoff/evidence/cycle-001/p05';
mkdirSync(OUT, { recursive: true });

for (const dpr of [1, 2]) {
  test.describe(`DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr, viewport: { width: 1000, height: 700 } });
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      test(`A${a}/B${b}`, async ({ page }, info) => {
        await openGame(page, `/?start=M1A_P05&cam=observatory_observe&p05=${a},${b}`);
        await page.addStyleTag({ content: '.stage.square{width:300px !important;max-width:300px !important;min-width:300px !important}' });
        await page.waitForTimeout(250);
        const box = await page.locator('#stage').boundingBox();
        expect(Math.round(box!.width)).toBe(300);
        await page.locator('#stage').screenshot({ path: `${OUT}/${info.project.name}-dpr${dpr}-A${a}B${b}.png` });
        const m = await page.evaluate(() => {
          const cv = document.getElementById('world') as HTMLCanvasElement;
          const css = cv.getBoundingClientRect().width;
          const k = cv.width / css;
          const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
          const g = c2.getContext('2d')!; g.drawImage(cv, 0, 0);
          const data = g.getImageData(0, 0, cv.width, cv.height).data;
          const near = (r: number, gg: number, b: number, t: [number, number, number]) => Math.hypot(r - t[0], gg - t[1], b - t[2]) < 60;
          const isPiece = (x: number, y: number) => {
            const i = (Math.round(y) * cv.width + Math.round(x)) * 4;
            const r = data[i]!, gg = data[i + 1]!, b = data[i + 2]!;
            return near(r, gg, b, [255, 255, 255]) || near(r, gg, b, [0xff, 0xd1, 0x66]) || near(r, gg, b, [0x66, 0xd9, 0xef]);
          };
          const R = (0.4 / 0.75) * (css / 2) * k;   // target circle radius in canvas px
          const N = 1440;
          const covered: boolean[] = [];
          for (let i = 0; i < N; i++) {
            const th = (i / N) * Math.PI * 2;
            let hit = false;
            for (let dr = -1.5 * k; dr <= 1.5 * k && !hit; dr += 0.5) {
              hit = isPiece(cv.width / 2 + (R + dr) * Math.cos(th), cv.height / 2 - (R + dr) * Math.sin(th));
            }
            covered.push(hit);
          }
          // longest uncovered run (circular), in CSS px of arc length
          let best = 0, run = 0;
          for (let i = 0; i < 2 * N; i++) { if (!covered[i % N]) { run++; best = Math.max(best, Math.min(run, N)); } else run = 0; }
          const cov = covered.filter(Boolean).length / N;
          return { coverage: cov, maxGapCssPx: (best / N) * 2 * Math.PI * (R / k), cssW: css, canvasW: cv.width };
        });
        info.annotations.push({ type: 'measure', description: JSON.stringify(m) });
        console.log(`MEASURE dpr${dpr} A${a}B${b} ${JSON.stringify(m)}`);
        if (a === 1 && b === 2) {
          expect(m.coverage).toBeGreaterThan(0.97);
          expect(m.maxGapCssPx).toBeLessThan(3);
        } else {
          expect(m.maxGapCssPx).toBeGreaterThanOrEqual(11);
        }
      });
    }
  });
}
