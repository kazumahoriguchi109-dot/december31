import type { Era } from './contract';

/** Original quiet procedural score and footsteps; no downloaded audio or pre-gesture context.
 * Score/feedback: at most 16 oscillator voices, each envelope <= .06.
 * The portal uses separate filtered-noise and tone envelopes through the same
 * volume-controlled master. Parameter limits are not a listening validation. */
export function createJourneyAudio() {
  let context: AudioContext | null = null, master: GainNode | null = null;
  let volume = .65, era: Era = 0, timer = 0, nextBar = 0, bar = 0, lastStep = -Infinity, foot = 0, disposed = false;
  const voices = new Set<OscillatorNode>();
  const lastEffect = new Map<string, number>();
  const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const ready = () => context?.state === 'running' && !document.hidden;
  function tone(frequency: number, at: number, duration: number, peak = .04, type: OscillatorType = 'sine') {
    if (!context || !master || voices.size >= 16) return;
    const source = context.createOscillator(), envelope = context.createGain();
    source.type = type; source.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(Math.min(.06, Math.max(0, peak)), at + Math.min(.12, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(.00001, at + duration);
    envelope.gain.linearRampToValueAtTime(0, at + duration + .015);
    source.connect(envelope); envelope.connect(master); voices.add(source);
    source.onended = () => { source.disconnect(); envelope.disconnect(); voices.delete(source); };
    source.start(at); source.stop(at + duration + .02);
  }
  function score() {
    if (!ready() || !context || context.currentTime < nextBar) return;
    const t = context.currentTime + .025;
    nextBar = t + 3.2;
    // The same four-bar phrase gains harmony and a high answering voice as the world develops.
    const root = [130.81, 110, 146.83, 98][bar++ % 4]!;
    tone(root, t, 2.8, .035, era === 0 ? 'triangle' : 'sine');
    tone(root * 2, t + .2, 1.8, .022, 'triangle');
    if (era >= 1) tone(root * 1.5, t + .35, 2.3, .025);
    if (era >= 2) tone(root * 2.5, t + .7, 1.6, .018);
    if (era >= 3) { tone(root * 4, t + 1.1, .7, .014); tone(root * 3, t + 2, .65, .012); }
  }
  function visibility() {
    if (!context || context.state === 'closed') return;
    if (document.hidden) void context.suspend().catch(() => {});
    else void context.resume().then(score).catch(() => {});
  }
  function unlock() {
    if (disposed || document.hidden) return;
    if (!context) {
      const AC = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (!AC) return;
      try { context = new AC(); } catch { return; }
      master = context.createGain(); master.gain.value = volume * .55;
      master.connect(context.destination);
      document.addEventListener('visibilitychange', visibility);
      timer = window.setInterval(score, 250);
    }
    if (context.state === 'running') score();
    else void context.resume().then(score).catch(() => {});
  }
  function setVolume(value: number) {
    volume = clamp(value);
    if (!context || !master) return;
    const at = context.currentTime;
    master.gain.cancelScheduledValues(at);
    master.gain.setValueAtTime(master.gain.value, at);
    master.gain.linearRampToValueAtTime(volume * .55, at + .025);
  }
  function play(id: string) {
    if (!ready() || !context) return;
    const key = ({press:'interact',line:'notice',cue:'evolution',move:'interact'} as Record<string,string>)[id] ?? id;
    const at = context.currentTime;
    // A shared effect cooldown prevents aliases or arbitrary event IDs from producing a dense stack.
    const category = ['solve','evolution','deny'].includes(key) ? key : 'feedback';
    const cooldown = category === 'feedback' ? .12 : .6;
    if (at - (lastEffect.get(category) ?? -Infinity) < cooldown) return;
    lastEffect.set(category, at);
    if (key === 'solve' || key === 'evolution') {
      [261.63,329.63,392,523.25].forEach((f,i)=>tone(f,at+i*.14,.65,key==='evolution'?.045:.035));
    } else if (key === 'deny') tone(174.61,at,.14,.025,'triangle');
    else tone(key === 'notice' ? 523.25 : 392, at, .10, .022, 'sine');
  }
  function step(running: boolean) {
    if (!ready() || !context) return;
    const at = context.currentTime;
    if (at - lastStep < (running ? .28 : .44)) return;
    lastStep = at;
    // Alternating short, low thuds contrast with the pitched menu feedback; callers invoke only while moving.
    const frequency = (++foot % 2 ? 108 : 92);
    tone(frequency, at, .075, running ? .032 : .023);
    tone(frequency * 1.6, at + .008, .045, .009, 'triangle');
  }
  function portal() {
    if (!ready() || !context || !master) return () => {};
    // Original synthesized wind sweep and a soft landing, no sampled third-party material.
    const ctx=context, bus=ctx.createGain();bus.gain.value=1;bus.connect(master);
    const nodes:AudioScheduledSourceNode[]=[];
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*6),ctx.sampleRate),data=buffer.getChannelData(0);
    let seed=123456789,low=0;
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;low=low*.94+(seed/4294967296*2-1)*.06;data[i]=low;}
    const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=buffer;filter.type='lowpass';
    const at=ctx.currentTime;filter.frequency.setValueAtTime(250,at);filter.frequency.exponentialRampToValueAtTime(1800,at+3.6);filter.frequency.exponentialRampToValueAtTime(120,at+5.8);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.2,at+2.5);gain.gain.linearRampToValueAtTime(.11,at+4.6);gain.gain.linearRampToValueAtTime(0,at+6);
    noise.connect(filter);filter.connect(gain);gain.connect(bus);noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};noise.start(at);noise.stop(at+6);nodes.push(noise);
    for(const [frequency,start,duration,peak] of [[164.81,0,4.8,.018],[220,.15,4.6,.014],[82.41,4.8,.9,.04]]){
      const osc=ctx.createOscillator(),env=ctx.createGain();osc.frequency.setValueAtTime(frequency!,at+start!);osc.frequency.exponentialRampToValueAtTime(frequency!*.67,at+start!+duration!);env.gain.setValueAtTime(0,at+start!);env.gain.linearRampToValueAtTime(peak!,at+start!+.2);env.gain.linearRampToValueAtTime(0,at+start!+duration!);osc.connect(env);env.connect(bus);osc.onended=()=>{osc.disconnect();env.disconnect();};osc.start(at+start!);osc.stop(at+start!+duration!);nodes.push(osc);
    }
    let stopped=false;return ()=>{if(stopped)return;stopped=true;bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(0,ctx.currentTime);for(const node of nodes){try{node.stop();}catch{}node.disconnect();}filter.disconnect();gain.disconnect();bus.disconnect();};
  }
  function dispose() {
    disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', visibility);
    for (const source of voices) { source.onended = null; source.stop(); source.disconnect(); }
    voices.clear(); lastEffect.clear();
    const old = context; context = null; master = null;
    if (old && old.state !== 'closed') void old.close().catch(() => {});
  }
  return {unlock,setVolume,setEra(value: Era) { if ([0,1,2,3].includes(value)) era = value; },play,step,portal,dispose};
}
