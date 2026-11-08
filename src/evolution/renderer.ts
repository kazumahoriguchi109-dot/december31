import * as THREE from 'three';
import { createRoomArt } from '../journey/roomArt';
import { roomCameraFrame } from '../journey/roomCamera';
import { ROOM_X_SCALE } from '../journey/roomPresentation';
import { createJourneyActor, pixelActor as approvedPixelActor } from '../journey/actorArt';
import { poseJourneyActor } from '../journey/acting';
import { getScene, WIRE_ROUTES, circuitReady, type State } from './model';

export interface EvolutionRenderOptions {room?:boolean;speaker?:'主人公'|'トト';reducedMotion?:boolean}
export function createRenderer(canvas:HTMLCanvasElement){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#111b29');const camera=new THREE.OrthographicCamera(-7,7,7,-7,.1,100);camera.up.set(0,1,0);
 scene.add(new THREE.HemisphereLight(0xe3eeff,0x34303b,2.4));const sun=new THREE.DirectionalLight(0xffe5b0,3);sun.position.set(-4,14,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;scene.add(sun);
 const room=new THREE.Group();createRoomArt(room);room.visible=false;scene.add(room);
 const characters=[createJourneyActor('player'),createJourneyActor('toto')];characters.forEach(a=>scene.add(a));
 const pixels=[approvedPixelActor('player'),approvedPixelActor('toto')];pixels.forEach(p=>scene.add(p.sprite));
 const lastPositions=[{x:0,z:0},{x:0,z:0}],facings=[0,0];let lastStage=-1;
 function resize(){const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);const dpr=Math.min(devicePixelRatio,2);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr))renderer.setSize(width,height,false);return {width,height,aspect:width/height};}
 function pose(index:number,options:EvolutionRenderOptions,roomView=false){poseJourneyActor(characters[index]!,{kind:index?'toto':'player',speaking:options.speaker===(index?'トト':'主人公'),expression:roomView?'curious':'neutral',waiting:index!==0,walk:0,time:performance.now()/1000,reducedMotion:options.reducedMotion??false});}
 function renderRoom(options:EvolutionRenderOptions){signature='';group.visible=false;room.visible=true;canvas.style.filter='';scene.background=new THREE.Color('#263238');pixels.forEach(p=>p.sprite.visible=false);
  characters.forEach((actor,i)=>{actor.visible=true;actor.scale.setScalar(1.05);actor.position.set((i?.85:-.65)*ROOM_X_SCALE,.52*1.05,.5);actor.rotation.y=i?-Math.PI/2:Math.PI/2;pose(i,options,true);});
  const {width,height,aspect}=resize(),frame=roomCameraFrame(width,height);camera.left=-8*aspect;camera.right=8*aspect;camera.top=8;camera.bottom=-8;camera.zoom=frame.zoom;camera.up.set(0,1,0);camera.position.set(0,frame.targetY+frame.rise,frame.targetZ+frame.run);camera.lookAt(0,frame.targetY,frame.targetZ);camera.updateProjectionMatrix();renderer.render(scene,camera);
 }
 let group=new THREE.Group();scene.add(group);let signature='';let materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[],textures:THREE.Texture[]=[];
 function material(color:string|number,glow=false){const m=new THREE.MeshStandardMaterial({color,roughness:.8,emissive:glow?color:0,emissiveIntensity:glow?.3:0});materials.push(m);return m;}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,color:string|number,glow=false){const g=new THREE.BoxGeometry(w,h,d);geometries.push(g);const m=new THREE.Mesh(g,material(color,glow));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
 function label(text:string,x:number,y:number,z:number,color='#ffffff',size=.62){const c=document.createElement('canvas');const measure=c.getContext('2d')!;measure.font='600 38px system-ui';c.width=Math.ceil(measure.measureText(text).width+28);c.height=64;const ctx=c.getContext('2d')!;ctx.font='600 38px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#152131';ctx.lineWidth=7;ctx.strokeText(text,c.width/2,32);ctx.fillStyle=color;ctx.fillText(text,c.width/2,32);const tex=new THREE.CanvasTexture(c);textures.push(tex);const mat=new THREE.SpriteMaterial({map:tex,depthTest:false});materials.push(mat);const sp=new THREE.Sprite(mat);sp.position.set(x,y,z);sp.scale.set(size*c.width/64,size,1);group.add(sp);}
 function actorMarker(x:number,z:number,h:number){const g=new THREE.RingGeometry(.34,.40,32);geometries.push(g);const m=new THREE.MeshBasicMaterial({color:0xffdf9e,side:THREE.DoubleSide,transparent:true,opacity:.8});materials.push(m);const ring=new THREE.Mesh(g,m);ring.rotation.x=-Math.PI/2;ring.position.set(x,h+.025,z);group.add(ring);}
 function render(state:State,options:EvolutionRenderOptions={}){if(options.room){renderRoom(options);return;}room.visible=false;group.visible=true;camera.zoom=1;const v=getScene(state);const sig=JSON.stringify([v,state.stage]);if(sig!==signature){signature=sig;scene.remove(group);materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials=[];geometries=[];textures=[];group=new THREE.Group();scene.add(group);
  const mono=v.view==='mono',dark=v.view==='dark';canvas.style.filter=mono?'grayscale(1)':'';scene.background=new THREE.Color(dark?'#090e18':mono?'#202328':v.view==='color'?'#627f83':'#738b92');
  for(const tile of v.tiles){if(dark)continue;if(tile.kind==='wire')continue;const wall=tile.kind==='wall';const water=tile.kind==='shaft';const height=wall?0:tile.height??0;const base=mono?(wall?'#60656a':'#b5b5ad'):(wall?'#50677a':water?'#315d71':((tile.x+tile.z)%2?'#dbe0d7':'#d1d9d0'));if(tile.kind==='gate'){box(tile.x,height+.6,tile.z,.9,1.2,.12,mono?'#eeeeee':'#dc9a74');}
   if(tile.label&&['△','○','□'].includes(tile.label))label(tile.label,tile.x,height+.15,tile.z,'#faf6de',.38);if(!water){box(tile.x,height-.18,tile.z,.98,.32,.98,mono?'#777d7c':'#72827c');box(tile.x,height-.015,tile.z,.97,.035,.97,base);if(wall)box(tile.x,(tile.height||1.2)/2,tile.z,.9,tile.height||1.2,.9,base);}else box(tile.x,-.35,tile.z,.96,.12,.96,base);}
  if(state.stage===2){
   WIRE_ROUTES.forEach((route,i)=>{const tint=['#f2a29a','#9ed4f3','#ffe48e'][i]!;const offset=(i-1)*.20;const height=.09+i*.08;
    route.slice(1).forEach((p,j)=>{const prev=route[j]!;const x1=prev.x+(j===0?0:offset),z1=prev.z+(j===0?0:offset),x2=p.x+(j===route.length-2?0:offset),z2=p.z+(j===route.length-2?0:offset);const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);const under=box((x1+x2)/2,height-.015,(z1+z2)/2,.21,.04,len+.1,'#182b36');under.rotation.y=Math.atan2(dx,dz);const cable=box((x1+x2)/2,height+.02,(z1+z2)/2,.10,.04,len+.04,state.wires[i]?tint:'#73858b',state.wires[i]);cable.rotation.y=Math.atan2(dx,dz);
    });label(['△','○','□'][i]!,route[1]!.x+offset,height+.15,route[1]!.z+offset,tint,.29);
   });
   label('レバー：入 / 切',3,.2,6.15,'#ffffff',.32);
  }
  if(state.stage>=4&&state.stage<=6){label('昔の部屋',1,.2,.15,'#ffffff',.38);label('今の部屋',5,.2,-.7,'#ffffff',.38);label('つながる通路',3.4,.2,7.5,'#ffffff',.30);}
  // Physical conduits identify cause and effect, not which input solves the room.
  function conduit(points:number[][],active:boolean){points.slice(1).forEach((p,i)=>{const q=points[i]!;const dx=p[0]!-q[0]!,dz=p[1]!-q[1]!;const mesh=box((p[0]!+q[0]!)/2,.11,(p[1]!+q[1]!)/2,.09,.06,Math.hypot(dx,dz),mono?'#ffffff':active?'#ffe5a3':'#728c98',active);mesh.rotation.y=Math.atan2(dx,dz);});}
  if(state.stage===2){conduit([[1,1],[1,.45],[3,.45],[3,0]],!state.wires[1]);conduit([[3,1],[3,0]],state.wires[2]);conduit([[5,1],[5,.45],[3,.45],[3,0]],state.wires[0]);}
  if(state.stage===3)conduit([[1,5],[1,4],[3,4],[3,3]],state.latch||state.actors.some(p=>p.x===1&&p.z===5));
  if(state.stage===4||state.stage===6)conduit([[1,1],[2.5,1],[2.5,3],[5,3]],state.gear===2);
  if(state.stage===5){label('乗り場 □',5,.2,6.45,'#ffffff',.32);}
  for(const d of v.devices){const h=d.kind==='platform'?state.platform:v.tiles.find(t=>t.x===d.x&&t.z===d.z)?.height??0;const on=d.active;const color=mono?(on?'#ffffff':'#53585e'):(on?'#e8c87e':'#657b87');const k=d.kind as string;if(k==='wire'){const symbol=d.label.slice(-1);const released=symbol==='○'?!on:on;box(d.x,h+.12,d.z,.75,.20,.75,released?'#acc8aa':'#657b87');if(!released)box(d.x,h+.36,d.z,.70,.18,.16,'#f0d7a2');label(released?'解除':'固定',d.x,h+.2,d.z+.45,'#ffffff',.24);}
   else if(k==='portal'||k==='gate'||k==='door'){box(d.x-.4,h+.65,d.z,.12,1.3,.18,'#577080');box(d.x+.4,h+.65,d.z,.12,1.3,.18,'#577080');box(d.x,h+1.32,d.z,.94,.14,.22,color);if(!on&&(k!=='portal'||state.stage===2))box(d.x,h+.62,d.z,.65,1.2,.08,color);}else if(k==='plate'){box(d.x,h+.04,d.z,.72,.07,.72,color,on);}else if(k==='platform'){box(d.x,h+.12,d.z,.82,.22,.82,color,on);}else if(k==='chest'){box(d.x,h+.25,d.z,.72,.48,.5,'#957454');box(d.x,h+.3,d.z+.26,.13,.16,.04,'#efd08d');}else {box(d.x,h+.24,d.z,.55,.46,.55,mono?'#555d62':'#456678');const handle=box(d.x,h+.66,d.z,.12,.45,.12,color,on);handle.rotation.z=on?-.6:.6;box(d.x,h+.9,d.z,.32,.10,.14,color);}
   const text=k==='portal'?(state.stage===2?'出口 '+(circuitReady(state)?'開':'閉'):'出口'):k==='platform'?d.label:k==='chest'?(state.stage===5?(state.key?'':'かけら △'):'宝箱'):d.label;if(text)label(text,d.x,h+1.65,d.z,on?'#ffe4a6':'#e9f2ef',state.stage===2?.31:.38);if(state.stage===2&&k==='lever')label(on?'入':'切',d.x,h+.2,d.z+.42,'#ffffff',.26);
  }
  v.actors.forEach((a,i)=>{const h=state.riding===i?state.platform:v.tiles.find(t=>t.x===a.x&&t.z===a.z)?.height??0;if(i===state.active)actorMarker(a.x,a.z,h);});
  const center=new THREE.Vector3(3,0,4);if(v.view==='dark'){camera.up.set(0,1,0);camera.position.set(3,10,12);camera.lookAt(center);}else if(v.view==='mono'||v.view==='color'){camera.position.set(3,19,4.001);camera.up.set(0,0,-1);camera.lookAt(center);}else {camera.up.set(0,1,0);const offsets=[[0,13,16],[-16,13,0],[0,13,-16]];const p=offsets[v.camera]??offsets[0]!;camera.position.set(3+p[0]!,p[1]!,4+p[2]!);camera.lookAt(center);}
 }
 v.actors.forEach((a,i)=>{const h=state.riding===i?state.platform:v.tiles.find(t=>t.x===a.x&&t.z===a.z)?.height??0;const previous=lastPositions[i]!;if(lastStage===state.stage&&(a.x!==previous.x||a.z!==previous.z))facings[i]=Math.atan2(a.x-previous.x,a.z-previous.z);else if(lastStage!==state.stage)facings[i]=0;lastPositions[i]={...a};
  const flat=v.view==='mono'||v.view==='color';const actor=characters[i]!,pixel=pixels[i]!;actor.visible=!flat;pixel.sprite.visible=flat;actor.scale.setScalar(.62);actor.position.set(a.x,h+.52*.62,a.z);actor.rotation.y=facings[i]!+Math.PI;pose(i,options);pixel.sprite.scale.set(.64,.96,1);pixel.sprite.position.set(a.x,h+.025,a.z);pixel.update(v.view==='color'?1:0,facings[i]!,0,{reducedMotion:options.reducedMotion??false,speaking:options.speaker===(i?'トト':'主人公')});
 });lastStage=state.stage;
 const {aspect}=resize();const horizontalSpan=v.view==='three'?4.8:3.5;const span=aspect<1?Math.max(4.6,horizontalSpan/aspect):4.8;camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();renderer.render(scene,camera);
 }
 return {render};
}
