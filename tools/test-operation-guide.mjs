// Operation guide checks: closing it never reaches the chest, and 続きから is not interrupted by it.
// Run (dev server or preview up): E2E_URL=http://127.0.0.1:5173 OUTPUT_DIR=/some/dir node tools/test-operation-guide.mjs
import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as model from '../src/evolution/model.ts';
const url=process.env.E2E_URL??'http://127.0.0.1:5173',out=process.env.OUTPUT_DIR??'/tmp/d31-probe';mkdirSync(out,{recursive:true});
const b=await chromium.launch({headless:true});
const note=(k,v)=>console.log(k,JSON.stringify(v));
async function fresh(viewport={width:1280,height:820}){const c=await b.newContext({viewport,reducedMotion:'reduce'});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url);return {c,p,errors};}
const read=p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),model.SAVE_KEY);
async function toGuide(p){await p.locator('[data-id="new"]').click();for(let i=0;i<3;i++)await p.getByRole('button',{name:'▼',exact:true}).click();await p.getByRole('button',{name:'映像をスキップしてゲームへ進む'}).click();await p.locator('.overlay[data-kind=operation-guide]').waitFor();}
const guideVisible=p=>p.locator('.overlay[data-kind=operation-guide]').isVisible();
const chestOpen=async p=>(await read(p)).stage;

// 1. each way of closing the guide must leave the chest closed (stage stays 0)
for(const way of ['click','enter','space']){
  const {c,p,errors}=await fresh();await toGuide(p);const before=await read(p);
  const btn=p.getByRole('button',{name:'はじめる',exact:true});
  if(way==='click')await btn.click();else{await btn.focus();await p.keyboard.press(way==='enter'?'Enter':'Space');}
  await p.waitForTimeout(500);
  const after=await read(p);
  note('guide-close-'+way,{stageBefore:before.stage,stageAfter:after.stage});assert.equal(await guideVisible(p),false,'guide must close ('+way+')');assert.equal(after.stage,0,'closing the guide by '+way+' must not open the chest');assert.deepEqual(errors,[]);
  await p.screenshot({path:`${out}/guide-closed-${way}.png`});
  await c.close();
}
// 2. keys while the guide is open must not reach the chest
{
  const {c,p}=await fresh();await toGuide(p);
  for(const k of ['KeyE','Space','Enter','ArrowDown','KeyT'])await p.keyboard.press(k);
  await p.waitForTimeout(300);
  note('guide-keys-ignored',{stage:(await read(p)).stage});assert.equal((await read(p)).stage,0,'keys pressed with the guide open must not open the chest');
  await c.close();
}
// 3. a click straight through the backdrop (outside the panel)
{
  const {c,p}=await fresh();await toGuide(p);
  await p.mouse.click(640,640);await p.waitForTimeout(300);
  note('guide-backdrop-click',{stage:(await read(p)).stage,guideStillOpen:await guideVisible(p)});assert.equal((await read(p)).stage,0,'a click behind the guide must not open the chest');
  await c.close();
}
// 4. guide not shown again on continue after it was seen; shown when the opening was never finished
{
  const {c,p}=await fresh();await toGuide(p);await p.getByRole('button',{name:'はじめる',exact:true}).click();
  await p.reload();await p.locator('[data-id="continue"]').click();await p.waitForTimeout(600);
  note('continue-after-seen',{guideVisible:await guideVisible(p)});assert.equal(await guideVisible(p),false,'続きから must not show the guide once it was seen');
  await c.close();
}
{
  const {c,p}=await fresh();await toGuide(p);
  await p.reload();await p.locator('[data-id="continue"]').click();await p.waitForTimeout(600);
  note('continue-while-guide-pending',{guideVisible:await guideVisible(p),stage:(await read(p)).stage});assert.equal(await guideVisible(p),true,'a never-dismissed guide is shown once on 続きから');assert.equal((await read(p)).stage,0);
  await c.close();
}
// 5. an old save that predates the guide key: continue must not show the guide
{
  const {c,p}=await fresh();await toGuide(p);await p.getByRole('button',{name:'はじめる',exact:true}).click();await p.locator('[data-id=interact]').click();await p.waitForTimeout(400);
  await p.evaluate(key=>localStorage.removeItem(key+':operation-guide'),model.SAVE_KEY);
  await p.reload();await p.locator('[data-id="continue"]').click();await p.waitForTimeout(600);
  note('continue-old-save-no-guide-key',{guideVisible:await guideVisible(p),stage:(await read(p)).stage});assert.equal(await guideVisible(p),false,'a save made before the guide existed must not be interrupted');assert.equal((await read(p)).stage,1);
  await c.close();
}
await b.close();console.log('GUIDE CHECKS PASSED');
