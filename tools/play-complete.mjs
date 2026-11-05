import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out=process.env.PLAY_OUT || '../release-evidence/cycle-018/full-play-final';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:out,size:{width:1280,height:720}}});const page=await context.newPage();
const log=[],errors=[];const started=Date.now();
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
async function record(kind,id){log.push({seconds:Math.round((Date.now()-started)/100)/10,kind,id,objective:await page.locator('#obj-text').textContent().catch(()=>null),dialogue:await page.locator('#dlg-text').textContent().catch(()=>null)});writeFileSync(`${out}/actions.json`,JSON.stringify({mode:'scripted real-UI browser play, not human first-time evaluation',debugHooks:false,seededSave:false,save:'new manual-1; actual autosave/reload once after P03',log,errors},null,2));}
async function shot(name){await page.screenshot({path:`${out}/${name}.png`});}
async function read(){for(let n=0;n<60;n++){const next=page.locator('#dlg:not([hidden]) [data-action-id="dlg_next"]');if(!await next.count())return;await record('dialogue',await page.locator('#dlg-speaker').textContent());await next.click();await page.waitForTimeout(340);}throw Error('dialogue loop');}
async function action(id){const b=page.locator(`#targets [data-action-id="${id}"],#controls [data-action-id="${id}"]`).first();await b.click();await page.waitForTimeout(350);await record('action',id);await read();}
try {
 await page.goto(process.env.LIVE_URL || 'http://127.0.0.1:4184/');await page.locator('#b-new').waitFor();await shot('00-title');
 if(await page.locator('[data-dev]').count())throw Error('development controls in shipped build');
 await page.locator('#b-new').click();await page.locator('[data-new="manual-1"]').click();await page.locator('#dlg').waitFor();await shot('01-opening-toto');
 await page.locator('[data-action-id="dlg_next"]').click();await page.waitForTimeout(350);await shot('02-opening-player');await read();
 await page.locator('[data-action-id="start_rpg"]').first().click();await page.waitForTimeout(350);await shot('03-arrival-dialogue');await read();
 await action('move_p01_panel');await shot('04-p01-before');await action('p01_right');await shot('05-p01-solved');
 await action('move_mill');await shot('06-p02-open');await action('p02_drain');await shot('07-p02-closed');await action('p02_stopper');await shot('08-p02-solved');
 await action('move_gate_near');await shot('09-p03-before');await action('p03_wait');await shot('10-p03-wait');await action('move_gate_far');await action('p03_latch');await action('p03_call');await shot('11-p03-solved');
 await action('move_wall_base');await page.locator('#savestate').filter({hasText:'保存しました'}).waitFor({timeout:10000});await record('save','autosave-confirmed');await page.reload();await page.locator('#b-cont').click();await read();await record('resume','continue-after-real-reload');await shot('12-p04-front');
 await action('view_wall_side');await shot('13-p04-side');await action('p04_inspect');await shot('14-p04-solved');
 await action('move_observatory');await shot('15-p05-before');await action('view_peek');await shot('15b-p05-observe');await action('p05_a1');await shot('15c-p05-adjusted');await page.locator('[data-action-id="p05_b2"]').first().click();await page.waitForTimeout(250);await record('action','p05_b2');await shot('15d-p05-closed-ring');await page.waitForTimeout(1500);await read();await shot('16-castle-return-objective');
 await action('move_portal_front');await shot('17-p06-front');await action('p06_wait');await action('move_portal_back');await shot('18-p06-open');await action('p06_call');await action('return_ask');await shot('19-return-confirm');
 await page.locator('[data-action-id="confirm_return_yes"]').click();await page.waitForTimeout(350);await shot('20-home-dialogue');await read();await shot('21-ending');await action('credits_open');await shot('22-credits');
 await page.locator('#b-back').click();await page.locator('#b-new').waitFor();await record('completed','all-six-puzzles-ending-credits-title');
 if(errors.length)throw Error(errors.join('\n'));
}finally{await context.close();await browser.close();}
console.log(`Full UI play completed: ${log.length} recorded events, no debug hooks or seeded save; errors=${errors.length}`);
