import {describe,it,expect} from 'vitest';
import {createPortalSamples,PORTAL_SECONDS,PORTAL_MOTION_SCALE} from '../../src/journey/portalSoundtrack';
describe('original portal soundtrack',()=>{
 it('uses an eighteen-second original score without stretching its pitch',()=>{
  expect(PORTAL_SECONDS).toBe(18);expect(PORTAL_MOTION_SCALE).toBe(3);
  const a=createPortalSamples(8000),b=createPortalSamples(8000);
  expect(a).toHaveLength(18*8000);expect(a.every((v,i)=>v===b[i])).toBe(true);
  expect(a[0]).toBe(0);expect(a.at(-1)).toBe(0);
  expect(a.every(Number.isFinite)).toBe(true);
  let peak=0;for(const sample of a)peak=Math.max(peak,Math.abs(sample));
  expect(peak).toBeGreaterThan(.04);expect(peak).toBeLessThan(.4);
  for(const seconds of [2,7,12,16]){
   const section=a.slice(seconds*8000,(seconds+1)*8000),rms=Math.sqrt(section.reduce((sum,v)=>sum+v*v,0)/section.length);
   expect(rms).toBeGreaterThan(.005);
  }
 });
 it('rejects invalid sample rates',()=>{for(const rate of [0,NaN,1000,200000])expect(()=>createPortalSamples(rate)).toThrow();});
});
