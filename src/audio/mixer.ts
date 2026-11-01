// Original, synthesized audio (Web Audio oscillators only; no sample files, nothing borrowed).
// Music is a slow looping pad per era; effects are short tones. Volumes come from the settings record.
type Era = 'E0' | 'E1' | 'E2' | 'E3';
const ROOTS: Record<Era, number[]> = {
  E0: [220, 261.63, 329.63, 261.63],        // thin, square-ish: the dot-picture world
  E1: [196, 246.94, 293.66, 246.94],
  E2: [174.61, 220, 261.63, 220],
  E3: [164.81, 207.65, 246.94, 329.63],     // warmer, wider: the lit world
};
const WAVE: Record<Era, OscillatorType> = { E0: 'square', E1: 'triangle', E2: 'sine', E3: 'sine' };

export class Mixer {
  private ctx: AudioContext | null = null;
  private master!: GainNode; private music!: GainNode; private sfx!: GainNode;
  private vol = { master: 0.7, music: 0.6, sfx: 0.8 };
  private era: Era = 'E0';
  private timer = 0; private step = 0;
  /** For tests and the captions: what was last played. */
  last = { music: '' as string, sfx: '' as string, count: 0 };

  setVolumes(master: number, music: number, sfx: number) {
    this.vol = { master, music, sfx };
    if (this.ctx) this.apply();
  }
  private apply() {
    const t = this.ctx!.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music * 0.25, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx * 0.5, t, 0.05);
  }
  /** Audio may only start after a user gesture; call from input handlers. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain();
      this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination);
      this.apply();
      this.timer = window.setInterval(() => this.tick(), 2400);
      document.addEventListener('visibilitychange', () => { if (document.hidden) void this.ctx?.suspend(); else void this.ctx?.resume(); });
      this.tick();
    }
    void this.ctx.resume();
  }
  setEra(e: string) { this.era = e in ROOTS ? (e as Era) : 'E2'; } // the room (era 'ROOM') uses the calm E2 voice
  private tone(freq: number, start: number, dur: number, type: OscillatorType, to: GainNode, peak: number) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.08, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(to); o.start(start); o.stop(start + dur + 0.05);
  }
  private tick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const notes = ROOTS[this.era]; const f = notes[this.step++ % notes.length]!;
    const t = this.ctx.currentTime + 0.02;
    this.tone(f / 2, t, 2.6, WAVE[this.era], this.music, 0.5);
    this.tone(f, t + 0.3, 2.0, WAVE[this.era], this.music, 0.25);
    this.tone(f * 1.5, t + 0.9, 1.4, 'sine', this.music, 0.18);
    this.last.music = this.era;
  }
  play(name: 'move' | 'press' | 'solve' | 'cue' | 'deny' | 'line') {
    this.last.sfx = name; this.last.count++;
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const s = (f: number, d: number, off = 0, type: OscillatorType = 'triangle', p = 0.6) => this.tone(f, t + off, d, type, this.sfx, p);
    switch (name) {
      case 'move': s(330, 0.12); break;
      case 'press': s(440, 0.1, 0, 'square', 0.3); break;
      case 'line': s(660, 0.04, 0, 'sine', 0.15); break;
      case 'deny': s(180, 0.18, 0, 'sawtooth', 0.25); break;
      case 'solve': s(523.25, 0.3); s(659.25, 0.3, 0.1); s(783.99, 0.5, 0.2); break;
      case 'cue': s(392, 0.9, 0, 'sine', 0.5); s(587.33, 0.9, 0.35, 'sine', 0.4); break;
    }
  }
  dispose() { clearInterval(this.timer); void this.ctx?.close(); this.ctx = null; }
}
