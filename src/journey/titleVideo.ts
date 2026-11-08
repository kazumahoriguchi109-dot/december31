/** Decorative title motion never owns game state or keyboard focus. */
export function createTitleVideo(video: HTMLVideoElement, source: string) {
 const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
 const connection = (navigator as Navigator & {connection?: EventTarget & {saveData?: boolean}}).connection;
 let title = true, ready = false, reducedMotion = false, failed = false, pending = false;
 let generation = 0;
 video.muted = true;
 const permitted = () => ready && title && !document.hidden && !reducedMotion && !motion.matches && !connection?.saveData && !failed;
 function sync() {
  if (!permitted()) {
   generation++;pending = false;video.pause();video.hidden = true;
   return;
  }
  if (!video.getAttribute('src')) video.src = source;
  if (pending || !video.paused) return;
  pending = true;
  const attempt = ++generation;
  void video.play().then(() => {
   if (attempt !== generation) return;
   pending = false;
   if (permitted()) video.hidden = false;
   else {video.pause();video.hidden = true;}
  }).catch(() => {
   if (attempt !== generation) return;
   pending = false;failed = true;video.hidden = true;
  });
 }
 video.addEventListener('error', () => {failed = true;sync();});
 // A late playback event after changing settings must not reveal motion.
 video.addEventListener('playing', () => {
  if (permitted()) video.hidden = false;
  else {video.pause();video.hidden = true;}
 });
 document.addEventListener('visibilitychange', sync);
 motion.addEventListener('change', sync);
 connection?.addEventListener('change', sync);
 return {
  setTitle(value: boolean) {title = value;sync();},
  setReducedMotion(value: boolean) {reducedMotion = value;ready = true;sync();},
 };
}
