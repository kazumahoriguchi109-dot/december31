import {describe,it,expect} from 'vitest';
import {isDialogueTap} from '../../src/journey/dialoguePointer';
describe('dialogue pointer gesture bounds',()=>{
 it('accepts a normal tap with a little finger movement',()=>{expect(isDialogueTap(0,50)).toBe(true);expect(isDialogueTap(8,1000)).toBe(true);});
 it('rejects drags even if they later return to the original position',()=>{expect(isDialogueTap(8.01,100)).toBe(false);expect(isDialogueTap(50,400)).toBe(false);});
 it('rejects long presses and invalid timing',()=>{expect(isDialogueTap(0,1001)).toBe(false);expect(isDialogueTap(0,-1)).toBe(false);});
});
