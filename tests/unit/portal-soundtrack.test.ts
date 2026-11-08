import {describe,it,expect} from 'vitest';
import {createPortalSamples,PORTAL_SECONDS,PORTAL_MOTION_SCALE} from '../../src/journey/portalSoundtrack';
describe('original portal soundtrack',()=>{
 it('uses a fifteen-second original score without stretching its pitch',()=>{
  expect(PORTAL_SECONDS).toBe(15);expect(PORTAL_MOTION_SCALE).toBe(2.5);
  const a=createPortalSamples(8000),b=createPortalSamples(8000);
  expect(a).toHaveLength(15*8000);expect(a.every((v,i)=>v===b[i])).toBe(true);
  expect(a[0]).toBe(0);expect(a.at(-1)).toBe(0);
  expect(a.every(Number.isFinite)).toBe(true);
  let peak=0;for(const sample of a)peak=Math.max(peak,Math.abs(sample));
  expect(peak).toBeGreaterThan(.04);expect(peak).toBeLessThan(.4);
  for(const seconds of [1,3,6,9,12,14]){
   const section=a.slice(seconds*8000,(seconds+1)*8000),rms=Math.sqrt(section.reduce((sum,v)=>sum+v*v,0)/section.length);
   expect(rms).toBeGreaterThan(.005);
  }
 });
 it('fades the shortened score smoothly rather than cutting an unfinished phrase',()=>{
  const a=createPortalSamples(8000);
  const peak=(values:Float32Array)=>values.reduce((m,v)=>Math.max(m,Math.abs(v)),0);
  expect(peak(a.slice(0,80))).toBeLessThan(.002);
  expect(peak(a.slice(-80))).toBeLessThan(.002);
  expect(peak(a.slice(13*8000,14*8000))).toBeGreaterThan(.02);
 });
 it('rejects invalid sample rates',()=>{for(const rate of [0,NaN,1000,200000])expect(()=>createPortalSamples(rate)).toThrow();});
});
