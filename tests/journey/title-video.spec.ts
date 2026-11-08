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
 expect(requests).toEqual([]);expect(await page.evaluate(k=>localStorage.getItem(k),saveKey)).toBeNull();
});

test('muted inline video plays, stops for settings and game, then resumes at the title',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('./');const clip=page.locator(video);
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

for (const mode of ['os','saved','data'] as const) test(`explicit title play opts into ${mode} limits without changing preferences or saves`,async({page})=>{
 if(mode==='os')await page.emulateMedia({reducedMotion:'reduce'});
 if(mode==='saved')await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({volume:.7,reducedMotion:true})),prefsKey);
 if(mode==='data')await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true,addEventListener(){}}}));
 await page.goto('./');const clip=page.locator(video),toggle=page.locator('#journey-title-video-toggle');
 await expect(toggle).toBeVisible();await expect(toggle).toHaveText('背景動画を再生');expect(await clip.getAttribute('src')).toBeNull();
 const prefs=await page.evaluate(k=>localStorage.getItem(k),prefsKey);
 await toggle.click();await expect(clip).toHaveAttribute('data-playing','true',{timeout:15000});
 await expect(toggle).toHaveText('背景動画を一時停止');await expect(page.locator('#journey-title-video-status')).toHaveText('再生中');
 await toggle.click();await expect(clip).toBeHidden();await expect(toggle).toHaveText('背景動画を再生');
 await expect(page.locator('#journey-title-video-status')).toHaveText('一時停止中');
 expect(await page.evaluate(k=>localStorage.getItem(k),prefsKey)).toBe(prefs);expect(await page.evaluate(k=>localStorage.getItem(k),saveKey)).toBeNull();
 await page.reload();expect(await page.locator(video).getAttribute('src')).toBeNull();
});

test('blocked autoplay can retry from a direct gesture and manual pause survives title return',async({page})=>{
 await page.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;let first=true;HTMLMediaElement.prototype.play=function(){if(first){first=false;return Promise.reject(new DOMException('Autoplay denied','NotAllowedError'));}return play.call(this);};});
 await page.goto('./');const clip=page.locator(video),toggle=page.locator('#journey-title-video-toggle');
 await expect(page.locator('#journey-title-video-status')).toHaveText('自動再生が止められています');await expect(toggle).toHaveText('背景動画を再生');
 await toggle.click();await expect(clip).toHaveAttribute('data-playing','true',{timeout:15000});
 const initial=await clip.evaluate((v:HTMLVideoElement)=>v.currentTime);await expect.poll(()=>clip.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(initial+.1);
 await toggle.click();await expect(clip).toBeHidden();
 await page.locator('#journey-new').click();await page.keyboard.press('Escape');await page.locator('#journey-pause [data-action="title"]').click();
 await expect(clip).toBeHidden();await expect(page.locator('#journey-title-video-status')).toHaveText('一時停止中');
 await toggle.click();await expect(clip).toHaveAttribute('data-playing','true');
});

test('failed media can retry after connectivity recovers',async({page})=>{
 await page.route('**/*.mp4',route=>route.abort());await page.goto('./');
 await expect(page.locator('#journey-title-video-status')).toHaveText('読み込めませんでした。再試行できます');
 await expect(page.locator('#journey-title-video-toggle')).toHaveText('背景動画を再試行');
 await page.unroute('**/*.mp4');await page.locator('#journey-title-video-toggle').click();
 await expect(page.locator(video)).toHaveAttribute('data-playing','true',{timeout:15000});
});
