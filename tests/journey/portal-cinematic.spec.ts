import {test,expect,type Page} from '@playwright/test';
import {createState,step,context,validateSave} from '../../src/journey/model';
import {pendingOpeningStory,acknowledgeOpeningLine,beginDeskStory} from '../../src/journey/openingStory';
// Focused cinematic cases resume a real model-built save immediately before the four desk lines.
// The separate opening-story suite still walks through all 22 introductory lines from a fresh game.
function deskSave(){
 const state=createState();step(state,{x:0,z:0,run:false},0);
 for(const line of pendingOpeningStory(state))acknowledgeOpeningLine(state,line.id);
 for(let i=0;i<500&&context(state)?.id!=='begin';i++)step(state,{x:0,z:-1,run:false},.05);
 if(context(state)?.id!=='begin'||!context(state)?.enabled)throw new Error('Desk fixture could not reach the playable desk');
 beginDeskStory(state);const saved=validateSave(JSON.parse(JSON.stringify(state)));
 if(!saved||pendingOpeningStory(saved).length!==4)throw new Error('Invalid unfinished desk fixture');
 return saved;
}
async function reachPortal(page:Page){
 await page.addInitScript(save=>{if(!localStorage.getItem('dec31-evolution-c013:journey'))localStorage.setItem('dec31-evolution-c013:journey',JSON.stringify(save));},deskSave());
 await page.goto('./');await page.locator('#journey-continue').click();
 for(let i=0;i<4;i++)await page.locator('#journey-dialogue [data-action="next"]').click();
}
test('portal survives reload, blocks movement, skips once, and never replays after arrival',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await reachPortal(page);
 await expect(page.locator('.journey-portal')).toBeVisible();await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','room');
 const position=await page.evaluate(()=>JSON.parse(localStorage.getItem('dec31-evolution-c013:journey')!).player);
 await page.keyboard.press('KeyW');await page.reload();await page.locator('#journey-continue').click();
 await expect(page.locator('.journey-portal')).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dec31-evolution-c013:journey')!).player)).toEqual(position);
 await page.keyboard.press('Escape');await expect(page.locator('.journey-portal')).toHaveCount(0);await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
 await page.waitForTimeout(18500);await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
 await page.reload();await page.locator('#journey-continue').click();await expect(page.locator('.journey-portal')).toHaveCount(0);await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');expect(errors).toEqual([]);
});
test('portal plays to the monochrome world without input',async({page})=>{
 test.setTimeout(120000);await reachPortal(page);await expect(page.locator('.journey-portal')).toBeVisible();
 await expect(page.locator('.journey-portal video')).toHaveJSProperty('muted',true);
 await expect(page.locator('.journey-portal')).toHaveCount(0,{timeout:30000});await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','world');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dec31-evolution-c013:journey')!).era)).toBe(0);
 await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
});
test('OS reduced motion uses a short still dissolve without video',async({page})=>{
 test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});await reachPortal(page);
 await expect(page.locator('.journey-portal')).toBeVisible();await expect(page.locator('.journey-portal video')).toHaveCount(0);
 await expect(page.locator('.journey-portal')).toHaveCount(0,{timeout:30000});await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
});
test('blocked video autoplay uses the animated fallback and still completes',async({page})=>{
 test.setTimeout(120000);await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Test autoplay block','NotAllowedError'));};});
 await reachPortal(page);await expect(page.locator('.journey-portal')).toBeVisible();await expect(page.locator('.journey-portal video')).toHaveCSS('opacity','0');
 await expect(page.locator('.journey-portal')).toHaveCount(0,{timeout:30000});await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
});
