import { expect, test } from '@playwright/test';

// Shipped UI only: no imports, game hooks, storage writes, or mixer-state changes.
// Instrumentation patches AudioNode.connect to observe the gain at the destination connection,
// adding a parallel analyser with the original connect method. The existing output is untouched.
// Source.start wrappers only count scheduled sources; they forward all arguments unchanged.
// This measures browser audio signals, not perceived loudness or a human listening session.
test('saved master mute survives reload and the first new-game gesture', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const observed = { gainsAtConnection: [] as number[], peak: 0, readings: 0, sourcesStarted: 0, states: [] as string[] };
    (window as any).__muteObservation = observed;
    const originalConnect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: any[]) {
      const destination = args[0];
      if (destination === this.context.destination && this instanceof GainNode) {
        observed.gainsAtConnection.push(this.gain.value);
        const analyser = this.context.createAnalyser(); analyser.fftSize = 2048;
        Reflect.apply(originalConnect, this, [analyser]);
        const samples = new Float32Array(analyser.fftSize);
        const context = this.context;
        window.setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          observed.readings++;
          if (!observed.states.includes(context.state)) observed.states.push(context.state);
          for (const sample of samples) observed.peak = Math.max(observed.peak, Math.abs(sample));
        }, 10);
      }
      return Reflect.apply(originalConnect, this, args);
    } as typeof AudioNode.prototype.connect;
    for (const prototype of [OscillatorNode.prototype, AudioBufferSourceNode.prototype]) {
      const originalStart = prototype.start;
      prototype.start = function (this: AudioScheduledSourceNode, ...args: any[]) {
        observed.sourcesStarted++;
        return Reflect.apply(originalStart, this, args);
      } as typeof prototype.start;
    }
  });
  const observation = () => page.evaluate(() => (window as any).__muteObservation as {
    gainsAtConnection: number[]; peak: number; readings: number; sourcesStarted: number; states: string[];
  });
  await page.goto('./');
  await page.locator('#b-new').click();
  await page.locator('[data-new="manual-2"]').click();
  await page.locator('#dlg [data-action-id="dlg_next"]').click();
  // Positive control: the analyser must see normal audio before the UI mutes it.
  await expect.poll(async () => (await observation()).peak).toBeGreaterThan(0.001);
  const audible = await observation();
  await page.reload();
  await page.locator('#b-set').click();
  await page.locator('#s-master').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('#s-master')).toHaveValue('0');
  await page.locator('#set-save').click();
  await expect(page.locator('#b-new')).toBeVisible(); // only reached after settings persistence succeeds
  await page.reload();
  await expect(page.locator('#b-new')).toBeVisible();
  expect((await observation()).gainsAtConnection).toEqual([]);
  await page.locator('#b-new').click(); // start a fresh game through the normal UI
  await page.locator('[data-new="manual-1"]').click();
  await page.locator('#c-yes').click(); // positive-control run already created an autosave
  await expect(page.locator('#dlg')).toBeVisible();
  await page.locator('#dlg [data-action-id="dlg_next"]').click(); // first mounted-game gesture unlocks audio
  // Covers the initial feedback and the first scheduled music tick (2.4 seconds).
  await expect.poll(async () => (await observation()).sourcesStarted, { timeout: 10000 }).toBeGreaterThan(0);
  await page.waitForTimeout(3200);
  const muted = await observation();
  expect(muted.gainsAtConnection).toEqual([0]);
  expect(muted.states).toContain('running');
  expect(muted.readings).toBeGreaterThan(20);
  expect(muted.peak).toBe(0);
  // A second reload reopens settings through the UI to verify the stored slider value.
  await page.reload();
  await page.locator('#b-set').click();
  await expect(page.locator('#s-master')).toHaveValue('0');
  expect(errors).toEqual([]);
  console.log('SHIPPED MUTE ' + JSON.stringify({ audible, muted, storedMaster: 0 }));
});
