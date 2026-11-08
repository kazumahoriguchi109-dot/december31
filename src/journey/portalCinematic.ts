import videoUrl from '../../assets/cinematic/portal-opening.mp4';
import artworkUrl from '../../assets/cinematic/portal-opening.png';
import {drawPortalFrame,PORTAL_SECONDS} from './portalFrames';
import './portalCinematic.css';
/** No state transitions happen here: the caller commits the world entry exactly once. */
export function createPortalCinematic(root:HTMLElement){
 let cleanup:(()=>void)|null=null;
 const image=new Image();image.src=artworkUrl;
 return {
  cancel(){cleanup?.();},
  play(options:{reducedMotion:boolean;onComplete:()=>void;onSound:()=>()=>void}){
   cleanup?.();
   const reduced=options.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
   const overlay=document.createElement('section');overlay.className='journey-portal';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','二人がゲームの世界へ吸い込まれる映像');
   overlay.innerHTML='<canvas aria-hidden="true"></canvas><footer><p>ふたりで、画面の向こうへ。</p><button type="button" aria-label="映像をスキップしてゲームへ進む">スキップ <span aria-hidden="true">E / Esc</span></button></footer>';
   const prior=document.activeElement as HTMLElement|null;
   const siblings=Array.from(root.children).filter((e):e is HTMLElement=>e instanceof HTMLElement).map(e=>({e,inert:e.inert}));
   siblings.forEach(({e})=>e.inert=true);root.append(overlay);
   const canvas=overlay.querySelector('canvas')!,ctx=canvas.getContext('2d')!;
   const button=overlay.querySelector('button')!;button.focus();
   let finished=false,elapsed=0,last=performance.now(),raf=0;
   const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.setAttribute('aria-hidden','true');video.style.opacity='0';if(!reduced){video.src=videoUrl;overlay.insertBefore(video,overlay.querySelector('footer'));video.addEventListener('loadeddata',()=>{if(finished)return;video.currentTime=Math.min(5.9,elapsed/1000);if(!document.hidden)void video.play().then(()=>{video.style.opacity='1';}).catch(()=>{});});video.addEventListener('error',()=>{video.style.opacity='0';});}
   const stopSound=reduced?()=>{}:options.onSound();
   const finish=(complete=true)=>{if(finished)return;finished=true;video.pause();video.removeAttribute('src');video.load();cancelAnimationFrame(raf);stopSound();document.removeEventListener('keydown',key,true);document.removeEventListener('visibilitychange',visibility);overlay.remove();siblings.forEach(({e,inert})=>e.inert=inert);cleanup=null;if(complete)options.onComplete();else prior?.focus();};
   const key=(e:KeyboardEvent)=>{if(e.ctrlKey||e.metaKey||e.altKey)return;e.stopImmediatePropagation();if(['Escape','KeyE','Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)finish();}else if(e.code==='Tab'){e.preventDefault();button.focus();}};
   const visibility=()=>{last=performance.now();if(document.hidden)video.pause();else if(!reduced&&video.readyState>=2)void video.play().catch(()=>{video.style.opacity='0';});};
   document.addEventListener('keydown',key,true);document.addEventListener('visibilitychange',visibility);button.addEventListener('click',()=>finish());
   const frame=(now:number)=>{if(finished)return;const dt=Math.max(0,now-last);last=now;if(!document.hidden)elapsed+=dt;if(canvas.width!==innerWidth||canvas.height!==innerHeight){canvas.width=Math.max(1,Math.round(innerWidth));canvas.height=Math.max(1,Math.round(innerHeight));}if(video.style.opacity!=='1'){if(image.complete&&image.naturalWidth)drawPortalFrame(ctx,image,canvas.width,canvas.height,reduced?elapsed/900*PORTAL_SECONDS:elapsed/1000,reduced);else{ctx.fillStyle='#090e17';ctx.fillRect(0,0,canvas.width,canvas.height);}}if(elapsed>=(reduced?900:PORTAL_SECONDS*1000))finish();else raf=requestAnimationFrame(frame);};
   cleanup=()=>finish(false);raf=requestAnimationFrame(frame);
  }
 };
}
