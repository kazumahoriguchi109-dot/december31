/** Original six-second suction cue and music. No samples or third-party compositions. */
export const PORTAL_SECONDS=6;
export const PORTAL_SAMPLE_RATE=44100;
export const PORTAL_MOTION_SCALE=1;
export function createPortalSamples(sampleRate:number):Float32Array<ArrayBuffer> {
 if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('Unsupported portal sample rate');
 const samples=new Float32Array(Math.round(sampleRate*PORTAL_SECONDS));
 const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 function note(frequency:number,start:number,duration:number,level:number,attack:number,pad=false){
  const from=Math.max(0,Math.floor(start*sampleRate)),to=Math.min(samples.length,Math.ceil((start+duration)*sampleRate));
  for(let i=from;i<to;i++){
   const age=i/sampleRate-start,release=Math.min(pad?1.1:.65,duration*.4);
   const envelope=smooth(age/attack)*smooth((duration-age)/release)*(pad?1:Math.exp(-age*.38));
   const phase=2*Math.PI*frequency*age;
   const wave=pad?Math.sin(phase):Math.sin(phase)*.83+Math.sin(phase*2)*.12+Math.sin(phase*3)*.05;
   samples[i]!+=wave*envelope*level;
  }
 }
 // Six warm chords arranged for six seconds. Frequencies remain unchanged;
 // only phrase timing and envelopes are composed for the shorter scene.
 const chords=[[130.8128,164.8138,195.9977],[110,130.8128,164.8138],[130.8128,174.6141,220],[123.4708,146.8324,195.9977],[123.4708,164.8138,195.9977],[130.8128,195.9977,261.6256]];
 chords.forEach((chord,i)=>chord.forEach(f=>note(f,i*.85,1.4,.018,.18,true)));
 // An original sparse bell-like answering phrase over the moving picture.
 [[1,523.2511],[2.7,659.2551],[4.4,587.3295],[6.1,523.2511],[7.8,440],[9.5,523.2511],[11.2,587.3295],[12.9,698.4565],[14.6,659.2551],[16.3,587.3295],[18,493.8833],[19.7,587.3295],[21.4,659.2551],[23.1,587.3295],[24.8,523.2511],[27,391.9954]].forEach(([t,f])=>note(f!,t!*.18,.75,.04,.025));
 // A quiet, low-pass wind bed, shaped over the complete flight, never time-stretched audio.
 let seed=123456789,low=0;
 const smoothing=Math.exp(-2*Math.PI*360/sampleRate);
 for(let i=0;i<samples.length;i++){
  const t=i/sampleRate,p=t/PORTAL_SECONDS;
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  low=low*smoothing+(seed/4294967296*2-1)*(1-smoothing);
  samples[i]!+=low*.07*smooth(p/.28)*(1-smooth((p-.68)/.28));
 }
 // Accelerating airy suction, followed by a falling "hyun" at the pull-through.
 let wind=0,phase=0;
 for(let i=0;i<samples.length;i++){
  const t=i/sampleRate,build=smooth((t-.6)/3.9),tail=1-smooth((t-4.9)/.8);
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=seed/4294967296*2-1;
  const cutoff=250+build*2600,alpha=1-Math.exp(-2*Math.PI*cutoff/sampleRate);
  wind+=alpha*(noise-wind);
  samples[i]!+=wind*.14*build*tail;
  const age=t-4.15;
  if(age>=0&&age<1.2){
   const u=age/1.2;phase+=2*Math.PI*(1100*Math.pow(.12,u))/sampleRate;
   samples[i]!+=Math.sin(phase)*.07*smooth(age/.10)*(1-smooth((age-.25)/.95));
  }
 }
 note(82.4069,5.1,.85,.035,.08,true);
 // Whole-track fades prevent discontinuities at either end and leave room below clipping.
 for(let i=0;i<samples.length;i++){
  const t=i/sampleRate;
  samples[i]!*=smooth(t/.2)*smooth((PORTAL_SECONDS-t)/.5);
 }
 samples[0]=0;samples[samples.length-1]=0;
 return samples;
}
