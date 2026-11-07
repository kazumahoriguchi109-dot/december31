import {describe,it,expect} from 'vitest';
import {materialPortrait} from '../../src/journey/materialPortrait';

describe('painted dialogue atlas',()=>{
 it('maps each emotion to a distinct cell without switching artwork or head dimensions',()=>{
  for(const speaker of ['あなた','トト']) {
   const portraits=(['neutral','question','surprise','relief'] as const).map(emotion=>materialPortrait(speaker,emotion));
   portraits.forEach((markup,column)=>{
    expect(markup).toContain(`data-portrait-column="${column}"`);
    expect(markup).toContain(`left:-${column*100}%`);
    expect(markup).toContain('width="1774" height="887"');
    expect(markup).toContain('alt=""');
   });
   expect(new Set(portraits.map(p=>p.match(/src="([^"]+)"/)![1])).size).toBe(1);
  }
 });
 it('keeps character rows distinct and does not interpolate speaker text into HTML',()=>{
  expect(materialPortrait('トト','neutral')).toContain('data-portrait-row="1"');
  expect(materialPortrait('あなた','neutral')).toContain('data-portrait-row="0"');
  expect(materialPortrait('<img onerror=alert(1)>','neutral')).not.toContain('onerror');
 });
});
