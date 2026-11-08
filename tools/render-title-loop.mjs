// Deterministic 12-second cinemagraph: existing artwork, periodic snow and lamp glow.
// Run: FFMPEG=/path/to/ffmpeg node tools/render-title-loop.mjs
import {chromium} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const ffmpeg=process.env.FFMPEG??'ffmpeg';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const data=readFileSync('assets/art/backgrounds/title-winter-v1.png').toString('base64');
await page.setContent('<canvas width="1280" height="720"></canvas>');
await page.evaluate(async data=>{
 const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
 const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
 let seed=3112;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const flakes=Array.from({length:145},()=>({x:rnd()*1280,y:rnd()*760,r:.45+rnd()*1.4,a:.2+rnd()*.43,phase:rnd()*Math.PI*2,drift:5+rnd()*12}));
 window.renderFrame=t=>{
  const phase=t/12*Math.PI*2;ctx.drawImage(img,0,0,1280,720);
  for(const [x,y,r,p] of [[160,446,70,0],[1234,505,65,1.3],[345,573,24,2.1]]){
   const a=.035+.018*Math.sin(phase+p)+.007*Math.sin(phase*3+p);
   const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,`rgba(255,174,70,${a})`);glow.addColorStop(1,'rgba(255,174,70,0)');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  for(const f of flakes){
   const y=((f.y+t/12*760)%760)-20,x=f.x+f.drift*Math.sin(phase+f.phase);
   const edge=Math.min(1,Math.max(0,(y+5)/25),Math.max(0,(725-y)/25));
   ctx.fillStyle=`rgba(225,236,255,${f.a*edge})`;ctx.beginPath();ctx.ellipse(x,y,f.r,f.r*1.15,0,0,Math.PI*2);ctx.fill();
  }
  return canvas.toDataURL('image/jpeg',.94).split(',')[1];
 };
},data);
mkdirSync('test-results/title-loop',{recursive:true});
const out='assets/art/backgrounds/title-winter-loop.mp4';
const child=spawn(ffmpeg,['-y','-hide_banner','-loglevel','error','-f','image2pipe','-framerate','24','-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','slow','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
const done=once(child,'exit');
for(let i=0;i<288;i++){
 const buffer=Buffer.from(await page.evaluate(t=>window.renderFrame(t),i/24),'base64');
 if(i===0||i===144||i===287)writeFileSync(`test-results/title-loop/frame-${i}.jpg`,buffer);
 if(!child.stdin.write(buffer))await once(child.stdin,'drain');
 if(i%72===0)console.log('Rendered',i,'/ 288');
}
const frame0=await page.evaluate(()=>window.renderFrame(0)),frame12=await page.evaluate(()=>window.renderFrame(12));
if(frame0!==frame12)throw new Error('Period boundary is not pixel-identical');
console.log('Unencoded t=0 and t=12 match exactly');
child.stdin.end();const [code]=await done;await browser.close();if(code!==0)process.exit(code??1);
console.log(out);
