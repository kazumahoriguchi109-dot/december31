import {chromium} from '@playwright/test';
const findChestY=async pg=>{const ys=[];for(let y=120;y<780;y+=4){await pg.mouse.move(640,y);if(await pg.locator('canvas').evaluate(e=>e.style.cursor)==='pointer')ys.push(y);}if(!ys.length)throw Error('chest not found by hover');return ys[Math.floor(ys.length/2)];};

const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:820},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.E2E_URL??'http://127.0.0.1:4198/');await page.locator('[data-id=new]').click();for(let i=0;i<3;i++)await page.locator('[data-id=next]').click();await page.getByRole('button',{name:'映像をスキップしてゲームへ進む'}).click();await page.getByRole('button',{name:'はじめる',exact:true}).click();
await page.screenshot({path:'/tmp/hud-before-click.png'});
for(const s of ['.room-heading','.keyhelp','.save','.guidance .mechanism-status','.guidance .affordance'])if(await page.locator(s).isVisible())throw Error(s+' visible');if(!(await page.locator('.guidance .objective').isVisible())||!(await page.locator('.guidance .objective').textContent()).startsWith('目標：'))throw Error('objective line not shown');
const key='dec31-evolving-puzzles-v1';
await page.mouse.click(100,200);if(await page.locator('.stage-announcement').isVisible())throw Error('announcement did not close');
if(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).stage,key)!==0)throw Error('background activated chest');
const cy=await findChestY(page);await page.mouse.move(640,cy);if(await page.locator('canvas').evaluate(el=>el.style.cursor)!=='pointer')throw Error('chest hover missing');
await page.mouse.click(640,cy);if(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).stage,key)!==1)throw Error('chest click failed');
await page.getByText('2Dの世界へようこそ',{exact:true}).waitFor();await page.screenshot({path:'/tmp/hud-2d-banner.png'});
await page.waitForTimeout(3200);if(await page.locator('.stage-announcement').isVisible())throw Error('announcement timeout failed');
await page.reload();await page.locator('[data-id=continue]').click();if(await page.locator('.stage-announcement').isVisible())throw Error('resume repeated banner');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/hud-mobile.png'});console.log('HUD, chest click, empty click, timeout, resume: passed',errors);
if(errors.length)throw Error(errors.join(';'));
await browser.close();
