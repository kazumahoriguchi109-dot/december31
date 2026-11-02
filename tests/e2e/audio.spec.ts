import { expect, test } from './fixtures';

// Automated audio sanity checks on an OFFLINE render of the real Mixer (no speakers). They can catch: no output, long silent runs,
// clipping at the loudest settings, jumps at era changes, and volume sliders that do nothing. They say NOTHING about whether the
// music is pleasant or emotionally right: that stays a human listening check (QUALITY_BACKLOG Q11).
const LIMITS = { minRms: 0.003, maxSilentRunS: 2.0, peakCeiling: 0.95, maxSampleStep: 0.25, maxEnvelopeJumpDb: 12 };  // (maxEnvelopeJumpDb is informational; the assertion compares with a steady-state baseline)

test('audio: every era is audible, never clips, and has no long silence', async ({ page }) => {
  await page.goto('/');
  const res = await page.evaluate(async (L) => {
    const { Mixer } = await import(/* @vite-ignore */ '/src/audio/mixer.ts') as typeof import('../../src/audio/mixer');
    const SR = 22050;
    const win = (x: Float32Array, s: number, w: number) => { let a = 0; const e = Math.min(x.length, s + w); for (let i = s; i < e; i++) a += x[i]! * x[i]!; return Math.sqrt(a / Math.max(1, e - s)); };
    const stats = (x: Float32Array) => {
      let peak = 0, sq = 0, clipped = 0, maxStep = 0;
      for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]!); if (v > peak) peak = v; sq += x[i]! * x[i]!; if (v >= 0.99) clipped++; if (i && Math.abs(x[i]! - x[i - 1]!) > maxStep) maxStep = Math.abs(x[i]! - x[i - 1]!); }
      let run = 0, longest = 0; const W = Math.round(SR * 0.1);
      for (let s = 0; s < x.length; s += W) { if (win(x, s, W) < 1e-4) { run += 0.1; longest = Math.max(longest, run); } else run = 0; }
      return { peak, rms: Math.sqrt(sq / x.length), clipped, maxStep, longestSilentS: longest };
    };
    const out: Record<string, unknown> = {};
    const loud = { master: 1, music: 1, sfx: 1 };
    for (const era of ['E0', 'E1', 'E2', 'E3', 'ROOM']) {
      const m = new Mixer();
      out[`era ${era} default`] = stats(await m.renderOffline([{ era, seconds: 24 }], [], undefined, SR));
      out[`era ${era} max sliders`] = stats(await new Mixer().renderOffline([{ era, seconds: 24 }], [], loud, SR));
    }
    // worst case: loudest sliders, every effect at once on top of the music
    const all = (['move', 'press', 'solve', 'cue', 'deny', 'line'] as const).map((name) => ({ name, at: 8 }));
    out['all sfx at once, max sliders'] = stats(await new Mixer().renderOffline([{ era: 'E3', seconds: 14 }], all, loud, SR));
    // each effect alone (music muted) must be audible
    for (const name of ['move', 'press', 'solve', 'cue', 'deny', 'line'] as const) {
      const x = await new Mixer().renderOffline([{ era: 'E2', seconds: 2 }], [{ name, at: 0.2 }], { master: 1, music: 0, sfx: 1 }, SR);
      out[`sfx ${name} alone`] = stats(x);
    }
    // sliders must do something: master 0 is silent, and halving master halves the level
    out['master 0'] = stats(await new Mixer().renderOffline([{ era: 'E2', seconds: 6 }], [{ name: 'solve', at: 1 }], { master: 0, music: 1, sfx: 1 }, SR));
    const full = stats(await new Mixer().renderOffline([{ era: 'E2', seconds: 12 }], [], { master: 1, music: 0.6, sfx: 0.8 }, SR));
    const half = stats(await new Mixer().renderOffline([{ era: 'E2', seconds: 12 }], [], { master: 0.5, music: 0.6, sfx: 0.8 }, SR));
    out['half/full rms ratio'] = half.rms / full.rms;
    // era changes: loudness envelope around every boundary (steady music across the join)
    const jumps: Record<string, number> = {};
    for (const [a, b] of [['E0', 'E1'], ['E1', 'E2'], ['E2', 'E3'], ['E3', 'ROOM']] as const) {
      const x = await new Mixer().renderOffline([{ era: a, seconds: 12 }, { era: b, seconds: 12 }], [], undefined, SR);
      const W = Math.round(SR * 0.25); let worst = 0;
      for (let s = Math.round(SR * 9); s + 2 * W < Math.round(SR * 15); s += W) {
        const r1 = win(x, s, W), r2 = win(x, s + W, W);
        if (r1 > 1e-4 && r2 > 1e-4) worst = Math.max(worst, Math.abs(20 * Math.log10(r2 / r1)));
      }
      jumps[`${a}->${b}`] = worst;
    }
    // baseline: the same measurement on a render with NO era change (note attacks alone cause jumps too)
    const steady: Record<string, number> = {};
    for (const era of ['E0', 'E1', 'E2', 'E3']) {
      const x = await new Mixer().renderOffline([{ era, seconds: 24 }], [], undefined, SR);
      const W = Math.round(SR * 0.25); let worst = 0;
      for (let s = Math.round(SR * 9); s + 2 * W < Math.round(SR * 15); s += W) {
        const r1 = win(x, s, W), r2 = win(x, s + W, W);
        if (r1 > 1e-4 && r2 > 1e-4) worst = Math.max(worst, Math.abs(20 * Math.log10(r2 / r1)));
      }
      steady[era] = worst;
    }
    out['steady jump dB'] = steady;
    out['envelope jump dB'] = jumps;
    return { out, L };
  }, LIMITS);
  console.log('AUDIO ' + JSON.stringify(res.out));
  const o = res.out as Record<string, any>;
  for (const k of Object.keys(o).filter((k) => k.startsWith('era '))) {
    expect(o[k].rms, k + ' not silent').toBeGreaterThan(LIMITS.minRms);
    expect(o[k].peak, k + ' headroom').toBeLessThan(LIMITS.peakCeiling);
    expect(o[k].clipped, k + ' clipped samples').toBe(0);
    expect(o[k].longestSilentS, k + ' silent run').toBeLessThan(LIMITS.maxSilentRunS);
    if (!k.startsWith('era E0')) expect(o[k].maxStep, k + ' sample step (a click)').toBeLessThan(LIMITS.maxSampleStep); // E0 is a square wave: its edges are instantaneous by design
  }
  expect(o['all sfx at once, max sliders'].peak).toBeLessThan(LIMITS.peakCeiling);
  expect(o['all sfx at once, max sliders'].clipped).toBe(0);
  for (const n of ['move', 'press', 'solve', 'cue', 'deny', 'line']) {
    expect(o[`sfx ${n} alone`].peak, `sfx ${n} audible`).toBeGreaterThan(0.01);
    expect(o[`sfx ${n} alone`].peak, `sfx ${n} headroom`).toBeLessThan(LIMITS.peakCeiling);
  }
  expect(o['master 0'].peak).toBeLessThan(1e-6);
  expect(o['half/full rms ratio']).toBeGreaterThan(0.4); expect(o['half/full rms ratio']).toBeLessThan(0.6);
  // an era change may not be abrupter than the music is within itself (note attacks); allow 3 dB over the worst steady era
  const steadyWorst = Math.max(...Object.values(o['steady jump dB'] as Record<string, number>));
  for (const [k, v] of Object.entries(o['envelope jump dB'] as Record<string, number>)) expect(v, `era change ${k} vs steady ${steadyWorst.toFixed(1)} dB`).toBeLessThan(steadyWorst + 3);
});
