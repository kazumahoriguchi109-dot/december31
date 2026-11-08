/** Reproducible six-second motion study from the user-approved image. */
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
const base=process.env.LIVE_URL??'http://127.0.0.1:5178';
const ffmpeg=process.env.FFMPEG??'/Users/horiguchikazuma/Library/Application Support/vrew/ffmpeg_gpl_vgx_v5/ffmpeg';
const out=process.env.PORTAL_OUT??'assets/cinematic';mkdirSync(out,{recursive:true});
// Original deterministic, smoothly enveloped wind/descending tones. No licensed samples.
const rate=44100,n=rate*6,pcm=Buffer.alloc(n*2);let seed=123456789,low=0;
for(let i=0;i<n;i++){const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;low=low*.94+(seed/4294967296*2-1)*.06;const wind=t<2.5?.2*t/2.5:t<4.6?.2-(t-2.5)/2.1*.09:.11*(6-t)/1.4;let value=low*wind;
for(const [frequency,start,duration,peak] of [[164.81,0,4.8,.018],[220,.15,4.6,.014],[82.41,4.8,.9,.04]]){const age=t-start;if(age<0||age>duration)continue;const env=age<.2?peak*age/.2:peak*(1-(age-.2)/(duration-.2));const k=Math.log(.67)/duration;const phase=frequency*(Math.exp(k*age)-1)/k;value+=Math.sin(2*Math.PI*phase)*env;}
pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value*.55)) *32767),i*2);}
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);writeFileSync('/tmp/portal-original-sfx.wav',Buffer.concat([header,pcm]));
const encoder=spawn(ffmpeg,['-y','-loglevel','warning','-f','image2pipe','-framerate','30','-i','pipe:0','-i','/tmp/portal-original-sfx.wav','-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-shortest',`${out}/portal-opening.mp4`],{stdio:['pipe','inherit','inherit']});
const completed=new Promise((resolve,reject)=>encoder.on('exit',code=>code===0?resolve():reject(new Error(`ffmpeg ${code}`))));
const browser=await chromium.launch();const page=await browser.newPage();await page.goto(base+'/assets/cinematic/portal-opening.png');await page.evaluate(async()=>{const {drawPortalFrame}=await import('/src/journey/portalFrames.ts');const image=new Image();image.src='/assets/cinematic/portal-opening.png';await image.decode();const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;window.renderFrame=t=>{drawPortalFrame(canvas.getContext('2d'),image,1280,720,t);return canvas.toDataURL('image/jpeg',.91).split(',')[1];};});
for(let i=0;i<180;i++){const data=Buffer.from(await page.evaluate(t=>window.renderFrame(t),i/30),'base64');if(!encoder.stdin.write(data))await new Promise(r=>encoder.stdin.once('drain',r));if(i%30===0)console.log(`rendered ${i}/180`);}
encoder.stdin.end();await completed;await browser.close();console.log(`${out}/portal-opening.mp4`);
