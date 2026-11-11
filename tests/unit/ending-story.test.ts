import {describe,it,expect} from 'vitest';
import {ENDING_STORY,endingLine,rewindStage} from '../../src/evolution/endingStory';
describe('ending story',()=>{
 it('includes reunion, reverse journey, return, closed chest and next year',()=>{expect([...new Set(ENDING_STORY.map(b=>b.scene))]).toEqual(['gate','rewind','room','chest','end']);expect(ENDING_STORY.some(b=>b.text.includes('手'))).toBe(true);expect(ENDING_STORY.some(b=>b.text.includes('来年も'))).toBe(true);});
 it('validates saved progress without changing puzzle saves',()=>{for(const n of [-1,99,NaN,null,'1',.5])expect(endingLine(n)).toBe(0);expect(endingLine(12)).toBe(12);});
 it('reverses world formats with a stable reduced-motion alternative',()=>{expect([0,.3,.6,.9,1].map(p=>rewindStage(p))).toEqual([3,2,1,0,0]);expect(rewindStage(1,true)).toBe(2);});
});
