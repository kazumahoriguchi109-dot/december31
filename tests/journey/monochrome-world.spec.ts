import {test,expect} from '@playwright/test';
test('monochrome world keeps live input, responsive UI and actual save across reload',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dec31-evolution-c013:journey')||'null'));
 await page.goto('./');await page.locator('#journey-new').click();
 for(let i=0;i<22;i++)await page.locator('#journey-dialogue [data-action="next"]').click();
 for(let i=0;i<14&&await page.locator('#journey-context-label').innerText()!=='いっしょに始める';i++){
  await page.locator('#journey-world').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');await page.waitForTimeout(80);
 }
 await page.locator('#journey-interact').click();for(let i=0;i<4;i++)await page.locator('#journey-dialogue [data-action="next"]').click();
 await expect(page.locator('.journey-portal')).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.locator('.journey-app')).toHaveAttribute('data-era','0');await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','world');
 await expect(page.locator('#journey-dialogue')).toBeVisible();
 for(const size of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);await expect(page.locator('.journey-next')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await test.info().attach(`monochrome-${size.width}`,{body:await page.screenshot(),contentType:'image/png'});
 }
 await page.setViewportSize({width:640,height:400});for(let i=0;i<2;i++)await page.locator('#journey-dialogue [data-action="next"]').click();
 const before=await save();await page.locator('#journey-world').focus();await page.keyboard.down('KeyD');await page.waitForTimeout(450);await page.keyboard.up('KeyD');await page.waitForTimeout(200);
 const moved=await save();expect(moved.player.x).toBeGreaterThan(before.player.x+.2);expect(moved.era).toBe(0);expect(moved.solved).toEqual(before.solved);
 await page.reload();await page.locator('#journey-continue').click();await expect(page.locator('.journey-app')).toHaveAttribute('data-era','0');
 expect((await save()).player).toEqual(moved.player);expect(errors).toEqual([]);
});
