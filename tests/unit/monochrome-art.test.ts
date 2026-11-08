import {describe,it,expect} from 'vitest';
import {monochromeFrame} from '../../src/journey/monochromeArt';
describe('monochrome live-world projection',()=>{
 it.each([[1280,800],[390,844],[844,390],[320,568]])('keeps pixels square at %i × %i',(w,h)=>{
  const f=monochromeFrame(w,h,{x:0,z:0});expect(Math.abs(f.w/f.h-w/h)).toBeLessThan(.004);
  expect(f.x(0)).toBeGreaterThan(0);expect(f.x(0)).toBeLessThan(f.w);
  expect(f.y(0)).toBeGreaterThan(f.h*.5);expect(f.y(0)).toBeLessThan(f.h*.72);
 });
 it('moves the view with state without changing state or relative positions',()=>{
  const player={x:3,z:-5.2};const before={...player};const f=monochromeFrame(1280,800,player);
  expect(player).toEqual(before);expect(f.x(4)-f.x(3)).toBe(f.unit);
  expect(f.y(-4)).toBeGreaterThan(f.y(-5));
 });
});
