/** A tap may move slightly, but dragging or holding must not advance a conversation. */
export function isDialogueTap(maxDistance:number,duration:number){return maxDistance<=8&&duration>=0&&duration<=1000;}
/** Only non-interactive dialogue content and the world canvas are continuation surfaces.
 * The real button remains the keyboard/assistive-technology control. */
export function bindDialoguePointer(root:HTMLElement,canvas:HTMLCanvasElement,dialogue:HTMLElement,token:()=>number|null,advance:()=>void){
 type Press={id:number;x:number;y:number;at:number;token:number;surface:Element;maxDistance:number;released:boolean};
 let press:Press|null=null,rejectRepeated=true;
 const reset=()=>{press=null;};
 const beginConversation=()=>{reset();rejectRepeated=true;};
 const acceptButtonClick=(event:MouseEvent)=>{if(rejectRepeated&&event.detail>1)return false;rejectRepeated=false;return true;};
 const surface=(target:EventTarget|null)=>{
  if(!(target instanceof Element)||target.closest('button,a,input,select,textarea,summary,[role="button"],[contenteditable],[data-action]'))return null;
  return target===canvas?canvas:dialogue.contains(target)?dialogue:null;
 };
 const modified=(e:MouseEvent)=>e.altKey||e.ctrlKey||e.metaKey||e.shiftKey;
 root.addEventListener('pointerdown',e=>{
  reset();const current=token(),area=surface(e.target);
  if(current===null||!area||!e.isPrimary||e.button!==0||modified(e))return;
  press={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now(),token:current,surface:area,maxDistance:0,released:false};
 });
 root.addEventListener('pointermove',e=>{if(press&&e.pointerId===press.id)press.maxDistance=Math.max(press.maxDistance,Math.hypot(e.clientX-press.x,e.clientY-press.y));});
 root.addEventListener('pointercancel',reset);
 root.addEventListener('pointerup',e=>{
  if(!press||e.pointerId!==press.id)return;
  press.maxDistance=Math.max(press.maxDistance,Math.hypot(e.clientX-press.x,e.clientY-press.y));
  if(surface(e.target)!==press.surface||token()!==press.token||!isDialogueTap(press.maxDistance,performance.now()-press.at)){reset();return;}
  press.released=true;
 });
 root.addEventListener('click',e=>{
  const candidate=press;reset();
  if(!candidate?.released||e.button!==0||e.detail<1||(rejectRepeated&&e.detail>1)||modified(e)||surface(e.target)!==candidate.surface||token()!==candidate.token||!isDialogueTap(candidate.maxDistance,performance.now()-candidate.at)||(candidate.surface===dialogue&&document.getSelection()?.toString()))return;
  rejectRepeated=false;
  // A final-line click must never reach an overlay created synchronously by advance().
  e.preventDefault();e.stopPropagation();advance();
 });
 return {reset,beginConversation,acceptButtonClick};
}
