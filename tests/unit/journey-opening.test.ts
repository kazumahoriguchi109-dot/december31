import {describe,it,expect} from 'vitest';
import {createState,step,interact,validateSave} from '../../src/journey/model';
import {OPENING_ROOM,OPENING_DESK,OPENING_ARRIVAL,beginDeskStory,acknowledgeOpeningLine,pendingPortalEntry,pendingOpeningStory,hasOpeningStory} from '../../src/journey/openingStory';
const initial=()=>{const s=createState();step(s,{x:0,z:0,run:false},0);return s;};
const read=(s:ReturnType<typeof createState>)=>{const events=pendingOpeningStory(s);for(const e of events)acknowledgeOpeningLine(s,e.id);};
describe('approved opening story',()=>{
 it('queues exactly 22 approved spoken room lines once, with the named speakers',()=>{
  const s=createState(),events=step(s,{x:0,z:0,run:false},0);
  expect(events.filter(e=>e.type==='dialogue').map(e=>[e.speaker,e.text])).toEqual(OPENING_ROOM);
  expect(OPENING_ROOM).toHaveLength(22);expect(OPENING_DESK).toHaveLength(4);
  expect(events[0]?.text).toBe('今年も、もう終わりだね');expect(events.at(-1)?.text).toBe('うん、始めよう！');
  expect(step(s,{x:0,z:0,run:false},0)).toEqual([]);
 });
 it('resumes each unread room sentence after save without replaying dismissed lines',()=>{
  let s=initial();
  for(let i=0;i<OPENING_ROOM.length;i++){
   s=validateSave(JSON.parse(JSON.stringify(s)))!;expect(s).not.toBeNull();
   const first=pendingOpeningStory(s)[0]!;expect(first.id).toBe(`opening-room-${i}`);
   expect(acknowledgeOpeningLine(s,first.id)).toEqual({changed:true,enterWorld:false});
   expect(acknowledgeOpeningLine(s,first.id).changed).toBe(false);
  }
  expect(pendingOpeningStory(s)).toEqual([]);expect(s.phase).toBe('room');
 });
 it('starts desk dialogue only on request, preserves it on reload, then enters the original world once',()=>{
  let s=initial();read(s);Object.assign(s.player,{x:0,z:-1.5});
  expect(pendingOpeningStory(s)).toEqual([]);
  expect(beginDeskStory(s).map(e=>[e.speaker,e.text])).toEqual(OPENING_DESK);expect(s.phase).toBe('room');
  for(let i=0;i<4;i++){
   s=validateSave(JSON.parse(JSON.stringify(s)))!;
   const first=pendingOpeningStory(s)[0]!;expect(first.id).toBe(`opening-desk-${i}`);
   const ack=acknowledgeOpeningLine(s,first.id);expect(ack.enterWorld).toBe(i===3);
   if(ack.enterWorld){const arrival=interact(s);expect(arrival.map(e=>[e.speaker,e.text])).toEqual(OPENING_ARRIVAL);}
  }
  expect(s.phase).toBe('world');expect(s.player).toMatchObject({x:0,z:0});expect(s.solved.every(v=>!v)).toBe(true);
  for(let i=0;i<2;i++){
   s=validateSave(JSON.parse(JSON.stringify(s)))!;expect(pendingOpeningStory(s)[0]?.id).toBe(`opening-arrival-${i}`);acknowledgeOpeningLine(s,`opening-arrival-${i}`);
  }
  expect(pendingOpeningStory(s)).toEqual([]);expect(s.seen).toHaveLength(7);
 });
 it('recognizes only unfinished room-to-world movies after a save round trip',()=>{
  const s=initial();read(s);Object.assign(s.player,{x:0,z:-1.5});expect(pendingPortalEntry(s)).toBe(false);beginDeskStory(s);read(s);expect(pendingPortalEntry(validateSave(JSON.parse(JSON.stringify(s)))!)).toBe(true);interact(s);expect(pendingPortalEntry(s)).toBe(false);expect(pendingPortalEntry(createState())).toBe(false);
 });
 it('does not replay new introductions or change progress in legacy room/world saves',()=>{
  let s=createState();s.seen=['room-intro'];s.steps=41;
  s=validateSave(s)!;expect(hasOpeningStory(s)).toBe(false);expect(pendingOpeningStory(s)).toEqual([]);expect(step(s,{x:0,z:0,run:false},0)).toEqual([]);
  Object.assign(s.player,{x:-2,z:-2.35});expect(interact(s).some(e=>e.id==='discovery-calendar')).toBe(true);
  Object.assign(s.player,{x:0,z:-1.5});expect(beginDeskStory(s)).toEqual([]);interact(s);
  expect(s.phase).toBe('world');expect(s.steps).toBe(41);expect(pendingOpeningStory(validateSave(s)!)).toEqual([]);
 });
 it('avoids repeated calendar exposition after the new introduction',()=>{
  const s=initial();read(s);Object.assign(s.player,{x:-2,z:-2.35});
  expect(interact(s).map(e=>e.type)).toEqual(['notice']);
 });
});
