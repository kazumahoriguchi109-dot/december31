import {test,expect} from '@playwright/test';
test('triangle cue is legible, keyboard-focusable and tappable in every era',async({page})=>{
 for(const era of [0,1,2,3])for(const size of [{width:1280,height:800},{width:390,height:844},{width:667,height:375}]){
  await page.setViewportSize(size);await page.goto(`/tests/visual/ui-fixture.html?era=${era}`);
  const cue=page.getByRole('button',{name:'つづきを聞く',exact:true});await expect(cue).toHaveText('▼');await expect(cue).toBeInViewport();await cue.focus();await expect(cue).toBeFocused();
  const style=await cue.evaluate(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {width:r.width,height:r.height,outline:s.outlineStyle,background:s.backgroundColor,color:s.color};});
  expect(style.width).toBeGreaterThanOrEqual(48);expect(style.height).toBeGreaterThanOrEqual(48);expect(style.outline).not.toBe('none');expect(style.background).toBe('rgba(0, 0, 0, 0)');
  if(era===0||era===3)await page.screenshot({path:test.info().outputPath(`cue-era${era}-${size.width}.png`)});
 }
});
