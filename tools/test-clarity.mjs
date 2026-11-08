import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import * as model from '../src/evolution/model.ts';
const b=await chromium.launch({headless:true,channel:'chrome'});const p=await b.newPage({viewport:{width:1280,height:820},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));const out=process.env.OUTPUT_DIR??'/tmp/evolution-qa';mkdirSync(out,{recursive:true});
const read=()=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),model.SAVE_KEY);
const click=id=>p.locator(`[data-id="${id}"]`).click();
async function dismiss(){if(await p.locator('.overlay').isVisible())await p.getByRole('button',{name:'進む',exact:true}).click();}
async function walk(x,z){let start=await read();const queue=[[start,[]]],seen=new Set();let route;while(queue.length){const [s,path]=queue.shift(),a=s.actors[s.active];if(a.x===x&&a.z===z){route=path;break;}const key=[a.x,a.z,s.gear,s.platform].join(',');if(seen.has(key))continue;seen.add(key);for(const [dx,dz]of [[0,-1],[0,1],[-1,0],[1,0]]){const next=structuredClone(s);model.move(next,dx,dz);if(next.actors[next.active].x!==a.x||next.actors[next.active].z!==a.z)queue.push([next,[...path,[dx,dz]]]);}}if(!route)throw Error(`no path stage${start.stage} to ${x},${z}`);for(const d of route){const s=await read(),c=model.getScene(s).camera;let [dx,dz]=d;for(let n=0;n<c;n++){const old=dx;dx=dz;dz=-old;}await click(dx===1?'right':dx===-1?'left':dz===-1?'up':'down');}const s=await read(),a=s.actors[s.active];if(a.x!==x||a.z!==z)throw Error('UI movement mismatch '+JSON.stringify(a));}
async function shot(n){await p.screenshot({path:`${out}/${n}.png`});await p.setViewportSize({width:390,height:844});await p.screenshot({path:`${out}/${n}-mobile.png`});await p.setViewportSize({width:1280,height:820});}
async function next(n){await dismiss();if((await read()).stage!==n)throw Error('stage mismatch expected '+n);await shot('stage-'+n);console.log('stage',n,'passed');}
await p.goto(process.env.E2E_URL??'http://127.0.0.1:5188');await click('new');for(let i=0;i<3;i++)await p.getByRole('button',{name:'▼',exact:true}).click();await p.getByRole('button',{name:'映像をスキップしてゲームへ進む'}).click();await shot('dark');await click('interact');await next(1);
await walk(3,2);await click('interact');await next(2);

for(const mask of [0,1,3,2,6,7,4,5]){
 for(let i=0;i<3;i++){const state=await read();if(state.wires[i]!==!!(mask&(1<<i))){await walk(1+i*2,6);await click('interact');}}
 const state=await read();if(model.circuitReady(state)!==(mask===5))throw Error('readiness mismatch');
 const status=await p.locator('.mechanism-status').innerText();if(!status.includes(mask===5?'出口：開いた':'出口：閉じている'))throw Error('status mismatch');
 await shot('circuit-'+mask);
 await p.reload();await click('continue');if(JSON.stringify((await read()).wires)!==JSON.stringify(state.wires))throw Error('reload mismatch');
}
await click('hint');await click('more-hint');await click('more-hint');await click('close');
await walk(3,1);await click('interact');await next(3);
await b.close();console.log('ALL 8 CIRCUIT STATES, SAVE RELOAD, HINTS, SOLUTION PASSED',errors);
