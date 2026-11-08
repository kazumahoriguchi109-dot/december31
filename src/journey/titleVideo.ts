/** Automatic decorative loop; game state and saved preferences are never changed. */
export function createTitleVideo(video: HTMLVideoElement, source: string) {
 const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
 const connection = (navigator as Navigator & {connection?: EventTarget & {saveData?: boolean}}).connection;
 let title = true, ready = false, reducedMotion = false, pending = false;
 let blocked = false, failed = false, generation = 0;
 video.muted = true;
 const allowed = () => ready && title && !document.hidden && !reducedMotion && !motion.matches && !connection?.saveData;
 const permitted = () => allowed() && !blocked && !failed;
 function stop() {
  generation++;pending = false;video.pause();video.hidden = true;video.dataset['playing'] = 'false';
 }
 function sync() {
  if (!permitted()) {stop();return;}
  if (!video.getAttribute('src')) video.src = source;
  if (pending || !video.paused) return;
  pending = true;video.hidden = false;video.dataset['playing'] = 'false';
  const attempt = ++generation;
  // Keep the video in layout while starting; the still remains visible underneath.
  void video.play().then(() => {
   if (attempt !== generation) return;
   pending = false;
   if (permitted()) {video.hidden = false;video.dataset['playing'] = 'true';}
   else stop();
  }).catch((error: unknown) => {
   if (attempt !== generation) return;
   pending = false;
   blocked = error instanceof DOMException && error.name === 'NotAllowedError';
   failed = !blocked;
   video.hidden = true;video.dataset['playing'] = 'false';
  });
 }
 function retry() {
  if (!allowed() || pending) return;
  const reload = failed || !!video.error;
  blocked = false;failed = false;
  if (reload) video.load();
  sync();
 }
 video.addEventListener('error', () => {failed = true;blocked = false;stop();});
 video.addEventListener('playing', () => {
  if (permitted()) {video.hidden = false;video.dataset['playing'] = 'true';}
  else stop();
 });
 // Recover a browser interruption, but never undo deliberate screen/preference pauses.
 video.addEventListener('pause', () => {if (permitted()) queueMicrotask(sync);});
 document.addEventListener('visibilitychange', () => {if (document.hidden) stop();else retry();});
 // If autoplay is restricted, the next ordinary gesture supplies user activation.
 // Failures do not schedule timers or repeatedly download a broken video.
 document.addEventListener('pointerdown', retry, {capture:true});
 document.addEventListener('keydown', retry, {capture:true});
 window.addEventListener('online', retry);
 motion.addEventListener('change', () => {if (motion.matches) stop();else retry();});
 connection?.addEventListener('change', () => {if (connection.saveData) stop();else retry();});
 return {
  setTitle(value: boolean) {title = value;if (value) retry();else stop();},
  setReducedMotion(value: boolean) {reducedMotion = value;ready = true;if (value) stop();else retry();},
 };
}
