import { expect, test } from './fixtures';
import { openGame } from './helpers';

for (const era of ['E0','E1','E2','E3']) test(`P01 both tile arms remain visible at every rotation in ${era}`, async ({page}) => {
  await openGame(page,`/?start=M1A_P04&era=${era}`);
  for(let rotation=0;rotation<4;rotation++) {
    const values=await page.evaluate(async rotation=>{
      const g=(window as any).__d31.game, s=structuredClone(g.state);
      s.player.anchor='p01_panel';s.player.view='front';s.dialogue.activeId=null;s.dialogue.queue=[];s.puzzles.p01={rotation,solved:rotation===1};const prev=g.state;g.state=s;g.emit([],prev);
      await new Promise(requestAnimationFrame);
      // Independent projection of the documented P01 orthographic camera; catches foreground occlusion.
      const length=Math.hypot(10,6.3);
      const pix=document.querySelector<HTMLCanvasElement>('#world-pix')!,raw=document.querySelector<HTMLCanvasElement>('#world')!;
      const cv=pix.hidden?raw:pix,c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const ctx=c.getContext('2d')!;ctx.drawImage(cv,0,0);
      // Screen W,N,E,S. Sample inside the tile, away from the fixed incoming/outgoing lines.
      return [[.42,0],[0,.65],[-.42,0],[0,-.65]].map(([wx,wz])=>{
        const sx=-wx!/8,sy=((.30-.7)*10+(wz!+.5)*6.3)/length/4.5;
        const px=Math.round((sx+1)/2*c.width),py=Math.round((1-sy)/2*c.height),d=ctx.getImageData(px-1,py-1,3,3).data;
        let light=0;for(let i=0;i<d.length;i+=4)if(d[i]!>130&&d[i+1]!>140&&d[i]!+d[i+1]!+d[i+2]!>440)light++;return light;
      });
    },rotation);
    const ports=[[0,1],[1,2],[2,3],[3,0]][rotation]!;
    values.forEach((n,i)=>{if(ports.includes(i))expect(n,`rotation ${rotation}, port ${i} is connected`).toBeGreaterThanOrEqual(3);else expect(n,`rotation ${rotation}, port ${i} stays disconnected`).toBeLessThanOrEqual(1);});
  }
});

test('720px conversation keeps objective, text and both actions on screen', async ({page})=>{
  await page.setViewportSize({width:1280,height:720});await page.goto('/');await page.locator('#b-new').click();await page.locator('[data-new="manual-1"]').click();
  await expect(page.locator('#dlg')).toBeVisible();
  const check=async()=>{const boxes=await page.locator('.objective,#dlg-text,#dlg-actions button').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));for(const r of boxes){expect(r.top).toBeGreaterThanOrEqual(0);expect(r.bottom).toBeLessThanOrEqual(720);expect(r.left).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(1280);}};
  await check();
  await page.locator('[data-action-id="dlg_skip"]').click();await page.waitForTimeout(350);
  await page.locator('[data-action-id="start_rpg"]').first().click();await expect(page.locator('#dlg')).toBeVisible();await check();
});
