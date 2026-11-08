import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const out='/tmp/december31-cycle012-ui';
test('painted atlas keeps eight expressive faces within aligned cells',async({page})=>{
 await mkdir(out,{recursive:true});await page.goto('tests/visual/portrait-gallery.html');
 await page.locator('.journey-material-portrait').evaluateAll(images=>Promise.all(images.map(i=>(i as HTMLImageElement).decode())));
 await expect(page.locator('.journey-material-portrait')).toHaveCount(8);
 expect(await page.locator('.journey-portrait').evaluateAll(nodes=>nodes.every(n=>Math.abs(n.clientWidth-n.clientHeight)<2))).toBe(true);
 await page.screenshot({path:`${out}/portrait-gallery.png`,fullPage:true});
});
test('four world eras use the approved navy dialogue and accessible focus',async({page})=>{
 await mkdir(out,{recursive:true});const appearances:string[]=[];
 for(let era=0;era<4;era++){
  await page.goto(`tests/visual/ui-fixture.html?era=${era}&expression=curious&speaker=トト`);
  const portrait=page.locator('.journey-material-portrait');await portrait.evaluate((i:HTMLImageElement)=>i.decode());
  await expect(portrait).toHaveAttribute('data-portrait-row','1');await expect(portrait).toHaveAttribute('data-portrait-column','1');
  await page.getByRole('button',{name:'つづきを聞く'}).focus();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  appearances.push(await page.locator('#journey-dialogue').evaluate(n=>{const c=getComputedStyle(n);return[c.borderRadius,c.borderColor,c.boxShadow].join('|')}));
  await page.screenshot({path:`${out}/era-${era}.png`});
 }
 // The first world uses an ink-and-white frame; later worlds share the approved navy panel.
 expect(appearances[0]).not.toBe(appearances[1]);expect(new Set(appearances.slice(1)).size).toBe(1);
 await expect(page.locator('#journey-dialogue')).toHaveCSS('color','rgb(255, 240, 210)');
});
test('portrait and next action remain visible in narrow viewports',async({page})=>{
 for(const size of[{width:390,height:844},{width:667,height:375}]){
  await page.setViewportSize(size);await page.goto('tests/visual/ui-fixture.html?era=3&expression=surprised');
  await page.locator('.journey-material-portrait').evaluate((i:HTMLImageElement)=>i.decode());
  await expect(page.getByRole('button',{name:'つづきを聞く'})).toBeInViewport();await expect(page.locator('.journey-portrait')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`${out}/narrow-${size.width}.png`});
 }
});
