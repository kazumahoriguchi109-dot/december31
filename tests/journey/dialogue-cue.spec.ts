import {test,expect} from '@playwright/test';
import {OPENING_ROOM} from '../../src/journey/openingStory';
test('triangle cue retains click, E, Space, Enter and touch without double advancing',async({browser,browserName})=>{
 test.setTimeout(90000);
 const context=await browser.newContext({viewport:{width:640,height:400},hasTouch:true});const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(process.env.LIVE_URL??'http://127.0.0.1:5175/');await page.locator('#journey-new').click();
  const cue=page.getByRole('button',{name:'つづきを聞く',exact:true}),line=page.locator('#journey-line');
  await expect(cue).toHaveText('▼');await expect(cue.locator('kbd')).toHaveCount(0);await expect(cue).toHaveAttribute('aria-keyshortcuts','E Space Enter');
  let n=0;await expect(line).toHaveText(OPENING_ROOM[n]![1]);
  const check=async()=>{await expect(line).toHaveText(OPENING_ROOM[++n]![1]);await page.waitForTimeout(100);await expect(line).toHaveText(OPENING_ROOM[n]![1]);};
  await cue.click();await check();
  await page.locator('#journey-world').focus();await page.keyboard.press('KeyE');await check();
  await page.keyboard.press('Space');await check();
  // macOS WebKit uses Option+Tab for buttons when full keyboard access is off.
  await page.locator('#journey-world').focus();for(let i=0;i<8&&!await cue.evaluate(n=>n===document.activeElement);i++)await page.keyboard.press(browserName==='webkit'?'Alt+Tab':'Tab');await expect(cue).toBeFocused();expect(await cue.evaluate(n=>getComputedStyle(n).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');await check();await page.keyboard.press('Space');await check();
  await cue.tap();await check();
  for(const size of [{width:320,height:640},{width:390,height:844},{width:667,height:375}]){
   await page.setViewportSize(size);await expect(cue).toBeInViewport();const box=await cue.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(48);expect(box!.height).toBeGreaterThanOrEqual(48);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
