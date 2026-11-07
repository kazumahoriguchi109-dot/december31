import {expect,test,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const saveKey='dec31-evolution-c013:journey';
const prefsKey='dec31-evolution-c013:preferences';
const out=process.env.TITLE_SHOTS||'/tmp/december31-title-screen-evidence';
const saved=async(page:Page)=>page.evaluate((key:string)=>localStorage.getItem(key),saveKey);

test('fresh title offers three choices and keyboard settings never create a game save',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');
 await expect(page.locator('#journey-new')).toBeFocused();
 await page.keyboard.press('Shift+Tab');
 expect(await page.evaluate(()=>document.activeElement?.id==='journey-world')).toBe(false);
 await page.locator('#journey-new').focus();
 await expect(page.locator('#journey-continue')).toBeVisible();
 await expect(page.locator('#journey-continue')).toBeDisabled();
 expect(await saved(page)).toBeNull();
 await page.keyboard.press('ArrowDown');
 await expect(page.locator('#journey-title-settings-button')).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.locator('#journey-title-settings')).toBeVisible();
 await expect(page.locator('.journey-app')).toHaveAttribute('data-screen','title');
 await page.locator('#journey-title-volume').fill('0.25');
 await page.locator('#journey-title-motion').check();
 for(let i=0;i<7;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('#journey-title-settings')||(document.activeElement===document.body&&!document.hasFocus()))).toBe(true);}
 await page.keyboard.press('Escape');
 await expect(page.locator('#journey-title-settings')).not.toBeVisible();
 await expect(page.locator('#journey-title-settings-button')).toBeFocused();
 expect(await saved(page)).toBeNull();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),prefsKey)).toEqual({volume:.25,reducedMotion:true});
 await page.reload();await page.locator('#journey-title-settings-button').click();
 await expect(page.locator('#journey-title-volume')).toHaveValue('0.25');
 await expect(page.locator('#journey-title-motion')).toBeChecked();
 await page.locator('#journey-title-settings-close').click();
 expect(await saved(page)).toBeNull();expect(errors).toEqual([]);
});

test('existing progress survives title settings, reload, cancelled restart and continue',async({page})=>{
 await page.goto('./');await page.locator('#journey-new').click();
 await expect(page.locator('#journey-dialogue')).toBeVisible();
 await page.keyboard.press('Escape');await page.locator('#journey-pause [data-action="title"]').click();
 await expect(page.locator('#journey-continue')).toBeEnabled();
 const before=await saved(page);expect(before).not.toBeNull();
 await page.locator('#journey-title-settings-button').click();
 await page.locator('#journey-title-volume').fill('0.1');await page.locator('#journey-title-motion').check();
 await page.locator('#journey-title-settings-close').click();
 expect(await saved(page)).toBe(before);
 page.once('dialog',async d=>{expect(d.type()).toBe('confirm');expect(d.message()).toContain('記録を上書き');await d.dismiss();});
 await page.locator('#journey-new').click();await expect(page.locator('#journey-title')).toBeVisible();
 expect(await saved(page)).toBe(before);
 await page.reload();await expect(page.locator('#journey-continue')).toBeEnabled();expect(await saved(page)).toBe(before);
 await page.locator('#journey-continue').click();await expect(page.locator('#journey-world')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#journey-volume')).toHaveValue('0.1');await expect(page.locator('#journey-motion')).toBeChecked();
});

test('fresh restart requires and respects confirmation before replacing a record',async({page})=>{
 await page.goto('./');await page.locator('#journey-new').click();await expect(page.locator('#journey-dialogue')).toBeVisible();
 await page.keyboard.press('Escape');await page.locator('#journey-pause [data-action="title"]').click();
 let confirmed=false;page.once('dialog',async d=>{confirmed=true;await d.accept();});
 await page.locator('#journey-new').click();await expect(page.locator('#journey-dialogue')).toBeVisible();expect(confirmed).toBe(true);
});

test('small and short titles retain all menu actions and settings controls',async({page},testInfo)=>{
 await mkdir(out,{recursive:true});
 for(const size of[{width:390,height:844},{width:667,height:375},{width:640,height:360}]){
  await page.setViewportSize(size);await page.goto('./');await page.locator('.journey-title-art').evaluate((i:HTMLImageElement)=>i.decode());
  for(const id of ['journey-new','journey-continue','journey-title-settings-button'])await expect(page.locator('#'+id)).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(testInfo.project.name==='chromium')await page.screenshot({path:`${out}/title-${size.width}x${size.height}.png`});
  await page.locator('#journey-title-settings-button').click();
  await expect(page.locator('#journey-title-settings-close')).toBeInViewport();
  await expect(page.locator('#journey-title-volume')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('#journey-title-settings-close').click();
 }
});

test('unusable stored data leaves continue disabled and settings usable',async({page})=>{
 await page.addInitScript(key=>localStorage.setItem(key,'invalid-json'),saveKey);
 await page.goto('./');await expect(page.locator('#journey-continue')).toBeDisabled();
 await page.locator('#journey-title-settings-button').click();await expect(page.locator('#journey-title-settings')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#journey-title-settings-button')).toBeFocused();
 expect(await saved(page)).toBe('invalid-json');
});

test('title is usable when browser storage is unavailable',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('Blocked','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('Blocked','SecurityError')};});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./');
 await expect(page.locator('#journey-continue')).toBeDisabled();await page.locator('#journey-title-settings-button').click();
 await page.locator('#journey-title-volume').fill('0');await page.locator('#journey-title-motion').check();
 await page.locator('#journey-title-settings-close').click();await expect(page.locator('#journey-new')).toBeVisible();expect(errors).toEqual([]);
});


test('empty continue is visibly inactive and ignores pointer and keyboard activation',async({page})=>{
 await page.goto('./');
 const button=page.locator('#journey-continue');
 await expect(button).toBeDisabled();await expect(button).toHaveCSS('opacity','0.45');
 await expect(page.locator('#journey-continue-note')).toBeVisible();
 const box=await button.boundingBox();expect(box).not.toBeNull();
 await page.mouse.click(box!.x+box!.width/2,box!.y+box!.height/2);
 await button.dispatchEvent('click');
 await button.dispatchEvent('keydown',{key:'Enter',code:'Enter'});
 await button.dispatchEvent('keydown',{key:' ',code:'Space'});
 await page.locator('#journey-title h1').click();
 await page.keyboard.press('Enter');await page.keyboard.press('Space');
 await expect(page.locator('.journey-app')).toHaveAttribute('data-screen','title');
 expect(await saved(page)).toBeNull();
 await page.locator('#journey-new').focus();await page.keyboard.press('Tab');
 await expect(button).not.toBeFocused();
 // WebKit follows macOS Tab preferences; arrow navigation explicitly visits buttons.
 await page.locator('#journey-new').focus();await page.keyboard.press('ArrowDown');
 await expect(page.locator('#journey-title-settings-button')).toBeFocused();
 await page.keyboard.press('ArrowUp');await expect(page.locator('#journey-new')).toBeFocused();
});

for(const invalid of [null,'invalid-json','{}'])test(`continue revalidates a stale save (${invalid}) without starting a new game`,async({page})=>{
 await page.goto('./');await page.locator('#journey-new').click();
 await expect(page.locator('#journey-dialogue')).toBeVisible();
 await page.keyboard.press('Escape');await page.locator('#journey-pause [data-action="title"]').click();
 const button=page.locator('#journey-continue');await expect(button).toBeEnabled();
 // Isolated test context only: emulate another tab removing or damaging the record.
 await page.evaluate(({key,value})=>{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);},{key:saveKey,value:invalid});
 await button.click();
 await expect(page.locator('.journey-app')).toHaveAttribute('data-screen','title');
 await expect(button).toBeDisabled();await expect(page.locator('#journey-new')).toBeFocused();
 await expect(page.locator('#journey-continue-note')).toBeVisible();
 expect(await saved(page)).toBe(invalid);
});
