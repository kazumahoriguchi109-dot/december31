import { expect, test } from './fixtures';
import { openGame } from './helpers';

test('P01 cue starts at both rendered feet and stays aligned after resizing', async ({page},info)=>{
  await openGame(page,'/?start=M1A_P04');
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  const start=await page.evaluate(()=>{
    const g=(window as any).__d31.game,s=structuredClone(g.state);s.progress.milestone='ARRIVAL';s.player.anchor='p01_panel';s.player.view='front';s.puzzles.p01={rotation:0,solved:false};s.puzzles.p02={drain:'open',stopper:'locked',solved:false};s.puzzles.p03={gateLatched:false,crossed:false,solved:false};s.dialogue.activeId=null;s.dialogue.queue=[];const prev=g.state;g.state=s;g.emit([],prev);return g.perform('p01_right','api');
  });expect(start).toBe(true);
  const check=async()=>{
    const points=await page.locator('#cue').evaluate(svg=>{
      const b=svg.getBoundingClientRect();return ['.cue-a','.cue-b'].map(sel=>{const m=(svg.querySelector(sel) as SVGGraphicsElement).transform.baseVal.consolidate()!.matrix;return{x:m.e/b.width,y:m.f/b.height};});
    });
    // Independently project the authored P01 foot locations, allowing the small speaking pose.
    const expected=[1.92,3.48].map(x=>({x:(1-x/8)/2,y:(1-((-.034-.7)*10+(3.45-4.5)*6.3)/Math.hypot(10,6.3)/4.5)/2}));
    points.forEach((p,i)=>{expect(Math.abs(p.x-expected[i]!.x)).toBeLessThan(.012);expect(Math.abs(p.y-expected[i]!.y)).toBeLessThan(.012);});
  };
  await check();await page.screenshot({path:info.outputPath('cue-feet.png')});
  await page.setViewportSize({width:1100,height:760});await page.clock.runFor(32);await check();await page.screenshot({path:info.outputPath('cue-resized.png')});
  await page.clock.runFor(580);await page.screenshot({path:info.outputPath('cue-arrival.png')});
  await page.clock.runFor(700);await expect(page.locator('#cue')).toBeHidden();
});

for(const era of ['E0','E1','E2','E3'])test(`mill drainage is visible end to end when open, absent when closed (${era})`,async({page},info)=>{
  await openGame(page,`/?start=M1A_P04&era=${era}`);
  const samples=async(open:boolean)=>page.evaluate(async open=>{
    const g=(window as any).__d31.game,s=structuredClone(g.state);s.player.anchor='mill';s.player.view='front';s.progress.milestone='P01_DONE';s.dialogue.activeId=null;s.dialogue.queue=[];s.puzzles.p02={drain:open?'open':'closed',stopper:'locked',solved:false};const prev=g.state;g.state=s;g.emit([],prev);await new Promise(requestAnimationFrame);
    const pix=document.querySelector<HTMLCanvasElement>('#world-pix')!,raw=document.querySelector<HTMLCanvasElement>('#world')!,cv=pix.hidden?raw:pix;
    const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const ctx=c.getContext('2d')!;ctx.drawImage(cv,0,0);
    return [6.8,7.7,8.6].map(z=>{const x=(1-(3-4)/8)/2,y=(1-((.08-.7)*10+(z-8)*6.3)/Math.hypot(10,6.3)/4.5)/2;const d=ctx.getImageData(Math.round(x*c.width)-1,Math.round(y*c.height)-1,3,3).data;let blue=0;for(let i=0;i<d.length;i+=4)if(d[i]!<160&&d[i+1]!>100&&d[i+2]!>140&&d[i+2]!>d[i]!*1.4)blue++;return blue;});
  },open);
  const values=await samples(true);
  await page.screenshot({path:info.outputPath(`drain-open-${era}.png`)});for(const n of values)expect(n).toBeGreaterThanOrEqual(3);
  for(const n of await samples(false))expect(n).toBeLessThanOrEqual(1);
  await page.screenshot({path:info.outputPath(`drain-closed-${era}.png`)});
});
