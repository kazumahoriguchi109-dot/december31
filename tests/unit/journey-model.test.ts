import { describe, expect, it } from 'vitest';
import { MAP, distance, heightAt, isOnPlate, type JourneyState, type Point } from '../../src/journey/contract';
import { createState, step, context, interact, partner, rotate, gateOpen, validateSave, movingToPlate, stepCompanion, millCompanionStaging } from '../../src/journey/model';

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
function solveTile(s:JourneyState){walk(s,{x:2.6,z:-3});walk(s,{x:3,z:-5.2});interact(s);walk(s,{x:2.6,z:-8.5});}
function toGate(){
 const s=begin();solveTile(s);walk(s,{x:0,z:-13});walk(s,{x:MAP.drainControl.x+.3,z:-13.7});interact(s);walk(s,{x:MAP.stopperControl.x+.3,z:-13.7});interact(s);walk(s,{x:0,z:-15});walk(s,{x:0,z:-20});walk(s,{x:0,z:-26});walk(s,MAP.gatePlate);return s;
}
function toWall(){
 const s=toGate();partner(s);walk(s,{x:0,z:-33});walk(s,{x:0,z:-37});walk(s,MAP.latch);interact(s);partner(s);wait(s,360);expect(s.solved[2]).toBe(true);walk(s,{x:8,z:-42});return s;
}

describe('evolution direct-control model',()=>{
 it('moves continuously, normalizes diagonal input, and cannot tunnel through first gate',()=>{
  const s=begin(),before={...s.player};step(s,{x:1,z:-1,run:false},.1);
  expect(distance(before,s.player)).toBeCloseTo(.3,5);
  walk(s,{x:2.6,z:-3});walk(s,{x:2.6,z:-9});walk(s,{x:0,z:-9});for(let i=0;i<90;i++)step(s,{x:0,z:-1,run:true},100);
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
 it('links the last-day calendar to an optional star on the path before and after color',()=>{
  let s=createState();walk(s,MAP.calendar);expect(context(s)?.id).toBe('calendar');
  expect(interact(s).some(e=>e.id==='discovery-calendar')).toBe(true);
  walk(s,MAP.console);expect(context(s)?.id).toBe('begin');interact(s);walk(s,MAP.starPost);
  expect(context(s)?.id).toBe('star-post');expect(interact(s).some(e=>e.id==='discovery-star-before')).toBe(true);
  solveTile(s);walk(s,MAP.starPost);expect(interact(s).some(e=>e.id==='discovery-star-color')).toBe(true);
  s=validateSave(s)!;expect(s.seen).toContain('discovery-calendar');expect(s.seen).toContain('discovery-star-before');expect(s.seen).toContain('discovery-star-color');
  expect(s.solved[0]).toBe(true);expect(s.solved.slice(1)).toEqual([false,false,false,false,false]);
 });
 it('blocks the entire first tile and permits operation only from its east control',()=>{
  const s=begin();let notices=0;
  for(let i=0;i<150;i++)notices+=step(s,{x:0,z:-1,run:false},1/60).filter(e=>e.id==='blocked-tile').length;
  expect(notices).toBe(1);step(s,{x:0,z:0,run:false},1/60);
  expect(step(s,{x:0,z:-1,run:false},1/60).some(e=>e.id==='blocked-tile')).toBe(false);
  expect(s.player.z).toBeGreaterThanOrEqual(-4.2);
  expect(context(s)?.id).not.toBe('tile');expect(interact(s).some(e=>e.type==='evolution')).toBe(false);
  walk(s,{x:2.6,z:-3});walk(s,{x:3,z:-5.2});
  expect(context(s)?.id).toBe('tile');expect(context(s)?.point).toEqual(MAP.tileControl);
  wait(s);expect(s.toto.x-s.player.x).toBeCloseTo(1.15,1);expect(Math.abs(s.toto.z-s.player.z)).toBeLessThan(.03);
  expect(validateSave(s)).not.toBeNull();
  interact(s);expect(s.solved[0]).toBe(true);
  // Solving the pattern never makes the physical plinth walkable.
  for(let i=0;i<60;i++)step(s,{x:-1,z:0,run:true},1/60);
  expect(s.player.x).toBeGreaterThanOrEqual(1.8);expect(validateSave(s)).not.toBeNull();
  const invalid=structuredClone(s);invalid.player={x:1.7,z:-5,facing:0};expect(validateSave(invalid)).toBeNull();
  const invalidFriend=structuredClone(s);invalidFriend.toto.x=-1.7;invalidFriend.toto.z=-7.7;expect(validateSave(invalidFriend)).toBeNull();
  walk(s,{x:3.8,z:-5.5});expect(context(s)?.id).not.toBe('tile');
 });
 it('self standing opens the gate, but walking away closes it',()=>{
  const s=toGate();expect(gateOpen(s)).toBe(true);walk(s,{x:0,z:-33});wait(s,180);expect(gateOpen(s)).toBe(false);
  for(let i=0;i<80;i++)step(s,{x:0,z:-1,run:true},.1);
  expect(s.player.z).toBeGreaterThan(-34.41);
 });
 it('the bridge and gate cannot be bypassed at their sides',()=>{
  const s=begin();solveTile(s);walk(s,{x:5,z:-21});
  for(let i=0;i<100;i++)step(s,{x:0,z:-1,run:true},.1);
  expect(s.player.z).toBeGreaterThan(-21.71);
  walk(s,{x:0,z:-13});walk(s,{x:MAP.drainControl.x+.3,z:-13.7});interact(s);walk(s,{x:MAP.stopperControl.x+.3,z:-13.7});interact(s);
  for(let i=0;i<80;i++)step(s,{x:0,z:-1,run:true},.1);
  expect(s.player.z).toBeGreaterThan(-21.71);
 });
 it('operates the mill from visible front controls and keeps both actors outside machinery',()=>{
  const s=begin();solveTile(s);
  for(const [point,id] of [[MAP.drainControl,'drain'],[MAP.stopperControl,'stopper']] as const){
   walk(s,{x:point.x+.3,z:point.z+.3});wait(s);expect(context(s)?.id).toBe(id);
   expect(s.toto.x-s.player.x).toBeCloseTo(1.15,1);expect(Math.abs(s.toto.z-s.player.z)).toBeLessThan(.03);
   expect(validateSave(s)).not.toBeNull();interact(s);
  }
  expect(s.solved[1]).toBe(true);walk(s,{x:-2,z:-16});walk(s,{x:-4,z:-16});
  for(let i=0;i<120;i++)step(s,{x:0,z:-1,run:true},1/60);
  expect(s.player.z).toBeGreaterThanOrEqual(-16.5);expect(context(s)?.id).not.toBe('stopper');
  for(const point of [MAP.drain,MAP.stopper,MAP.mill,{x:-7,z:-20},{x:-7,z:-16},{x:MAP.drainControl.x-.85,z:MAP.drainControl.z-.6},{x:MAP.stopperControl.x-.85,z:MAP.stopperControl.z-.6}]){
   const invalid=structuredClone(s);Object.assign(invalid.player,point);expect(validateSave(invalid)).toBeNull();
  }
  const loaded=validateSave(s)!;wait(loaded);expect(validateSave(loaded)).not.toBeNull();
 });
 it('keeps Toto clear of the adjacent handle at the drain control eastern edge',()=>{
  for(const approach of [{x:0,z:-13},{x:-8,z:-13},{x:-5.21,z:-12}]){
  const s=begin();solveTile(s);walk(s,{x:0,z:-12});walk(s,approach);walk(s,{x:-5.21,z:-14});
  for(let i=0;i<100;i++){const dx=-5.21-s.player.x,dz=-14-s.player.z,d=Math.hypot(dx,dz);if(d<.00001)break;step(s,{x:dx/d,z:dz/d,run:true},Math.min(.01,d/4.8));}
  for(let i=0;i<300;i++){const before={...s.toto};step(s,{x:0,z:0,run:false},1/60);expect(distance(before,s.toto)).toBeLessThanOrEqual(.082);expect(validateSave(s)).not.toBeNull();}
  expect(context(s)?.id).toBe('drain');
  const handle={x:MAP.stopperControl.x-.85,z:MAP.stopperControl.z-.6};
  expect(distance(s.toto,handle)).toBeGreaterThanOrEqual(1);
  expect(s.toto.x).toBeCloseTo(s.player.x+1.15,1);expect(s.toto.z).toBeCloseTo(s.player.z+1.5,1);
  expect(validateSave(s)).not.toBeNull();
  const loaded=validateSave(s)!;wait(loaded);expect(loaded.toto.x).toBeCloseTo(s.toto.x,1);expect(loaded.toto.z).toBeCloseTo(s.toto.z,1);
  }
 });
 it('advances only Toto during a mill conversation and reaches the safe staging point',()=>{
  const s=begin();solveTile(s);walk(s,{x:0,z:-13});walk(s,{x:-2.7,z:-13.7});
  const before=structuredClone(s),stage=millCompanionStaging(s);expect(stage).not.toBeNull();
  for(let i=0;i<180;i++){const previous={...s.toto};stepCompanion(s,1/60);expect(distance(previous,s.toto)).toBeLessThanOrEqual(.082);expect(validateSave(s)).not.toBeNull();}
  expect(millCompanionStaging(s)?.ready).toBe(true);expect(s.player).toEqual(before.player);
  expect({...s,toto:before.toto}).toEqual(before);
 });
 it('settles at P02 immediately after E from multiple approaches and both device orders',()=>{
  for(const offset of [{x:.3,z:.3},{x:.79,z:0},{x:-.09,z:.3},{x:.3,z:-.14}])for(const approach of [{x:0,z:-13},{x:-8,z:-13},{x:-5,z:-11}])for(const order of [['drain','stopper'],['stopper','drain']] as const){
   const s=begin();solveTile(s);walk(s,{x:0,z:-12});walk(s,approach);
   for(const id of order){
    walk(s,{x:s.player.x,z:-13});const c=id==='drain'?MAP.drainControl:MAP.stopperControl;
    const destination={x:c.x+offset.x,z:c.z+offset.z};walk(s,destination);
    for(let i=0;i<100;i++){const dx=destination.x-s.player.x,dz=destination.z-s.player.z,d=Math.hypot(dx,dz);if(d<.00001)break;step(s,{x:dx/d,z:dz/d,run:true},Math.min(.01,d/4.8));}
    expect(context(s)?.id).toBe(id);
    interact(s);const player={...s.player},stage=millCompanionStaging(s)!;
    const probe=structuredClone(s);Object.assign(probe.toto,stage.target);expect(validateSave(probe)).not.toBeNull();
    for(let i=0;i<60;i++){const previous={...s.toto};stepCompanion(s,1/60);expect(distance(previous,s.toto)).toBeLessThanOrEqual(.082);expect(validateSave(s)).not.toBeNull();}
    expect(s.player).toEqual(player);
    expect(millCompanionStaging(s)?.ready,JSON.stringify({offset,approach,order,id,player,toto:s.toto,stage:millCompanionStaging(s)})).toBe(true);
   }
   expect(s.solved[1]).toBe(true);
  }
 });
 it('reports arrival once through the companion helper and again only after a new instruction',()=>{
  const s=toGate();partner(s);walk(s,{x:-1,z:-31.5});
  const notices=[];for(let i=0;i<180;i++)notices.push(...stepCompanion(s,1/60));
  // Arrival can happen while walking away; a subsequent helper must not repeat it.
  expect(notices.filter(e=>e.id==='partner-arrived').length).toBeLessThanOrEqual(1);
  expect(s.toto.waiting).toBe(true);expect(stepCompanion(s,1/60)).toEqual([]);
  partner(s);const rejoin=[];for(let i=0;i<180;i++)rejoin.push(...stepCompanion(s,1/60));
  expect(rejoin.filter(e=>e.id==='partner-rejoined')).toHaveLength(1);
  walk(s,{x:-1.5,z:-31.5});partner(s);const returning=[];for(let i=0;i<180;i++)returning.push(...stepCompanion(s,1/60));
  expect(returning.filter(e=>e.id==='partner-arrived')).toHaveLength(1);
 });
 it('waits before an occupied footprint and finishes walking after the player leaves',()=>{
  const s=toGate();partner(s);wait(s);
  expect(movingToPlate(s)).toBe(true);expect(s.toto.waiting).toBe(false);
  expect(distance(s.toto,s.player)).toBeGreaterThanOrEqual(.849);
  expect(validateSave(s)).not.toBeNull();
  walk(s,{x:-1,z:-31.5});wait(s);
  expect(s.toto.waiting).toBe(true);expect(distance(s.toto,MAP.gatePlate)).toBeLessThan(.00001);
 });
 it('walks to the actual plate centre, resumes midway and cancels without teleporting',()=>{
  let s=toGate();walk(s,{x:-3,z:-28});wait(s);walk(s,{x:-3,z:-30});wait(s);
  expect(gateOpen(s)).toBe(false);
  const before={...s.toto},player={...s.player};partner(s);
  expect(s.toto.x).toBe(before.x);expect(s.toto.z).toBe(before.z);expect(s.player).toEqual(player);
  expect(movingToPlate(s)).toBe(true);expect(s.toto.waiting).toBe(false);expect(gateOpen(s)).toBe(false);
  for(let i=0;i<12;i++){
   const previous={...s.toto};step(s,{x:0,z:0,run:false},1/60);
   expect(distance(previous,s.toto)).toBeLessThanOrEqual(.050001);
   expect(gateOpen(s)).toBe(distance(s.player,MAP.gatePlate)<=.9||distance(s.toto,MAP.gatePlate)<=.9);
  }
  const loaded=validateSave(s);expect(loaded).not.toBeNull();s=loaded!;expect(movingToPlate(s)).toBe(true);
  const midway={...s.toto};partner(s);expect(movingToPlate(s)).toBe(false);expect(s.toto.plate).toBeNull();
  expect(s.toto.x).toBe(midway.x);expect(s.toto.z).toBe(midway.z);
  partner(s);wait(s);expect(s.toto.waiting).toBe(true);expect(distance(s.toto,MAP.gatePlate)).toBeLessThan(.00001);
  expect(gateOpen(s)).toBe(true);expect(validateSave(s)).not.toBeNull();
  const invalid=structuredClone(s);invalid.toto.x+=.3;expect(validateSave(invalid)).toBeNull();
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
 it('walks into camera-horizontal separation at rest in all four views and after reload',()=>{
  let s=toWall();walk(s,{x:3,z:-40});
  for(let quarter=0;quarter<4;quarter++){
   if(quarter)rotate(s);const player={...s.player};
   for(let i=0;i<180;i++){const before={...s.toto};stepCompanion(s,1/60);expect(distance(before,s.toto)).toBeLessThanOrEqual(.082);expect(validateSave(s)).not.toBeNull();}
   const q=s.quarter*Math.PI/2,screenX=(s.toto.x-s.player.x)*Math.cos(q)-(s.toto.z-s.player.z)*Math.sin(q);
   expect(Math.abs(screenX)).toBeGreaterThan(1);expect(s.player).toEqual(player);
   s=validateSave(s)!;for(let i=0;i<120;i++)stepCompanion(s,1/60);
   const resumedX=(s.toto.x-s.player.x)*Math.cos(q)-(s.toto.z-s.player.z)*Math.sin(q);
   expect(Math.abs(resumedX)).toBeGreaterThan(1);
  }
 });
 it('prefers the current screen side while arranging in open ground',()=>{
  const raw=toWall();rotate(raw);interact(raw);walk(raw,MAP.wallTop);
  Object.assign(raw.player,{x:3,z:-40});Object.assign(raw.toto,{x:3.5,z:-39.2});raw.quarter=0;
  const s=validateSave(raw)!;let moved=false;
  for(let i=0;i<180;i++){const before={...s.toto};stepCompanion(s,1/60);
   expect(s.toto.x-s.player.x).toBeGreaterThan(.3);
   if(distance(before,s.toto)>.01&&distance(s.player,s.toto)>.2){
    moved=true;const movementAngle=Math.atan2(s.toto.x-before.x,s.toto.z-before.z);
    if(distance(s.player,s.toto)>1.18)expect(Math.cos(s.toto.facing-movementAngle)).toBeGreaterThan(.95);
   }
  }
  expect(moved).toBe(true);expect(s.toto.x-s.player.x).toBeGreaterThan(1);
 });
 it('finishes an in-flight rest movement without reversing for repeated Q presses',()=>{
  const s=toWall();walk(s,{x:3,z:-40});wait(s);rotate(s);
  let direction:Point|null=null;
  for(let i=0;i<30;i++){const before={...s.toto};stepCompanion(s,1/60);if(distance(before,s.toto)>.005){direction={x:s.toto.x-before.x,z:s.toto.z-before.z};break;}}
  expect(direction).not.toBeNull();
  for(let i=0;i<5;i++){rotate(s);const before={...s.toto};stepCompanion(s,1/60);const dx=s.toto.x-before.x,dz=s.toto.z-before.z;expect(dx*direction!.x+dz*direction!.z).toBeGreaterThanOrEqual(0);}
  wait(s);expect(validateSave(s)).not.toBeNull();
 });
 it('preserves narrow-route following, physical plate state and waiting through Q',()=>{
  const base=toWall();rotate(base);interact(base);walk(base,MAP.wallTop);
  for(const [player,toto] of [[{x:0,z:-23},{x:0,z:-22}],[{x:0,z:-35},{x:0,z:-34}],[{x:8,z:-46},{x:8,z:-45}]] as const){
   const raw=structuredClone(base);Object.assign(raw.player,player);Object.assign(raw.toto,toto);const s=validateSave(raw)!;expect(s).not.toBeNull();
   const before={...s.toto};for(let i=0;i<180;i++)stepCompanion(s,1/60);
   expect(Math.abs(s.toto.x-before.x)).toBeLessThan(.001);expect(validateSave(s)).not.toBeNull();
  }
  const waitingState=structuredClone(base);Object.assign(waitingState.player,{x:-1.5,z:-31.5});Object.assign(waitingState.toto,{x:-3,z:-31.5,plate:'gate',waiting:true});
  const gate=validateSave(waitingState)!;expect(gate).not.toBeNull();const waiting={...gate.toto};
  for(let i=0;i<4;i++){const previous=gate.quarter;rotate(gate);expect(gate.quarter).not.toBe(previous);wait(gate);expect(gate.toto).toEqual(waiting);}

 });
 it('finishes a requested reunion once before arranging a camera-side rest position',()=>{
  const raw=toWall();Object.assign(raw.player,{x:3,z:-39});Object.assign(raw.toto,{x:-3,z:-31.5,waiting:true,plate:'gate'});raw.quarter=1;
  const s=validateSave(raw)!;expect(s).not.toBeNull();partner(s);let arrivals=0;
  for(let i=0;i<600;i++){
   const previous={...s.toto},events=stepCompanion(s,1/60);expect(distance(previous,s.toto)).toBeLessThanOrEqual(.082);
   for(const event of events)if(event.id==='partner-rejoined'){arrivals++;expect(distance(s.player,s.toto)).toBeLessThanOrEqual(1.1);}
  }
  expect(arrivals).toBe(1);expect(s.toto.plate).toBeNull();expect(validateSave(s)).not.toBeNull();
  expect(Math.abs(s.toto.z-s.player.z)).toBeGreaterThan(1);
 });
 it('keeps rest candidates clear of focused latch and lever mechanisms in every view',()=>{
  const base=toWall();rotate(base);interact(base);walk(base,MAP.wallTop);
  for(const [player,focus] of [[{x:2,z:-38.4},MAP.latch],[{x:6,z:-55},MAP.leverB],[{x:0,z:-55},MAP.leverA],[{x:3,z:-53},MAP.observe],[{x:8,z:-42.05},MAP.wall]] as const){
   for(let quarter=0;quarter<4;quarter++){
    const raw=structuredClone(base);Object.assign(raw.player,player);Object.assign(raw.toto,{x:player.x+.2,z:player.z+.9});raw.quarter=quarter as 0|1|2|3;
    const s=validateSave(raw)!;expect(s).not.toBeNull();expect(context(s)?.point).toEqual(focus);
    for(let i=0;i<240;i++){const before={...s.toto};stepCompanion(s,1/60);expect(distance(before,s.toto)).toBeLessThanOrEqual(.082);expect(validateSave(s)).not.toBeNull();}
    const q=s.quarter*Math.PI/2,cross=Math.abs((s.toto.x-focus.x)*Math.cos(q)-(s.toto.z-focus.z)*Math.sin(q));
    expect(cross,JSON.stringify({player,quarter,toto:s.toto})).toBeGreaterThanOrEqual(.83);
    expect(distance(s.toto,focus)).toBeGreaterThanOrEqual(.98);
   }
  }
 });
 it('walks around the player when the safe object-side rest candidate changes sides',()=>{
  const raw=toWall();rotate(raw);interact(raw);walk(raw,MAP.wallTop);Object.assign(raw.player,{x:6,z:-55});Object.assign(raw.toto,{x:6,z:-56.05});
  const s=validateSave(raw)!;expect(s).not.toBeNull();let minimum=Infinity;
  for(let i=0;i<240;i++){const previous={...s.toto};stepCompanion(s,1/60);minimum=Math.min(minimum,distance(s.player,s.toto));expect(distance(previous,s.toto)).toBeLessThanOrEqual(.082);expect(validateSave(s)).not.toBeNull();}
  expect(minimum,`minimum separation ${minimum}`).toBeGreaterThanOrEqual(1);
  expect(s.toto.z).toBeGreaterThan(-54.05);
 });
 it('increases an initially overlapping rest distance and keeps a blocked rest fallback outside the player',()=>{
  const base=toWall();rotate(base);interact(base);walk(base,MAP.wallTop);
  const raw=structuredClone(base);Object.assign(raw.player,{x:6,z:-55});Object.assign(raw.toto,{x:6,z:-55.2});
  const s=validateSave(raw)!;expect(s).not.toBeNull();let previousDistance=distance(s.player,s.toto);
  for(let i=0;i<240;i++){stepCompanion(s,1/60);const d=distance(s.player,s.toto);if(previousDistance<.6)expect(d).toBeGreaterThanOrEqual(previousDistance-.00001);else expect(d).toBeGreaterThanOrEqual(.6);previousDistance=d;expect(validateSave(s)).not.toBeNull();}
  expect(s.toto.z).toBeGreaterThan(-54.05);
  const blocked=structuredClone(base);Object.assign(blocked.player,{x:2,z:-37.7});Object.assign(blocked.toto,{x:2,z:-38.75});
  const noRoute=validateSave(blocked)!;expect(noRoute).not.toBeNull();
  for(let i=0;i<240;i++){stepCompanion(noRoute,1/60);expect(distance(noRoute.player,noRoute.toto)).toBeGreaterThanOrEqual(.6);expect(validateSave(noRoute)).not.toBeNull();}
 });
 it('uses a bounded further rest fallback at the old latch state, holds it and restores safely',()=>{
  const base=toWall();
  for(const quarter of [1,3] as const)for(const side of [-1,1]){
   const raw=structuredClone(base);Object.assign(raw.player,{x:2.05,z:-37.097});Object.assign(raw.toto,{x:2.05+side*1.05,z:-37.097});raw.quarter=quarter;
   let s=validateSave(raw)!;expect(s).not.toBeNull();const player={...s.player};let arrived=false;
   for(let i=0;i<360;i++){
    const before={...s.toto};stepCompanion(s,1/60);expect(distance(before,s.toto)).toBeLessThanOrEqual(.082);expect(distance(s.player,s.toto)).toBeLessThanOrEqual(2.02);expect(distance(s.player,s.toto)).toBeGreaterThanOrEqual(.6);expect(validateSave(s)).not.toBeNull();
    if(s.toto.z< -39.05)arrived=true;if(arrived)expect(s.toto.z).toBeLessThan(-39.05);
   }
   expect(arrived).toBe(true);expect(s.player).toEqual(player);expect(Math.abs(s.toto.z-MAP.latch.z)).toBeGreaterThan(.85);expect(distance(s.toto,MAP.latch)).toBeGreaterThan(1);
   s=validateSave(s)!;for(let i=0;i<240;i++){stepCompanion(s,1/60);expect(distance(s.player,s.toto)).toBeLessThanOrEqual(2.02);expect(validateSave(s)).not.toBeNull();}expect(s.toto.z).toBeLessThan(-39.05);
  }
 });
 it('never corrects an unassigned companion onto any of the three pressure plates',()=>{
  const base=toWall();rotate(base);interact(base);walk(base,MAP.wallTop);walk(base,MAP.leverA);interact(base);walk(base,MAP.leverB);interact(base);walk(base,MAP.observe);interact(base);interact(base);
  for(const plate of [MAP.gatePlate,MAP.frontPlate,MAP.backPlate]){
   const raw=structuredClone(base);Object.assign(raw.player,{x:plate.x+2.6,z:plate.z});Object.assign(raw.toto,{x:plate.x+3.3,z:plate.z+.7});
   const s=validateSave(raw)!;expect(s).not.toBeNull();
   for(let q=0;q<4;q++){rotate(s);for(let frame=0;frame<120;frame++){stepCompanion(s,1/60);expect(isOnPlate(s.toto,plate)).toBe(false);expect(validateSave(s)).not.toBeNull();}}
   expect(s.portalOpen).toBe(false);expect(s.toto.plate).toBeNull();
  }
 });
 it('completes all six through walked routes, physical plates and observation, with valid saves',()=>{
  const s=toWall();expect(validateSave(s)).not.toBeNull();rotate(s);interact(s);walk(s,MAP.wallTop);expect(s.solved[3]).toBe(true);
  walk(s,MAP.leverA);expect(context(s)?.label).toBe('レバーAを動かす');interact(s);walk(s,MAP.leverB);expect(context(s)?.label).toBe('レバーBを動かす');interact(s);
  expect([s.ringA,s.ringB]).toEqual([1,2]);expect(s.solved[4]).toBe(false);
  walk(s,MAP.observe);interact(s);expect(s.solved[4]).toBe(true);expect(s.mode).toBe('observe');expect(s.era).toBe(3);expect(validateSave(s)).not.toBeNull();
  interact(s);walk(s,MAP.wallTop);walk(s,{x:8,z:-42});walk(s,{x:0,z:-37});walk(s,{x:0,z:-33});walk(s,{x:0,z:-26});walk(s,{x:0,z:-15});walk(s,{x:0,z:-20});walk(s,{x:3,z:-8});walk(s,{x:3,z:-4});walk(s,MAP.spawn);walk(s,MAP.frontPlate);
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
  expect(validateSave({...createState(),version:2})).toBeNull();
  const s=createState();expect(validateSave(s)).toEqual(s);const copy=validateSave(s)!;copy.player.x=2;expect(s.player.x).toBe(0);
  s.player.x=NaN;expect(validateSave(s)).toBeNull();
  const f=begin();f.solved[4]=true;f.era=3;expect(validateSave(f)).toBeNull();
  const g=begin();g.player.z=-23;expect(validateSave(g)).toBeNull();
 });
});
