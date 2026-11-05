import { MAP, distance, heightAt, inControlArea, type Actor, type ContextAction, type InputFrame, type JourneyEvent, type JourneyState, type Point } from './contract';

const RADIUS = .28, INTERACT = 1.65, PLATE = .9;
const transient = new WeakMap<JourneyState, { path:Point[]; blocked:string; initialized:boolean;rejoining:boolean }>();
const runtime = (s:JourneyState) => { let r=transient.get(s); if(!r){r={path:[],blocked:'',initialized:false,rejoining:false};transient.set(s,r);} return r; };
const notice=(id:string,text:string):JourneyEvent=>({type:'notice',id,text});
const line=(id:string,text:string,speaker:'主人公'|'トト'='トト'):JourneyEvent=>({type:'dialogue',id,text,speaker});
const sound=(id:string):JourneyEvent=>({type:'sound',id});
const once=(s:JourneyState,id:string,events:JourneyEvent[])=>{if(s.seen.includes(id))return [];s.seen.push(id);return events;};
const platePoint=(plate:JourneyState['toto']['plate']):Point|null=>plate==='gate'?MAP.gatePlate:plate==='front'?MAP.frontPlate:plate==='back'?MAP.backPlate:null;
const onPlate=(actor:Point,plate:Point)=>distance(actor,plate)<=PLATE;

export function createState():JourneyState {
 return {version:3,phase:'room',player:{x:0,z:1.3,facing:Math.PI},toto:{x:1,z:1.1,facing:Math.PI,waiting:false,plate:null},era:0,quarter:0,mode:'walk',p1:0,p2Drain:true,p2Stopper:true,gateLatched:false,wallSeen:false,ringA:0,ringB:1,solved:[false,false,false,false,false,false],portalOpen:false,seen:[],steps:0};
}

export function gateOpen(s:JourneyState):boolean {
 return s.gateLatched || onPlate(s.player,MAP.gatePlate) || onPlate(s.toto,MAP.gatePlate);
}

/** Collision is evaluated in short substeps; a held direction never tunnels across a locked gate. */
function obstruction(s:JourneyState,p:Point,from:Point,following=false):string {
 if(s.phase==='room')return Math.abs(p.x)>3.7 || p.z< -3.7 || p.z>2.7?'room':'';
 if(p.x< -12+RADIUS || p.x>12-RADIUS || p.z< -65+RADIUS || p.z>8-RADIUS)return 'edge';
 if(s.era<3 && p.z>3.35)return 'rear';
 for(const control of [MAP.drainControl,MAP.stopperControl]){
  if(distance(p,{x:control.x-.85,z:control.z-.6})<.65)return 'mill';
 }
 if(p.x> -9.2&&p.x< -2.8&&p.z> -21.8&&p.z< -16.5)return 'mill';
 if(p.x> -7.7&&p.x< -6.3&&p.z> -17&&p.z< -14.9)return 'mill';
 if(distance(p,{x:1.8,z:-5.25})<.5)return 'tile';
 if(Math.abs(p.x-MAP.tile.x)<1.8 && Math.abs(p.z-MAP.tile.z)<1.8)return 'tile';
 if(!s.solved[0] && Math.abs(p.z+10)<.55)return 'p01';
 if(p.z< -21.7 && p.z> -24.3 && (!s.solved[1] || Math.abs(p.x)>1.7))return 'water';
 if(Math.abs(p.z+35)<.6 && (Math.abs(p.x)>1.5 || !gateOpen(s)))return 'gate';
 if(!s.wallSeen && p.x>6.2 && p.x<10.8 && p.z< -42.8 && p.z> -49)return 'wall';
 if(Math.abs(heightAt(p)-heightAt(from))>.16)return 'cliff';
 if(!s.portalOpen && Math.abs(p.z-4)<.42 && Math.abs(p.x)<1.65)return 'frame';
 if(!following && s.toto.plate==='gate' && (p.z> -25.2 || p.z< -40.5))return 'friend';
 return '';
}
const blockCopy:Record<string,string>={mill:'装置の手前に、二つの操作ハンドルがある。',tile:'台の上には乗れない。右側のハンドルを回せそうだ。',p01:'線の先で、道が閉じている。',water:'流れが深い。このままでは渡れない。',gate:'門はまだ閉じている。',wall:'白い壁の形が気になる。',cliff:'段差が大きい。歩ける道を探そう。',rear:'枠の向こうは、まだ平らに見える。',frame:'枠の脇を回ってみよう。',friend:'トトと合流してから先へ進もう。'};

function moveActor(s:JourneyState,actor:Actor,dx:number,dz:number,following=false):string {
 const from={x:actor.x,z:actor.z};let reason='';
 for(const [axis,delta] of [['x',dx],['z',dz]] as const){
  if(!delta)continue;const next={x:actor.x,z:actor.z};next[axis]+=delta;
  const blocked=obstruction(s,next,actor,following);
  if(!blocked)actor[axis]=next[axis];else reason=blocked;
 }
 const mx=actor.x-from.x,mz=actor.z-from.z;if(Math.hypot(mx,mz)>.00001)actor.facing=Math.atan2(mx,mz);
 return reason;
}

function clearSegment(s:JourneyState,a:Point,b:Point):boolean {
 const n=Math.max(1,Math.ceil(distance(a,b)/.08));let previous=a;
 for(let i=1;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n};if(obstruction(s,p,previous,true))return false;previous=p;}
 return true;
}

/** Reconstruct a safe trail after reload; movement history is deliberately not saved. */
function recoverTrail(s:JourneyState,goal:Point=s.player):Point[] {
 const start=s.toto;
 if(clearSegment(s,start,goal))return [{x:goal.x,z:goal.z}];
 const id=(x:number,z:number)=>`${x},${z}`,point=(key:string)=>{const [x,z]=key.split(',').map(Number);return {x:x!*.5,z:z!*.5};};
 const candidates:Point[]=[];
 for(let x=Math.round(start.x*2)-1;x<=Math.round(start.x*2)+1;x++)for(let z=Math.round(start.z*2)-1;z<=Math.round(start.z*2)+1;z++){
  const p={x:x*.5,z:z*.5};if(clearSegment(s,start,p))candidates.push(p);
 }
 candidates.sort((a,b)=>distance(a,start)-distance(b,start));const first=candidates[0];if(!first)return [];
 const initial=id(Math.round(first.x*2),Math.round(first.z*2)),open=[initial],cost=new Map([[initial,0]]),parent=new Map<string,string>(),closed=new Set<string>();
 let found:string|null=null;
 while(open.length&&closed.size<7500){
  let best=0,bestScore=Infinity;
  for(let i=0;i<open.length;i++){const key=open[i]!,score=cost.get(key)!+distance(point(key),goal);if(score<bestScore){best=i;bestScore=score;}}
  const key=open.splice(best,1)[0]!,at=point(key);if(closed.has(key))continue;closed.add(key);
  if(distance(at,goal)<.8&&clearSegment(s,at,goal)){found=key;break;}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const nx=Math.round(at.x*2)+dx!,nz=Math.round(at.z*2)+dz!;if(nx< -23||nx>23||nz< -129||nz>15)continue;
   const nk=id(nx,nz);if(closed.has(nk))continue;const next={x:nx*.5,z:nz*.5};if(!clearSegment(s,at,next))continue;
   const nc=cost.get(key)!+distance(at,next);if(nc>=(cost.get(nk)??Infinity))continue;cost.set(nk,nc);parent.set(nk,key);open.push(nk);
  }
 }
 if(!found)return [];
 const route:Point[]=[{x:goal.x,z:goal.z}];let key:string|undefined=found;
 while(key){route.push(point(key));key=parent.get(key);}route.reverse();
 return route;
}

export function movingToPlate(s:JourneyState):boolean {return s.toto.plate!==null&&!s.toto.waiting;}

function advanceToPlate(s:JourneyState,dt:number):void {
 const goal=platePoint(s.toto.plate);if(!goal)return;
 const r=runtime(s);if(!r.initialized){r.path=recoverTrail(s,goal);r.initialized=true;}
 while(r.path.length>1&&distance(s.toto,r.path[0]!)<.08)r.path.shift();
 const target=r.path[0];if(!target)return;
 const d=distance(s.toto,target),travel=Math.min(d,3*dt),count=Math.max(1,Math.ceil(travel/.08));
 for(let i=0;i<count;i++){
  const left=distance(s.toto,target);if(left<.000001)break;
  const amount=Math.min(left,travel/count);
  const next={x:s.toto.x+(target.x-s.toto.x)/left*amount,z:s.toto.z+(target.z-s.toto.z)/left*amount};
  // Wait just short of an occupied footprint; neither child pushes the other.
  if(distance(s.player,goal)<.6&&distance(next,s.player)<.85)break;
  moveActor(s,s.toto,next.x-s.toto.x,next.z-s.toto.z,true);
 }
 if(distance(s.toto,goal)<.000001){s.toto.waiting=true;r.path=[];s.toto.facing=Math.atan2(s.player.x-s.toto.x,s.player.z-s.toto.z);}
}

export function millCompanionStaging(s:JourneyState):{target:Point;ready:boolean;directPathClear:boolean}|null {
 if(s.phase!=='world'||(!inControlArea(s.player,'drain')&&!inControlArea(s.player,'stopper')))return null;
 const target={x:s.player.x+1.15,z:s.player.z};
 if([MAP.drainControl,MAP.stopperControl].some(c=>distance(target,{x:c.x-.85,z:c.z-.6})<1))target.z+=1.5;
 return {target,ready:distance(s.toto,target)<.08,directPathClear:clearSegment(s,s.toto,target)};
}

function advanceFriend(s:JourneyState,dt:number):void {
 if(s.toto.waiting)return;
 if(movingToPlate(s)){advanceToPlate(s,dt);return;}
 const r=runtime(s);if(!r.initialized){r.path=recoverTrail(s);r.initialized=true;}const last=r.path.at(-1);
 if(!last || distance(last,s.player)>.18)r.path.push({x:s.player.x,z:s.player.z});
 if(r.path.length>500)r.path.splice(0,r.path.length-500);
 while(r.path.length>1 && distance(s.toto,r.path[0]!)<.16)r.path.shift();
 // At the first control, stand beside the player so both silhouettes stay
 // outside the plinth and its pattern remains visible in the fixed early view.
 const millControl=inControlArea(s.player,'drain')?MAP.drain:inControlArea(s.player,'stopper')?MAP.stopper:null;
 if(s.phase==='world' && (millControl || (s.era<2 && inControlArea(s.player,'tile')))){
  const beside=millCompanionStaging(s)?.target??{x:s.player.x+1.15,z:s.player.z};
  if(distance(s.toto,s.player)<2 && clearSegment(s,s.toto,beside)){
   const d=distance(s.toto,beside),travel=Math.min(d,3*dt);
   if(d>.02)moveActor(s,s.toto,(beside.x-s.toto.x)/d*travel,(beside.z-s.toto.z)/d*travel,true);
   const focus=millControl??MAP.tile;s.toto.facing=Math.atan2(focus.x-s.toto.x,focus.z-s.toto.z);
   r.path=[{x:s.player.x,z:s.player.z}];return;
  }
 }
 // Old breadcrumbs can run through the player's current position after a turn.
 // Once the final approach is unobstructed, reserve a metre of personal space.
 const separation=distance(s.player,s.toto);
 const finalApproach=separation<1.4 && clearSegment(s,s.toto,s.player);
 if(finalApproach){
  r.path=[{x:s.player.x,z:s.player.z}];
  if(separation<.95){
   const dx=separation>.001?(s.toto.x-s.player.x)/separation:Math.sin(s.player.facing+Math.PI/2);
   const dz=separation>.001?(s.toto.z-s.player.z)/separation:Math.cos(s.player.facing+Math.PI/2);
   const retreat=Math.min(1.05-separation,2*dt);
   moveActor(s,s.toto,dx*retreat,dz*retreat,true);
   s.toto.facing=Math.atan2(s.player.x-s.toto.x,s.player.z-s.toto.z);
   return;
  }
  if(separation<=1.05)return;
 }
 const target=r.path[0];if(!target)return;
 const d=distance(s.toto,target);if(d<.02)return;
 const travel=Math.min(d,4.9*dt,finalApproach?Math.max(0,separation-1.05):Infinity),n=Math.max(1,Math.ceil(travel/.1));
 for(let i=0;i<n;i++)moveActor(s,s.toto,(target.x-s.toto.x)/Math.max(distance(s.toto,target),.0001)*travel/n,(target.z-s.toto.z)/Math.max(distance(s.toto,target),.0001)*travel/n,true);
}

/** Advance only the companion during dialogue/actions; puzzle transitions wait for step(). */
export function stepCompanion(s:JourneyState,dt:number):JourneyEvent[] {
 if(s.phase==='ending'||s.mode!=='walk')return [];
 const wasMoving=movingToPlate(s);
 advanceFriend(s,Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0)));
 if(wasMoving&&s.toto.waiting)return [notice('partner-arrived','トトは足形の上で待っている。')];
 const r=runtime(s);
 if(r.rejoining&&s.toto.plate===null&&distance(s.player,s.toto)<=1.1){r.rejoining=false;return [notice('partner-rejoined','トトと合流した。')];}
 return [];
}

function consequences(s:JourneyState):JourneyEvent[] {
 const ev:JourneyEvent[]=[];
 if(s.solved[0] && !s.solved[1] && !s.p2Drain && !s.p2Stopper){
  s.solved[1]=true;ev.push(sound('solve'),line('mill-solved','水が車輪に届いた。橋も下りてきたね。'));
 }
 if(s.gateLatched && !s.solved[2] && s.toto.plate===null && s.player.z< -36 && s.toto.z< -35.7 && distance(s.player,s.toto)<1.65){
  s.solved[2]=true;s.era=2;ev.push({type:'evolution',id:'depth',era:2,text:'奥行きが生まれた'},line('depth-control','横からも見られる。Qで、世界を回してみよう。'));
 }
 if(s.wallSeen && !s.solved[3] && s.player.z< -49.7){
  s.solved[3]=true;ev.push(sound('solve'),line('wall-solved','模様だと思っていたところを、歩いて来られた。','主人公'));
 }
 if(s.solved[4] && !s.portalOpen){
  const opposite=(onPlate(s.player,MAP.frontPlate)&&onPlate(s.toto,MAP.backPlate))||(onPlate(s.player,MAP.backPlate)&&onPlate(s.toto,MAP.frontPlate));
  if(opposite){s.portalOpen=true;s.solved[5]=true;ev.push(sound('solve'),line('portal-open','二つの光が重なった。もう離れても、消えないね。'),line('portal-rejoin','一緒に帰ろう。トトを呼んで、枠へ戻ろう。','主人公'));}
 }
 return ev;
}

export function step(s:JourneyState,input:InputFrame,dt:number):JourneyEvent[] {
 if(s.phase==='ending')return [];
 const ev:JourneyEvent[]=[];
 if(s.phase==='room')ev.push(...once(s,'room-intro',[line('room-intro','今年もいっしょに遊ぼう。机のところまで歩いてみて。')]));
 if(s.mode!=='walk')return ev;
 const seconds=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
 let ix=Number.isFinite(input.x)?input.x:0,iz=Number.isFinite(input.z)?input.z:0;
 const len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len;}
 const q=s.quarter*Math.PI/2,c=Math.cos(q),sn=Math.sin(q),speed=input.run&&s.era>=1?4.8:3;
 const dx=(ix*c+iz*sn)*speed*seconds,dz=(-ix*sn+iz*c)*speed*seconds;
 const before={x:s.player.x,z:s.player.z},count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.09));let blocked='';
 for(let i=0;i<count;i++)blocked=moveActor(s,s.player,dx/count,dz/count)||blocked;
 const moved=distance(before,s.player);s.steps+=moved;
 const r=runtime(s);
 if(blocked && blocked!==r.blocked && blockCopy[blocked]){
  const events=[notice(`blocked-${blocked}`,blockCopy[blocked]!)];
  ev.push(...(blocked==='tile'||blocked==='mill'?once(s,`${blocked}-control-hint`,events):events));
 }
 r.blocked=blocked;
 ev.push(...stepCompanion(s,seconds));
 if(s.phase==='world'){
  if(s.solved[1]&&!s.solved[2]&&distance(s.player,MAP.gatePlate)<4)ev.push(...once(s,'gate-intro',[line('gate-intro','足元の印がある。近づいてみよう。')]));
  if(s.solved[2]&&!s.solved[3]&&distance(s.player,MAP.wall)<4)ev.push(...once(s,'wall-intro',[line('wall-intro','ここ、前から見えていた白い模様だ。','主人公')]));
  if(s.solved[3]&&!s.solved[4]&&distance(s.player,MAP.observe)<4)ev.push(...once(s,'ring-intro',[line('ring-intro','レバーと、丸いのぞき口がある。動かしたら、そこから見てみよう。')]));
  ev.push(...consequences(s));
 }
 return ev;
}

export function context(s:JourneyState):ContextAction|null {
 if(s.phase==='ending')return null;
 const action=(id:string,label:string,hint:string,point:Point,enabled=true):ContextAction=>({id,label,hint,point,enabled});
 if(s.mode==='observe')return action('leave-observe','観測台から離れる','Eで戻る',MAP.observe);
 if(s.phase==='room')return distance(s.player,MAP.console)<=INTERACT?action('begin','いっしょに始める','二人のいつものゲーム',MAP.console):null;
 const options:ContextAction[]=[];
 options.push(action('footprints','ふたりの足跡を見る','雪の上に、違う大きさの足跡',{x:-6,z:-5}));
 if(s.solved[0])options.push(action('pond','凍った池をのぞく','氷の下に、細い光が見える',{x:7,z:-18}));
 if(s.solved[2])options.push(action('post','標柱を調べる','いつから、こんな形だったんだろう',{x:-6,z:-40}));
 options.push(action('tile',s.solved[0]?'光る石を調べる':'ハンドルを回す',s.solved[0]?'線はつながったまま':'つなぎ口の向きを変える',MAP.tileControl));
 if(s.solved[0]){
  options.push(action('drain',s.solved[1]?'水の流れを見る':s.p2Drain?'排水口を閉じる':'排水口を開く',s.p2Drain?'水は横の穴へ流れている':'水は車輪へ流れている',MAP.drainControl));
  options.push(action('stopper',s.solved[1]?'水車を調べる':s.p2Stopper?'止め具を外す':'止め具を戻す',s.p2Stopper?'車輪が固定されている':'車輪は自由に回れる',MAP.stopperControl));
 }
 if(s.solved[1]){
  if(!s.gateLatched&&s.toto.plate===null)options.push(action('wait','トトにここで待ってもらう','Tでも指示できる',MAP.gatePlate));
  options.push(action('latch',s.gateLatched?'留め金を調べる':'留め金を固定する',s.gateLatched?'門は開いたまま':'門を開いたままにする留め金',MAP.latch));
 }
 if(s.solved[2])options.push(action('wall',s.wallSeen?'白い段を調べる':s.quarter%2?'白い段を調べる':'白い模様を調べる',s.wallSeen?'上まで続いている':'見る向きによって形が違う',MAP.wall));
 if(s.solved[3]){
  options.push(action('lever-a','レバーAを動かす',`板A：${['手前','中央','奥'][s.ringA]}`,MAP.leverA,!s.solved[4]));
  options.push(action('lever-b','レバーBを動かす',`板B：${['手前','中央','奥'][s.ringB]}`,MAP.leverB,!s.solved[4]));
  options.push(action('observe','輪をのぞく','位置を変えたら、ここで確かめる',MAP.observe));
 }
 if(s.era===3){
  if(s.toto.plate===null&&!s.portalOpen){
   options.push(action('wait','トトにここで待ってもらう','Tでも指示できる',MAP.frontPlate));
   options.push(action('wait','トトにここで待ってもらう','Tでも指示できる',MAP.backPlate));
  }
  options.push(action('portal',s.portalOpen?'一緒に帰る':'光る枠を調べる',s.portalOpen?(s.toto.plate!==null?'Tでトトを呼ぼう':distance(s.player,s.toto)>1.8?'トトが来るのを待とう':'二人で部屋へ戻る'):'入口に二つの光が残っている',MAP.portal,!s.portalOpen||(s.toto.plate===null&&distance(s.player,s.toto)<=1.8)));
 }
 return options.filter(a=>a.id==='drain'||a.id==='stopper'||a.id==='tile'?inControlArea(s.player,a.id):distance(s.player,a.point)<=INTERACT).sort((a,b)=>distance(s.player,a.point)-distance(s.player,b.point))[0]??null;
}

export function interact(s:JourneyState):JourneyEvent[] {
 const a=context(s);if(!a)return [notice('nothing-near','近づくと、調べられるものが分かる。')];
 if(!a.enabled)return [notice('context-unavailable',a.hint)];
 const ev:JourneyEvent[]=[];
 switch(a.id){
  case 'footprints':return once(s,'discovery-footprints',[line('discovery-footprints','ぼくらの足跡、少しずつ形が違う。ここまで本当に歩いてきたんだ。','主人公')]).concat(notice('footprints-memory','二人の足跡が、雪の上に並んでいる。'));
  case 'pond':return once(s,'discovery-pond',[line('discovery-pond','氷の下にも、光が動いてる。止まって見えたけど、ちゃんと流れてたんだね。')]).concat(notice('pond-memory','氷の下で、光がゆっくり流れている。'));
  case 'post':return once(s,'discovery-post',[line('discovery-post','さっきまで、一本の線みたいだったのに。横があったんだ。','主人公')]).concat(notice('post-memory','見る向きで、標柱の形が変わって見える。'));
  case 'begin':s.phase='world';s.player={...MAP.spawn,facing:Math.PI};s.toto={x:1,z:.4,facing:Math.PI,waiting:false,plate:null};runtime(s).path=[];ev.push(line('arrival-one','あれ……本当に、ゲームの中にいる。','主人公'),line('arrival-two','道の先に城がある。まずは、あの光る石まで行ってみよう。'));break;
  case 'tile':
   s.player.facing=Math.atan2(MAP.tile.x-s.player.x,MAP.tile.z-s.player.z);
   if(s.solved[0])return [notice('tile-memory','二つの光が、つながった線に残っている。')];
   s.p1=(s.p1+1)%4;ev.push(sound('press'));
   if(s.p1===1){s.solved[0]=true;s.era=1;ev.push({type:'evolution',id:'colour',era:1,text:'世界に色が満ちた'},line('colour-control','体が軽い。Shiftで走れる。Tでぼくに待ってもらうこともできるよ。'));}break;
  case 'drain':if(s.solved[1])return [notice('water-memory','水は車輪へ届き、橋は下りたままだ。')];s.p2Drain=!s.p2Drain;ev.push(sound('press'));break;
  case 'stopper':if(s.solved[1])return [notice('mill-memory','水車が回る音がする。')];s.p2Stopper=!s.p2Stopper;ev.push(sound('press'));break;
  case 'wait':return partner(s);
  case 'latch':if(s.gateLatched)return [notice('latch-memory','留め金が、門を開いたまま支えている。')];s.gateLatched=true;ev.push(sound('press'),line('latch-fixed','これで門は閉じない。Tでトトを呼ぼう。','主人公'));break;
  case 'wall':
   if(!s.wallSeen&&s.quarter%2===0)return [notice('wall-front','白い線が、段の形に並んでいる。')];
   if(!s.wallSeen){s.wallSeen=true;ev.push(line('wall-recognized','上まで続いている。自分で歩いて上れそうだ。','主人公'));}
   else ev.push(notice('wall-known','白い段は、上の道へ続いている。'));break;
  case 'lever-a':s.ringA=((s.ringA+1)%3) as 0|1|2;ev.push(sound('press'));break;
  case 'lever-b':s.ringB=((s.ringB+1)%3) as 0|1|2;ev.push(sound('press'));break;
  case 'observe':
   s.mode='observe';
   if(!s.solved[4]&&s.ringA===1&&s.ringB===2){s.solved[4]=true;s.era=3;ev.push({type:'evolution',id:'resonance',era:3,text:'ふたりの光が、世界に残る'},line('ring-complete','輪がつながった。……でも、まだゲームの中だ。','主人公'),line('resonance-control','入口の枠が光ってる。Rで、残った光を確かめられる。いっしょに戻ろう。'));}
   else if(!s.solved[4])ev.push(notice('ring-mismatch','輪の端が、まだそろっていない。'));
   break;
  case 'leave-observe':s.mode='walk';break;
  case 'portal':
   if(!s.portalOpen)return [notice('frame-observation','こちら側にも、向こう側にも、同じ印がある。')];
   s.phase='ending';s.mode='walk';s.quarter=0;s.player={x:0,z:0,facing:Math.PI};s.toto={x:.9,z:.1,facing:Math.PI,waiting:false,plate:null};runtime(s).path=[];
   ev.push(line('home-one','戻ってきた……。二人とも、ここにいる。','主人公'),line('home-two','同じ画面なのに、さっきよりいろんなものが見えるね。'),{type:'ending',id:'home'});break;
 }
 ev.push(...consequences(s));return ev;
}

export function partner(s:JourneyState):JourneyEvent[] {
 if(s.phase!=='world'||s.mode!=='walk'||s.era<1)return [notice('partner-locked','今は、いっしょに進もう。')];
 if(s.toto.plate!==null){
  if(s.toto.plate==='gate'&&!s.gateLatched&&s.player.z< -34.4)return [notice('call-unsafe','まだ門が固定されていない。戻ってから呼ぼう。')];
  const route:Point[]=[];
  if(s.toto.plate==='gate'&&s.player.z< -35)route.push({x:0,z:-33},{x:0,z:-37});
  if((s.toto.plate==='front'&&s.player.z>4)||(s.toto.plate==='back'&&s.player.z<4))route.push({x:2.3,z:s.toto.z},{x:2.3,z:s.player.z});
  route.push({x:s.player.x,z:s.player.z});runtime(s).path=route;runtime(s).initialized=true;
  s.toto.waiting=false;s.toto.plate=null;runtime(s).rejoining=true;return [sound('press'),notice('partner-call','トトがこちらへ歩いてくる。')];
 }
 const choices:JourneyState['toto']['plate'][]=[];
 if(s.solved[1]&&!s.gateLatched)choices.push('gate');
 if(s.era===3&&!s.portalOpen)choices.push('front','back');
 const target=choices.map(plate=>({plate,point:platePoint(plate)!})).filter(v=>distance(v.point,s.player)<=INTERACT).sort((a,b)=>distance(a.point,s.player)-distance(b.point,s.player))[0];
 if(!target)return [notice('partner-no-place','足形の近くで、待ってもらおう。')];
 s.toto.waiting=false;s.toto.plate=target.plate;runtime(s).rejoining=false;runtime(s).path=recoverTrail(s,target.point);runtime(s).initialized=true;
 return [sound('press'),notice('partner-walk-to-plate','トトが足形まで歩いていく。')];
}

export function rotate(s:JourneyState):JourneyEvent[] {
 if(s.phase!=='world'||s.mode!=='walk'||s.era<2)return [notice('view-locked','今は、正面から見える道を進もう。')];
 s.quarter=((s.quarter+1)%4) as 0|1|2|3;return [sound('press')];
}

export function objective(s:JourneyState):string {
 if(s.phase==='room')return 'トトとゲームを始めよう';
 if(s.phase==='ending')return 'ふたりで、帰ってきた';
 if(s.portalOpen)return s.toto.plate!==null?'トトと合流して、一緒に帰ろう':'光る枠から、二人で帰ろう';
 if(!s.solved[0])return '城への道を探そう';
 if(!s.solved[1])return '水車のある川を渡ろう';
 if(!s.solved[2])return s.gateLatched?'トトと門の先へ':'二人で門を越えよう';
 if(!s.solved[3])return '高台へ続く道を探そう';
 if(!s.solved[4])return '高台の仕掛けを確かめよう';
 return '二人で元の世界へ帰ろう';
}

/** A new save namespace must never interpret an old anchor save as a walkable-world state. */
export function validateSave(value:unknown):JourneyState|null {
 if(!value||typeof value!=='object')return null;
 const s=value as JourneyState;
 if(s.version!==3||!['room','world','ending'].includes(s.phase)||!['walk','observe'].includes(s.mode))return null;
 if(!Number.isInteger(s.era)||s.era<0||s.era>3||!Number.isInteger(s.quarter)||s.quarter<0||s.quarter>3)return null;
 if(!Number.isInteger(s.p1)||s.p1<0||s.p1>3||![s.ringA,s.ringB].every(n=>Number.isInteger(n)&&n>=0&&n<=2))return null;
 if(![s.p2Drain,s.p2Stopper,s.gateLatched,s.wallSeen,s.portalOpen].every(v=>typeof v==='boolean'))return null;
 if(!Array.isArray(s.solved)||s.solved.length!==6||!s.solved.every(v=>typeof v==='boolean'))return null;
 if(s.solved.some((v,i)=>v&&i>0&&!s.solved[i-1]))return null;
 if(!Array.isArray(s.seen)||s.seen.length>100||!s.seen.every(v=>typeof v==='string'&&v.length<=80))return null;
 if(!Number.isFinite(s.steps)||s.steps<0||s.steps>1e8)return null;
 const validActor=(a:Actor)=>a&&typeof a==='object'&&Number.isFinite(a.x)&&Number.isFinite(a.z)&&Number.isFinite(a.facing)&&Math.abs(a.facing)<=Math.PI+.001;
 if(!validActor(s.player)||!validActor(s.toto)||typeof s.toto.waiting!=='boolean'||![null,'gate','front','back'].includes(s.toto.plate))return null;
 if(s.toto.waiting&&s.toto.plate===null)return null;
 const expectedEra=s.solved[4]?3:s.solved[2]?2:s.solved[0]?1:0;
 if(s.era!==expectedEra||(s.era<2&&s.quarter!==0))return null;
 if(s.solved[0]&&s.p1!==1||s.solved[1]&&(s.p2Drain||s.p2Stopper)||s.gateLatched&&!s.solved[1]||s.solved[2]&&!s.gateLatched||s.wallSeen&&!s.solved[2]||s.solved[3]&&!s.wallSeen||s.solved[4]&&(s.ringA!==1||s.ringB!==2)||s.portalOpen!==s.solved[5])return null;
 if(!s.solved[0]&&(!s.p2Drain||!s.p2Stopper)||!s.solved[3]&&(s.ringA!==0||s.ringB!==1))return null;
 if(s.phase==='room'&&(s.solved.some(Boolean)||s.toto.plate!==null)||s.phase==='ending'&&(!s.portalOpen||s.toto.plate!==null))return null;
 if(s.phase!=='world'){
  if(s.mode!=='walk'||[s.player,s.toto].some(p=>Math.abs(p.x)>3.71||p.z< -3.71||p.z>2.71))return null;
 }else{
  if([s.player,s.toto].some(p=>p.x< -11.73||p.x>11.73||p.z< -64.73||p.z>7.73))return null;
  if(s.player.z< -10.55&&!s.solved[0]||s.player.z< -24.3&&!s.solved[1]||s.player.z< -35.6&&!s.gateLatched&&s.toto.plate!=='gate'||s.player.z< -49&&!s.wallSeen||s.player.z>3.35&&s.era<3)return null;
  if(obstruction(s,s.player,s.player)||obstruction(s,s.toto,s.toto,true))return null;
  if(s.mode==='observe'&&(!s.solved[3]||distance(s.player,MAP.observe)>INTERACT+.01))return null;
 }
 if(s.toto.plate!==null){const p=platePoint(s.toto.plate);if(!p||(s.toto.waiting&&distance(s.toto,p)>.00001)||s.era<1||s.toto.plate==='gate'&&!s.solved[1]||s.toto.plate!=='gate'&&s.era!==3)return null;
  if(movingToPlate(s)&&recoverTrail(s,p).length===0)return null;
 }
 return {version:3,phase:s.phase,player:{x:s.player.x,z:s.player.z,facing:s.player.facing},toto:{x:s.toto.x,z:s.toto.z,facing:s.toto.facing,waiting:s.toto.waiting,plate:s.toto.plate},era:s.era,quarter:s.quarter,mode:s.mode,p1:s.p1,p2Drain:s.p2Drain,p2Stopper:s.p2Stopper,gateLatched:s.gateLatched,wallSeen:s.wallSeen,ringA:s.ringA,ringB:s.ringB,solved:[...s.solved],portalOpen:s.portalOpen,seen:[...new Set(s.seen)],steps:s.steps};
}
