import {test,expect} from '@playwright/test';
test('live monochrome world survives portrait resize without texture corruption or state edits',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/tests/visual/monochrome-fixture.html');await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 const initial=await page.locator('canvas').screenshot();
 for(const size of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
  await page.setViewportSize(size);await page.waitForTimeout(150);
  await expect(page.locator('body')).toHaveAttribute('data-state-unchanged','true');
  expect((await page.locator('canvas').screenshot()).length).toBeGreaterThan(5000);
 }
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(150);
 expect(await page.locator('canvas').screenshot()).toEqual(initial);expect(errors).toEqual([]);
});
