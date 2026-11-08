import {beginDeskStory,pendingOpeningStory,acknowledgeOpeningLine} from './openingStory';
import {createState,step,stepCompanion,millCompanionStaging,context,interact,partner,rotate,objective} from './model';
import {memoryAt,lightMemory,memoryLit,pendingMemoryExplanation,acknowledgeMemoryExplanation,acknowledgeMemoryLine,unreadMemoryLines} from './memories';
import {createRenderer} from './renderer';
import {createUI} from './ui';
import {createJourneyAudio} from './audio';
import {loadJourney,saveJourney,loadPreferences,savePreferences} from './persistence';
import type {JourneyEvent,JourneyState,Expression} from './contract';
import './style.css';

let state:JourneyState=createState();
let preferences=loadPreferences();
let screen:'title'|'game'|'pause'|'credits'='title';
let dialogue:{id:string,speaker:string,text:string,expression:Expression}[]=[];
let pendingInteraction:{id:string,at:number}|null=null;
let actionCue:{id:string,start:number,duration:number}|null=null;
const expressionFor=(id:string,text:string):Expression=>/^opening-room-(8|9)$/.test(id)?'relieved':/home|solved|portal-open|latch-fixed/.test(id)?'relieved':/arrival|opening-desk/.test(id)?'surprised':/wall|discovery|[？?]/.test(id+text)?'curious':'neutral';
let evolutionRevealUntil=0;
let millRevealUntil=0;
let dialogueStageRemaining=0;
let dialogueVisible=false;
let toastId='';
let transitionUntil=0, toastUntil=0, resonance=false, guardHeld=false,pendingEnding=false;
let lastSave=0,wasMoving=false,lastTime=performance.now();
const keys=new Set<string>();
const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']);
const root=document.querySelector<HTMLElement>('#app')!;
const audio=createJourneyAudio();audio.setVolume(preferences.volume);
const ui=createUI(root,action);
const renderer=createRenderer(ui.canvas);
ui.setSettings(preferences);ui.setContinue(!!loadJourney());ui.setScreen('title');
const unlockNames=['','色と流れが生まれた','世界に奥行きが生まれた','ふたりの跡が見える'];
function saveNow(){const ok=saveJourney(state);lastSave=performance.now();ui.setSaveStatus(ok?'保存しました':'保存できません。このページを閉じると進行が失われます');}
function toast(text:string,id=''){toastId=id;ui.setToast(text);toastUntil=performance.now()+4500;}
function setScreen(next:typeof screen){screen=next;keys.clear();guardHeld=false;if(next!=='game'){pendingInteraction=null;actionCue=null;}ui.setScreen(next);if(next==='game'){renderer.resize();ui.canvas.focus();}if(next==='title')ui.setContinue(!!loadJourney());}
function dialogueBlocked(){const stage=millCompanionStaging(state);return performance.now()<evolutionRevealUntil||performance.now()<millRevealUntil||(dialogueStageRemaining>0&&!!stage&&!stage.ready);}
function showLine(){const line=dialogueBlocked()?null:dialogue[0]??null;dialogueVisible=!!line;ui.setDialogue(line);if(!dialogue.length&&pendingEnding){pendingEnding=false;setScreen('credits');}}
function events(list:JourneyEvent[]){
 for(const event of list){
  if(event.type==='dialogue'){dialogue.push({id:event.id,speaker:event.speaker??'トト',text:event.text??event.id,expression:expressionFor(event.id,event.text??'')});if(event.id==='mill-solved'){millRevealUntil=performance.now()+(preferences.reducedMotion?100:1050);keys.clear();}if(event.id==='mill-solved'&&millCompanionStaging(state)&&!millCompanionStaging(state)?.ready)dialogueStageRemaining=1;}
  else if(event.type==='notice'){if(event.id==='partner-arrived'){if(toastId==='partner-walk-to-plate')toast(event.text??'',event.id);}else if(event.id==='partner-rejoined'){if(toastId==='partner-call')toast(event.text??'',event.id);}else toast(event.text??'',event.id);}
  else if(event.type==='sound')audio.play(event.id);
  else if(event.type==='evolution'){
   const era=event.era??state.era;audio.setEra(era);audio.play('evolution');ui.setEvolution(era);
   evolutionRevealUntil=performance.now()+(preferences.reducedMotion?300:1400);transitionUntil=evolutionRevealUntil;ui.setToast('');toastUntil=0;toastId='';keys.clear();
  }else if(event.type==='ending'){pendingEnding=true;ui.setToast('');toastUntil=0;toastId='';actionCue=null;}
 }
 if(list.length){saveNow();showLine();}
}
function interactionBusy(){return !!pendingInteraction||!!(actionCue&&actionCue.id!=='partner'&&performance.now()<actionCue.start+actionCue.duration);}
function available(){return screen==='game'&&!dialogue.length&&!interactionBusy()&&performance.now()>=transitionUntil&&performance.now()>=millRevealUntil;}
function begin(fresh:boolean){
 const existing=loadJourney();
 // Recheck at activation: another tab may have removed or invalidated the save.
 if(!fresh&&!existing){ui.setContinue(false);setScreen('title');return;}
 if(fresh&&existing&&!window.confirm('今の冒険の記録を上書きして、新しく始めますか？'))return;
 state=fresh?createState():existing??createState();dialogue=[];pendingEnding=false;evolutionRevealUntil=0;millRevealUntil=0;dialogueStageRemaining=0;dialogueVisible=false;pendingInteraction=null;actionCue=null;resonance=false;transitionUntil=0;ui.setEvolution(null);ui.setDialogue(null);audio.setEra(state.era);setScreen('game');
 if(fresh)events(step(state,{x:0,z:0,run:false},0));
 else if(state.phase==='ending')setScreen('credits');
 else {const opening=pendingOpeningStory(state);if(opening.length)events(opening);else {const pending=pendingMemoryExplanation(state);if(pending){
  const unread:JourneyEvent[]=unreadMemoryLines(state,pending).map(({speaker,text,index})=>({type:'dialogue',id:`memory-${pending}-${index}`,speaker,text}));
  unread.push({type:'dialogue',id:`memory-light-${pending}`,speaker:'トト',text:'光が道に残った。帰り道のしるべになるね。'});events(unread);
 }}}
 showLine();saveNow();
}
function action(id:string,value?:string){
 audio.unlock();
 if(id==='volume'){preferences.volume=Math.max(0,Math.min(1,Number(value)));audio.setVolume(preferences.volume);savePreferences(preferences);return;}
 if(id==='motion'){preferences.reducedMotion=value==='true';ui.setSettings(preferences);savePreferences(preferences);return;}
 if(id==='new'){begin(true);return;}if(id==='continue'){begin(false);return;}
 if(id==='title'){saveNow();dialogue=[];dialogueVisible=false;ui.setDialogue(null);ui.setEvolution(null);setScreen('title');return;}
 if(id==='pause'&&screen==='game'){saveNow();setScreen('pause');return;}
 if(id==='resume'&&screen==='pause'){setScreen('game');return;}
 if(id==='credits'){setScreen('credits');return;}
 if(id==='next'&&screen==='game'&&dialogue.length&&dialogueVisible){const line=dialogue.shift()!;
  const opening=acknowledgeOpeningLine(state,line.id);
  const match=/^memory-(gate|water|first)-(\d+)$/.exec(line.id);
  const changed=match?acknowledgeMemoryLine(state,match[1]!,Number(match[2])):line.id.startsWith('memory-light-')&&acknowledgeMemoryExplanation(state,line.id.slice('memory-light-'.length));
  if(opening.enterWorld)events(interact(state));
  if(changed||opening.changed)saveNow();audio.play('line');showLine();keys.clear();return;}
 if(!available())return;
 if(id==='interact'){
  const memory=memoryAt(state,resonance);
  const target=context(state);
  if(memory&&!target?.enabled){
   const first=lightMemory(state,memory.id);
   const lines:JourneyEvent[]=memory.lines.map(([speaker,text],i)=>({type:'dialogue' as const,id:`memory-${memory.id}-${i}`,speaker,text}));
   if(first)lines.push({type:'dialogue',id:`memory-light-${memory.id}`,speaker:'トト',text:'光が道に残った。帰り道のしるべになるね。'});
   events(lines);if(first)toast('思い出の光が道に灯った。','memory-lit');return;
  }
  if(target?.id==='begin'&&target.enabled){const opening=beginDeskStory(state);if(opening.length){events(opening);return;}}
  const animate=target?.enabled&&(['lever-a','lever-b'].includes(target.id)||target.id==='tile'&&!state.solved[0]||['drain','stopper'].includes(target.id)&&!state.solved[1]||target.id==='latch'&&!state.gateLatched);
  if(animate&&target){const now=performance.now();keys.clear();actionCue={id:target.id,start:now,duration:preferences.reducedMotion?180:750};pendingInteraction={id:target.id,at:now+(preferences.reducedMotion?100:450)};}
  else events(interact(state));
 }
 else if(id==='partner'){const before=state.toto.waiting,beforePlate=state.toto.plate;events(partner(state));if(before!==state.toto.waiting||beforePlate!==state.toto.plate)actionCue={id:'partner',start:performance.now(),duration:preferences.reducedMotion?180:700};}
 else if(id==='rotate'){
  const previous=state.quarter;events(rotate(state));
  if(state.quarter!==previous){guardHeld=[...keys].some(k=>movementKeys.has(k));transitionUntil=performance.now()+(preferences.reducedMotion?100:280);}
 }else if(id==='resonance'){
  if(state.era<3){toast('まだ、この世界には見えていないものがある。');return;}
  resonance=!resonance;audio.play('line');toast(resonance?'ふたりの跡が浮かんだ。近づいて、Eで灯そう。':state.seen.some(id=>id.startsWith('memory-lit-'))?'共鳴を閉じた。灯した光は残っている。':'いつもの景色に戻った。');
 }
}
document.addEventListener('keydown',e=>{
 if(screen!=='game') {if(e.key==='Escape'&&screen==='pause'){e.preventDefault();action('resume');}return;}
 if(e.ctrlKey||e.altKey||e.metaKey)return;
 if(e.target instanceof HTMLInputElement)return;
 audio.unlock();
 if(movementKeys.has(e.code)||e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();if(!dialogue.length)keys.add(e.code);return;}
 if(e.repeat)return;
 if(e.code==='Escape'){e.preventDefault();action('pause');return;}
 if(e.code==='KeyE'||e.code==='Space'||e.code==='Enter'){
  // Native focused buttons keep their single browser activation path.
  if((e.code==='Space'||e.code==='Enter')&&e.target instanceof HTMLButtonElement)return;
  e.preventDefault();action(dialogue.length?'next':'interact');
 }else if(e.code==='KeyT'){e.preventDefault();action('partner');}
 else if(e.code==='KeyQ'){e.preventDefault();action('rotate');}
 else if(e.code==='KeyR'){e.preventDefault();action('resonance');}
});
document.addEventListener('keyup',e=>{keys.delete(e.code);if(![...keys].some(k=>movementKeys.has(k)))guardHeld=false;});
window.addEventListener('blur',()=>{keys.clear();guardHeld=false;if(screen==='game')saveNow();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(screen==='game')saveNow();}});
window.addEventListener('beforeunload',()=>{if(screen!=='title')saveJourney(state);});
window.addEventListener('resize',()=>renderer.resize());
function frame(now:number){
 const dt=Math.min(.05,Math.max(0,(now-lastTime)/1000));lastTime=now;
 if(pendingInteraction&&screen==='game'&&now>=pendingInteraction.at){const id=pendingInteraction.id;pendingInteraction=null;const target=context(state);if(target?.id===id&&target.enabled)events(interact(state));else actionCue=null;}
 if(actionCue&&now>=actionCue.start+actionCue.duration)actionCue=null;
 if(millRevealUntil&&now>=millRevealUntil){millRevealUntil=0;showLine();}
 if(transitionUntil&&now>=transitionUntil){transitionUntil=0;ui.setEvolution(null);if(evolutionRevealUntil){evolutionRevealUntil=0;showLine();}}
 if(toastUntil&&now>toastUntil){ui.setToast('');toastUntil=0;toastId='';}
 const active=available()&&!guardHeld;
 const input={x:active?(Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))):0,z:active?(Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))):0,run:active&&(keys.has('ShiftLeft')||keys.has('ShiftRight'))};
 const before={x:state.player.x,z:state.player.z};
 if(active)events(step(state,input,dt));
 else if(screen==='game'&&state.phase==='world'&&state.mode==='walk'&&performance.now()>=transitionUntil&&(dialogue.length>0||interactionBusy()))events(stepCompanion(state,dt));
 if(screen==='game'&&dialogueStageRemaining>0){dialogueStageRemaining=Math.max(0,dialogueStageRemaining-dt);if(dialogueStageRemaining===0||millCompanionStaging(state)?.ready){dialogueStageRemaining=0;showLine();}}
 const moving=Math.hypot(state.player.x-before.x,state.player.z-before.z)>.0001;
 if(moving)audio.step(input.run&&state.era>=1);
 if((moving&&now-lastSave>2000)||(wasMoving&&!moving)){saveNow();}wasMoving=moving;
 if(screen!=='title'){
  const actualContext=context(state),memory=memoryAt(state,resonance);
  const shownContext=dialogue.length?null:actualContext?.enabled?actualContext:memory?{id:`memory-${memory.id}`,label:memoryLit(state,memory.id)?'ふたりの思い出を聞く':'思い出を灯す',hint:memory.title,point:memory.point,enabled:true}:actualContext;
  const focusContext=available()&&!guardHeld&&shownContext?.enabled?shownContext:null;
  ui.render(state,shownContext,objective(state));
  const interactButton=document.getElementById('journey-interact') as HTMLButtonElement;
  if(interactionBusy())interactButton.disabled=true;interactButton.setAttribute('aria-busy',String(interactionBusy()));
  renderer.render(state,screen==='game'?dt:0,{reducedMotion:preferences.reducedMotion,quality:'normal',resonance,focusActionId:focusContext?.id,focusActionPoint:focusContext?.point,speaker:!dialogueBlocked()&&dialogue[0]?(dialogue[0].speaker==='トト'?'toto':'player'):undefined,expression:!dialogueBlocked()?dialogue[0]?.expression??'neutral':'neutral',action:actionCue?{id:actionCue.id,progress:Math.min(1,(now-actionCue.start)/actionCue.duration)}:undefined});
 }
 requestAnimationFrame(frame);
}
ui.canvas.tabIndex=0;ui.canvas.setAttribute('aria-label','ゲーム画面。WASDか矢印キーで移動、Eで近くを調べる。');
requestAnimationFrame(frame);

// Read-only telemetry for automated input tests. Removed from production by Vite.
if(import.meta.env.DEV)Object.defineProperty(window,'__journeyProbe',{value:()=>({state:structuredClone(state),screen,dialogue:dialogue[0]??null,context:context(state),guardHeld,transition:performance.now()<transitionUntil||interactionBusy()||dialogueBlocked(),action:actionCue?{id:actionCue.id,progress:Math.min(1,(performance.now()-actionCue.start)/actionCue.duration)}:null})});
