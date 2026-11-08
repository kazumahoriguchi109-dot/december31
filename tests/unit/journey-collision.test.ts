import { describe, expect, it } from 'vitest';
import { ACTOR_RADIUS, ROOM_SOLIDS, solidObstruction, solids, touchesSolid, type Solid } from '../../src/journey/collision';
import { ROOM_X_SCALE, FURNITURE_X_SCALE } from '../../src/journey/roomPresentation';
import { MAP, distance, type JourneyState, type Point } from '../../src/journey/contract';
import { context, createState, gateOpen, interact, step, stepCompanion, validateSave } from '../../src/journey/model';

function world():JourneyState {
 return {...createState(),phase:'world',era:3,player:{x:0,z:0,facing:0},toto:{x:1,z:.4,facing:0,plate:null,waiting:false},p1:1,p2Drain:false,p2Stopper:false,gateLatched:true,wallSeen:true,ringA:1,ringB:2,solved:[true,true,true,true,true,false]};
}
const clear=(s:JourneyState)=>{
 expect(solidObstruction(s,s.player),JSON.stringify(s.player)).toBe('');
 expect(solidObstruction(s,s.toto),JSON.stringify(s.toto)).toBe('');
};
function walk(s:JourneyState,goal:Point){
 for(let i=0;i<1500;i++){
  const d=distance(s.player,goal);if(d<.06)return;
  const q=s.quarter*Math.PI/2,dx=(goal.x-s.player.x)/d,dz=(goal.z-s.player.z)/d;
  step(s,{x:dx*Math.cos(q)-dz*Math.sin(q),z:dx*Math.sin(q)+dz*Math.cos(q),run:true},Math.min(1/60,d/4.8));clear(s);
 }
 throw new Error(`Blocked route ${JSON.stringify(s.player)} -> ${JSON.stringify(goal)}`);
}
const settle=(s:JourneyState,n=360)=>{for(let i=0;i<n;i++){const previous={...s.toto};stepCompanion(s,1/60);expect(distance(previous,s.toto)).toBeLessThanOrEqual(.082);clear(s);}};

describe('solid-object footprints',()=>{
 it('converts room furniture widths and actor clearance independently from anchor positions',()=>{
  const s=createState(),desk=solids(s).find(o=>o.id==='desk')!;
  expect(desk.x).toBe(MAP.console.x);
  expect(desk.halfX).toBeCloseTo(ROOM_SOLIDS.desk.width*FURNITURE_X_SCALE/ROOM_X_SCALE/2);
  const edge=desk.x+desk.halfX+ACTOR_RADIUS/ROOM_X_SCALE;
  expect(touchesSolid(s,{x:edge-.001,z:desk.z},desk)).toBe(true);
  expect(touchesSolid(s,{x:edge+.001,z:desk.z},desk)).toBe(false);
  expect(touchesSolid(s,{x:0,z:-2.02+ACTOR_RADIUS-.001},desk)).toBe(true);
  expect(touchesSolid(s,{x:0,z:-2.02+ACTOR_RADIUS+.001},desk)).toBe(false);
 });
 it('uses the whole body at every rectangle edge and rounded corner, not a point or square actor',()=>{
  for(const s of [createState(),world()]){
   const sx=s.phase==='room'?ROOM_X_SCALE:1,rect:Solid={id:'test',x:0,z:0,halfX:1,halfZ:.5};
   for(let i=0;i<32;i++){
    const a=i*Math.PI/16,dx=Math.cos(a),dz=Math.sin(a);
    const corner={x:Math.sign(dx)*rect.halfX,z:Math.sign(dz)*rect.halfZ};
    const p=(r:number)=>({x:corner.x+dx*r/sx,z:corner.z+dz*r});
    expect(touchesSolid(s,p(ACTOR_RADIUS-.001),rect)).toBe(true);
    expect(touchesSolid(s,p(ACTOR_RADIUS+.001),rect)).toBe(false);
   }
  }
 });
 it('leaves rugs, light pools, the observation pad, pressure plates and frozen pond walkable',()=>{
  const s=createState();for(const point of [{x:0,z:.5},{x:1,z:1.3},{x:-1.5,z:1.7}])expect(solidObstruction(s,point)).toBe('');
  const w=world();for(const point of [MAP.observe,MAP.frontPlate,MAP.backPlate,MAP.gatePlate,{x:7,z:-18}])expect(solidObstruction(w,point)).toBe('');
 });
 it('includes the bridge pulley and both low optical arcs beyond their supporting posts',()=>{
  const s=world();expect(solidObstruction(s,{x:-1.2,z:-21.1})).toBe('mill');
  expect(solidObstruction(s,{x:2.9,z:-56.75})).toBe('ring');
  expect(solidObstruction(s,{x:3.3,z:-57.1})).toBe('ring');
  expect(solidObstruction(s,{x:0,z:-21.1})).toBe('');
 });
 it('keeps portal pillars physical after opening and ignores a low lamp below the raised stair',()=>{
  const s=world();s.portalOpen=true;s.solved[5]=true;
  expect(solidObstruction(s,{x:1.25,z:4})).toBe('frame');
  expect(solidObstruction(s,{x:0,z:4})).toBe('');
  const lamp=solids(s).find(o=>o.id==='lantern'&&o.x===10.7)!;
  expect(touchesSolid(s,{x:10.4,z:-48},lamp)).toBe(false);
 });
});

describe('body-safe movement and companion navigation',()=>{
 it('stops long held cardinal and diagonal input at every reachable side of room furniture',()=>{
  let approaches=0;
  for(const obstacle of solids(createState()))for(let i=0;i<16;i++){
   const angle=i*Math.PI/8,dx=Math.cos(angle),dz=Math.sin(angle),s=createState();
   const start={x:obstacle.x+dx*(obstacle.halfX+ACTOR_RADIUS/ROOM_X_SCALE+.65),z:obstacle.z+dz*(obstacle.halfZ+ACTOR_RADIUS+.65)};
   Object.assign(s.player,start);Object.assign(s.toto,{x:0,z:1.3});
   const loaded=validateSave(s);if(!loaded||distance(loaded.player,start)>.000001||solidObstruction(s,start))continue;
   approaches++;
   for(let j=0;j<80;j++){
    const d=distance(s.player,obstacle);step(s,{x:(obstacle.x-s.player.x)/d,z:(obstacle.z-s.player.z)/d,run:true},100);clear(s);
   }
   expect(touchesSolid(s,s.player,obstacle)).toBe(false);
  }
  expect(approaches).toBeGreaterThan(20);
 });
 it('prevents fast movement through the reachable sides of every outdoor solid',()=>{
  let approaches=0;
  for(const obstacle of solids(world()))for(let i=0;i<8;i++){
   const a=i*Math.PI/4,s=world();s.portalOpen=true;s.solved[5]=true;Object.assign(s.toto,{...MAP.frontPlate,waiting:true,plate:'front'});
   const start={x:obstacle.x+Math.cos(a)*(obstacle.halfX+ACTOR_RADIUS+.8),z:obstacle.z+Math.sin(a)*(obstacle.halfZ+ACTOR_RADIUS+.8)};
   Object.assign(s.player,start);const loaded=validateSave(s);
   if(!loaded||distance(loaded.player,start)>.000001||solidObstruction(s,start))continue;
   approaches++;
   for(let j=0;j<35;j++){
    const d=distance(s.player,obstacle);step(s,{x:(obstacle.x-s.player.x)/d,z:(obstacle.z-s.player.z)/d,run:true},100);clear(s);
   }
  }
  expect(approaches).toBeGreaterThan(80);
 });
 it('slides along the desk edge, turns around its corner and keeps begin reachable',()=>{
  const s=createState();walk(s,{x:0,z:-1.5});expect(context(s)?.id).toBe('begin');
  const before={...s.player};for(let i=0;i<35;i++){step(s,{x:1,z:-1,run:false},1/60);clear(s);if(s.player.x<.86)expect(s.player.z).toBeGreaterThanOrEqual(-1.561);}
  expect(s.player.x-before.x).toBeGreaterThan(.8);expect(s.player.z).toBeLessThan(-1.6);
  walk(s,{x:1.4,z:-1.4});walk(s,{x:1.4,z:-2.5});settle(s);
  expect(distance(s.player,s.toto)).toBeLessThan(1.15);
 });
 it('rebuilds a path around the desk after reload rather than walking into a corner forever',()=>{
  const raw=createState();Object.assign(raw.player,{x:-1.6,z:-2.5});Object.assign(raw.toto,{x:1.4,z:-2.5});
  const s=validateSave(raw)!;expect(s).not.toBeNull();settle(s,900);
  expect(distance(s.player,s.toto)).toBeLessThan(1.1);
  walk(s,{x:-1.6,z:-1.3});walk(s,{x:1.4,z:-1.3});walk(s,{x:1.4,z:-2.5});settle(s,480);
  expect(distance(s.player,s.toto)).toBeLessThan(1.1);
 });
 it('routes the companion around outdoor posts, lanterns, levers and castle masonry',()=>{
  for(const [player,toto] of [
   [{x:-6,z:-41},{x:-6,z:-39}],
   [{x:4,z:-14},{x:4,z:-12}],
   [{x:0,z:-57.2},{x:0,z:-54.8}],
   [{x:-1.4,z:-63},{x:7.4,z:-63}],
  ] as const){
   const raw=world();Object.assign(raw.player,player);Object.assign(raw.toto,toto);const s=validateSave(raw)!;
   expect(s).not.toBeNull();settle(s,1200);expect(distance(s.player,s.toto)).toBeLessThan(2.05);
  }
 });
 it('holds a gate open until a body has cleared the doorway without latching it',()=>{
  const s=world();s.era=1;s.solved=[true,true,false,false,false,false];s.gateLatched=false;s.wallSeen=false;s.ringA=0;s.ringB=1;
  Object.assign(s.player,{x:0,z:-35});Object.assign(s.toto,{x:0,z:-33});
  expect(gateOpen(s)).toBe(true);
  walk(s,{x:0,z:-33});settle(s);expect(gateOpen(s)).toBe(false);expect(s.gateLatched).toBe(false);
  for(let i=0;i<80;i++)step(s,{x:0,z:-1,run:true},.1);
  expect(s.player.z).toBeGreaterThanOrEqual(-34.4);
 });
 it('moves both actors diagonally out of the safe gap between opposing apparatus corners',()=>{
  const raw=world();raw.era=2;raw.solved[4]=false;raw.ringA=0;raw.ringB=0;
  Object.assign(raw.player,{x:6,z:-55});Object.assign(raw.toto,{x:2.7,z:-57.05});
  const s=validateSave(raw)!;expect(s).not.toBeNull();interact(s);clear(s);
  const repaired={...s.toto};expect(repaired.x).toBeCloseTo(2.7);expect(repaired.z).toBeCloseTo(-57.17);
  for(const quarter of [0,1,2,3] as const){
   const playerState=structuredClone(s);playerState.quarter=quarter;Object.assign(playerState.player,repaired);Object.assign(playerState.toto,{x:6,z:-55});
   const q=quarter*Math.PI/2;
   step(playerState,{x:Math.cos(q)+Math.sin(q),z:Math.sin(q)-Math.cos(q),run:false},1/60);clear(playerState);
   expect(playerState.player.x).toBeGreaterThan(repaired.x);expect(playerState.player.z).toBeLessThan(repaired.z);
  }
  settle(s,720);expect(distance(s.player,s.toto)).toBeLessThan(1.1);
 });
 it('rejoins after all four reported B0 to B1 overlap corrections and after reload',()=>{
  for(const [x,z] of [[2.7,-57.05],[2.7,-56.95],[2.8,-56.95],[2.9,-56.95]])for(const reload of [false,true]){
   const raw=world();raw.era=2;raw.solved[4]=false;raw.ringA=0;raw.ringB=0;
   Object.assign(raw.player,{x:6,z:-55});Object.assign(raw.toto,{x:x!,z:z!});let s=validateSave(raw)!;
   expect(s).not.toBeNull();interact(s);if(reload)s=validateSave(s)!;clear(s);settle(s,720);
   expect(distance(s.player,s.toto)).toBeLessThan(1.1);
  }
 });
 it('preserves interaction reachability and handles a moving ring support without overlapping either actor',()=>{
  const raw=world();raw.era=2;raw.solved[4]=false;raw.ringA=0;raw.ringB=1;
  Object.assign(raw.player,{x:0,z:-55});Object.assign(raw.toto,{x:2.7,z:-57.2});const s=validateSave(raw)!;
  expect(context(s)?.id).toBe('lever-a');const old={...s.toto};expect(old.x).toBe(2.7);expect(old.z).toBe(-57.2);interact(s);clear(s);expect(s.ringA).toBe(1);expect(distance(s.toto,old)).toBeGreaterThan(0);
  expect(distance(s.toto,old)).toBeLessThan(.5);expect(validateSave(s)).not.toBeNull();
  walk(s,{x:6,z:-55});expect(context(s)?.id).toBe('lever-b');interact(s);clear(s);
  walk(s,MAP.observe);expect(context(s)?.id).toBe('observe');interact(s);expect(s.solved[4]).toBe(true);
 });
});

describe('existing save overlap migration',()=>{
 it('rescues both actors from every new room solid without changing progress or the input object',()=>{
  for(const obstacle of solids(createState())){
   const raw=createState();raw.steps=123.5;raw.seen=['room-intro','discovery-calendar'];Object.assign(raw.player,obstacle);Object.assign(raw.toto,obstacle);
   const original=structuredClone(raw),s=validateSave(raw)!;expect(s).not.toBeNull();clear(s);expect(raw).toEqual(original);
   expect(s.steps).toBe(123.5);expect(s.seen).toEqual(original.seen);expect(s.solved).toEqual(original.solved);
   expect(s.player.facing).toBe(raw.player.facing);expect(s.toto.plate).toBeNull();
   const repeat=validateSave(s)!;expect(repeat).toEqual(s);
   walk(s,{x:s.player.x,z:-1.2});walk(s,{x:0,z:-1.5});expect(context(s)?.id).toBe('begin');interact(s);expect(s.phase).toBe('world');
  }
 });
 it('rescues old world scenery overlaps while retaining all puzzle and observation state',()=>{
  for(const point of [MAP.starPost,MAP.latch,MAP.leverA,MAP.leverB,{x:-6,z:-40},{x:4,z:-13},{x:3,z:-63},{x:1.25,z:4}]){
   const raw=world();raw.portalOpen=true;raw.solved[5]=true;raw.steps=321;raw.seen=['discovery-star-before'];Object.assign(raw.player,point);Object.assign(raw.toto,point);
   const s=validateSave(raw)!;expect(s,JSON.stringify(point)).not.toBeNull();clear(s);
   for(const key of ['solved','era','gateLatched','wallSeen','ringA','ringB','portalOpen','seen','steps','mode'] as const)expect(s[key]).toEqual(raw[key]);
   expect(distance(s.player,point)).toBeLessThan(3);
  }
  const observe=world();observe.mode='observe';Object.assign(observe.player,MAP.observe);Object.assign(observe.toto,MAP.leverB);
  expect(validateSave(observe)?.mode).toBe('observe');
 });
 it('still rejects corrupt progress and old forbidden puzzle areas instead of relocating through barriers',()=>{
  const room=createState();room.player.x=100;expect(validateSave(room)).toBeNull();
  const invalid=world();invalid.player.z=-23;invalid.solved=[true,false,false,false,false,false];invalid.era=1;expect(validateSave(invalid)).toBeNull();
  const tile=world();Object.assign(tile.player,MAP.tile);expect(validateSave(tile)).toBeNull();
 });
});
