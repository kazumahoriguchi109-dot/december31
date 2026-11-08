import {test,expect} from '@playwright/test';
import {OPENING_ROOM,OPENING_DESK,OPENING_ARRIVAL} from '../../src/journey/openingStory';
test('world/panel clicks advance once; drag, selection, long press, right click and pause do not',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./');await page.locator('#journey-new').click();
 const line=page.locator('#journey-line'),world=page.locator('#journey-world'),cue=page.locator('[data-action="next"]');let index=0;
 const current=()=>expect(line).toHaveText(OPENING_ROOM[index]![1]);const advanced=async()=>{index++;await current();await page.waitForTimeout(100);await current();};
 await current();await line.click();await advanced();await world.click({position:{x:240,y:125}});await advanced();await page.locator('#journey-portrait').click();await advanced();await cue.click();await advanced();
 await world.focus();await page.keyboard.press('KeyE');await advanced();await page.keyboard.press('Space');await advanced();
 await world.click({position:{x:240,y:125},button:'right'});await current();
 // A key changes the line during a held pointer: releasing it must not advance again.
 await page.mouse.move(200,125);await page.mouse.down();await page.keyboard.press('KeyE');await advanced();await page.mouse.up();await current();
 await page.mouse.move(200,125);await page.mouse.down();await world.dispatchEvent('pointercancel',{pointerId:1,bubbles:true});await page.mouse.up();await current();
 const panel=await page.locator('#journey-dialogue').boundingBox();await page.mouse.move(200,panel!.y-2);await page.mouse.down();await page.mouse.move(200,panel!.y+2);await page.mouse.up();await current();
 await page.mouse.move(200,125);await page.mouse.down();await page.mouse.move(260,125,{steps:5});await page.mouse.move(200,125,{steps:5});await page.mouse.up();await current();
 await page.mouse.move(200,125);await page.mouse.down();await page.waitForTimeout(1100);await page.mouse.up();await current();
 const textBox=await line.boundingBox();await page.mouse.move(textBox!.x+5,textBox!.y+10);await page.mouse.down();await page.mouse.move(textBox!.x+100,textBox!.y+10,{steps:5});await page.mouse.up();await current();
 await page.locator('[data-action="pause"]').click();await expect(page.locator('#journey-pause')).toBeVisible();await page.locator('#journey-volume').fill('0');await page.locator('#journey-motion').check();await page.locator('[data-action="resume"]').click();await current();
 // Deliberate rapid clicks each advance one line; the following test guards the movie boundary.
 await world.click({position:{x:240,y:125}});await advanced();await world.dblclick({position:{x:240,y:125}});index+=2;await current();
 // Reload uses the real autosave, with the next unread line retained.
 await page.reload();await page.locator('#journey-continue').click();await current();expect(errors).toEqual([]);
});
test('last desk-line click opens the movie without carrying the click into skip or arrival',async({page})=>{
 await page.goto('./');await page.locator('#journey-new').click();for(let i=0;i<OPENING_ROOM.length;i++)await page.locator('[data-action="next"]').click();
 for(let i=0;i<14&&await page.locator('#journey-context-label').innerText()!=='いっしょに始める';i++){await page.locator('#journey-world').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');await page.waitForTimeout(80);}
 await page.locator('#journey-interact').click();for(let i=0;i<OPENING_DESK.length-1;i++)await page.locator('#journey-line').click();
 await expect(page.locator('#journey-line')).toHaveText(OPENING_DESK.at(-1)![1]);await page.locator('#journey-line').dblclick();await expect(page.locator('.journey-portal')).toBeVisible();
 await page.mouse.click(240,125);await page.waitForTimeout(1800);await page.mouse.click(240,125);await expect(page.locator('.journey-portal')).toBeVisible();
 const skipButton=page.getByRole('button',{name:'映像をスキップしてゲームへ進む'});await expect(skipButton).toBeEnabled({timeout:20000});const skip=await skipButton.boundingBox();await page.mouse.dblclick(skip!.x+skip!.width/2,skip!.y+skip!.height/2,{delay:80});await expect(page.locator('#journey-line')).toHaveText(OPENING_ARRIVAL[0]![1]);await page.waitForTimeout(150);await expect(page.locator('#journey-line')).toHaveText(OPENING_ARRIVAL[0]![1]);
 await page.locator('#journey-line').click();await expect(page.locator('#journey-line')).toHaveText(OPENING_ARRIVAL[1]![1]);
});
test('touch surface tap and accessible button remain separate, single-advance inputs',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await context.newPage();
 try{await page.goto(process.env.LIVE_URL??'http://127.0.0.1:4184/');await page.locator('#journey-new').tap();const line=page.locator('#journey-line');await line.tap();await expect(line).toHaveText(OPENING_ROOM[1]![1]);await page.touchscreen.tap(180,240);await expect(line).toHaveText(OPENING_ROOM[2]![1]);await page.getByRole('button',{name:'つづきを聞く',exact:true}).tap();await expect(line).toHaveText(OPENING_ROOM[3]![1]);}finally{await context.close();}
});
