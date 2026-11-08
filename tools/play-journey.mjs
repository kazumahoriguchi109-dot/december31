/** Whole journey using public buttons and physical keyboard events only.
 * localStorage is READ ONLY telemetry of the game's own autosave. No probe,
 * injected game code, seeded saves, clock mocking, or state mutation is used.
 * Run: LIVE_URL=http://127.0.0.1:5175 PLAY_OUT=/tmp/december31-material-evidence node tools/play-journey.mjs
 */
import { chromium, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const url=process.env.LIVE_URL||'http://127.0.0.1:5175';
const out=process.env.PLAY_OUT||'/tmp/december31-material-evidence';mkdirSync(out,{recursive:true});
const browserName=process.env.PLAY_BROWSER==='webkit'?'webkit':'chromium';
const browser=await ({chromium,webkit})[browserName].launch({headless:true});
const viewport=process.env.PLAY_LOW_RESOURCE==='1'?{width:640,height:400}:{width:1280,height:800};
const context=await browser.newContext({viewport,...(process.env.PLAY_RECORD==='0'?{}:{recordVideo:{dir:out,size:viewport}})});
const page=await context.newPage();page.setDefaultTimeout(15000);
const log=[],errors=[];let completed=false;const start=Date.now();
page.on('pageerror',e=>errors.push(String(e)));
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dec31-evolution-c013:journey')||'null'));
const report=()=>writeFileSync(`${out}/journey-actions.json`,JSON.stringify({completed,url,browser:browserName,viewport,mode:'Automated keyboard/button play; not human first-play assessment',debugHooks:false,seededSave:false,telemetry:'Read-only localStorage of game-created autosaves for position, camera quarter, puzzle completion and reload checks',log,errors},null,2));
async function record(kind,detail){log.push({seconds:+((Date.now()-start)/1000).toFixed(2),kind,detail,state:await saved()});report();console.log(kind,typeof detail==='string'?detail:JSON.stringify(detail));}
const visible=selector=>page.locator(selector).isVisible();
async function dialogue(){
 let quiet=0;
 for(let i=0;i<100;i++){
  if(await visible('#journey-dialogue')){
   await record('dialogue',await page.locator('#journey-line').innerText());
   await page.locator('#journey-dialogue [data-action="next"]').click();quiet=0;
  }else if(await visible('.journey-portal')){
   if(!log.some(entry=>entry.kind==='portal')){await record('portal','Watching the complete opening cinematic without skipping');await shot('01b-portal');}
   quiet=0;
  }else if(await visible('#journey-evolution'))quiet=0;
  else if(++quiet>=3)return;
  await page.waitForTimeout(160);
 }
 throw Error('Dialogue/reveal did not finish');
}
async function shot(name){await page.screenshot({path:`${out}/journey-${name}.png`});}
async function press(key){await page.keyboard.press(key);await page.waitForTimeout(950);await dialogue();await record('key',key);}
async function use(label){
 await dialogue();assert.equal(await page.locator('#journey-context-label').innerText(),label,'Wrong interaction target');
 await page.locator('#journey-interact').click();await page.waitForTimeout(1100);await dialogue();await record('interact',label);
}
async function walk(x,z){
 let stagnant=0,previous=null;
 for(let i=0;i<350;i++){
  await dialogue();const s=await saved();assert(s,'Game autosave missing');
  const dx=x-s.player.x,dz=z-s.player.z,d=Math.hypot(dx,dz);
  if(d<.23){await record('walk',{x,z});return;}
  if(previous&&Math.hypot(s.player.x-previous.x,s.player.z-previous.z)<.008)stagnant++;else stagnant=0;
  if(stagnant>10)throw Error(`Blocked walking to ${x},${z}; saved player=${JSON.stringify(s.player)} toast=${await page.locator('#journey-toast').textContent()}`);
  previous=s.player;
  if(i%20===0)await record('movement-progress',{target:{x,z},distance:d,iteration:i});
  const q=s.quarter*Math.PI/2,ix=dx*Math.cos(q)-dz*Math.sin(q),iz=dx*Math.sin(q)+dz*Math.cos(q);
  const useX=Math.abs(ix)>.07&&((stagnant>1||Math.abs(ix)>Math.abs(iz)*.45)),useZ=Math.abs(iz)>.07&&((stagnant>1||Math.abs(iz)>Math.abs(ix)*.45));
  const keys=[...(useX?[ix>0?'KeyD':'KeyA']:[]),...(useZ?[iz>0?'KeyS':'KeyW']:[])];
  // Real-time held keys. Stop after each pulse so the game itself writes an autosave.
  await page.locator('#journey-world').focus();const run=s.era>0&&d>1;if(run)await page.keyboard.down('ShiftLeft');for(const k of keys)await page.keyboard.down(k);
  await page.waitForTimeout(Math.max(20,Math.min(650,d/(run?4.8:3)*650)));
  for(const k of keys)await page.keyboard.up(k);await page.keyboard.up('ShiftLeft');await page.waitForTimeout(130);
 }
 throw Error(`Walking deadline ${x},${z}`);
}
async function until(predicate,label,timeout=20000){
 const end=Date.now()+timeout;
 do{await dialogue();if(predicate(await saved()))return;await page.waitForTimeout(200);}while(Date.now()<end);
 throw Error(`Condition timeout: ${label}`);
}
async function solved(n){await until(s=>s.solved[n-1],`P${n}`);await record('puzzle',`P${n} solved`);await shot(`p${n}-solved`);}
try{
 await page.goto(url);await page.locator('#journey-new').waitFor();assert.equal(await saved(),null,'Fresh isolated browser context must have no save');await shot('00-title');
 await page.locator('#journey-new').click();await dialogue();await shot('01-room');
 await walk(0,-1.35);await use('いっしょに始める');await shot('02-world');
 await walk(3,-3);await walk(3.1,-5.2);await shot('03-p1-before');await use('ハンドルを回す');await solved(1);
 await walk(3,-8.5);await walk(0,-13);await walk(-5.7,-13);await walk(-5.7,-13.7);await use('排水口を閉じる');await walk(-5.7,-13);await walk(-2.7,-13);await walk(-2.7,-13.7);await use('止め具を外す');await solved(2);
 await walk(0,-15);await walk(0,-20);await walk(0,-26);await walk(-2.2,-31.5);await press('KeyT');await walk(0,-33);await until(s=>s.toto.waiting,'Toto reached gate plate');
 await walk(0,-37);await walk(2,-37);await use('留め金を固定する');await press('KeyT');await solved(3);
 await walk(8,-42);await dialogue();const before=await saved();await record('reload-before','Actual autosave after P03');await page.reload();await page.locator('#journey-continue').click();await dialogue();const after=await saved();
 assert.deepEqual(after.solved,before.solved);assert.deepEqual(after.player,before.player);assert.equal(after.quarter,before.quarter);assert.equal(after.gateLatched,true);await record('reload-pass','Continue restored position and solved puzzles');await shot('04-reloaded');
 await press('KeyQ');await use('白い段を調べる');await walk(8,-50.5);await solved(4);
 await walk(8,-53);await walk(0,-53);await walk(0,-55);await use('レバーAを動かす');await walk(0,-53);await walk(6,-53);await walk(6,-55);await use('レバーBを動かす');await walk(3,-54);await shot('05-observe-before');await use('輪をのぞく');await solved(5);await use('観測をやめる');
 await walk(8,-50.5);await walk(8,-42);await walk(0,-40);await walk(0,-37);await walk(0,-33);await walk(0,-26);await walk(0,-20);await walk(0,-15);await walk(3,-8);await walk(3,-4);await walk(0,0);await walk(.9,2.5);
 await press('KeyR');await shot('06-resonance');await press('KeyR');await press('KeyT');await walk(3,2.5);await until(s=>s.toto.waiting,'Toto reached front plate');await walk(3,5.5);await walk(0,5.5);await solved(6);
 await press('KeyT');
 // Companion movement alone is not autosaved every frame. Use its public UI state,
 // then pause/resume to request a real game save for the final distance assertion.
 await page.waitForTimeout(5000);await press('Escape');await page.locator('#journey-pause [data-action="resume"]').click();await dialogue();
 await until(s=>s.toto.plate===null&&Math.hypot(s.player.x-s.toto.x,s.player.z-s.toto.z)<1.8,'Toto rejoined');
 await use('一緒に帰る');await page.locator('#journey-credits').waitFor({state:'visible'});assert.equal((await saved()).phase,'ending');assert((await saved()).solved.every(Boolean));await shot('07-credits');await record('ending','All six puzzles, return dialogue and credits reached');
 await page.locator('#journey-credits [data-action="title"]').click();await page.locator('#journey-title').waitFor({state:'visible'});await shot('08-title-after-ending');
 assert.deepEqual(errors,[],'Browser/network errors');completed=true;await record('completed','New game → P01–P06 → return → credits → title; mid-game reload/continue passed');
}catch(error){errors.push(String(error));await record('failure',String(error)).catch(()=>{});await shot('failure').catch(()=>{});throw error;}
finally{report();await context.close();await browser.close();}
