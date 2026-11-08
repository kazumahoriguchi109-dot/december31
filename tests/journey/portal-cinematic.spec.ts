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
 await page.waitForTimeout(30500);await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
 await page.reload();await page.locator('#journey-continue').click();await expect(page.locator('.journey-portal')).toHaveCount(0);await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');expect(errors).toEqual([]);
});
test('portal plays to the monochrome world without input',async({page})=>{
 test.setTimeout(120000);await reachPortal(page);await expect(page.locator('.journey-portal')).toBeVisible();
 await expect(page.locator('.journey-portal video')).toHaveJSProperty('muted',true);
 await page.waitForTimeout(18500);await expect(page.locator('.journey-portal')).toBeVisible();
 await expect(page.locator('.journey-portal')).toHaveCount(0,{timeout:45000});await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','world');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dec31-evolution-c013:journey')!).era)).toBe(0);
 await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
});
test('OS reduced motion uses a short still dissolve without video',async({page})=>{
 test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});await reachPortal(page);
 await expect(page.locator('.journey-portal')).toBeVisible();await expect(page.locator('.journey-portal video')).toHaveCount(0);
 await expect(page.locator('.journey-portal')).toHaveCount(0,{timeout:5000});await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
});
test('blocked video autoplay uses the animated fallback and still completes',async({page})=>{
 test.setTimeout(120000);await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Test autoplay block','NotAllowedError'));};});
 await reachPortal(page);await expect(page.locator('.journey-portal')).toBeVisible();await expect(page.locator('.journey-portal video')).toHaveCSS('opacity','0');
 await expect(page.locator('.journey-portal')).toHaveCount(0,{timeout:45000});await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
});

// Fast dialogue advancement must not carry through into an accidental movie skip.
test('rapid advance keys and held repeats cannot skip the opening, deliberate skip still works',async({page})=>{
 test.setTimeout(120000);await reachPortal(page);
 for(let i=0;i<10;i++){await page.keyboard.press('KeyE');await page.waitForTimeout(120);}
 await expect(page.locator('.journey-portal')).toBeVisible();
 await page.keyboard.down('Space');await page.keyboard.down('Space');await page.keyboard.up('Space');
 await expect(page.locator('.journey-portal')).toBeVisible();
 await page.waitForTimeout(1600);await page.keyboard.press('KeyE');
 await expect(page.locator('.journey-portal')).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.locator('.journey-portal')).toHaveCount(0);await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
});
test('late movie response cannot consume the animation or jump into its middle',async({page})=>{
 test.setTimeout(120000);await page.route('**/portal-opening-*.mp4',async route=>{await new Promise(r=>setTimeout(r,7000));await route.continue().catch(()=>{});});
 await reachPortal(page);await page.waitForTimeout(2500);
 await expect(page.locator('.journey-portal p')).toHaveText('ふたりで、画面の向こうへ。');
 await expect(page.locator('.journey-portal video')).toHaveCSS('opacity','0');
 await page.waitForTimeout(6000);await expect(page.locator('.journey-portal')).toBeVisible();await expect(page.locator('.journey-portal video')).toHaveCSS('opacity','0');
 await page.keyboard.press('Escape');await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','world');
});

test('double tapping the final dialogue does not activate the new skip button',async({page})=>{
 test.setTimeout(120000);await page.addInitScript(save=>localStorage.setItem('dec31-evolution-c013:journey',JSON.stringify(save)),deskSave());
 await page.goto('./');await page.locator('#journey-continue').click();for(let i=0;i<3;i++)await page.locator('#journey-dialogue [data-action="next"]').click();
 const box=await page.locator('#journey-dialogue [data-action="next"]').boundingBox();
 await page.mouse.dblclick(box!.x+box!.width/2,box!.y+box!.height/2,{delay:100});
 await page.waitForTimeout(300);await expect(page.locator('.journey-portal')).toBeVisible();
 await page.locator('.journey-portal button').click();await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
});

test('a playback promise that never settles falls back instead of waiting indefinitely',async({page})=>{
 test.setTimeout(120000);await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return new Promise<void>(()=>{});};});
 await reachPortal(page);await expect(page.locator('.journey-portal p')).toHaveText('ふたりで、画面の向こうへ。',{timeout:10000});
 await expect(page.locator('.journey-portal video')).toHaveCSS('opacity','0');await page.keyboard.press('Escape');await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','world');
});


test('slow dialogue advancement keys never dismiss the movie',async({page})=>{
 test.setTimeout(120000);await reachPortal(page);
 for(const key of ['KeyE','Space','Enter','KeyE','Space','Enter']){
  await page.waitForTimeout(800);await page.keyboard.press(key);
  await expect(page.locator('.journey-portal')).toBeVisible();
 }
 await page.keyboard.press('Escape');
 await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
});
for(const key of ['Enter','Space'])test(`focused skip button supports native ${key} exactly once`,async({page})=>{
 test.setTimeout(120000);await reachPortal(page);
 const skip=page.locator('.journey-portal button');await expect(skip).toBeEnabled();
 await page.keyboard.press('Tab');await expect(skip).toBeFocused();
 await page.keyboard.press(key);await expect(page.locator('.journey-portal')).toHaveCount(0);
 await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
 await page.waitForTimeout(300);await expect(page.locator('#journey-line')).toHaveText('あれ……本当に、ゲームの中にいる。');
});
