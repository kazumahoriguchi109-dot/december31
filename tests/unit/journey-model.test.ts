import { describe, expect, it } from 'vitest';
import { MAP, distance, heightAt, type JourneyState, type Point } from '../../src/journey/contract';
import { createState, step, context, interact, partner, rotate, gateOpen, validateSave } from '../../src/journey/model';

const wait=(s:JourneyState,n=180)=>{for(let i=0;i<n;i++)step(s,{x:0,z:0,run:false},1/60);};
function walk(s:JourneyState,to:Point){
 for(let n=0;n<3000;n++){
  const d=distance(s.player,to);if(d<.09)return;
  const wx=(to.x-s.player.x)/d,wz=(to.z-s.player.z)/d,q=s.quarter*Math.PI/2;
  step(s,{x:wx*Math.cos(q)-wz*Math.sin(q),z:wx*Math.sin(q)+wz*Math.cos(q),run:true},1/60);
 }
 throw new Error(`Cannot walk from ${s.player.x},${s.player.z} to ${to.x},${to.z}`);
}
function begin(){const s=createState();walk(s,MAP.console);interact(s);return s;}
function toGate(){
 const s=begin();walk(s,{x:0,z:-5});interact(s);walk(s,MAP.drain);interact(s);walk(s,MAP.stopper);interact(s);walk(s,{x:0,z:-20});walk(s,{x:0,z:-26});walk(s,MAP.gatePlate);return s;
}
function toWall(){
 const s=toGate();partner(s);walk(s,{x:0,z:-33});walk(s,{x:0,z:-37});walk(s,MAP.latch);interact(s);partner(s);wait(s,360);expect(s.solved[2]).toBe(true);walk(s,{x:8,z:-42});return s;
}

describe('evolution direct-control model',()=>{
 it('moves continuously, normalizes diagonal input, and cannot tunnel through first gate',()=>{
  const s=begin(),before={...s.player};step(s,{x:1,z:-1,run:false},.1);
  expect(distance(before,s.player)).toBeCloseTo(.3,5);
  walk(s,{x:2,z:-5});walk(s,{x:2,z:-9});walk(s,{x:0,z:-9});for(let i=0;i<90;i++)step(s,{x:0,z:-1,run:true},100);
  expect(s.player.z).toBeGreaterThan(-9.46);expect(s.solved[0]).toBe(false);
 });
 it('keeps Toto separated after straight walks, turns, retracing and a close saved position',()=>{
  const s=begin();
  for(const destination of [{x:0,z:-3},{x:3,z:-3},{x:3,z:0},{x:0,z:0}]){
   walk(s,destination);wait(s);
   expect(distance(s.player,s.toto)).toBeGreaterThanOrEqual(.94);
   expect(distance(s.player,s.toto)).toBeLessThanOrEqual(1.1);
  }
  const raw=structuredClone(s);raw.toto.x=raw.player.x+.356;raw.toto.z=raw.player.z;
  const restored=validateSave(raw)!;expect(restored).not.toBeNull();
  step(restored,{x:0,z:0,run:false},1/60);
  expect(distance(restored.toto,raw.toto)).toBeLessThan(.04);
  wait(restored);expect(distance(restored.player,restored.toto)).toBeGreaterThanOrEqual(.94);
 });
 it('keeps the first tile visible while allowing interaction from its edge',()=>{
  const s=begin();for(let i=0;i<150;i++)step(s,{x:0,z:-1,run:false},1/60);
  expect(distance(s.player,MAP.tile)).toBeGreaterThanOrEqual(.6);
  expect(context(s)?.id).toBe('tile');interact(s);expect(s.solved[0]).toBe(true);
 });
 it('self standing opens the gate, but walking away closes it',()=>{
  const s=toGate();expect(gateOpen(s)).toBe(true);walk(s,{x:0,z:-33});wait(s,180);expect(gateOpen(s)).toBe(false);
  for(let i=0;i<80;i++)step(s,{x:0,z:-1,run:true},.1);
  expect(s.player.z).toBeGreaterThan(-34.41);
 });
 it('the bridge and gate cannot be bypassed at their sides',()=>{
  const s=begin();walk(s,{x:0,z:-5});interact(s);walk(s,{x:5,z:-21});
  for(let i=0;i<100;i++)step(s,{x:0,z:-1,run:true},.1);
  expect(s.player.z).toBeGreaterThan(-21.71);
  walk(s,MAP.drain);interact(s);walk(s,MAP.stopper);interact(s);
  for(let i=0;i<80;i++)step(s,{x:0,z:-1,run:true},.1);
  expect(s.player.z).toBeGreaterThan(-21.71);
 });
 it('refuses a far-side call before the latch without moving Toto or closing the gate',()=>{
  const s=toGate();partner(s);walk(s,{x:0,z:-33});walk(s,{x:0,z:-37});
  const before=structuredClone(s.toto),events=partner(s);expect(events[0]?.id).toBe('call-unsafe');expect(s.toto).toEqual(before);expect(gateOpen(s)).toBe(true);
  expect(validateSave(s)).not.toBeNull();
  walk(s,{x:0,z:-33});partner(s);expect(s.toto.waiting).toBe(false);
 });
 it('requires observing from the side and walking upstairs, never jumps across ramp sides',()=>{
  const s=toWall();expect(context(s)?.label).toBe('白い模様を調べる');interact(s);expect(s.wallSeen).toBe(false);
  for(let i=0;i<80;i++)step(s,{x:0,z:-1,run:true},.1);expect(s.player.z).toBeGreaterThan(-42.81);
  rotate(s);interact(s);expect(s.wallSeen).toBe(true);expect(s.solved[3]).toBe(false);
  walk(s,{x:8,z:-47});const y=heightAt(s.player);
  // world -X is camera-local +Z at quarter 1.
  for(let i=0;i<100;i++)step(s,{x:0,z:-1,run:true},.1);
  expect(s.player.x).toBeGreaterThanOrEqual(6.5);expect(heightAt(s.player)).toBeCloseTo(y,1);
  walk(s,{x:8,z:-50.4});expect(s.solved[3]).toBe(true);
  walk(s,{x:4,z:-50.4});for(let i=0;i<100;i++)step(s,{x:-1,z:0,run:true},.1);
  expect(s.player.z).toBeLessThanOrEqual(-49);expect(heightAt(s.player)).toBe(3);
 });
 it('completes all six through walked routes, physical plates and observation, with valid saves',()=>{
  const s=toWall();expect(validateSave(s)).not.toBeNull();rotate(s);interact(s);walk(s,MAP.wallTop);expect(s.solved[3]).toBe(true);
  walk(s,MAP.leverA);interact(s);walk(s,MAP.leverB);interact(s);
  expect([s.ringA,s.ringB]).toEqual([1,2]);expect(s.solved[4]).toBe(false);
  walk(s,MAP.observe);interact(s);expect(s.solved[4]).toBe(true);expect(s.mode).toBe('observe');expect(s.era).toBe(3);expect(validateSave(s)).not.toBeNull();
  interact(s);walk(s,MAP.wallTop);walk(s,{x:8,z:-42});walk(s,{x:0,z:-37});walk(s,{x:0,z:-33});walk(s,{x:0,z:-26});walk(s,{x:0,z:-20});walk(s,{x:2,z:-8});walk(s,{x:2,z:-4});walk(s,MAP.spawn);walk(s,MAP.frontPlate);
  partner(s);expect(s.toto.plate).toBe('front');walk(s,{x:3,z:2.5});walk(s,{x:3,z:5.5});walk(s,MAP.backPlate);
  expect(s.portalOpen).toBe(true);expect(s.solved.every(Boolean)).toBe(true);expect(validateSave(s)).not.toBeNull();
  const wrong=interact(s);expect(s.phase).toBe('world');expect(wrong[0]?.type).toBe('notice');
  partner(s);wait(s,300);expect(s.toto.waiting).toBe(false);expect(distance(s.player,s.toto)).toBeLessThan(1.8);
  interact(s);expect(s.phase).toBe('ending');expect(validateSave(s)).not.toBeNull();expect(s.steps).toBeGreaterThan(150);
 });
 it('reconstructs a collision-safe following trail after saves at a bridge, gate and stair',()=>{
  const base=toWall();rotate(base);interact(base);walk(base,MAP.wallTop);
  // These are stable world positions: the missing transient trail must not send Toto through a cliff/fence/river.
  for(const [player,toto] of [
   [{x:-3,z:-25.5},{x:0,z:-22}],
   [{x:8,z:-39},{x:-3,z:-31.5}],
   [{x:1,z:-55},{x:8,z:-42}],
  ] as const){
   const raw=structuredClone(base);Object.assign(raw.player,player);Object.assign(raw.toto,toto);
   const loaded=validateSave(raw);expect(loaded).not.toBeNull();wait(loaded!,1500);
   expect(distance(loaded!.player,loaded!.toto)).toBeLessThan(1.1);expect(validateSave(loaded)).not.toBeNull();
  }
 });
 it('records optional discoveries once without advancing a puzzle',()=>{
  const s=begin();walk(s,{x:-6,z:-5});const first=interact(s);expect(first.some(e=>e.type==='dialogue')).toBe(true);
  expect(interact(s).every(e=>e.type==='notice')).toBe(true);expect(s.solved.some(Boolean)).toBe(false);
 });
 it('rejects old, non-finite, skipped-progress and impossible geometry saves',()=>{
  expect(validateSave({version:1,player:{anchor:'room'}})).toBeNull();
  const s=createState();expect(validateSave(s)).toEqual(s);const copy=validateSave(s)!;copy.player.x=2;expect(s.player.x).toBe(0);
  s.player.x=NaN;expect(validateSave(s)).toBeNull();
  const f=begin();f.solved[4]=true;f.era=3;expect(validateSave(f)).toBeNull();
  const g=begin();g.player.z=-23;expect(validateSave(g)).toBeNull();
 });
});
