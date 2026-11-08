/** Reproducible fifteen-second motion illustration with original music and effects. */
import {webkit} from '@playwright/test';
import {spawn} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createPortalSamples,PORTAL_SECONDS,PORTAL_SAMPLE_RATE} from '../src/journey/portalSoundtrack.ts';
const base=process.env.LIVE_URL??'http://127.0.0.1:5178';
const ffmpeg=process.env.FFMPEG??'ffmpeg';
const out=process.env.PORTAL_OUT??'assets/cinematic';mkdirSync(out,{recursive:true});
const rate=PORTAL_SAMPLE_RATE,samples=createPortalSamples(rate),pcm=Buffer.alloc(samples.length*2);
for(let i=0;i<samples.length;i++)pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]*.55))*32767),i*2);
const header=Buffer.alloc(44);
header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);
header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);
header.write('data',36);header.writeUInt32LE(pcm.length,40);
const wav='/tmp/portal-original-soundtrack.wav';writeFileSync(wav,Buffer.concat([header,pcm]));
// Render the new timing from source; stretching an earlier clip would prolong its dark ending.
if(process.env.PORTAL_SOURCE_VIDEO)throw new Error('The fifteen-second version must render from the Canvas source.');
const inputs=['-f','image2pipe','-framerate','10','-i','pipe:0','-i',wav];
const filter='fps=30';
const encoder=spawn(ffmpeg,['-y','-loglevel','warning',...inputs,'-map','0:v:0','-map','1:a:0','-vf',filter,'-t',String(PORTAL_SECONDS),'-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',`${out}/portal-opening.mp4`],{stdio:['pipe','inherit','inherit']});
const completed=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('exit',code=>code===0?resolve():reject(new Error(`ffmpeg ${code}`)));});
{
 const browser=await webkit.launch();try{
  const page=await browser.newPage();await page.goto(base+'/assets/cinematic/portal-opening.png');await page.evaluate(async()=>{const {drawPortalFrame}=await import('/src/journey/portalFrames.ts');const image=new Image();image.src='/assets/cinematic/portal-opening.png';await image.decode();const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;window.renderFrame=t=>{drawPortalFrame(canvas.getContext('2d'),image,1280,720,t);return canvas.toDataURL('image/jpeg',.91).split(',')[1];};});
  for(let i=0;i<PORTAL_SECONDS*10;i++){const data=Buffer.from(await page.evaluate(t=>window.renderFrame(t),i/10),'base64');if(!encoder.stdin.write(data))await new Promise(r=>encoder.stdin.once('drain',r));if(i%30===0)console.log(`rendered ${i}/${PORTAL_SECONDS*10}`);}
  encoder.stdin.end();await completed;
 }finally{await browser.close();}
}
console.log(`${out}/portal-opening.mp4`);
