/** Decorative title motion never owns game state or stored preferences. */
export function createTitleVideo(video: HTMLVideoElement, source: string, button: HTMLButtonElement, status: HTMLElement) {
 const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
 const connection = (navigator as Navigator & {connection?: EventTarget & {saveData?: boolean}}).connection;
 let title = true, ready = false, reducedMotion = false, pending = false;
 let optedIn = false, manuallyPaused = false, blocked = false, failed = false, generation = 0;
 video.muted = true;
 const preferenceBlocks = () => reducedMotion || motion.matches || !!connection?.saveData;
 const permitted = () => ready && title && !document.hidden && !manuallyPaused && (optedIn || !preferenceBlocks()) && !blocked && !failed;
 function updateControl() {
  const playing = !video.paused && video.dataset['playing'] === 'true';
  button.textContent = playing || pending ? '背景動画を一時停止' : failed ? '背景動画を再試行' : '背景動画を再生';
  button.setAttribute('aria-pressed', String(playing || pending));
  status.textContent = failed ? '読み込めませんでした。再試行できます' : blocked ? '自動再生が止められています' : pending ? '読み込み中' : playing ? '再生中' : manuallyPaused ? '一時停止中' : preferenceBlocks() && !optedIn ? '動き・通信量の設定により静止画を表示中' : '静止画を表示中';
 }
 function stop() {generation++;pending = false;video.pause();video.hidden = true;video.dataset['playing'] = 'false';updateControl();}
 function sync() {
  if (!permitted()) {stop();return;}
  if (!video.getAttribute('src')) video.src = source;
  if (pending || !video.paused) {updateControl();return;}
  pending = true;video.hidden = false;video.dataset['playing'] = 'false';
  const attempt = ++generation;
  updateControl();
  // Call play synchronously, including from the button's trusted user gesture.
  void video.play().then(() => {
   if (attempt !== generation) return;
   pending = false;
   if (permitted()) {video.hidden = false;video.dataset['playing'] = 'true';}
   else {video.pause();video.hidden = true;video.dataset['playing'] = 'false';}
   updateControl();
  }).catch((error: unknown) => {
   if (attempt !== generation) return;
   pending = false;
   blocked = error instanceof DOMException && error.name === 'NotAllowedError';
   failed = !blocked;
   video.hidden = true;video.dataset['playing'] = 'false';updateControl();
  });
 }
 button.addEventListener('click', () => {
  if (pending || !video.paused && !video.hidden) {manuallyPaused = true;stop();return;}
  const retry = failed || !!video.error;
  optedIn = true;manuallyPaused = false;blocked = false;failed = false;
  if (retry) video.load();
  sync();
 });
 video.addEventListener('error', () => {failed = true;blocked = false;stop();});
 video.addEventListener('playing', () => {
  if (permitted()) {video.hidden = false;video.dataset['playing'] = 'true';}
  else {video.pause();video.hidden = true;video.dataset['playing'] = 'false';}
  updateControl();
 });
 video.addEventListener('pause', updateControl);
 document.addEventListener('visibilitychange', sync);
 motion.addEventListener('change', () => {if (motion.matches) optedIn = false;sync();});
 connection?.addEventListener('change', () => {if (connection.saveData) optedIn = false;sync();});
 updateControl();
 return {
  setTitle(value: boolean) {title = value;sync();},
  setReducedMotion(value: boolean) {
   if (value && !reducedMotion) optedIn = false;
   reducedMotion = value;ready = true;sync();
  },
 };
}
