import {chromium} from '@playwright/test';
import {createState,SAVE_KEY} from '../src/evolution/model.ts';
const browser=await chromium.launch({headless:true});const p=await browser.newPage({viewport:{width:1280,height:820}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.E2E_URL??'http://127.0.0.1:4198/');
const s=createState();s.stage=7;s.solved.fill(true);s.actors=[{x:3,z:4},{x:4,z:4}];await p.evaluate(({s,k})=>localStorage.setItem(k,JSON.stringify(s)),{s,k:SAVE_KEY});await p.reload();await p.locator('[data-id=continue]').click();
for(let i=0;i<18;i++){if(i===2){await p.waitForTimeout(6500);continue;}if(i===1||i===4||i===10||i===17){await p.screenshot({path:`/tmp/ending-${i}.png`});}
 if(i===5){await p.reload();await p.locator('[data-id=continue]').click();if(!(await p.locator('.panel').textContent()).includes('ちゃんと二人とも'))throw Error('resume lost beat');}
 if(i===8){await p.setViewportSize({width:390,height:844});await p.screenshot({path:'/tmp/ending-mobile.png'});if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('mobile overflow');await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');await p.setViewportSize({width:1280,height:820});}
 if(i<17)await p.locator('[data-id=ending-next]').click();
}
if(!(await p.locator('.panel').textContent()).includes('おしまい'))throw Error('no final');await p.locator('[data-id=title]').click();await p.locator('[data-id=continue]').click();if(!(await p.locator('.panel').textContent()).includes('おしまい'))throw Error('final resume');await p.locator('[data-id=ending-replay]').click();if(!(await p.locator('.panel').textContent()).includes('今度は'))throw Error('replay');
console.log('ending all beats, timer, resume, mobile, replay passed',errors);await browser.close();if(errors.length)process.exitCode=1;
