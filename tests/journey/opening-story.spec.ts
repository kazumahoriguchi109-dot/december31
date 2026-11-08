import {test,expect,type Page} from '@playwright/test';
import {OPENING_ROOM,OPENING_DESK,OPENING_ARRIVAL} from '../../src/journey/openingStory';
const next=(page:Page)=>page.locator('#journey-dialogue [data-action="next"]').click();
const current=(page:Page)=>page.locator('#journey-line');
async function reload(page:Page){await page.reload();await page.locator('#journey-continue').click();}
test('approved opening retains unread lines through pause, reload, desk and world arrival',async({page})=>{
 test.setTimeout(60000);
 await page.goto('./');await page.locator('#journey-new').click();
 for(let i=0;i<3;i++){await expect(current(page)).toHaveText(OPENING_ROOM[i]![1]);await next(page);}
 await page.keyboard.press('Escape');await page.locator('#journey-pause [data-action="resume"]').click();
 await expect(current(page)).toHaveText(OPENING_ROOM[3]![1]);await reload(page);await expect(current(page)).toHaveText(OPENING_ROOM[3]![1]);
 for(let i=3;i<22;i++){await expect(current(page)).toHaveText(OPENING_ROOM[i]![1]);await expect(page.locator('#journey-speaker')).toHaveText(OPENING_ROOM[i]![0]);await next(page);}
 await expect(page.locator('#journey-dialogue')).toBeHidden();await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','room');
 for(let i=0;i<12&&await page.locator('#journey-context-label').innerText()!=='いっしょに始める';i++){
  await page.locator('#journey-world').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');await page.waitForTimeout(80);
 }
 await page.locator('#journey-interact').click();
 for(let i=0;i<2;i++){await expect(current(page)).toHaveText(OPENING_DESK[i]![1]);await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','room');await next(page);}
 await reload(page);
 for(let i=2;i<4;i++){await expect(current(page)).toHaveText(OPENING_DESK[i]![1]);await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','room');await next(page);}
 await expect(page.locator('.journey-app')).toHaveAttribute('data-phase','world');await expect(current(page)).toHaveText(OPENING_ARRIVAL[0]![1]);await next(page);await reload(page);
 await expect(current(page)).toHaveText(OPENING_ARRIVAL[1]![1]);await next(page);await expect(page.locator('#journey-dialogue')).toBeHidden();await reload(page);await expect(page.locator('#journey-dialogue')).toBeHidden();
});
test('longest opening line and continue action fit narrow and short screens',async({page})=>{
 await page.goto('./');await page.locator('#journey-new').click();for(let i=0;i<17;i++)await next(page);
 for(const size of [{width:320,height:640},{width:390,height:844},{width:667,height:375}]){
  await page.setViewportSize(size);await expect(current(page)).toHaveText(OPENING_ROOM[17]![1]);
  await expect(current(page)).toBeInViewport();await expect(page.locator('.journey-next')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
});
