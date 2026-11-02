import { expect, test } from './fixtures';

import { openGame } from './helpers';
import { mkdirSync } from 'node:fs';

const OUT = 'handoff/evidence/cycle-001/p04';
mkdirSync(OUT, { recursive: true });
// polygon area from data/puzzles.json p04Geometry.frontMaskPolygonUV over the wall_base_front frustum (8 x 4.5 m)
const EXPECTED_FRACTION = 6.0 / 36;

async function wallFraction(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const cv = document.getElementById('world') as HTMLCanvasElement;
    const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
    const g = c2.getContext('2d')!; g.drawImage(cv, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let n = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4;
      if (d[i]! > 150 && d[i + 1]! > 150 && d[i + 2]! > 140) { n++; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    }
    return { frac: n / (cv.width * cv.height), w: cv.width, h: cv.height, bbox: [minx / cv.width, maxx / cv.width, miny / cv.height, maxy / cv.height] };
  });
}

for (const era of ['E0', 'E1', 'E2']) {
  test(`front silhouette ${era}`, async ({ page }, info) => {
    await openGame(page, `/?start=M1A_P04&era=${era}`);
    await page.waitForTimeout(300);
    await page.locator('#stage').screenshot({ path: `${OUT}/${info.project.name}-front-${era}.png` });
    const m = await wallFraction(page);
    console.log(`MEASURE front ${era} ${JSON.stringify(m)} expected ${EXPECTED_FRACTION.toFixed(4)}`);
    expect(Math.abs(m.frac - EXPECTED_FRACTION) / EXPECTED_FRACTION).toBeLessThan(0.05);
  });
}
test('side view thickness is visible (E2)', async ({ page }, info) => {
  await openGame(page, '/?start=M1A_P04&era=E2');
  await page.locator('#controls [data-action-id="view_wall_side"]').click();
  await page.waitForTimeout(300);
  await page.locator('#stage').screenshot({ path: `${OUT}/${info.project.name}-side-E2.png` });
});
