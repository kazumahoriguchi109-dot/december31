import {describe,it,expect} from 'vitest';
import {createState,validateSave} from '../../src/journey/model';
import {millVisual} from '../../src/journey/millVisual';

describe('mill presentation follows saved switches',()=>{
 it('shows the selected water path and catch for each unsolved combination, and the open bridge only on success',()=>{
  for(const [drain,stopper,solved] of [[true,true,false],[true,false,false],[false,true,false],[false,false,true]] as const){
   const view=millVisual({p2Drain:drain,p2Stopper:stopper,solved:[true,solved,false,false,false,false]});
   expect(view.bypass).toBe(drain);expect(view.wheelChannel).toBe(!drain);expect(view.locked).toBe(stopper);expect(view.turning).toBe(solved);expect(view.bridgeDown).toBe(solved);
  }
 });
 it('preserves an unfinished setting and a completed bridge after save validation',()=>{
  const s=createState();s.phase='world';s.era=1;s.solved[0]=true;s.p1=1;s.p2Drain=false;s.p2Stopper=true;
  const first=validateSave(s)!;expect(first).not.toBeNull();expect(millVisual(first)).toMatchObject({wheelChannel:true,locked:true,bridgeDown:false});
  s.p2Stopper=false;s.solved[1]=true;const final=validateSave(s)!;expect(final).not.toBeNull();expect(millVisual(final)).toMatchObject({wheelChannel:true,locked:false,turning:true,bridgeDown:true});
 });
});
