/** The puzzle model is authoritative; rendering never changes puzzle state. */
export type Point = { x:number; z:number };
export type View = 'dark'|'mono'|'color'|'three';
export type Tile = Point & {height:number;kind:'floor'|'wall'|'gate'|'plate'|'shaft'|'dock'|'exit'|'wire';label?:string};
export type Device = Point & {id:string;label:string;kind:'chest'|'lever'|'gear'|'wire'|'plate'|'platform'|'portal';active:boolean};
export type State = {version:1;totoWaiting?:boolean;stage:number;actors:[Point,Point];active:0|1;gear:number;wires:[boolean,boolean,boolean];latch:boolean;platform:number;platformDirection:1|-1;riding:0|1|null;platformClock:number;key:boolean;charge:number;solved:boolean[];steps:number;message:string};
export type Scene = {tiles:Tile[];devices:Device[];actors:[Point,Point];view:View;camera:0|1|2;objective:string;context:string;status:string;affordance:string;roomName:string;room:'old'|'new'|'main';canSwitch:boolean};
export const SAVE_KEY='dec31-evolving-puzzles-v1';
const names=['まっくらな入口','トトと開ける扉','色でつながる道','先に行って待っていて','止まって考えられる部屋','待たないと来ない足場','二人でつくる帰り道','12月31日の部屋'];
const objectives=['宝箱を開けて、暗闇から出よう。','トトに門を開けてもらい、奥の合流レバーで合流しよう。','レバーで出口のロックを外そう。','門を開けて、二人とも出口へ。','隣の部屋の門を開けて、二人とも出口へ。','上の△にあるかけらを取り、二人とも出口へ。','帰り道に充電して、二人で帰ろう。','二人とも、帰ってきた。'];
export const WIRE_ROUTES:Point[][]=[
 [{x:1,z:5},{x:1,z:4},{x:2,z:4},{x:3,z:4},{x:3,z:3},{x:4,z:3},{x:5,z:3},{x:5,z:2},{x:5,z:1}],
 [{x:3,z:5},{x:3,z:4},{x:3,z:3},{x:2,z:3},{x:1,z:3},{x:1,z:2},{x:1,z:1}],
 [{x:5,z:5},{x:5,z:4},{x:4,z:4},{x:4,z:3},{x:4,z:2},{x:3,z:2},{x:3,z:1}]
];
export const circuitReady=(s:State)=>s.wires[0]&&!s.wires[1]&&s.wires[2];

const same=(a:Point,b:Point)=>a.x===b.x&&a.z===b.z;
const near=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
export function createState():State{return {version:1,totoWaiting:false,stage:0,actors:[{x:3,z:7},{x:3,z:8}],active:0,gear:0,wires:[false,false,false],latch:false,platform:0,platformDirection:1,riding:null,platformClock:0,key:false,charge:0,solved:[false,false,false,false,false,false],steps:0,message:'主人公「トト？ ……すぐ目の前に何かある。」'};}
export function roomOf(s:State,p:Point=s.actors[s.active]):'old'|'new'|'main'{return s.stage>=4&&s.stage<=6?(p.x<=2&&p.z<7?'old':'new'):'main';}
// Presentation belongs to the whole puzzle, never the selected actor's room.
// Old-room movement and clock rules remain independent of the camera.
export function getView(s:State):View{return s.stage===0?'dark':s.stage===1?'mono':s.stage===2?'color':'three';}
export function getCamera(s:State):0|1|2{return getView(s)==='three'?(s.stage===3?1:s.stage===5?2:0):0;}
function enter(s:State,stage:number){const done=s.solved.slice(),steps=s.steps;Object.assign(s,createState(),{stage,solved:done,steps});if(stage>=2)s.actors=[{x:3,z:7},{x:4,z:7}];if(stage>=4&&stage<=6)s.actors=[{x:1,z:6},{x:5,z:6}];if(stage===7)s.actors=[{x:3,z:4},{x:4,z:4}];}
function say(s:State,text:string){s.message=text;return text;}
function complete(s:State){if(s.stage>=1&&s.stage<=6)s.solved[s.stage-1]=true;const n=s.stage+1;enter(s,n);return say(s,n===2?'トト「色がついた！ 線が、別々の行き先につながってる。」':n===3?'主人公「奥行きがある……。今度は二人で別の場所を歩けるよ。」':n===4?'トト「この部屋は昔のまま。隣は今の時間で動いているね。」':n===7?'12月31日。窓の外に、いつもの町があった。二人「ただいま。」':names[n]+'。二人で先へ進もう。');}
export function resetRoom(s:State):string{const stage=s.stage;enter(s,stage);return say(s,'この部屋の入口から、もう一度。前の部屋の記録は残っています。');}
function floor(s:State,p:Point):boolean{
 if(!Number.isInteger(p.x)||!Number.isInteger(p.z)||p.x<0||p.x>6||p.z<0||p.z>8)return false;
 if(s.stage===0||s.stage===1)return p.x===3;
 if(s.stage===7)return p.x>=1&&p.x<=5&&p.z>=1&&p.z<=7;
 if(s.stage===3&&p.x===4&&p.z===2)return false;
 if(s.stage===5&&p.z===0&&p.x!==6)return false;
 if(s.stage<=3)return p.x>=1&&p.x<=5&&p.z<=7;
 return (p.x===1&&p.z>=1&&p.z<=7)||(p.z===7&&p.x>=1&&p.x<=6)||(p.x>=4&&p.x<=6&&p.z<=7);
}
export function isGateOpen(s:State):boolean{return s.stage===1?s.latch||!!s.totoWaiting&&s.actors[1].z===5:s.stage===3?s.latch||s.actors.some(p=>same(p,{x:1,z:5})):s.stage===4?s.latch||s.gear===2:s.stage===6?s.charge>=1:true;}
function gateAt(s:State,p:Point):boolean{return s.stage===1?p.z===3:s.stage===3?p.z===3:s.stage===4?p.x>=4&&p.z===3:s.stage===6?p.x>=4&&p.z===2:false;}
function shaftAt(s:State,p:Point){return s.stage===5&&p.x===5&&p.z>=1&&p.z<=5;}
function advancePlatform(s:State){if(s.platform===2)s.platformDirection=-1;else if(s.platform===0)s.platformDirection=1;s.platform+=s.platformDirection;if(s.riding!==null)s.actors[s.riding]={x:5,z:5-s.platform*2};}
export function move(s:State,dx:number,dz:number):string{
 if(!Number.isInteger(dx)||!Number.isInteger(dz)||Math.abs(dx)+Math.abs(dz)!==1)return '';
 if(s.stage===0)return say(s,'暗くて道が見えない。目の前の留め金に手を伸ばそう。');
 if(s.stage===7)return '';
 if(s.riding===s.active)return say(s,'足場に乗っている。着いた場所で「調べる」を押すと降りられる。');
 if((s.stage===1||roomOf(s)==='old')&&dx!==0)return say(s,'この部屋では、上と下だけに歩ける。');
 const p=s.actors[s.active],next={x:p.x+dx,z:p.z+dz};
 if(!floor(s,next))return say(s,'壁がある。別の道を探そう。');
 if(s.stage>=3&&same(next,s.actors[1-s.active]!))return say(s,'仲間がいる。切り替えて少し場所を空けよう。');
 if(s.stage===3&&next.z===3&&next.x!==3)return say(s,'門の通り道は中央だけ。');
 const nextGear=(s.gear+1)%3;
 if(gateAt(s,next)&&!(isGateOpen(s)))return say(s,s.stage===1?'門は閉じている。トトを白い印で待機させよう。':'道は閉じている。もう一人のいる場所を見てみよう。');
 if(s.stage===5&&!s.key&&next.x===6&&next.z<=3)return say(s,'上の道には段差がある。足場でかけらを取ると、帰りの階段が開く。');
 if(shaftAt(s,next))return say(s,'ここは足場の通り道。下の乗り場で足場を待とう。');
 s.actors[s.active]=next;s.steps++;
 if(s.stage>=4&&roomOf(s,p)==='old'){s.gear=nextGear;if(s.stage===5)advancePlatform(s);}
 if(s.stage===2||(s.stage===1&&!s.totoWaiting))s.actors[1]={x:p.x,z:p.z};
 return say(s,s.stage===1?(s.latch?'門は開いたまま。出口へ進もう。':s.totoWaiting?'トトが印で待機中。門は開いている。':s.actors[1].z===5?'トトが白い印に乗った。待機をお願いできる。':'トトと白い印へ進もう。'):roomOf(s,p)!==roomOf(s,next)?(roomOf(s,next)==='old'?'昔の部屋。上下に歩くたび、装置が一目盛り進む。':'今の部屋。部屋の向きに合わせて、四方向に歩ける。'):'');
}
export function switchActor(s:State):string{if(s.stage<3||s.stage===7)return say(s,'今は二人で一緒に進もう。');s.active=s.active===0?1:0;return say(s,(s.active===0?'主人公':'トト')+'を操作中。'+(roomOf(s)==='old'?'昔の部屋では、動いた分だけ時間が進む。':'今の部屋の様子を見よう。'));}
export function tick(s:State,seconds:number):string{
 if(!Number.isFinite(seconds)||seconds<=0||s.stage<5||s.stage>6||roomOf(s)!=='new')return '';
 const dt=Math.min(seconds,1);
 if(s.stage===5){s.platformClock+=dt;while(s.platformClock>=2){s.platformClock-=2;advancePlatform(s);}return '';}
 if(s.charge<1&&s.gear===2&&s.actors.some(p=>same(p,{x:5,z:3}))&&s.actors.some(p=>roomOf(s,p)==='old')){const before=s.charge;s.charge=Math.min(1,s.charge+dt/4);if(before<1&&s.charge===1)return say(s,'光とかけらが帰り道につながった。トト「ついた！ 向こうに、部屋が見える！」 主人公「待って。そっちに行くから。」 二人を出口へ集めよう。');}
 return '';
}
const togetherAtExit=(s:State)=>s.actors.every(p=>p.z<=2&&(s.stage===5?p.x===6:p.x>=3));
export function interact(s:State):string{
 const p=s.actors[s.active];
 if(s.stage===0){enter(s,1);return say(s,'宝箱の留め金が外れた。白い光が、一本の道を照らす。トト「白い印から、門へ線がつながってるね。」');}
 if(s.stage===7)return say(s,'二人の帰り道は、昔と今の両方でできていた。');
 if(s.stage===1){if(s.latch&&near(p,{x:3,z:0}))return complete(s);if(near(p,{x:3,z:1})){s.latch=true;s.totoWaiting=false;s.actors[1]={x:3,z:3};return say(s,'合流レバーで門を固定した。トトが門を通って合流した！ 出口を調べよう。');}return say(s,'白い印でトトに待機をお願いして、門の向こうへ進もう。');}
 if(s.stage===2){for(let i=0;i<3;i++)if(near(p,{x:1+i*2,z:5})){s.wires[i]=!s.wires[i];return say(s,['赤・△','青・○','黄・□'][i]+'のレバーを'+(s.wires[i]?'入れた。':'切った。')+['右のロックが'+(s.wires[i]?'外れた。':'掛かった。'),'止め具が'+(s.wires[i]?'出口を押さえた。':'離れた。'),'中央のロックが'+(s.wires[i]?'外れた。':'掛かった。')][i]);}if(near(p,{x:3,z:0})){if(circuitReady(s))return complete(s);return say(s,'扉の印は△と□。○の線は扉ではなく、止め具へ続いている。');}}
 if(s.stage===3){if(near(p,{x:5,z:1})){s.latch=true;return say(s,'柱の裏のレバーを下げた。門が開いたままになった。仲間を呼ぼう。');}if(near(p,{x:3,z:0})){if(s.latch&&togetherAtExit(s))return complete(s);return say(s,'二人とも門を越えてから、先へ進もう。');}}
 if(s.stage===4){if(!s.latch&&near(p,{x:6,z:1})){s.latch=true;return say(s,'内側のレバーで、道を開いたままにした。昔の部屋の仲間も出口へ。');}if(near(p,{x:5,z:0})){if(s.latch&&togetherAtExit(s))return complete(s);return say(s,'二人で出口に集まろう。通り抜けた先のレバーで道を固定できる。');}}
 if(s.stage===5){
  if(s.riding===s.active){if(s.platform===2){if(same(s.actors[1-s.active]!,{x:6,z:1}))return say(s,'上の降り場に仲間がいる。切り替えて場所を空けよう。');s.key=true;s.riding=null;s.actors[s.active]={x:6,z:1};return say(s,'△の印が重なった。帰り道のかけらを取って、上の足場へ降りた。帰りの広い階段が開いた。');}if(s.platform===0){if(same(s.actors[1-s.active]!,{x:5,z:6}))return say(s,'下の降り場に仲間がいる。切り替えて場所を空けよう。');s.riding=null;s.actors[s.active]={x:5,z:6};return say(s,'下の乗り場へ降りた。');}return say(s,'ここには降り場がない。△の上の乗り場か、□の下の乗り場まで待とう。');}
  if(same(p,{x:5,z:6})){if(s.riding!==null)return say(s,'仲間が足場に乗っている。下りてから交代しよう。');if(s.platform===0){s.riding=s.active;s.actors[s.active]={x:5,z:5};return say(s,'□の乗り場から足場に乗った。今の部屋では、立ち止まっていても動く。');}return say(s,'足場が□の印へ戻ってくるのを待とう。');}
  if(near(p,{x:6,z:0})){if(s.key&&togetherAtExit(s))return complete(s);return say(s,s.key?'かけらを持って、二人で出口へ。':'△の高さに、帰り道のかけらがある。');}
 }
 if(s.stage===6&&near(p,{x:5,z:0})){if(s.charge>=1&&togetherAtExit(s))return complete(s);return say(s,s.charge<1?'まだ帰り道に光が足りない。':'二人そろって帰ろう。');}
 return say(s,getScene(s).context||'床の印や装置のつながりを見てみよう。');
}
const HINTS:string[][]=[['目の前の宝箱に手を伸ばしてみよう。'],['白い印から門へ、線がつながっている。','トトが印に乗ったら、待機をお願いしてみよう。','主人公が門の手前まで進むとトトが印に乗る。「トトに待ってもらう」で門を開け、奥の合流レバーを操作しよう。'],['扉に必要な印と、線の終点を見比べよう。','色だけでなく、△・○・□の印で線をたどれる。','△と□は扉へ。○は止め具へ。○だけ切ってみよう。'],['床の印を踏むと、離れた門が開く。','切り替えた相手は、その場に待っている。','一人を○の床スイッチに残し、もう一人で門を通り、柱裏のレバーへ。'],['昔の部屋の歯車は歩くと進み、止まると止まる。','配電器の△と、新しい部屋の受け口△を合わせよう。','昔の部屋で二歩進むと△に合う。そのまま人物を切り替え、門の向こうでレバーを引こう。'],['昔の部屋では歩くと動き、今の部屋では待っても動く。','□が下の乗り場、△が上の乗り場。どちらの見方でも同じ印。','今の部屋の□で足場を待ち、調べて乗ろう。△の高さに来たら調べて降りる。'],['昔の配電器を△に合わせると、今の充電器につながる。','充電する子は今の部屋の床スイッチに立ち、もう一人は昔の部屋で止まる。','昔の子を二歩動かして△に固定。今の子を充電床へ動かして4秒待とう。完了後は二人とも出口へ。'],['二人とも帰ってきた。']];
export function getHint(s:State,level=0):string{const hints=HINTS[s.stage]??HINTS[0]!;return hints[Math.max(0,Math.min(Math.floor(level),hints.length-1))]!;}
export function getScene(s:State):Scene{
 const tiles:Tile[]=[],devices:Device[]=[];const add=(id:string,x:number,z:number,label:string,kind:Device['kind'],active=false)=>devices.push({id,x,z,label,kind,active});
 for(let z=0;z<=8;z++)for(let x=0;x<=6;x++){const p={x,z};if(!floor(s,p))continue;let kind:Tile['kind']='floor',label:string|undefined;let height=0;
 if(gateAt(s,p)&&(!isGateOpen(s)||(s.stage===3&&x!==3)))kind='gate';
 if(shaftAt(s,p))kind='shaft';
 if(s.stage===3&&x===1&&z===5){kind='plate';label='○';}
 if(s.stage===6&&x===5&&z===3){kind='plate';label='△';}
 if(s.stage===5&&x===5&&z===6){kind='dock';label='□';}
 if(s.stage===5&&x===6&&z<=4){height=Math.max(0,2-Math.max(0,z-1)*.5);label=z===1?'△':s.key?'階段':undefined;if(!s.key&&z>=2&&z<=3)kind='gate';}
 if(z===0&&x===(s.stage<=3?3:s.stage===5?6:5)){kind='exit';label='出口';}
 tiles.push({...p,height,kind,label});}
 if(s.stage===0)add('chest',3,6,'宝箱','chest');
 if(s.stage===1){add('wait-pad',3,5,s.totoWaiting?'トト：待機中':'トトの待機マス','plate',!!s.totoWaiting);add('gear',3,3,isGateOpen(s)?'門：開':'門：閉','gear',isGateOpen(s));add('release',3,1,s.latch?'合流済み':'合流レバー','lever',s.latch);}
 if(s.stage===2){for(let i=0;i<3;i++){add('wire-'+i,1+i*2,5,['赤 △','青 ○','黄 □'][i]!,'lever',s.wires[i]);for(const point of WIRE_ROUTES[i]!.slice(1,-1))tiles.push({...point,height:.03+i*.04,kind:'wire',label:['△','○','□'][i]});add('end-'+i,[5,1,3][i]!,1,['ロック △','止め具 ○','ロック □'][i]!,'wire',s.wires[i]);}}
 if(s.stage===3){tiles.push({x:4,z:2,height:2.5,kind:'wall',label:'柱'});add('plate',1,5,'門の床スイッチ ○','plate',isGateOpen(s));add('latch',5,1,'柱裏のレバー','lever',s.latch);}
 if(s.stage===4||s.stage===6){add('generator',1,1,['○','□','△'][s.gear]!+' 配電器','gear',s.gear===2);add('receiver',5,s.stage===4?3:3,s.stage===4?'受け口 △':'充電 △ '+Math.round(s.charge*100)+'%','plate',s.gear===2);if(s.stage===4)add('latch',6,1,'固定レバー','lever',s.latch);}
 if(s.stage===5){add('generator',1,1,'歩くと一目盛り','gear');add('platform',5,5-s.platform*2,['□ 下','○ 中','△ 上'][s.platform]!,'platform',true);add('key',6,1,s.key?'かけら取得済み':'かけら △','chest',s.key);}
 if(s.stage>=1&&s.stage<=6)add('exit',s.stage<=3?3:s.stage===5?6:5,0,s.stage===6?'帰り道':'次の部屋','portal',s.stage===2?circuitReady(s):s.stage===6?s.charge>=1:false);
 const p=s.actors[s.active];let context='';
 if(s.stage===1)context=s.latch&&near(p,{x:3,z:0})?'出口を調べる':near(p,{x:3,z:1})?'合流レバーを調べる':'近くの装置を調べる';else if(s.stage===0)context='宝箱を開ける';else if(s.stage===5&&s.riding===s.active)context=s.platform===2?'かけらを取って降りる':s.platform===0?'下の乗り場へ降りる':'上の降り場を待つ';else if(s.stage===5&&same(p,{x:5,z:6}))context=s.platform===0?'足場に乗る':'足場を待つ';else{const d=devices.find(d=>near(p,d)&&d.kind==='portal')??devices.find(d=>near(p,d)&&['chest','lever'].includes(d.kind)&&!(d.id==='key'&&s.key)&&!(d.id==='latch'&&s.latch));context=d?(d.id.startsWith('wire-')?d.label+'を'+(d.active?'切る':'入れる')+' E':d.label+'を調べる E'):'';}
 const guidance=getGuidance(s);
 return {...guidance,tiles,devices,actors:s.actors,view:getView(s),camera:getCamera(s),objective:(s.latch&&[3,4].includes(s.stage))||s.stage===5&&s.key||s.stage===6&&s.charge>=1?'道が開いた。二人とも出口へ集まろう。':objectives[s.stage]??'',context,roomName:names[s.stage]??'',room:roomOf(s),canSwitch:s.stage>=3&&s.stage<=6};
}
/** Observations only: the objective names the goal, not the solution. */
export function getGuidance(s:State):{status:string;affordance:string}{
 const who=(i:number)=>i?'トト':'主人公';
 const together=s.actors.filter(p=>p.z<=2&&(s.stage===5?p.x===6:p.x>=3)).length;
 const shared='装置のそばで E / 調べる。床スイッチは上に立つと反応。';
 if(s.stage===0)return {status:'目の前：宝箱',affordance:'E / 宝箱を開ける'};
 if(s.stage===1)return {status:s.latch?'門：開放固定・合流済み':s.totoWaiting?'トト：待機中・門：開':'トト：ついてくる・門：閉',affordance:'印のマスでトトに待機をお願いし、奥のレバーで合流。'};
 if(s.stage===2)return {status:`出口：${circuitReady(s)?'開いた':'閉じている'} ｜ △ ${s.wires[0]?'解除':'ロック'} ・ □ ${s.wires[2]?'解除':'ロック'} ・ ○ ${s.wires[1]?'止め具 作動':'止め具 解除'}`,affordance:'入口の3本のレバー：隣で E（入 / 切）。線は同じ印へ続く。'};
 if(s.stage===3)return {status:`門：${s.latch?'開放固定':isGateOpen(s)?'床スイッチで開いている':'閉じている'} ｜ 出口側 ${together}/2人`,affordance:'Tで二人を切替。操作しない子はその場で待つ。'+shared};
 if(s.stage===4)return {status:`配電器 ${['○','□','△'][s.gear]} → 受け口 △ ｜ 門：${s.latch?'開放固定':isGateOpen(s)?'開いている':'閉じている'} ｜ 出口側 ${together}/2人`,affordance:'昔と今は下の通路でつながる。Tで仲間のいる部屋へ切替。'};
 if(s.stage===5)return {status:`足場：${['□ 下','○ 中','△ 上'][s.platform]}${s.riding===null?'（空）':`（${who(s.riding)}が乗車）`} ｜ かけら：${s.key?'取得済み・階段開通':'未取得'} ｜ 出口側 ${together}/2人`,affordance:'□は乗り場。足場が来たら E で乗り降り。Tで人物切替。'};
 if(s.stage===6)return {status:`配電器 ${['○','□','△'][s.gear]} → 充電床 △ ｜ ${Math.round(s.charge*100)}%${s.charge>=1?'・帰り道 開通':roomOf(s)==='old'?'・今の部屋へ切替で再開':s.gear===2&&s.actors.some(p=>same(p,{x:5,z:3}))&&s.actors.some(p=>roomOf(s,p)==='old')?'・充電中':'・待機中'} ｜ 床 ${s.actors.some(p=>same(p,{x:5,z:3}))?'人がいる':'空'} ・ 昔の担当 ${s.actors.some(p=>roomOf(s,p)==='old')?'いる':'いない'} ｜ 出口側 ${together}/2人`,affordance:'充電床は上に立って使う。Tで人物切替。蓄えた光は消えない。'};
 return {status:'帰還',affordance:''};
}
/** Reject malformed, cross-version and impossible snapshots without touching any old keys. */
export function restore(raw:unknown):State|null{
 let v:unknown=raw;try{if(typeof raw==='string')v=JSON.parse(raw);}catch{return null;}
 if(!v||typeof v!=='object')return null;const s=v as State;
 if(s.version!==1||!Number.isInteger(s.stage)||s.stage<0||s.stage>7||![0,1].includes(s.active)||!Number.isInteger(s.gear)||s.gear<0||s.gear>2||!Number.isInteger(s.platform)||s.platform<0||s.platform>2||![1,-1].includes(s.platformDirection)||![null,0,1].includes(s.riding)||!Number.isFinite(s.platformClock)||s.platformClock<0||s.platformClock>=2||!Number.isFinite(s.charge)||s.charge<0||s.charge>1||!Number.isInteger(s.steps)||s.steps<0||typeof s.message!=='string'||s.message.length>2000)return null;
 if(!Array.isArray(s.actors)||s.actors.length!==2||!s.actors.every(p=>p&&floor(s,p))||!Array.isArray(s.wires)||s.wires.length!==3||!s.wires.every(x=>typeof x==='boolean')||!Array.isArray(s.solved)||s.solved.length!==6||!s.solved.every((x,i)=>typeof x==='boolean'&&x===(i<s.stage-1))||typeof s.latch!=='boolean'||typeof s.key!=='boolean')return null;
 if(s.stage<3&&s.active!==0)return null;
 if(s.stage!==5&&(s.platform!==0||s.platformClock!==0||s.riding!==null||s.key))return null;
 if(s.stage!==6&&s.charge!==0)return null;
 if(s.stage!==2&&s.wires.some(Boolean))return null;
 if(![1,3,4].includes(s.stage)&&s.latch)return null;
 if(s.stage===1&&s.actors[1].z<4&&!s.latch)return null;if(s.totoWaiting!==undefined&&typeof s.totoWaiting!=='boolean')return null;if(s.totoWaiting&&(s.stage!==1||s.actors[1].z!==5))return null;
 if(s.stage===5&&!s.key&&s.actors.some(p=>p.x===6&&p.z<=3))return null;
 if(s.riding!==null&&(s.stage!==5||!same(s.actors[s.riding],{x:5,z:5-s.platform*2})))return null;
 if(s.stage===5&&s.actors.some((p,i)=>shaftAt(s,p)&&i!==s.riding))return null;
 if(s.stage>=3&&same(s.actors[0],s.actors[1]))return null;
 return JSON.parse(JSON.stringify(s)) as State;
}

/** Device that the existing context action can operate. No remote activation or puzzle bypass. */
export function interactionDevice(s:State):string|null {
 const p=s.actors[s.active];
 if(s.stage===0)return 'chest';
 if(s.stage===1)return s.latch&&near(p,{x:3,z:0})?'exit':near(p,{x:3,z:1})?'release':null;
 if(s.stage===2){for(let i=0;i<3;i++)if(near(p,{x:1+i*2,z:5}))return 'wire-'+i;return near(p,{x:3,z:0})?'exit':null;}
 if(s.stage===3)return near(p,{x:5,z:1})?'latch':near(p,{x:3,z:0})?'exit':null;
 if(s.stage===4)return !s.latch&&near(p,{x:6,z:1})?'latch':near(p,{x:5,z:0})?'exit':null;
 if(s.stage===5){if(s.riding===s.active)return s.platform===2?'key':'platform';if(same(p,{x:5,z:6}))return 'platform';return near(p,{x:6,z:0})?'exit':null;}
 return s.stage===6&&near(p,{x:5,z:0})?'exit':null;
}

export function waitForToto(s:State):string {
 if(s.stage!==1||s.latch)return '';
 if(s.totoWaiting){s.totoWaiting=false;return say(s,'トト「また一緒に行こう。」門が閉じた。');}
 if(s.actors[1].z!==5)return say(s,'トトが白い印のマスに乗ってから、待機をお願いしよう。');
 s.totoWaiting=true;return say(s,'トト「ここで待ってる！ 向こうのレバーをお願い。」門が開いた。');
}
