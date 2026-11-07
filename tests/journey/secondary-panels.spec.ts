import {test,expect} from '@playwright/test';

test('navy settings preserve repeated keyboard dismissal and focus without creating a save',async({page})=>{
 await page.goto('./');
 for(let i=0;i<2;i++){
  await page.locator('#journey-title-settings-button').click();
  const panel=page.locator('#journey-title-settings');
  await expect(panel).toBeVisible();
  const style=await panel.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundImage,color:s.color,border:s.borderTopColor};});
  expect(style.background).toContain('linear-gradient');
  const rgb=style.color.match(/\d+/g)!.map(Number);expect(Math.min(...rgb.slice(0,3))).toBeGreaterThan(150);
  expect(style.border).not.toBe('rgba(0, 0, 0, 0)');
  await page.locator('#journey-title-motion').check();
  await page.keyboard.press('Escape');await expect(panel).not.toBeVisible();
  await expect(page.locator('#journey-title-settings-button')).toBeFocused();
 }
 expect(await page.evaluate(()=>localStorage.getItem('dec31-evolution-c013:journey'))).toBeNull();
 await expect(page.locator('#journey-continue')).toBeDisabled();
});

test('secondary panels fit narrow and short screens and preserve a paused dialogue',async({page})=>{
 page.on('dialog',dialog=>dialog.accept());
 for(const size of [{width:320,height:640},{width:667,height:375},{width:1280,height:720}]){
  await page.setViewportSize(size);await page.goto('./');
  await page.locator('#journey-title-settings-button').click();
  await page.locator('#journey-title-settings-close').click();
  const continueButton=page.locator('#journey-continue');
  await page.locator('#journey-new').click();
  await expect(page.locator('#journey-dialogue')).toBeVisible();
  const line=await page.locator('#journey-line').innerText();
  await page.keyboard.press('Escape');await expect(page.locator('#journey-pause')).toBeVisible();
  await page.locator('#journey-volume').fill('0.35');
  await page.locator('#journey-motion').check();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('#journey-pause [data-action="resume"]').click();
  await expect(page.locator('#journey-line')).toHaveText(line);
  await page.keyboard.press('Escape');
  await page.locator('#journey-pause [data-action="title"]').click();
  await expect(continueButton).toBeEnabled();
 }
});
