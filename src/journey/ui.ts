import type { ContextAction, JourneyState, Expression } from './contract';
import { MAP, distance } from './contract';
import type { DialogueEmotion } from '../ui/portraits';
import { materialPortrait } from './materialPortrait';
import keyart from '../../assets/art/backgrounds/title-winter-v1.png';
import './style.css';

type Screen = 'title' | 'game' | 'pause' | 'credits';
export interface JourneyUI {
 canvas: HTMLCanvasElement;
 render(state: JourneyState, context: ContextAction | null, objective: string): void;
 setScreen(screen: Screen): void;
 setDialogue(line: {speaker: string; text: string; expression?: Expression} | null): void;
 setToast(text: string): void;
 setEvolution(era: number | null): void;
 setContinue(has: boolean): void;
 setSettings(settings: {volume: number; reducedMotion: boolean}): void;
 setSaveStatus(text: string): void;
}
const ERA_NAMES = ['雪の道', '彩りの道', '奥行きの道', 'ふたりの道'];
const EVOLUTIONS = [
 {title:'世界へ、一歩', keys:'WASD / 矢印 歩く'},
 {title:'走る・合図ができる', keys:'Shift 走る · T 合図'},
 {title:'横からも見られる', keys:'Q 見回す'},
 {title:'ふたりの跡が見える', keys:'R 共鳴'},
];
// Prefer the authored performance from the controller; older callers retain a conservative text fallback.
const EXPRESSION: Record<Expression, DialogueEmotion> = {neutral:'neutral',curious:'question',surprised:'surprise',relieved:'relief'};
function emotionFor(line:{text:string;expression?:Expression}):DialogueEmotion {
 if(line.expression)return EXPRESSION[line.expression];
 if(/[？?]|かな|かも|なんで|でも、まだ/.test(line.text))return 'question';
 if(/あれ……|本当に、ゲーム|体が軽い|横があった|氷の下にも/.test(line.text))return 'surprise';
 if(/戻ってきた|一緒に帰ろう|いっしょに遊ぼう|橋も下り|もう離れても|門は閉じない|歩いて来られた|ありがとう/.test(line.text))return 'relief';
 return 'neutral';
}
const text = (node: HTMLElement, value: string) => { if (node.textContent !== value) node.textContent = value; };
const show = (node: HTMLElement, visible: boolean) => { node.hidden = !visible; };

/** UI receives projections of the journey. All game commands go through the controller. */
export function createUI(root: HTMLElement, onAction: (id: string, value?: string) => void): JourneyUI {
 root.innerHTML = `<div class="journey-app" data-screen="title">
  <canvas id="journey-world" aria-label="ふたりで歩く冬の世界" tabindex="0"></canvas>
  <div class="journey-vignette" aria-hidden="true"></div>
  <div id="journey-game-ui" class="journey-game-ui" hidden>
   <header class="journey-hud">
    <div class="journey-objective"><span class="journey-eyebrow" id="journey-era">雪の道</span><p id="journey-objective"></p><div class="journey-progress" aria-label="仕掛けの進み具合">${Array.from({length:6},(_,i)=>`<i data-puzzle="${i}" aria-hidden="true"></i>`).join('')}</div></div>
    <div class="journey-hud-end"><div class="journey-status-row"><span id="journey-save"></span><button class="journey-icon-button" data-action="pause" aria-label="ひと休み。Escでも開きます">Ⅱ<span>ひと休み</span></button></div><div id="journey-evolution" class="journey-evolution" role="status" aria-live="polite" aria-atomic="true" hidden><h2 id="journey-evolution-title"></h2><p id="journey-evolution-keys"></p></div></div>
   </header>
   <p id="journey-walk-help" class="journey-walk-help"><kbd>WASD</kbd> / <kbd>↑↓←→</kbd> 歩く</p>
   <div class="journey-bottom" id="journey-bottom">
    <div class="journey-context" id="journey-context" hidden><p id="journey-context-hint"></p><button class="journey-button journey-interact" data-action="interact" id="journey-interact"><kbd>E</kbd><span id="journey-context-label">調べる</span><span class="journey-space">/ Space</span></button></div>
    <nav class="journey-abilities" aria-label="できること"><button data-action="partner" id="journey-partner" hidden><kbd>T</kbd><span id="journey-partner-label">トトに声をかける</span><small id="journey-partner-state" role="status" hidden></small></button><button data-action="rotate" id="journey-rotate" hidden><kbd>Q</kbd><span>見回す</span></button><button data-action="resonance" id="journey-resonance" hidden><kbd>R</kbd><span>共鳴</span></button></nav>
   </div>
   <section id="journey-dialogue" class="journey-dialogue" aria-labelledby="journey-speaker" hidden><div class="journey-portrait" id="journey-portrait" aria-hidden="true"></div><div class="journey-dialogue-copy"><h2 id="journey-speaker"></h2><p id="journey-line" role="status" aria-live="polite" aria-atomic="true"></p></div><button class="journey-button journey-next" data-action="next"><span>つづきを聞く</span><kbd aria-hidden="true">E</kbd></button></section>

   <p id="journey-toast" class="journey-toast" role="status" aria-live="polite" hidden></p>
  </div>
  <section id="journey-title" class="journey-screen journey-title" aria-labelledby="journey-title-heading">
   <img class="journey-title-art" src="${keyart}" width="1672" height="941" fetchpriority="high" alt=""/><div class="journey-title-shade" aria-hidden="true"></div>
   <div class="journey-title-copy">
    <div class="journey-title-emblem" aria-hidden="true"><span></span>✧<span></span></div>
    <h1 id="journey-title-heading" aria-label="12月31日"><span class="journey-date-number">12</span><span class="journey-date-unit">月</span><span class="journey-date-number">31</span><span class="journey-date-unit">日</span></h1>
    <div class="journey-title-rule" aria-hidden="true"><span></span></div>
    <nav class="journey-title-menu" aria-label="タイトルメニュー">
     <button class="journey-title-option" data-action="new" id="journey-new">冒険をする</button>
     <div class="journey-continue-row"><button class="journey-title-option" data-action="continue" id="journey-continue" disabled aria-describedby="journey-continue-note">続きから</button><p id="journey-continue-note">まだ冒険の記録がありません</p></div>
     <button class="journey-title-option" id="journey-title-settings-button" aria-haspopup="dialog" aria-controls="journey-title-settings">設定</button>
    </nav>
   </div>
   <p class="journey-title-help">↑ ↓ 選ぶ<span>·</span>Enter 決定</p>
  </section>
  <dialog id="journey-title-settings" class="journey-settings-dialog journey-paper" aria-labelledby="journey-settings-heading">
   <h2 id="journey-settings-heading">設定</h2>
   <fieldset class="journey-settings"><legend>心地よく遊ぶために</legend><label for="journey-title-volume">音の大きさ <output id="journey-title-volume-output">70%</output></label><input id="journey-title-volume" type="range" min="0" max="1" step="0.05" value="0.7"/><label class="journey-check"><input id="journey-title-motion" type="checkbox"/>動きをひかえめにする</label></fieldset>
   <button class="journey-button" id="journey-title-settings-close" autofocus>戻る</button>
  </dialog>
  <section id="journey-pause" class="journey-screen journey-pause" aria-labelledby="journey-pause-heading" hidden><div class="journey-paper"><p class="journey-eyebrow">冒険は、ここで待っている</p><h1 id="journey-pause-heading">ひと休み</h1><div class="journey-menu"><button class="journey-button journey-primary" data-action="resume">冒険へ戻る <span>→</span></button></div><fieldset class="journey-settings"><legend>心地よく遊ぶために</legend><label for="journey-volume">音の大きさ <output id="journey-volume-output">70%</output></label><input id="journey-volume" type="range" min="0" max="1" step="0.05" value="0.7"/><label class="journey-check"><input id="journey-motion" type="checkbox"/>動きをひかえめにする</label></fieldset><div class="journey-control-guide"><p><kbd>WASD</kbd> / <kbd>↑↓←→</kbd> 歩く</p><p><kbd>E</kbd> / <kbd>Space</kbd> 近くを調べる</p><p id="journey-pause-extra"></p><p><kbd>Esc</kbd> ひと休み / 戻る</p></div><button class="journey-text-button" data-action="title">タイトルへ</button></div></section>
  <section id="journey-credits" class="journey-screen journey-credits" aria-labelledby="journey-credits-heading" hidden><div class="journey-paper"><p class="journey-eyebrow">また、いっしょに。</p><h1 id="journey-credits-heading">12月31日</h1><p class="journey-credit-lead">ふたりの冒険を、遊んでくれてありがとう。</p><dl><dt>企画・制作</dt><dd>Kazuma Horiguchi</dd><dt>制作支援</dt><dd>Claude Code / Codex</dd><dt>描画</dt><dd>Three.js</dd></dl><p class="journey-credit-note">冬の風景とふたりの物語。<br/>それぞれの素材の利用条件は、プロジェクトのライセンス記録に保存しています。</p><button class="journey-button journey-primary" data-action="title">タイトルへ <span>→</span></button></div></section>
 </div>`;
 const get = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
 const app=root.querySelector<HTMLElement>('.journey-app')!, canvas=get<HTMLCanvasElement>('journey-world');
 const game=get('journey-game-ui'), bottom=get('journey-bottom'), dialogue=get('journey-dialogue'), walkHelp=get('journey-walk-help');
 const contextBox=get('journey-context'), contextLabel=get('journey-context-label'), contextHint=get('journey-context-hint'), interact=get<HTMLButtonElement>('journey-interact');
 const partner=get('journey-partner'), rotate=get('journey-rotate'), resonance=get('journey-resonance');
 const objectiveNode=get('journey-objective'), eraNode=get('journey-era'), progress=root.querySelector<HTMLElement>('.journey-progress')!, marks=[...root.querySelectorAll<HTMLElement>('[data-puzzle]')];
 const toast=get('journey-toast'), evolution=get('journey-evolution');
 let screen:Screen='title', talking=false, dialogueKey='', observed=false, toastTimer:ReturnType<typeof setTimeout>|undefined;
 let lastEra=-1, lastSolved='', lastPhase='', lastPartnerStatus='';
 root.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLButtonElement>('[data-action]');if(button&&!button.disabled){onAction(button.dataset['action']!);}});
 const settingsDialog=get<HTMLDialogElement>('journey-title-settings'), settingsButton=get<HTMLButtonElement>('journey-title-settings-button');
 const titleMenu=root.querySelector<HTMLElement>('.journey-title-menu')!;
 const focusTitle=()=>{(get<HTMLButtonElement>('journey-continue').disabled?get('journey-new'):get('journey-continue')).focus({preventScroll:true});};
 settingsButton.addEventListener('click',()=>{if(screen==='title'&&!settingsDialog.open)settingsDialog.showModal();});
 get('journey-title-settings-close').addEventListener('click',()=>settingsDialog.close());
 settingsDialog.addEventListener('close',()=>{if(screen==='title')settingsButton.focus({preventScroll:true});});
 titleMenu.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowUp','ArrowDown'].includes(event.key))return;
  const buttons=[...titleMenu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
  event.preventDefault();buttons[(current+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
 });
 function syncSettings(settings:{volume:number;reducedMotion:boolean}){
  for(const prefix of ['journey','journey-title']){
   get<HTMLInputElement>(`${prefix}-volume`).value=String(settings.volume);
   text(get(`${prefix}-volume-output`),`${Math.round(settings.volume*100)}%`);
   get<HTMLInputElement>(`${prefix}-motion`).checked=settings.reducedMotion;
  }
  app.dataset['reducedMotion']=String(settings.reducedMotion);
 }
 for(const prefix of ['journey','journey-title']){
  get<HTMLInputElement>(`${prefix}-volume`).addEventListener('input',event=>{
   const value=(event.target as HTMLInputElement).value;
   syncSettings({volume:Number(value),reducedMotion:get<HTMLInputElement>(`${prefix}-motion`).checked});onAction('volume',value);
  });
  get<HTMLInputElement>(`${prefix}-motion`).addEventListener('change',event=>{
   const checked=(event.target as HTMLInputElement).checked;
   syncSettings({volume:Number(get<HTMLInputElement>(`${prefix}-volume`).value),reducedMotion:checked});onAction('motion',String(checked));
  });
 }
 canvas.tabIndex=-1;canvas.inert=true;
 function syncExploration(){app.dataset['talking']=String(talking);show(bottom,screen==='game'&&!talking);show(walkHelp,screen==='game'&&!talking&&!observed);show(dialogue,screen==='game'&&talking);}
 return {
  canvas,
  render(state,context,objective){
   text(objectiveNode,objective);
   observed=state.mode==='observe';app.dataset['mode']=state.mode;
   if(lastEra!==state.era||lastPhase!==state.phase){
    lastEra=state.era;lastPhase=state.phase;app.dataset['era']=String(state.era);app.dataset['phase']=state.phase;
    text(eraNode,state.phase==='room'||state.phase==='ending'?'いつもの部屋':ERA_NAMES[state.era]!);
    text(walkHelp, state.era>=1?'WASD / ↑↓←→ 歩く　 ·　 Shift 走る':'WASD / ↑↓←→ 歩く');
    text(get('journey-pause-extra'),[state.era>=1?'Shift 走る / T トトに声をかける':'',state.era>=2?'Q 見回す':'',state.era>=3?'R 共鳴':''].filter(Boolean).join('　 ·　 '));
   }
   const solved=state.solved.map(Boolean).join();if(lastSolved!==solved){lastSolved=solved;marks.forEach((m,i)=>m.classList.toggle('is-solved',!!state.solved[i]));progress.setAttribute('aria-label',`仕掛け ${state.solved.filter(Boolean).length} / 6`);}
   show(contextBox,!!context||observed);interact.disabled=!observed&&context?.enabled===false;
   text(contextLabel,observed?'観測をやめる':context?.label??'調べる');text(contextHint,observed?'':context?.hint??'');
   show(partner,state.era>=1&&!observed&&state.phase==='world');show(rotate,state.era>=2&&!observed&&state.phase==='world');show(resonance,state.era>=3&&!observed&&state.phase==='world');
   const moving=state.toto.plate!==null&&!state.toto.waiting;
   const platePoint=state.toto.plate==='gate'?MAP.gatePlate:state.toto.plate==='front'?MAP.frontPlate:state.toto.plate==='back'?MAP.backPlate:null;
   const occupied=moving&&platePoint!==null&&distance(state.player,platePoint)<.65&&distance(state.toto,platePoint)<1.2;
   const partnerStatus=occupied?'blocked':moving?'moving':state.toto.waiting?'waiting':'following';
   if(lastPartnerStatus!==`${partnerStatus}:${state.toto.plate}`){lastPartnerStatus=`${partnerStatus}:${state.toto.plate}`;text(get('journey-partner-label'),moving?'トトを呼び戻す':state.toto.waiting?'トトを呼ぶ':'トトに声をかける');const note=get('journey-partner-state');text(note,occupied?'印を少し空けよう':moving?'印へ向かっている':state.toto.waiting?(state.toto.plate?'印で待っている':'ここで待っている'):'');show(note,moving||state.toto.waiting);partner.dataset['partnerState']=partnerStatus;partner.classList.toggle('is-waiting',state.toto.waiting);}
   syncExploration();
  },
  setScreen(next){
   if(settingsDialog.open&&next!=='title')settingsDialog.close();
   screen=next;app.dataset['screen']=next;canvas.tabIndex=next==='game'?0:-1;canvas.inert=next!=='game';
   show(game,next==='game'||next==='pause');for(const name of ['title','pause','credits'] as const)show(get(`journey-${name}`),name===next);syncExploration();
   if(next==='title'){focusTitle();return;}
   const focus=next==='game'?canvas:next==='pause'?get('journey-pause').querySelector<HTMLButtonElement>('[data-action="resume"]'):get('journey-credits').querySelector('button');focus?.focus({preventScroll:true});
  },
  setDialogue(line){
   talking=!!line;
   if(line){const key=`${line.speaker}\n${line.text}\n${line.expression??''}`;if(key!==dialogueKey){dialogueKey=key;text(get('journey-speaker'),line.speaker);text(get('journey-line'),line.text);const emotion=emotionFor(line);get('journey-portrait').innerHTML=materialPortrait(line.speaker,emotion); dialogue.dataset['speaker']=line.speaker==='トト'?'toto':'player';dialogue.dataset['emotion']=emotion;}}
   else dialogueKey='';syncExploration();
  },
  setToast(value){clearTimeout(toastTimer);text(toast,value);show(toast,!!value);if(value)toastTimer=setTimeout(()=>show(toast,false),4500);},
  setEvolution(era){show(evolution,era!==null);if(era===null){text(get('journey-evolution-title'),'');text(get('journey-evolution-keys'),'');delete evolution.dataset['era'];return;}const entry=EVOLUTIONS[Math.max(0,Math.min(3,era))]!;text(get('journey-evolution-title'),entry.title);text(get('journey-evolution-keys'),entry.keys);evolution.dataset['era']=String(era);},
  setContinue(has){
   const button=get<HTMLButtonElement>('journey-continue');button.disabled=!has;
   show(get('journey-continue-note'),!has);
   if(has)button.removeAttribute('aria-describedby');else button.setAttribute('aria-describedby','journey-continue-note');
   if(!has&&document.activeElement===button)get('journey-new').focus({preventScroll:true});
  },
  setSettings:syncSettings,
  setSaveStatus(value){text(get('journey-save'),value);},
 };
}
