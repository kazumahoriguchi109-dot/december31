import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const out=process.env.ROOM_SHOTS||'/tmp/december31-room-ui/final';
const saveKey='dec31-evolution-c013:journey';
async function dismiss(page:Page){for(let i=0;i<8&&await page.locator('#journey-dialogue').isVisible();i++){await page.locator('#journey-dialogue [data-action="next"]').click();await page.waitForTimeout(100);}}
test('compact room UI preserves opening, saved position and the real game interaction',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await page.locator('#journey-new').click();
 await expect(page.locator('#journey-line')).toContainText('机のところまで歩いてみて');
 await expect(page.locator('#journey-speaker')).toHaveText('トト');
 await expect(page.locator('.journey-next')).toBeInViewport();
 await expect(page.locator('.journey-material-portrait')).toBeVisible();
 await mkdir(out,{recursive:true});if(info.project.name==='chromium')await page.screenshot({path:`${out}/room-dialogue.png`});
 await dismiss(page);
 const hud=await page.locator('.journey-hud').boundingBox();expect(hud!.height).toBeLessThan(90);
 await expect(page.locator('#journey-walk-help')).toBeVisible();
 await expect(page.locator('#journey-interact')).toBeDisabled();
 for(const id of ['journey-partner','journey-rotate','journey-resonance'])await expect(page.locator('#'+id)).toBeHidden();
 if(info.project.name==='chromium')await page.screenshot({path:`${out}/room-exploration.png`});
 // Advance with ordinary inputs until the actual proximity action becomes available.
 // A fixed wall-clock hold is unreliable when other WebGL test contexts share the GPU.
 for(let i=0;i<12&&await page.locator('#journey-context-label').innerText()!=='いっしょに始める';i++){
  await page.locator('#journey-world').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');await page.waitForTimeout(80);
 }
 await expect(page.locator('#journey-context-label')).toHaveText('いっしょに始める');
 await expect(page.locator('#journey-interact')).toBeEnabled();
 await page.keyboard.press('Escape');
 const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),saveKey);
 await page.reload();await page.locator('#journey-continue').click();
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),saveKey);expect(after.player).toEqual(before.player);
 await expect(page.locator('#journey-context-label')).toHaveText('いっしょに始める');
 await page.locator('#journey-interact').click();await dismiss(page);
 await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','world');
 expect(errors).toEqual([]);
});
test('room HUD and dialogue remain usable on small screens',async({page},info)=>{
 page.on('dialog',d=>d.accept());
 await mkdir(out,{recursive:true});
 for(const size of[{width:390,height:844},{width:667,height:375}]){
  await page.setViewportSize(size);await page.goto('./');
  await page.locator('#journey-new').click();
  await expect(page.locator('.journey-next')).toBeInViewport();await expect(page.locator('#journey-speaker')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(info.project.name==='chromium')await page.screenshot({path:`${out}/room-dialogue-${size.width}.png`});
  await dismiss(page);await expect(page.locator('#journey-walk-help')).toBeInViewport();await expect(page.locator('#journey-interact')).toBeInViewport();
  await page.keyboard.press('Escape');await expect(page.locator('#journey-pause [data-action="resume"]')).toBeInViewport();
 }
});
