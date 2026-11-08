import {expect,test} from '@playwright/test';
const prefsKey='dec31-evolution-c013:preferences';
const saveKey='dec31-evolution-c013:journey';
const video='#journey-title-video';

for (const mode of ['os','saved','data'] as const) test(`title retains its still image without fetching video for ${mode} preference`,async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.resourceType()==='media'&&/\.mp4(?:\?|$)/.test(r.url()))requests.push(r.url());});
 if(mode==='os')await page.emulateMedia({reducedMotion:'reduce'});
 if(mode==='saved')await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({volume:.7,reducedMotion:true})),prefsKey);
 if(mode==='data')await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true,addEventListener(){}}}));
 await page.goto('./');await expect(page.locator('#journey-new')).toBeVisible();
 await expect(page.locator(video)).toBeHidden();expect(await page.locator(video).getAttribute('src')).toBeNull();
 await expect(page.locator('.journey-title-art')).toBeVisible();
 await page.locator('#journey-title-heading').click();await page.keyboard.press('ArrowDown');
 expect(await page.locator(video).getAttribute('src')).toBeNull();
 expect(requests).toEqual([]);expect(await page.evaluate(k=>localStorage.getItem(k),saveKey)).toBeNull();
});

test('muted inline video plays, stops for settings and game, then resumes at the title',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('./');const clip=page.locator(video);
 await expect(page.locator('#journey-title-video-toggle, #journey-title-video-status, .journey-title-video-control')).toHaveCount(0);
 expect(await clip.evaluate((v:HTMLVideoElement)=>v.controls)).toBe(false);
 // Unsupported decoders are a legitimate still-image fallback, not a broken menu.
 const supported=await clip.evaluate((v:HTMLVideoElement)=>!!v.canPlayType('video/mp4; codecs="avc1.42E01E"'));
 test.skip(!supported,'This browser build has no H.264 decoder; fallback cases run separately.');
 await expect(clip).toHaveAttribute('data-playing','true',{timeout:15000});
 const initial=await clip.evaluate((v:HTMLVideoElement)=>({time:v.currentTime,muted:v.muted,inline:v.hasAttribute('playsinline'),loop:v.loop,duration:v.duration}));
 expect(initial.muted&&initial.inline&&initial.loop).toBe(true);expect(initial.duration).toBeGreaterThan(1);
 await expect.poll(()=>clip.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(initial.time+.1);
 await page.locator('#journey-title-settings-button').click();await page.locator('#journey-title-motion').check();
 await expect(clip).toBeHidden();await expect.poll(()=>clip.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
 await page.locator('#journey-title-motion').uncheck();await expect(clip).toHaveAttribute('data-playing','true');await page.locator('#journey-title-settings-close').click();
 expect(await page.evaluate(k=>localStorage.getItem(k),saveKey)).toBeNull();
 await page.locator('#journey-new').click();await expect(clip).toBeHidden();await expect.poll(()=>clip.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
 await page.keyboard.press('Escape');await page.locator('#journey-pause [data-action="title"]').click();await expect(clip).toHaveAttribute('data-playing','true');
 const saved=await page.evaluate(k=>localStorage.getItem(k),saveKey);expect(saved).not.toBeNull();
 await page.emulateMedia({reducedMotion:'reduce'});await expect(clip).toBeHidden();await expect.poll(()=>clip.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
 await page.emulateMedia({reducedMotion:'no-preference'});await expect(clip).toHaveAttribute('data-playing','true');
 expect(await page.evaluate(k=>localStorage.getItem(k),saveKey)).toBe(saved);
});

test('a hidden page pauses decorative playback and can resume',async({page})=>{
 await page.goto('./');const clip=page.locator(video);
 test.skip(!(await clip.evaluate((v:HTMLVideoElement)=>!!v.canPlayType('video/mp4; codecs="avc1.42E01E"'))),'No H.264 decoder');
 await expect(clip).toHaveAttribute('data-playing','true',{timeout:15000});
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(clip).toBeHidden();await expect.poll(()=>clip.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
 await page.evaluate(()=>{delete (document as unknown as {hidden?:boolean}).hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await expect(clip).toHaveAttribute('data-playing','true');
});

for (const failure of ['network','autoplay'] as const) test(`${failure} failure leaves the still image and menus usable`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 if(failure==='network')await page.route('**/*.mp4',route=>route.abort());
 else await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Autoplay denied','NotAllowedError'));};});
 await page.goto('./');await expect(page.locator('#journey-new')).toBeVisible();await expect(page.locator(video)).toBeHidden();
 await expect(page.locator('.journey-title-art')).toBeVisible();await page.locator('#journey-title-settings-button').click();
 await expect(page.locator('#journey-title-settings')).toBeVisible();await page.locator('#journey-title-settings-close').click();
 expect(await page.evaluate(k=>localStorage.getItem(k),saveKey)).toBeNull();
 await page.locator('#journey-new').click();await expect(page.locator('#journey-dialogue')).toBeVisible();expect(errors).toEqual([]);
});

for (const gesture of ['pointer','keyboard'] as const) test(`blocked autoplay retries on ordinary title ${gesture} input without video controls`,async({page})=>{
 await page.addInitScript(()=>{
  const play=HTMLMediaElement.prototype.play;
  const state=window as unknown as {titleVideoAttempts:number};state.titleVideoAttempts=0;
  HTMLMediaElement.prototype.play=function(){state.titleVideoAttempts++;if(state.titleVideoAttempts===1)return Promise.reject(new DOMException('Autoplay denied','NotAllowedError'));return play.call(this);};
 });
 await page.goto('./');const clip=page.locator(video);
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {titleVideoAttempts:number}).titleVideoAttempts)).toBe(1);
 await expect(clip).toBeHidden();
 await expect(page.locator('#journey-title-video-toggle, #journey-title-video-status, .journey-title-video-control')).toHaveCount(0);
 if(gesture==='pointer')await page.locator('#journey-title-heading').click();else await page.keyboard.press('ArrowDown');
 await expect(clip).toHaveAttribute('data-playing','true',{timeout:15000});
 const initial=await clip.evaluate((v:HTMLVideoElement)=>v.currentTime);
 await expect.poll(()=>clip.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(initial+.1);
 await expect(page.locator('.journey-app')).toHaveAttribute('data-screen','title');
 expect(await page.evaluate(k=>localStorage.getItem(k),saveKey)).toBeNull();
});

test('failed media retries when connectivity returns without a dedicated control',async({page})=>{
 await page.route('**/*.mp4',route=>route.abort());await page.goto('./');
 const clip=page.locator(video);
 await expect.poll(()=>clip.evaluate((v:HTMLVideoElement)=>!!v.error)).toBe(true);await expect(clip).toBeHidden();
 await page.unroute('**/*.mp4');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(clip).toHaveAttribute('data-playing','true',{timeout:15000});
 expect(await page.evaluate(k=>localStorage.getItem(k),saveKey)).toBeNull();
});

test('unexpected title pause resumes automatically and the video wraps at its end',async({page})=>{
 await page.goto('./');const clip=page.locator(video);
 await expect(clip).toHaveAttribute('data-playing','true',{timeout:15000});
 await clip.evaluate((v:HTMLVideoElement)=>v.pause());
 await expect.poll(()=>clip.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(false);
 await expect(clip).toHaveAttribute('data-playing','true');
 await clip.evaluate((v:HTMLVideoElement)=>{v.currentTime=v.duration-.15;});
 await expect.poll(()=>clip.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeLessThan(2);
 expect(await clip.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(false);
});
