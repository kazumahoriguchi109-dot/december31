import {expect,test} from '@playwright/test';
test('material title, opening, pause, settings and resume use normal UI',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await page.locator('#journey-new').waitFor();
 await page.locator('.journey-title-art').evaluate((i:HTMLImageElement)=>i.decode());
 expect(await page.locator('.journey-title-friends img').evaluateAll(images=>images.length===2&&images.every(i=>(i as HTMLImageElement).naturalWidth===1024))).toBe(true);
 await page.locator('#journey-new').click();await expect(page.locator('#journey-dialogue')).toBeVisible();
 await expect(page.locator('.journey-material-portrait')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#journey-pause')).toBeVisible();
 await page.locator('#journey-motion').check();await page.locator('#journey-volume').fill('0');
 await page.getByRole('button',{name:'冒険へ戻る'}).click();
 await expect(page.locator('#journey-dialogue')).toBeVisible();
 await expect(page.locator('.journey-app')).toHaveAttribute('data-reduced-motion','true');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);
});
test('narrow title and scrollable pause preserve accessible actions',async({page})=>{
 await page.setViewportSize({width:640,height:360});await page.goto('./');await page.locator('#journey-new').click();
 await page.keyboard.press('Escape');await page.locator('#journey-pause').waitFor();
 await page.locator('#journey-pause [data-action="title"]').click();
 await expect(page.locator('#journey-continue')).toBeVisible();
 await page.locator('#journey-continue').click();await expect(page.locator('#journey-world')).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
