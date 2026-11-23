import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import * as model from '../src/evolution/model.ts';
const b=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});const TOUCH=process.env.TOUCH==='1';const ctx=await b.newContext(TOUCH?{viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}:{viewport:{width:1280,height:820},reducedMotion:'reduce'});const p=await ctx.newPage();
// TOUCH=1 replays the whole run at phone width with real taps (every locator click becomes a tap).
if(TOUCH){const proto=Object.getPrototypeOf(p.locator('body'));proto.click=function(o){return this.tap(o);};}
const errors=[];p.on('pageerror',e=>errors.push(e.message));const out=process.env.OUTPUT_DIR??'/tmp/evolution-qa';mkdirSync(out,{recursive:true});
const read=()=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),model.SAVE_KEY);
const ARROWS={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};const KEYS={interact:'KeyE',switch:'KeyT'};const rawClick=async id=>{const l=p.locator(`[data-id="${id}"]`),shown=await l.isVisible();if(!shown){if(ARROWS[id])return p.keyboard.press(ARROWS[id]);if(KEYS[id])return p.keyboard.press(KEYS[id]);if(id==='wait'){await p.keyboard.press('KeyE');return p.locator('[data-id=inspect-wait]').click();}}return l.click();};
async function click(id){
 const before=await read();await rawClick(id);if(id==='interact'&&before?.stage===1&&await p.locator('[data-id=inspect-use]').isVisible())await rawClick('inspect-use');
 if(before?.stage>=4&&before.stage<=6){
  const after=await read();
  if(after.stage===before.stage){
   const era=await p.locator('.game').getAttribute('data-era');
   if(era!=='three')throw Error('3D presentation changed during '+id);
   if(model.getScene(after).camera!==model.getScene(before).camera)throw Error('camera changed during '+id);
   if(model.roomOf(after)==='old'&&!(await p.locator('[data-id=left]').isDisabled()))throw Error('old room allowed horizontal movement');
  }
 }
}
async function dismiss(){if(await p.locator('.overlay').isVisible())await p.getByRole('button',{name:'進む',exact:true}).click();}
async function walk(x,z){let start=await read();const queue=[[start,[]]],seen=new Set();let route;while(queue.length){const [s,path]=queue.shift(),a=s.actors[s.active];if(a.x===x&&a.z===z){route=path;break;}const key=[a.x,a.z,s.gear,s.platform].join(',');if(seen.has(key))continue;seen.add(key);for(const [dx,dz]of [[0,-1],[0,1],[-1,0],[1,0]]){const next=structuredClone(s);model.move(next,dx,dz);if(next.actors[next.active].x!==a.x||next.actors[next.active].z!==a.z)queue.push([next,[...path,[dx,dz]]]);}}if(!route)throw Error(`no path stage${start.stage} to ${x},${z}`);for(const d of route){const s=await read(),c=model.getScene(s).camera;let [dx,dz]=d;for(let n=0;n<c;n++){const old=dx;dx=dz;dz=-old;}await click(dx===1?'right':dx===-1?'left':dz===-1?'up':'down');}const s=await read(),a=s.actors[s.active];if(a.x!==x||a.z!==z)throw Error('UI movement mismatch '+JSON.stringify(a));}
async function shot(n){await p.screenshot({path:`${out}/${n}${TOUCH?'-touch':''}.png`});if(TOUCH)return;await p.setViewportSize({width:390,height:844});await p.waitForTimeout(250);await p.screenshot({path:`${out}/${n}-mobile.png`});await p.setViewportSize({width:1280,height:820});}
async function next(n){await dismiss();if((await read()).stage!==n)throw Error('stage mismatch expected '+n);await shot('stage-'+n);console.log('stage',n,'passed');}
await p.goto(process.env.E2E_URL??'http://127.0.0.1:5188');await click('new');for(let i=0;i<3;i++)await p.getByRole('button',{name:'▼',exact:true}).click();await p.getByRole('button',{name:'映像をスキップしてゲームへ進む'}).click();await shot('dark');{const g=p.locator('.overlay[data-kind=operation-guide]');if(!await g.isVisible())throw Error('operation guide missing after the opening');const b=await read();await p.getByRole('button',{name:'はじめる',exact:true}).click();if(await g.isVisible())throw Error('guide did not close');const a=await read();if(JSON.stringify(a)!==JSON.stringify(b)&&a.stage!==b.stage)throw Error('closing the guide advanced the game');}await click('interact');await next(1);
await walk(3,4);await click('wait');await walk(3,2);await click('interact');await walk(3,1);await click('interact');await next(2);
await walk(1,6);await click('interact');await walk(5,6);await click('interact');await walk(3,1);await click('interact');await next(3);
await walk(1,5);await click('switch');await walk(5,2);await click('interact');await walk(4,1);await click('switch');await walk(3,1);await click('interact');await next(4);
await click('up');await click('up');await click('switch');await walk(6,2);await click('interact');await walk(5,1);await click('switch');await walk(4,1);await click('switch');await click('interact');await next(5);
await click('switch');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).platform===0,model.SAVE_KEY);await click('interact');if((await read()).riding!==1)throw Error('failed boarding');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).platform===2,model.SAVE_KEY);await click('interact');if(!(await read()).key)throw Error('failed upper disembark');await shot('lift-upper');await walk(6,1);await click('switch');await walk(6,2);await click('switch');await click('interact');await next(6);
await click('up');await click('up');await click('switch');await walk(5,3);await click('pause');const paused=await read();await p.waitForTimeout(1200);if((await read()).charge!==paused.charge)throw Error('pause advanced charge');await click('resume');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).charge===1,model.SAVE_KEY);await walk(5,1);await click('switch');await walk(4,1);await click('switch');await click('interact');if((await read()).stage!==7)throw Error('failed ending');for(let beat=0;await p.locator('[data-id=title]').count()===0;beat++){if(beat>40)throw Error('ending never reached its last beat');await shot('ending-'+String(beat).padStart(2,'0'));await click('ending-next');}await shot('ending-last');await click('title');await click('continue');if(!(await p.getByRole('heading',{name:'12月31日 / おしまい'}).isVisible()))throw Error('ending resume missing');
writeFileSync(`${out}/result.json`,JSON.stringify({stages:7,errors,finished:true,pause:true,endingResume:true},null,2));console.log('ALL PASSED',errors);await b.close();if(errors.length)process.exitCode=1;
