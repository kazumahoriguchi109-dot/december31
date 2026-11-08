import videoUrl from '../../assets/cinematic/portal-opening.mp4';
import artworkUrl from '../../assets/cinematic/portal-opening.png';
import {drawPortalFrame,PORTAL_SECONDS} from './portalFrames';
import './portalCinematic.css';
/** Playback starts only once something can actually be shown. The caller owns world entry. */
export function createPortalCinematic(root:HTMLElement){
 let cleanup:(()=>void)|null=null;
 const image=new Image();image.src=artworkUrl;
 return {
  cancel(){cleanup?.();},
  play(options:{reducedMotion:boolean;onComplete:()=>void;onSound:()=>()=>void}){
   cleanup?.();
   const reduced=options.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
   const overlay=document.createElement('section');overlay.className='journey-portal';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','二人がゲームの世界へ吸い込まれる映像');
   overlay.innerHTML='<canvas aria-hidden="true"></canvas><footer><p aria-live="polite">映像を準備しています…</p><button type="button" aria-label="映像をスキップしてゲームへ進む">スキップ <span aria-hidden="true">E / Esc</span></button></footer>';
   const prior=document.activeElement as HTMLElement|null;
   const siblings=Array.from(root.children).filter((e):e is HTMLElement=>e instanceof HTMLElement).map(e=>({e,inert:e.inert}));
   siblings.forEach(({e})=>e.inert=true);root.append(overlay);
   const canvas=overlay.querySelector('canvas')!,ctx=canvas.getContext('2d')!,button=overlay.querySelector('button')!,caption=overlay.querySelector('p')!;
   overlay.tabIndex=-1;overlay.focus();button.disabled=true;
   let finished=false,elapsed=0,last=performance.now(),raf=0,mode:'loading'|'video'|'canvas'='loading';
   let playPending=false,playRequestAt=0;
   let lastAdvanceInput=performance.now(),videoFailed=false,imageFailed=false,failed=false,objectUrl='',stopSound=()=>{};
   const requestedAt=performance.now(),controller=new AbortController();
   const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.setAttribute('aria-hidden','true');video.style.opacity='0';
   if(!reduced)overlay.insertBefore(video,overlay.querySelector('footer'));
   const readyImage=()=>image.complete&&image.naturalWidth>0;
   const resize=()=>{if(canvas.width!==innerWidth||canvas.height!==innerHeight){canvas.width=Math.max(1,Math.round(innerWidth));canvas.height=Math.max(1,Math.round(innerHeight));}};
   const begin=(next:'video'|'canvas')=>{
    if(finished||mode!=='loading'||document.hidden)return;
    mode=next;caption.textContent='ふたりで、画面の向こうへ。';
    if(next==='canvas'){video.pause();controller.abort();video.style.opacity='0';}
    stopSound=reduced?()=>{}:options.onSound();
    // Audio preparation is synchronous: neither it nor loading time consumes the movie.
    elapsed=0;last=performance.now();
    if(next==='video'){video.currentTime=0;video.style.opacity='1';}
   };
   const choose=()=>{
    if(finished||mode!=='loading'||document.hidden)return;
    if(reduced&&readyImage()){begin('canvas');return;}
    if(!reduced&&video.readyState>=2&&!videoFailed){
     if(playPending){if(readyImage()&&performance.now()-playRequestAt>=1200)begin('canvas');return;}
     playPending=true;playRequestAt=performance.now();
     void video.play().then(()=>{if(mode==='loading'&&!finished)begin('video');else if(mode!=='video')video.pause();}).catch(()=>{videoFailed=true;if(readyImage())begin('canvas');}).finally(()=>{playPending=false;});return;
    }
    // Once a visible fallback begins, never jump into a later portion of a late video.
    if(readyImage()&&(videoFailed||performance.now()-requestedAt>=1200)){begin('canvas');return;}
    if(!failed&&imageFailed&&(videoFailed||reduced)){failed=true;caption.textContent='映像を読み込めませんでした。ゲームへ進めます。';button.disabled=false;}
   };
   const finish=(complete=true)=>{if(finished)return;finished=true;controller.abort();video.pause();video.removeAttribute('src');video.load();if(objectUrl)URL.revokeObjectURL(objectUrl);cancelAnimationFrame(raf);stopSound();document.removeEventListener('keydown',key,true);document.removeEventListener('keyup',release,true);document.removeEventListener('visibilitychange',visibility);overlay.remove();siblings.forEach(({e,inert})=>e.inert=inert);cleanup=null;if(complete)options.onComplete();else prior?.focus();};
   const advanceKeys=['KeyE','Space','Enter'];
   const pastGuard=()=>mode==='loading'?performance.now()-requestedAt>=1200:elapsed>=(reduced?0:1200);
   const canAdvance=(now:number)=>(failed||pastGuard())&&now-lastAdvanceInput>=600;
   const key=(e:KeyboardEvent)=>{if(e.ctrlKey||e.metaKey||e.altKey)return;e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();if(!e.repeat)finish();}else if(advanceKeys.includes(e.code)){e.preventDefault();const now=performance.now(),allowed=canAdvance(now);lastAdvanceInput=now;if(!e.repeat&&allowed)finish();}else if(e.code==='Tab'){e.preventDefault();if(!button.disabled)button.focus();}};
   const release=(e:KeyboardEvent)=>{if(advanceKeys.includes(e.code)){lastAdvanceInput=performance.now();e.preventDefault();}};
   const visibility=()=>{last=performance.now();if(document.hidden)video.pause();else if(mode==='video')void video.play().catch(()=>{if(readyImage()){elapsed=video.currentTime*1000;mode='canvas';video.style.opacity='0';}});else choose();};
   document.addEventListener('keydown',key,true);document.addEventListener('keyup',release,true);document.addEventListener('visibilitychange',visibility);
   button.addEventListener('click',e=>{if(e.detail>1)return;if((failed||pastGuard())&&(e.detail>0||performance.now()-lastAdvanceInput>=600))finish();});
   video.addEventListener('loadeddata',choose);
   video.addEventListener('error',()=>{videoFailed=true;if(mode==='video'&&readyImage()){elapsed=video.currentTime*1000;mode='canvas';last=performance.now();video.style.opacity='0';}else choose();});
   // Fetch the entire small clip before playing so a slow response cannot shorten or stall it.
   if(!reduced)void fetch(videoUrl,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Movie unavailable');return r.blob();}).then(blob=>{if(finished||mode!=='loading')return;objectUrl=URL.createObjectURL(blob);video.src=objectUrl;video.load();}).catch(()=>{if(!finished&&mode==='loading'){videoFailed=true;choose();}});
   void image.decode().then(choose).catch(()=>{imageFailed=true;choose();});
   const frame=(now:number)=>{
    if(finished)return;const dt=Math.max(0,now-last);last=now;resize();
    if(mode==='loading'){choose();button.disabled=!failed&&!pastGuard();if(readyImage())drawPortalFrame(ctx,image,canvas.width,canvas.height,0,true);else{ctx.fillStyle='#090e17';ctx.fillRect(0,0,canvas.width,canvas.height);}}
    else{
     if(!document.hidden){if(mode==='video')elapsed=video.currentTime*1000;else elapsed+=dt;}
     button.disabled=!failed&&elapsed<(reduced?0:1200);
     if(mode==='canvas')drawPortalFrame(ctx,image,canvas.width,canvas.height,reduced?elapsed/900*PORTAL_SECONDS:elapsed/1000,reduced);
     if((mode==='video'&&video.ended)||elapsed>=(reduced?900:PORTAL_SECONDS*1000)){finish();return;}
    }
    raf=requestAnimationFrame(frame);
   };
   cleanup=()=>finish(false);raf=requestAnimationFrame(frame);
  }
 };
}
