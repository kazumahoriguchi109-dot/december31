/** Public-UI timing check on installed Google Chrome, with a fresh isolated profile. */
import {chromium} from '@playwright/test';
import {OPENING_ROOM,OPENING_DESK} from '../src/journey/openingStory.ts';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.LIVE_URL??'http://127.0.0.1:4190/';
const output=process.env.PORTAL_QA_OUT??'/tmp/portal-six-qa';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
async function fresh(page,edition){await page.goto(base+(edition==='legacy'?'?edition=legacy':''));if(edition==='legacy'){
 await page.locator('#journey-new').click();for(let i=0;i<OPENING_ROOM.length;i++)await page.locator('[data-action=next]').click();
 for(let i=0;i<18;i++){if(await page.locator('#journey-context-label').innerText()==='いっしょに始める')break;await page.locator('#journey-world').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(250);await page.keyboard.up('KeyW');await page.waitForTimeout(60);}
 await page.locator('#journey-interact').click();for(let i=0;i<OPENING_DESK.length;i++)await page.locator('[data-action=next]').click();
}else{await page.locator('[data-id=new]').click();for(let i=0;i<3;i++)await page.locator('[data-id=next]').click();}}
async function arrived(page,edition){if(edition==='legacy')await page.getByText('あれ……本当に、ゲームの中にいる。',{exact:true}).waitFor();else await page.locator('[data-id=interact]').filter({hasText:'宝箱を開ける'}).waitFor();}
try{
 for(const edition of ['new','legacy']){
  const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'no-preference'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.portalTiming={start:0,end:0,video:false};window.portalAudio=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration===6){const data=this.buffer.getChannelData(0);window.portalAudio.push({duration:this.buffer.duration,context:this.context.state,peak:data.reduce((m,v)=>Math.max(m,Math.abs(v)),0)});}return original.apply(this,args);};new MutationObserver(()=>{const o=document.querySelector('.journey-portal');if(o?.querySelector('p')?.textContent==='ふたりで、画面の向こうへ。'&&!window.portalTiming.start){window.portalTiming.start=performance.now();}if(window.portalTiming.start&&!o&&!window.portalTiming.end)window.portalTiming.end=performance.now();}).observe(document,{subtree:true,childList:true,characterData:true});});
  await fresh(page,edition);await page.locator('.journey-portal p').filter({hasText:'ふたりで、画面の向こうへ。'}).waitFor();const video=await page.locator('.journey-portal video').evaluate(v=>({duration:v.duration,rate:v.playbackRate,visible:getComputedStyle(v).opacity,muted:v.muted}));
  // Dialogue keys must never skip even after the 1.2-second click guard expires.
  for(const key of ['KeyE','Space','Enter']){await page.waitForTimeout(650);await page.keyboard.press(key);if(!await page.locator('.journey-portal').isVisible())throw Error('accidental skip');}
  await page.screenshot({path:`${output}/${edition}-playing.png`});await page.locator('.journey-portal').waitFor({state:'detached',timeout:22000});await arrived(page,edition);const timing=await page.evaluate(()=>window.portalTiming),seconds=(timing.end-timing.start)/1000;if(seconds<5.8||seconds>7.5)throw Error(`wrong ${edition} runtime duration: ${seconds}`);if(video.rate!==1)throw Error('video sped up at runtime');await page.screenshot({path:`${output}/${edition}-arrival.png`});
  const audio=await page.evaluate(()=>window.portalAudio);if(!audio.some(a=>a.context==='running'&&a.peak>.04))throw Error('portal audio did not start');await page.reload();await page.locator(edition==='legacy'?'#journey-continue':'[data-id=continue]').click();await arrived(page,edition);if(await page.locator('.journey-portal').count())throw Error('completed movie replayed');
  results.push({edition,seconds,video,audio,errors,completedResume:true});console.log(JSON.stringify(results.at(-1)));if(errors.length)throw Error(errors.join('\n'));await context.close();
 }
 // A fresh introduction interrupted during playback resumes as a movie, then deliberate skip works once.
 const c=await browser.newContext(),p=await c.newPage();await fresh(p,'new');await p.locator('.journey-portal p').filter({hasText:'ふたりで、画面の向こうへ。'}).waitFor();await p.reload();await p.locator('[data-id=continue]').click();await p.locator('.journey-portal').waitFor();await p.keyboard.press('Escape');await arrived(p,'new');await p.waitForTimeout(300);if(await p.locator('.journey-portal').count())throw Error('skipped movie replayed');await c.close();results.push({newInterruptedResume:true,deliberateSkip:true});
 const reduced=await browser.newContext({reducedMotion:'reduce'}),rp=await reduced.newPage();await fresh(rp,'new');const began=Date.now();if(await rp.locator('.journey-portal video').count())throw Error('reduced-motion video exists');await rp.locator('.journey-portal').waitFor({state:'detached',timeout:5000});await arrived(rp,'new');results.push({reducedMotionSeconds:(Date.now()-began)/1000});await reduced.close();writeFileSync(`${output}/result.json`,JSON.stringify(results,null,2));console.log('PORTAL CHECKS PASSED');
}finally{await browser.close();}
