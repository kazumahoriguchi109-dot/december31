// Original synthesized score + three Kenney CC0 interaction samples (assets/audio/SOURCES.md).
// Music is a slow looping pad per era; effects are short tones. Volumes come from the settings record.
type Era = 'E0' | 'E1' | 'E2' | 'E3';
const ROOTS: Record<Era, number[]> = {
  E0: [220, 261.63, 329.63, 261.63],        // thin, square-ish: the dot-picture world
  E1: [196, 246.94, 293.66, 246.94],
  E2: [174.61, 220, 261.63, 220],
  E3: [164.81, 207.65, 246.94, 329.63],     // warmer, wider: the lit world
};
const WAVE: Record<Era, OscillatorType> = { E0: 'square', E1: 'triangle', E2: 'sine', E3: 'sine' };

// Output scaling of the music and effects buses (the sliders multiply these). Raised after an offline measurement showed the
// default mix peaking near -26 dBFS; the loudest sliders with every effect at once must still stay under the clipping ceiling.
const MUSIC_GAIN = 0.55, SFX_GAIN = 0.75;
const SAMPLE_URLS = {
  press: new URL('./samples/press.wav', import.meta.url).href,
  move: new URL('./samples/move.wav', import.meta.url).href,
  deny: new URL('./samples/deny.wav', import.meta.url).href,
};


export class Mixer {
  private ctx: AudioContext | null = null;
  private master!: GainNode; private music!: GainNode; private sfx!: GainNode;
  private vol = { master: 0.7, music: 0.6, sfx: 0.8 };
  private era: Era = 'E0';
  private buffers = new Map<string, AudioBuffer>();
  private sampleLoad: Promise<void> | null = null;
  private activeEffects = new Map<string, { bus: GainNode; sources: Set<AudioScheduledSourceNode> }>();
  private readonly visibilityChanged = () => {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return;
    void (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {});
  };
  private timer = 0; private step = 0;
  /** For tests and the captions: what was last played. */
  last = { music: '' as string, sfx: '' as string, count: 0 };

  setVolumes(master: number, music: number, sfx: number) {
    this.vol = { master, music, sfx };
    if (this.ctx) this.apply();
  }
  private apply() {
    const t = this.ctx!.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.music.gain.cancelScheduledValues(t);
    this.sfx.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music * MUSIC_GAIN, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx * SFX_GAIN, t, 0.05);
  }
  /** Audio may only start after a user gesture; call from input handlers. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain();
      // GainNode starts at 1. Set saved levels before connecting: a muted start must never leak a ramp from full volume.
      this.master.gain.value = this.vol.master;
      this.music.gain.value = this.vol.music * MUSIC_GAIN;
      this.sfx.gain.value = this.vol.sfx * SFX_GAIN;
      this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination);
      void this.loadSamples(this.ctx);
      this.timer = window.setInterval(() => this.tick(), 2400);
      document.addEventListener('visibilitychange', this.visibilityChanged);
      this.tick();
    }
    if (!document.hidden) void this.ctx.resume().catch(() => {});
  }
  // Decode after a user gesture. Missing assets fall back to the original synth voice.
  private loadSamples(ctx: BaseAudioContext): Promise<void> {
    return this.sampleLoad ??= Promise.all(Object.entries(SAMPLE_URLS).map(async ([name, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(name, buffer);
      } catch { /* no network/storage dependency for playing the game */ }
    })).then(() => undefined);
  }
  get loadedSamples() { return [...this.buffers.keys()]; }
  private sample(name: string, at: number, output: GainNode, sources?: Set<AudioScheduledSourceNode>): boolean {
    const buffer = this.buffers.get(name);
    if (!buffer) return false;
    const source = this.ctx!.createBufferSource(); source.buffer = buffer;
    const gain = this.ctx!.createGain(); gain.gain.value = name === 'deny' ? .2 : .28;
    sources?.add(source);
    source.connect(gain); gain.connect(output);
    source.onended = () => { source.disconnect(); gain.disconnect(); sources?.delete(source); this.releaseOutput(output, sources); };
    source.start(at); return true;
  }
  private releaseOutput(output: GainNode, sources?: Set<AudioScheduledSourceNode>) {
    if (!sources || sources.size) return;
    output.disconnect();
    for (const [name, voice] of this.activeEffects) if (voice.sources === sources) this.activeEffects.delete(name);
  }
  setEra(e: string) { this.era = e in ROOTS ? (e as Era) : 'E2'; } // the room (era 'ROOM') uses the calm E2 voice
  private tone(freq: number, start: number, dur: number, type: OscillatorType, to: GainNode, peak: number, sources?: Set<AudioScheduledSourceNode>) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.08, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    sources?.add(o);
    o.onended = () => { o.disconnect(); g.disconnect(); sources?.delete(o); this.releaseOutput(to, sources); };
    o.connect(g); g.connect(to); o.start(start); o.stop(start + dur + 0.05);
  }
  private tick(at?: number) {
    if (!this.ctx || (at === undefined && this.ctx.state !== 'running')) return;
    const notes = ROOTS[this.era]; const f = notes[this.step++ % notes.length]!;
    const t = (at ?? this.ctx.currentTime) + 0.02;
    this.tone(f / 2, t, 2.6, WAVE[this.era], this.music, 0.5);
    this.tone(f, t + 0.3, 2.0, WAVE[this.era], this.music, 0.25);
    this.tone(f * 1.5, t + 0.9, 1.4, 'sine', this.music, 0.18);
    // a small melody over the pad: a looping pentatonic phrase per era (rests keep it gentle)
    const PH: Record<Era, number[]> = { E0: [0, 2, 4, 2, 0, -1, 2, -1], E1: [0, 2, 4, 5, 4, 2, 0, -1], E2: [4, 2, 0, 2, 4, 7, 4, -1], E3: [7, 4, 5, 4, 2, 4, 0, 2] };
    const SCALE = [0, 2, 4, 7, 9];
    const ph = PH[this.era]; const base = f * 2;
    for (let i = 0; i < 4; i++) {
      const deg = ph[((this.step - 1) * 4 + i) % ph.length]!;
      if (deg < 0) continue;
      const semis = SCALE[deg % 5]! + 12 * Math.floor(deg / 5);
      this.tone(base * 2 ** (semis / 12), t + 0.15 + i * 0.6, 0.7, this.era === 'E0' ? 'square' : 'triangle', this.music, this.era === 'E0' ? 0.12 : 0.22);
    }
    this.last.music = this.era;
  }
  play(name: 'move' | 'press' | 'solve' | 'cue' | 'deny' | 'line', at?: number) {
    this.last.sfx = name; this.last.count++;
    if (!this.ctx || (at === undefined && this.ctx.state !== 'running')) return;
    const t = at ?? this.ctx.currentTime;
    let output = this.sfx, sources: Set<AudioScheduledSourceNode> | undefined;
    if (at === undefined) {
      // A fresh gesture replaces the same feedback; a 15ms release avoids an abrupt sample cut and unbounded synth overlap.
      const previous = this.activeEffects.get(name);
      if (previous) {
        previous.bus.gain.cancelScheduledValues(t);
        previous.bus.gain.setValueAtTime(previous.bus.gain.value, t);
        previous.bus.gain.linearRampToValueAtTime(0, t + .015);
        for (const source of previous.sources) source.stop(t + .016);
      }
      output = this.ctx.createGain(); output.connect(this.sfx); sources = new Set();
      this.activeEffects.set(name, { bus: output, sources });
    }
    if (this.sample(name, t, output, sources)) return;
    const s = (f: number, d: number, off = 0, type: OscillatorType = 'triangle', p = 0.6) => this.tone(f, t + off, d, type, output, p, sources);
    switch (name) {
      case 'move': s(330, 0.12); break;
      case 'press': s(440, 0.1, 0, 'square', 0.3); break;
      case 'line': s(660, 0.04, 0, 'sine', 0.15); break;
      case 'deny': s(180, 0.18, 0, 'sawtooth', 0.25); break;
      case 'solve': s(523.25, 0.3); s(659.25, 0.3, 0.1); s(783.99, 0.5, 0.2); break;
      case 'cue': s(392, 0.9, 0, 'sine', 0.5); s(587.33, 0.9, 0.35, 'sine', 0.4); break;
    }
  }
  /**
   * Renders a scripted session offline (no speakers) so tests can measure silence, clipping and transitions. Not used in play.
   * Eras change at tick boundaries exactly as in play; `volumes` are the three settings sliders (0..1).
   */
  async renderOffline(plan: { era: string; seconds: number }[], sfx: { name: Parameters<Mixer['play']>[0]; at: number }[] = [], volumes = { master: 0.7, music: 0.6, sfx: 0.8 }, sampleRate = 22050): Promise<Float32Array> {
    const total = plan.reduce((n, p) => n + p.seconds, 0);
    const ctx = new OfflineAudioContext(1, Math.ceil(total * sampleRate), sampleRate);
    this.ctx = ctx as unknown as AudioContext;
    this.master = ctx.createGain(); this.music = ctx.createGain(); this.sfx = ctx.createGain();
    this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(ctx.destination);
    this.master.gain.value = volumes.master; this.music.gain.value = volumes.music * MUSIC_GAIN; this.sfx.gain.value = volumes.sfx * SFX_GAIN;
    await this.loadSamples(ctx);
    let t0 = 0;
    for (const seg of plan) {
      this.setEra(seg.era);
      for (let t = t0; t < t0 + seg.seconds; t += 2.4) this.tick(t);
      t0 += seg.seconds;
    }
    for (const e of sfx) this.play(e.name, e.at);
    const buf = await ctx.startRendering();
    this.ctx = null;
    return buf.getChannelData(0);
  }
  dispose() {
    clearInterval(this.timer); document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.activeEffects.clear();
    const ctx = this.ctx; this.ctx = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }
}
