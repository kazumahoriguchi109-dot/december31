import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {ACTOR_RADIUS,ROOM_SOLIDS} from '../../src/journey/collision';
import {ROOM_X_SCALE,FURNITURE_X_SCALE} from '../../src/journey/roomPresentation';
const key='dec31-evolution-c013:journey';
test('desk stops sustained and diagonal movement without losing approach, save or interaction',async({page},info)=>{
 test.setTimeout(60000); // Includes the longer authored opening before movement checks.
 await page.goto('./');await page.locator('#journey-new').click();
 for(let i=0;i<40&&await page.locator('#journey-dialogue').isVisible();i++){
  await page.locator('#journey-dialogue [data-action="next"]').click();await page.waitForTimeout(100);
 }
 const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
 await page.locator('#journey-world').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(2000);await page.keyboard.up('KeyW');await page.waitForTimeout(180);
 const first=await saved();expect(first.player.z).toBeGreaterThan(-2);expect(first.player.z).toBeLessThan(-1.3);
 await page.keyboard.down('KeyW');await page.waitForTimeout(1000);await page.keyboard.up('KeyW');await page.waitForTimeout(180);
 const held=await saved();expect(held.player.z).toBeCloseTo(first.player.z,2);
 if(info.project.name==='chromium'){
  const out=process.env.COLLISION_SHOTS||'/tmp/december31-collision';await mkdir(out,{recursive:true});await page.screenshot({path:out+'/desk-contact.png'});
 }
 // A small diagonal press slides along the front rather than entering the tabletop.
 await page.keyboard.down('KeyW');await page.keyboard.down('KeyD');await page.waitForTimeout(160);await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await page.waitForTimeout(180);
 const diagonal=await saved();expect(diagonal.player.x).toBeGreaterThan(first.player.x);expect(diagonal.player.z).toBeGreaterThan(-2);
 await page.keyboard.press('Escape');const before=await saved();await page.reload();await page.locator('#journey-continue').click();
 const after=await saved();expect(after.player).toEqual(before.player);
 await expect(page.locator('#journey-context-label')).toHaveText('いっしょに始める');
 await page.locator('#journey-interact').click();
 for(let i=0;i<8&&await page.locator('#journey-dialogue').isVisible();i++)await page.locator('#journey-dialogue [data-action="next"]').click();
 await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','world');
});

test('an old save inside the desk resumes outside it without resetting progress',async({page})=>{
 await page.goto('./');await page.locator('#journey-new').click();await page.keyboard.press('Escape');
 // Seed only coordinates in an isolated test context to reproduce a pre-fix valid save.
 const old=await page.evaluate(k=>{
  const s=JSON.parse(localStorage.getItem(k)!);s.player.x=0;s.player.z=-2.5;s.toto.x=.45;s.toto.z=-2.4;s.steps=27;
  localStorage.setItem(k,JSON.stringify(s));return s;
 },key);
 // Install after navigation so the previous page's visibility autosave cannot replace the fixture.
 await page.addInitScript(({key,old})=>localStorage.setItem(key,JSON.stringify(old)),{key,old});
 await page.reload();await expect(page.locator('#journey-continue')).toBeEnabled();await page.locator('#journey-continue').click();
 const loaded=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
 expect(loaded.steps).toBe(old.steps);expect(loaded.seen).toEqual(old.seen);expect(loaded.solved).toEqual(old.solved);expect(loaded.phase).toBe('room');
 // Neither actor remains inside the desk footprint after the loaded state is saved.
 for(const actor of [loaded.player,loaded.toto]){
  const desk=ROOM_SOLIDS.desk;
  const dx=Math.max(0,Math.abs(actor.x-desk.x)*ROOM_X_SCALE-desk.width*FURNITURE_X_SCALE/2);
  const dz=Math.max(0,Math.abs(actor.z-desk.z)-desk.depth/2);
  expect(Math.hypot(dx,dz)).toBeGreaterThanOrEqual(ACTOR_RADIUS-1e-6);
 }
 await expect(page.locator('#journey-world')).toBeFocused();
});
