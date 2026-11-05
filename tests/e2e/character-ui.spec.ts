import { expect, test } from './fixtures';
import { openGame } from './helpers';

test('both speakers have distinct portraits and dialogue stays usable at 720px', async ({page})=>{
  await page.goto('/');await page.locator('#b-new').click();await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg-portrait svg')).toHaveAttribute('data-character','toto');
  await page.locator('[data-action-id="dlg_next"]').click();await page.waitForTimeout(350);
  await expect(page.locator('#dlg-portrait svg')).toHaveAttribute('data-character','player');
  const boxes=await page.locator('#dlg-portrait,#dlg-text,#dlg-actions button').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));
  for(const r of boxes){expect(r.top).toBeGreaterThanOrEqual(0);expect(r.bottom).toBeLessThanOrEqual(720);expect(r.left).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(1280);}
});

test('mill main actions and hint fit at 720px and retain 44px targets',async({page})=>{
  await openGame(page,'/?start=M1A_P04');
  await page.evaluate(()=>{const g=(window as any).__d31.game,s=structuredClone(g.state);s.player.anchor='mill';s.player.view='front';s.progress.milestone='P01_DONE';s.puzzles.p02={drain:'open',stopper:'locked',solved:false};s.dialogue.activeId=null;s.dialogue.queue=[];const prev=g.state;g.state=s;g.emit([],prev);});
  const boxes=await page.locator('.panel button').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height};}));
  expect(boxes.length).toBeGreaterThanOrEqual(5);
  for(const r of boxes){expect(r.top).toBeGreaterThanOrEqual(0);expect(r.bottom).toBeLessThanOrEqual(720);expect(r.height).toBeGreaterThanOrEqual(44);}
});

for(const era of ['E1','E2','E3'])test(`P03 waiting Toto's green coat is not hidden by the foreground house (${era})`,async({page})=>{
  await openGame(page,`/?start=M1A_P04&era=${era}`);
  const green=await page.evaluate(async()=>{
    const g=(window as any).__d31.game,s=structuredClone(g.state);s.player.anchor='gate_near';s.player.view='front';s.toto={mode:'wait',anchor:'p03_plate'};s.dialogue.activeId=null;s.dialogue.queue=[];const prev=g.state;g.state=s;g.emit([],prev);await new Promise(requestAnimationFrame);
    const pix=document.querySelector<HTMLCanvasElement>('#world-pix')!,raw=document.querySelector<HTMLCanvasElement>('#world')!,cv=pix.hidden?raw:pix,c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const ctx=c.getContext('2d')!;ctx.drawImage(cv,0,0);
    const x=(1-(9.85-10)/8)/2,y=(1-((.85-.7)*10+(8.92-11.5)*6.3)/Math.hypot(10,6.3)/4.5)/2,d=ctx.getImageData(Math.round(x*c.width)-2,Math.round(y*c.height)-2,5,5).data;
    let n=0;for(let i=0;i<d.length;i+=4)if(d[i+1]!>d[i]!*1.1&&d[i]!<110&&d[i+2]!>d[i]!*1.1)n++;return n;
  });expect(green).toBeGreaterThanOrEqual(9);
});

for(const view of ['front','observe','apparatus_side'])test(`P05 ${view}, six stops and objective remain together at 720px`,async({page})=>{
  await openGame(page,'/?start=M1A_P05');if(view!=='front')await page.locator(`[data-action-id="${view==='observe'?'view_peek':'view_apparatus'}"]`).click();
  const bounds=await page.locator('#stage,.objective,#controls button').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));
  for(const r of bounds){expect(r.top).toBeGreaterThanOrEqual(0);expect(r.bottom).toBeLessThanOrEqual(720);expect(r.left).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(1280);}
  await expect(page.locator('#controls [data-action-id^="p05_a"]')).toHaveCount(3);await expect(page.locator('#controls [data-action-id^="p05_b"]')).toHaveCount(3);
});
