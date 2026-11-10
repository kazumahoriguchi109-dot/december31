import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const out=process.env.OUTPUT_DIR??'/tmp/character-continuity';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:820}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=id=>page.locator(`[data-id=${id}]`).click();
try{
 await page.goto(process.env.E2E_URL??'http://127.0.0.1:4197/');
 await click('new');
 if(await page.locator('.dialogue-portrait .journey-material-portrait').count()!==1)throw Error('approved room portrait replaced');
 await click('next');await click('next');await click('next');await page.locator('.journey-portal').waitFor();await page.keyboard.press('Escape');
 await click('interact');
 const portrait=page.locator('.dialogue-portrait .world-character-portrait');
 if(await portrait.getAttribute('data-character')!=='toto'||await portrait.getAttribute('data-portrait-era')!=='mono')throw Error('chest transition did not adopt Toto monochrome world art');
 await portrait.evaluate(img=>img.decode());
 for(const [width,height] of [[1280,820],[390,844],[640,360]]){
  await page.setViewportSize({width,height});await page.screenshot({path:`${out}/chest-${width}.png`});
  const bounds=await portrait.boundingBox();if(!bounds||bounds.width<30||bounds.x<0||bounds.y<0||bounds.y+bounds.height>height)throw Error('portrait clipped');
 }
 await click('close');
 // Test the same reusable renderer for both identities and every authored expression.
 await page.evaluate(async()=>{
  const {characterPortrait}=await import('/src/evolution/characterPortrait.ts');
  const {pixelActor}=await import('/src/journey/actorArt.ts');
  const expression={neutral:'neutral',question:'curious',surprise:'surprised',relief:'relieved'};
  for(const view of ['mono','color'])for(const speaker of ['主人公','トト'])for(const emotion of Object.keys(expression)){
   const kind=speaker==='トト'?'toto':'player';const actor=pixelActor(kind);actor.update(view==='color'?1:0,0,0,{expression:expression[emotion],reducedMotion:true});
   const source=actor.sprite.material.map.image, scale=source.width/32;
   const expected=document.createElement('canvas');expected.width=expected.height=26*scale;
   expected.getContext('2d').drawImage(source,4*scale,2*scale,26*scale,26*scale,0,0,expected.width,expected.height);
   const div=document.createElement('div');div.innerHTML=characterPortrait(speaker,emotion,view);
   if(div.firstElementChild.src!==expected.toDataURL())throw Error('portrait pixels differ from world: '+kind+'/'+view+'/'+emotion);
  }
 });
 await page.reload();await click('continue');
 if(await page.locator('.feedback-portrait .world-character-portrait').getAttribute('data-portrait-era')!=='mono')throw Error('resume lost era');
 await page.addInitScript(()=>{const key='dec31-evolving-puzzles-v1';const s=JSON.parse(localStorage.getItem(key));s.stage=3;s.solved=[true,true,false,false,false,false];s.actors=[{x:3,z:7},{x:4,z:7}];s.gear=0;localStorage.setItem(key,JSON.stringify(s));});
 await page.reload();await click('continue');await click('switch');
 if(await page.locator('.feedback-portrait .journey-material-portrait').getAttribute('data-portrait-row')!=='1')throw Error('3D switch lost Toto identity');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('CHARACTER CONTINUITY PASSED: room preserved, chest transition, all 16 world texture crops, resume, actor switch, 3 viewport sizes');
}finally{await browser.close();}
