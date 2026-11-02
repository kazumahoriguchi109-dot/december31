import { test } from './fixtures';

import { openGame } from './helpers';

// Synchronous cost of one full refresh (state -> DOM rebuild + WebGL draw), headless, 1366x768. Informational, not a pass/fail gate.
test('refresh cost p50/p95', async ({ page }) => {
  test.setTimeout(120_000); // software GL (SwiftShader) in headless is slow; real-GPU timing is still a human/hardware check
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const start of ['M1A_P04', 'M1A_P05']) {
    await openGame(page, `/?start=${start}`);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const g = (window as unknown as { __d31: { game: { setStatus(t: string): void } } }).__d31.game;
      const t: number[] = [];
      for (let i = 0; i < 200; i++) { const a = performance.now(); g.setStatus(`n${i}`); t.push(performance.now() - a); }
      t.sort((x, y) => x - y);
      return { p50: t[100]!, p95: t[190]!, max: t[199]! };
    });
    console.log(`PERF ${start} ${JSON.stringify(r)} renderer=${await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const e = c?.getExtension('WEBGL_debug_renderer_info'); return e ? c!.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })}`);
  }
});
