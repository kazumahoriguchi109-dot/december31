import {describe,it,expect} from 'vitest';
import {createState} from '../../src/journey/model';
import {MEMORIES,memoryAt} from '../../src/journey/memories';

describe('optional resonance memories',()=>{
 it('requires the late ability, resonance, world walking and proximity',()=>{
  const s=createState();s.phase='world';s.era=3;
  for(const m of MEMORIES){Object.assign(s.player,m.point);expect(memoryAt(s,true)?.id).toBe(m.id);expect(memoryAt(s,false)).toBeNull();}
  s.era=2;expect(memoryAt(s,true)).toBeNull();s.era=3;s.mode='observe';expect(memoryAt(s,true)).toBeNull();s.mode='walk';s.phase='room';expect(memoryAt(s,true)).toBeNull();s.phase='world';Object.assign(s.player,{x:-10,z:0});expect(memoryAt(s,true)).toBeNull();
 });
});
