import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
test('test-only unread-wall fixture preserves state across four quarters and both quality levels',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('/tmp/december31-cycle012-wall-fix',{recursive:true});
 for(const quality of['normal','low'])for(let quarter=0;quarter<4;quarter++){
  await page.goto(`tests/visual/wall-fixture.html?quarter=${quarter}&quality=${quality}`);
  await expect(page.locator('body')).toHaveAttribute('data-ready','true');
  await expect(page.locator('body')).toHaveAttribute('data-state-unchanged','true');await expect(page.locator('body')).toHaveAttribute('data-wall-seen','false');
  await expect(page.locator('body')).toHaveAttribute('data-opacity',quarter===2?'0.18':'1');
  await page.screenshot({path:`/tmp/december31-cycle012-wall-fix/fixture-${quality}-q${quarter}.png`});
 }expect(errors).toEqual([]);
});
