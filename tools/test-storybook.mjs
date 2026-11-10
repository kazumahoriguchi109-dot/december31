import {chromium,webkit,firefox} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const out=process.env.OUTPUT_DIR??'/tmp/storybook-qa';mkdirSync(out,{recursive:true});
for(const [name,engine] of Object.entries({chromium,webkit,firefox})){
 const browser=await engine.launch({headless:true});const p=await browser.newPage({viewport:{width:1280,height:820},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const click=id=>p.locator(`[data-id="${id}"]:visible`).click();
 const saved=()=>p.evaluate(()=>localStorage.getItem('dec31-evolving-puzzles-v1'));
 await p.goto(process.env.E2E_URL??'http://127.0.0.1:4192');await click('new');for(let i=0;i<3;i++)await click('next');await p.getByRole('button',{name:'映像をスキップしてゲームへ進む'}).click();
 await click('pause');assert.equal(await p.locator('[data-kind=pause] .buttons button').count(),4);
 await p.screenshot({path:`${out}/${name}-pause.png`});
 await p.locator('[data-id=resume]').focus();assert.equal(await p.locator('[data-id=resume]').evaluate(e=>e===document.activeElement),true);
 await p.keyboard.press('Shift+Tab');assert.equal(await p.locator('.overlay [data-id=title]').evaluate(e=>e===document.activeElement),true);
 await p.keyboard.press('Tab');assert.equal(await p.locator('[data-id=resume]').evaluate(e=>e===document.activeElement),true);
 await click('settings');assert.equal(await p.locator('[data-kind=settings]').isVisible(),true);await p.keyboard.press('Escape');await click('pause');await click('reset-confirm');assert.equal(await p.locator('[data-kind=reset-confirm]').isVisible(),true);await click('close');
 await click('pause');await click('title');const before=await saved();await click('new');
 assert.equal(await p.locator('.panel p').textContent(),'今回の6つの謎の記録を上書きします。前の試作の記録は消えません。');
 await p.screenshot({path:`${out}/${name}-new-confirm.png`});
 // Initial Enter is deliberately safe; no overwrite and title focus restored.
 await p.keyboard.press('Enter');assert.equal(await p.locator('.overlay').isVisible(),false);assert.equal(await saved(),before);
 await click('new');await p.keyboard.press('Escape');assert.equal(await saved(),before);
 for(const [width,height] of [[390,844],[320,568],[640,360]]){await p.setViewportSize({width,height});await click('new');await p.screenshot({path:`${out}/${name}-confirm-${width}.png`});for(const id of ['close','fresh']){const b=await p.locator(`[data-id=${id}]`).boundingBox();assert(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height);}await click('close');await click('continue');await click('pause');await p.screenshot({path:`${out}/${name}-pause-${width}.png`});for(const id of ['resume','settings','reset-confirm','title']){const b=await p.locator(`.overlay [data-id=${id}]`).boundingBox();assert(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height);}await click('title');}
 await click('new');await click('fresh');assert.equal(await p.locator('[data-kind=opening]').isVisible(),true);assert.deepEqual(errors,[]);console.log(name,'passed');await browser.close();
}
