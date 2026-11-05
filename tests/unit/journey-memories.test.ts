import {describe,it,expect} from 'vitest';
import {createState,validateSave} from '../../src/journey/model';
import {MEMORIES,memoryAt,lightMemory,memoryLit,pendingMemoryExplanation,acknowledgeMemoryExplanation,acknowledgeMemoryLine,unreadMemoryLines} from '../../src/journey/memories';

describe('optional resonance memories',()=>{
 it('persists each optional trail once without changing puzzle progress',()=>{
  const s=createState();s.phase='world';s.era=3;s.solved=[true,true,true,true,true,false];s.gateLatched=true;s.wallSeen=true;s.ringA=1;s.ringB=2;s.p1=1;s.p2Drain=false;s.p2Stopper=false;
  const solved=[...s.solved];expect(lightMemory(s,'unknown')).toBe(false);expect(lightMemory(s,'gate')).toBe(true);
  expect(lightMemory(s,'gate')).toBe(false);expect(s.seen.filter(x=>x==='memory-lit-gate')).toHaveLength(1);
  expect(s.solved).toEqual(solved);const restored=validateSave(s);expect(restored).not.toBeNull();expect(memoryLit(restored!,'gate')).toBe(true);
  expect(memoryLit(restored!,'water')).toBe(false);s.era=2;expect(lightMemory(s,'water')).toBe(false);
 });
 it('recovers an unread light explanation and stops recovering it after acknowledgement',()=>{
  const s=createState();s.phase='world';s.era=3;s.solved=[true,true,true,true,true,false];s.gateLatched=true;s.wallSeen=true;s.ringA=1;s.ringB=2;s.p1=1;s.p2Drain=false;s.p2Stopper=false;
  expect(pendingMemoryExplanation(s)).toBeNull();expect(acknowledgeMemoryExplanation(s,'gate')).toBe(false);
  expect(lightMemory(s,'gate')).toBe(true);expect(acknowledgeMemoryLine(s,'gate',0)).toBe(true);let restored=validateSave(s)!;expect(pendingMemoryExplanation(restored)).toBe('gate');expect(unreadMemoryLines(restored,'gate').map(x=>x.index)).toEqual([1,2]);
  expect(acknowledgeMemoryExplanation(restored,'gate')).toBe(true);expect(acknowledgeMemoryExplanation(restored,'gate')).toBe(false);
  restored=validateSave(restored)!;expect(pendingMemoryExplanation(restored)).toBeNull();expect(memoryLit(restored,'gate')).toBe(true);
 });
 it('requires the late ability, resonance, world walking and proximity',()=>{
  const s=createState();s.phase='world';s.era=3;
  for(const m of MEMORIES){Object.assign(s.player,m.point);expect(memoryAt(s,true)?.id).toBe(m.id);expect(memoryAt(s,false)).toBeNull();}
  s.era=2;expect(memoryAt(s,true)).toBeNull();s.era=3;s.mode='observe';expect(memoryAt(s,true)).toBeNull();s.mode='walk';s.phase='room';expect(memoryAt(s,true)).toBeNull();s.phase='world';Object.assign(s.player,{x:-10,z:0});expect(memoryAt(s,true)).toBeNull();
 });
});
