import {MEMORIES} from './memories';
import * as THREE from 'three';
import {MAP,CONTROL_AREAS,isOnPlate,heightAt,distance,type JourneyState,type JourneyRenderer,type RenderOptions} from './contract';
import {poseJourneyActor} from './acting';
import {pixelActor,createJourneyActor} from './actorArt';
import {C,asset,box,cylinder,glyph,line,torus,fence,material,snowTexture,trail,snowBank,bankStones,waterTexture,lightPool,operatingArea} from './sceneArt';

/** The renderer observes state; all travel, puzzle gates and saves belong to the model. */
export function createRenderer(canvas:HTMLCanvasElement):JourneyRenderer{
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x738e97);scene.fog=new THREE.Fog(0x738e97,32,90);
 const outdoor=new THREE.Group(),room=new THREE.Group(),trees:THREE.Group[]=[];scene.add(outdoor,room);
 const hemi=new THREE.HemisphereLight(0xd8e5df,0x6d7965,2.1),sun=new THREE.DirectionalLight(0xffe0ab,2.3);sun.position.set(-10,20,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:.1,far:65});sun.shadow.bias=-.001;sun.shadow.normalBias=.03;scene.add(hemi,sun,sun.target);
 const camera=new THREE.OrthographicCamera(-16,16,10,-10,.1,150),optical=new THREE.PerspectiveCamera(56,1,.03,70);
 camera.layers.enable(1); // Optical plates are also visible as physical apparatus in the walkable world.
 const player=createJourneyActor('player'),toto=createJourneyActor('toto');for(const actor of[player,toto]){actor.scale.setScalar(1.05);actor.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=o.receiveShadow=true;}});scene.add(actor);}
 const pixels=[pixelActor('player'),pixelActor('toto')];pixels.forEach(p=>scene.add(p.sprite));
 const shadows=[player,toto].map(g=>{const m=new THREE.Mesh(new THREE.CircleGeometry(.33,16),new THREE.MeshBasicMaterial({color:0x273a36,transparent:true,opacity:.24,depthWrite:false}));m.rotation.x=-Math.PI/2;scene.add(m);return m;});
 // A continuous, bounded walkable clearing. Scenery sits outside the traversable corridor.
 const lowGround=box(outdoor,24,.5,57,0,-.25,-20.5,C.snow),highGround=box(outdoor,24,3.5,16,0,1.25,-57,C.snow);for(const g of[lowGround,highGround]){(g.material as THREE.MeshStandardMaterial).color.set(0xffffff);(g.material as THREE.MeshStandardMaterial).map=snowTexture();}
 // Until the side view is inspected, the frontal reading is a flat white pattern.
 // The proxy is presentation-only: after wallSeen every camera shows the real shared-height ramp.
 const stair=new THREE.Group(),wallPattern=new THREE.Group();outdoor.add(stair,wallPattern);
 const face=box(wallPattern,4,3,.07,8.5,1.5,-42.99,C.snow);face.material.dispose();(face as THREE.Mesh).material=new THREE.MeshBasicMaterial({color:0xe5e9de});
 for(let i=0;i<5;i++){const width=.65+i*.55;box(wallPattern,width,.045,.015,9.9-width/2,.42+i*.47,-42.94,0xa9b7af);}
 // Ground steps use the exact shared slope; white striping suggests risers without changing foot height.
 const ramp=box(stair,4,.15,Math.hypot(6,3),8.5,1.5-.075*Math.sqrt(1.25),-46,C.paper);ramp.rotation.x=Math.atan(.5);
 for(let i=0;i<12;i++){const z=-43-(i+.5)*.5;const stripe=box(stair,4,.015,.07,8.5,heightAt({x:8,z})+.025,z,i%2?C.snow:0xc6cfc7);stripe.rotation.x=Math.atan(.5);}
 for(const side of [-1,1]){for(let z=6;z>=-64;z-=3.7){const x=side*(12.35+(.3*Math.sin(z)));trees.push(asset(outdoor,z%2?'pine_snow':'pine_slender',x,heightAt({x,z}),z,1.45+Math.abs(Math.sin(z))*.4));}}
 fence(outdoor,-12,12,8);fence(outdoor,-12,12,-65,3);
 // Low edges of the plateau express the physical boundary; the right-hand stair remains open.
 for(const [a,b]of[[-12,6.2],[10.8,12]])fence(outdoor,a!,b!,-49,3);
 for(let z=4;z>-64;z-=1.35){const x=z< -43&&z> -50?8.5:z< -49?3:Math.sin(z*.12)*.9;const y=heightAt({x,z});if((z>-24&&z<-22)||(z>-8.7&&z<-3.0))continue;const path=box(z< -43&&z> -49?stair:outdoor,2.7,.025,1.5,x,y+.018,z,0xc7bb9c);if(z< -43&&z> -49)path.rotation.x=Math.atan(.5);}
 // The worn approach bends around the raised P01 table, toward the actual standing point.
 trail(outdoor,[[0,-2.6],[.3,-3.1],[1.1,-3.4],[2.4,-3.7],[3.25,-4.3],[3.3,-5.5],[3.3,-6.8],[2.8,-8.1],[1.5,-8.7],[.1,-9.1]],1.35);
 trail(outdoor,[[2.95,-5.5],[3.3,-5.5]],1.05,0xb7ae96);
 for(let i=0;i<35;i++){const z=3.5-i*1.26;if((z>-8.8&&z<-3)||(z>-24&&z<-22))continue;const x=Math.sin(z*.12)*.9;const side=i%2?-1:1;snowBank(outdoor,x+side*(1.28+(i%3)*.07),z,.22+(i%3)*.09,.26);}
 for(const [x,z,rx,rz]of[[-1.8,-4.2,.5,.2],[-1.85,-7.7,.55,.24],[1.5,-7.85,.48,.18],[1.35,-4.15,.4,.18],[2.35,-3.65,.32,.14],[3.95,-5.8,.22,.65],[3.7,-7.2,.28,.4]]as const)snowBank(outdoor,x,z,rx,rz);
 // A few footprints carry the path across the broad clearing, without masquerading as controls.
 for(let i=0;i<55;i++){const z=5-i*1.2;if(z>-24&&z<-22)continue;const x=(i%2?-.3:.3)+(z<-49?3:0);if((z<-43&&z>-49)||(z>-8.7&&z<-3.1))continue;box(outdoor,.16,.012,.3,x,heightAt({x,z})+.04,z,0xa9b6ad);}
 // Optional discoveries are physical scenery, never automatic puzzle answers.
 for(let i=0;i<7;i++){const z=-3.5-i*.45;for(const x of[-6.16,-5.84]){const f=box(outdoor,.14,.018,.27,x,.04,z,0x839b93);f.rotation.y=.25;}}glyph(outdoor,'∴',-6,.7,-5,'#d1dfd5',.5);
 const pond=new THREE.Mesh(new THREE.CircleGeometry(2.15,24),material(0x8bb7c1));pond.rotation.x=-Math.PI/2;pond.position.set(7,.035,-18);pond.scale.y=.68;outdoor.add(pond);for(let i=0;i<5;i++)box(outdoor,.7,.01,.035,6.1+i*.42,.05,-18+(i%2)*.32,0xc2d7d7);glyph(outdoor,'◇',7,.65,-18,'#d1dfd5',.5);
 box(outdoor,.42,1.25,.42,-6,.625,-40,C.stone);box(outdoor,.6,.15,.58,-6,1.3,-40,C.snow);box(outdoor,.26,.35,.025,-6,.9,-39.78,C.navy);glyph(outdoor,'▥',-6,1.7,-40,'#d1dfd5',.5);
 // Lamps and sparse winter plants frame a route while leaving the movement corridor open.
 for(const [x,z]of[[-3,-3],[4,-13],[3,-27],[-5,-38],[10.7,-48],[7,-60]]as const)asset(outdoor,'lantern',x,heightAt({x,z}),z,.8);
 for(let i=0;i<50;i++){const x=(i%2?-1:1)*(8.6+Math.sin(i*9.1)*1.5),z=6-i*1.42;if(z<-43&&z>-49)continue;const y=heightAt({x,z});for(let j=0;j<3;j++){const tuft=box(outdoor,.07,.16+j*.045,.07,x+j*.12,y+.08,z,0x708f7a);tuft.rotation.z=(j-1)*.2;}}
 for(const x of[-12,12])for(let z=7;z>-65;z-=3){const y=heightAt({x,z});box(outdoor,.13,.75,.13,x,y+.375,z,C.wood);if(z-3>-49||z<=-49)line(outdoor,new THREE.Vector3(x,y+.55,z),new THREE.Vector3(x,y+.55,z-3),.035,C.wood);}
 // P01 is a raised stone mechanism. The east crank is reached from tileControl, never over the lines.
 box(outdoor,3.5,.1,3.5,MAP.tile.x,.05,MAP.tile.z,C.stone);
 const tileBase=box(outdoor,3.2,.16,3.2,MAP.tile.x,.08,MAP.tile.z,C.navy),tile=new THREE.Group();tile.position.set(MAP.tile.x,.18,MAP.tile.z);outdoor.add(tile);
 box(tile,1.65,.06,.19,-.75,.015,0,C.gold);box(tile,.19,.06,1.65,0,.015,-.75,C.gold);cylinder(tile,.19,.07,0,.025,0,C.gold);
 for(const x of[-1.4,1.4])for(const z of[-7.4,-4.6])cylinder(outdoor,.045,.03,x,.18,z,C.gold,8);
 box(outdoor,.2,.07,1.4,0,.19,-8.2,C.paper);box(outdoor,.55,.07,.2,1.775,.19,-6,C.paper);
 cylinder(outdoor,.17,.08,2.04,.15,-6,C.stone);cylinder(outdoor,.09,.03,2.04,.21,-6,C.paper);
 const crankX=MAP.tileControl.x-.8,crankZ=MAP.tileControl.z+.25;
 box(outdoor,.42,.14,.46,crankX,.07,crankZ,C.stone);cylinder(outdoor,.09,.52,crankX,.32,crankZ,C.wood,10);
 line(outdoor,new THREE.Vector3(1.55,.14,crankZ),new THREE.Vector3(crankX,.14,crankZ),.055,C.gold);
 const crank=new THREE.Group();crank.position.set(crankX,.62,crankZ);crank.rotation.x=-Math.PI/3;outdoor.add(crank);torus(crank,.29,.045,0,0,0,C.gold);
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3;line(crank,new THREE.Vector3(),new THREE.Vector3(Math.cos(a)*.28,Math.sin(a)*.28,0),.025,C.wood);}
 const grip=cylinder(crank,.055,.17,.28,0,.065,C.wood,8);grip.rotation.x=Math.PI/2;
 // A shallow worn foot board locates the hands at the crank, without adding another floating marker.
 const controlPads=Object.fromEntries(Object.entries(CONTROL_AREAS).map(([id,area])=>[id,operatingArea(outdoor,area)]));
 for(const z of[-5.76,-5.34])box(outdoor,.11,.012,.24,MAP.tileControl.x+.35,.054,z,0x7f9386).rotation.y=Math.PI/2;
 const p1Gate=new THREE.Group();outdoor.add(p1Gate);fence(p1Gate,-12,12,-10);const p1Opening=box(p1Gate,4,1.3,.25,0,.65,-10,C.wood);
 // Waterworks: visible stream, sluice, stopped wheel, and a genuine bridge over the collision water band.
 const river=box(outdoor,24,.12,2,0,-.035,-23,C.water),riverTexture=waterTexture();river.material.color.set(0xffffff);river.material.map=riverTexture;river.material.roughness=.48;
 const banks:[number,number][]=[];for(let x=-11.6;x<12;x+=.87){if(Math.abs(x)<2.4)continue;for(const z of[-21.86,-24.14])banks.push([x+.08*Math.sin(x*3),z]);}for(let i=0;i<7;i++)banks.push([-8.82,-18.7-i*.44]);bankStones(outdoor,banks);
 for(let x=-11;x<12;x+=2.4){if(Math.abs(x)<2.5)continue;snowBank(outdoor,x,-21.76,.7,.19);snowBank(outdoor,x+.4,-24.24,.65,.2);}
 trail(outdoor,[[.3,-13],[-1.4,-13],[-3,-13],[-4.5,-13],[-6,-13]],1.1,0xaca890);
 trail(outdoor,[[-2.75,-13],[-2.75,-13.75]],.75,0xaca890);
 trail(outdoor,[[-5.75,-13],[-5.75,-13.75]],.75,0xaca890);
 for(const [x,z,rx,rz]of[[-8.6,-18.5,.5,.22],[-8.7,-21.1,.42,.6],[-5.35,-21.3,.5,.24],[-6.5,-17.8,.35,.16],[-2.5,-16.5,.35,.18]]as const)snowBank(outdoor,x,z,rx,rz);
 const bridge=new THREE.Group();outdoor.add(bridge);for(let z=-24.1;z<=-21.8;z+=.28)box(bridge,4,.12,.24,0,.07,z,C.wood);for(const x of[-1.85,1.85]){line(bridge,new THREE.Vector3(x,.8,-24),new THREE.Vector3(x,.8,-22),.055,C.wood);for(const z of[-24,-23,-22])box(bridge,.12,.9,.12,x,.45,z,C.wood);}
 const millHouse=asset(outdoor,'mill_house',-7,0,-20,1.15);millHouse.rotation.y=Math.PI;
 const millLight=new THREE.PointLight(0xffc67b,0,7,2);millLight.position.set(-6.17,1.45,-18.4);outdoor.add(millLight);const millGlow=lightPool(outdoor,-6.17,-18,1.8);
 asset(outdoor,'firewood',-8.35,0,-18.8,.75);asset(outdoor,'barrel',-8.6,0,-20,.65);
 const wheel=new THREE.Group();wheel.position.set(MAP.mill.x,1.35,MAP.mill.z);outdoor.add(wheel);torus(wheel,1.14,.13,0,0,0,C.wood);torus(wheel,.92,.055,0,0,.09,C.gold);for(let i=0;i<12;i++){const a=i*Math.PI/6,paddle=box(wheel,.32,.13,.38,Math.cos(a)*1.08,Math.sin(a)*1.08,0,0x8b6546);paddle.rotation.z=a;}for(let i=0;i<8;i++){const a=i*Math.PI/4;line(wheel,new THREE.Vector3(),new THREE.Vector3(Math.cos(a)*1.12,Math.sin(a)*1.12,0),.07,C.wood);}cylinder(outdoor,.25,.5,-5,.25,-18,C.stone);
 box(outdoor,.42,.06,5,-4.7,.04,-20.5,C.water);const spill=box(outdoor,.55,.07,2.6,MAP.drain.x,.06,-16.7,C.water);for(const x of[-7.4,-6.6])box(outdoor,.15,.16,2.8,x,.08,-16.7,C.stone);cylinder(outdoor,.65,.035,-7,.025,-15.25,0x8bb7c1);const sluice=box(outdoor,.8,.65,.2,MAP.drain.x,.4,MAP.drain.z,C.navy);const pin=box(outdoor,.18,.6,.18,MAP.stopper.x,.55,MAP.stopper.z,C.gold);
 // The work enclosure matches the model's occupied mill area; controls are reached from its foreground.
 box(outdoor,6.4,.05,5.3,-6,-.015,-19.15,0x9aa49b);
 // Keep the floor under the existing water / wheels: the foundation top is below water and tread detail.
 for(const [x1,x2]of[[-9.2,-7.7],[-6.3,-2.8]]as const){for(let x=x1;x<x2+.05;x+=.75)box(outdoor,.1,.58,.1,x,.29,-16.5,C.wood);line(outdoor,new THREE.Vector3(x1,.48,-16.5),new THREE.Vector3(x2,.48,-16.5),.045,C.wood);}
 for(const x of[-9.2,-2.8]){for(let z=-21.8;z<=-16.5;z+=1.1)box(outdoor,.1,.58,.1,x,.29,z,C.wood);line(outdoor,new THREE.Vector3(x,.48,-21.8),new THREE.Vector3(x,.48,-16.5),.045,C.wood);}
 const drainHandle=new THREE.Group(),stopHandle=new THREE.Group();
 for(const [control,g,mark]of[[MAP.drainControl,drainHandle,'≈'],[MAP.stopperControl,stopHandle,'⊣']]as const){
  const x=control.x-.85,z=control.z-.6;g.position.set(x,.65,z);g.rotation.x=-Math.PI/3;outdoor.add(g);box(outdoor,.72,.12,.72,x,.06,z,C.stone);cylinder(outdoor,.085,.55,x,.345,z,C.wood,10);torus(g,.24,.04,0,0,0,C.gold);line(g,new THREE.Vector3(-.23,0,0),new THREE.Vector3(.23,0,0),.028,C.wood);line(g,new THREE.Vector3(0,-.23,0),new THREE.Vector3(0,.23,0),.028,C.wood);const grip=cylinder(g,.045,.14,.22,0,.06,C.wood,8);grip.rotation.x=Math.PI/2;
  glyph(outdoor,mark,x,1.1,z,'#f0ddb1',.48);
 }
 // The rods visibly connect each distant handwheel to its own mechanism without crossing the walk path.
 line(outdoor,new THREE.Vector3(-6.85,.25,-14.6),new THREE.Vector3(-6.85,.25,-17.8),.04,C.gold);line(outdoor,new THREE.Vector3(-6.85,.25,-17.8),new THREE.Vector3(MAP.drain.x,.25,MAP.drain.z),.04,C.gold);
 line(outdoor,new THREE.Vector3(-3.85,.25,-14.6),new THREE.Vector3(-3.85,.25,-18.5),.04,C.gold);line(outdoor,new THREE.Vector3(-3.85,.25,-18.5),new THREE.Vector3(MAP.stopper.x,.55,MAP.stopper.z),.04,C.gold);
 // Cooperation: both plates and the latch sit at the model's coordinates.
 fence(outdoor,-12,-2,-35);fence(outdoor,2,12,-35);const gate=box(outdoor,4,1.6,.18,0,.8,-35,C.navy);
 const gatePlate=cylinder(outdoor,.85,.08,MAP.gatePlate.x,.05,MAP.gatePlate.z,C.gold);torus(outdoor,.53,.035,MAP.gatePlate.x,.12,MAP.gatePlate.z,C.paper).rotation.x=-Math.PI/2;glyph(outdoor,'◎',MAP.gatePlate.x,.8,MAP.gatePlate.z,'#f0ddb1',.55);
 const latch=box(outdoor,.35,.9,.35,MAP.latch.x,.45,MAP.latch.z,C.wood);const latchLever=new THREE.Group();latchLever.position.set(MAP.latch.x,.82,MAP.latch.z);outdoor.add(latchLever);box(latchLever,.48,.09,.12,.13,0,0,C.gold);cylinder(latchLever,.09,.15,.35,.04,0,C.wood);line(outdoor,new THREE.Vector3(2.23,.1,-38),new THREE.Vector3(2.23,.1,-35),.03,C.gold);glyph(outdoor,'⌁',MAP.latch.x,1.2,MAP.latch.z);
 glyph(outdoor,'◐',MAP.wall.x,1.2,MAP.wall.z+.2,'#f0ddb1',.6);
 // Optical apparatus. Ring segments preserve r/z = .4 only at A1/B2.
 const apparatus=new THREE.Group();apparatus.position.set(3,4.6,-55);outdoor.add(apparatus);
 const arc=(r:number,start:number,end:number,color:number)=>{const pts=[];for(let i=0;i<=56;i++){const a=start+(end-start)*i/56;pts.push(new THREE.Vector3(Math.cos(a)*r*.35,Math.sin(a)*r*.35,0));}const curve=new THREE.CatmullRomCurve3(pts);const m=new THREE.Mesh(new THREE.TubeGeometry(curve,56,r*.00875,6,false),new THREE.MeshBasicMaterial({color}));apparatus.add(m);return m;};
 optical.layers.set(1);
 const fixed=arc(2.8,0,Math.PI,C.paper),armA=arc(2,Math.PI,Math.PI*1.5,C.gold),armB=arc(2.4,Math.PI*1.5,Math.PI*2,0x79c7d0);fixed.position.z=-7*.35;apparatus.traverse(o=>o.layers.set(1));
 const leverHandles:THREE.Group[]=[],ringCarriages:THREE.Group[]=[];
 for(const [x,endX,color]of [[2.2,2.3,C.gold],[3.8,3.84,0x79c7d0]]as const){const g=new THREE.Group();outdoor.add(g);ringCarriages.push(g);box(g,.26,.12,.25,x,3.22,0,C.navy);line(g,new THREE.Vector3(x,3.25,0),new THREE.Vector3(x,4.6,0),.035,color);line(g,new THREE.Vector3(x,4.6,0),new THREE.Vector3(endX,4.6,0),.035,color);}
 for(const [point,label,color]of[[MAP.leverA,'A',C.gold],[MAP.leverB,'B',0x79c7d0]]as const){
  box(outdoor,.95,.16,.95,point.x,3.08,point.z,C.stone);cylinder(outdoor,.32,.55,point.x,3.4,point.z,C.navy);torus(outdoor,.2,.045,point.x,3.69,point.z,color).rotation.y=Math.PI/2;
  const handle=new THREE.Group();handle.position.set(point.x,3.7,point.z);outdoor.add(handle);leverHandles.push(handle);box(handle,.095,.66,.095,0,.31,0,color);box(handle,.47,.13,.15,0,.67,0,C.wood);for(const x of[-.25,.25])cylinder(handle,.09,.16,x,.67,0,color,10).rotation.z=Math.PI/2;
  const railX=label==='A'?2.2:3.8;line(outdoor,new THREE.Vector3(point.x,3.2,point.z),new THREE.Vector3(railX,3.2,point.z),.035,color);line(outdoor,new THREE.Vector3(railX,3.2,point.z),new THREE.Vector3(railX,3.2,-57.6),.035,color);for(const z of[-56.4,-57.5])box(outdoor,.16,.15,.22,railX,3.12,z,C.stone);
  // The letter remains attached to its apparatus when Q changes the camera orientation.
  const badge=glyph(outdoor,label,point.x,5.05,point.z,'#f0ddb1',.52);badge.userData['journeyMarker']=false;
 }

 const observerBase=cylinder(outdoor,.65,.06,MAP.observe.x,3.05,MAP.observe.z,C.navy);glyph(outdoor,'◉',MAP.observe.x,3.7,MAP.observe.z,'#f0ddb1',.65);
 // Castle is the apparent destination, behind the optical ring rather than in its line of sight.
 const castle=asset(outdoor,'castle',3,3,-64,1.1);
 // Portal and its two distinct plate shapes, matching the final cooperative puzzle.
 const portal=new THREE.Group();portal.position.set(MAP.portal.x,0,MAP.portal.z);outdoor.add(portal);for(const x of[-1.25,1.25])box(portal,.23,3,.23,x,1.5,0,C.gold);box(portal,2.7,.23,.23,0,3,0,C.gold);
 const portalFill=box(portal,2.25,2.7,.06,0,1.4,0,0x76aeb4);portalFill.material.transparent=true;portalFill.material.opacity=.18;portalFill.material.depthWrite=false;portalFill.castShadow=false;const portalSeal=new THREE.Group();portal.add(portalSeal);for(const side of[-1,1])line(portalSeal,new THREE.Vector3(-.95*side,.22,.04),new THREE.Vector3(.95*side,2.58,.04),.025,C.paper);const front=cylinder(outdoor,.64,.06,MAP.frontPlate.x,.04,MAP.frontPlate.z,C.gold),back=cylinder(outdoor,.64,.06,MAP.backPlate.x,.04,MAP.backPlate.z,C.gold);const resonance=new THREE.Group();outdoor.add(resonance);for(const [index,p]of[MAP.frontPlate,MAP.backPlate].entries()){for(let i=0;i<=index;i++){const ring=torus(resonance,.34+i*.13,.035,p.x,.1,p.z,C.paper);ring.rotation.x=-Math.PI/2;}for(const x of[-.14,.14])box(resonance,.12,.02,.24,p.x+x,.11,p.z,C.gold);glyph(resonance,index?'◎':'○',p.x,.5,p.z,'#f0ddb1',.52);}for(const z of[1,3.3,4.7,6.5]){for(const x of[-.2,.2])box(resonance,.13,.025,.27,1.8+x,.08,z,C.gold);}
 // Paired, original paper-and-gold memory markers appear only with the unlocked view.
 for(const m of MEMORIES){
  const y=heightAt(m.point);const mark=new THREE.Group();mark.position.set(m.point.x,y,m.point.z);resonance.add(mark);
  const halo=torus(mark,.53,.035,0,.06,0,C.paper);halo.rotation.x=-Math.PI/2;
  for(const side of[-1,1]){const foot=box(mark,.14,.025,.32,side*.17,.08,0,side<0?C.gold:0x79c7d0);foot.rotation.y=side*.22;}
  const star=glyph(mark,'✦',0,2.5,0,'#f0ddb1',.55);star.userData['journeyMarker']=false;
 }
 // Context selection follows main's one enabled action; no proximity-based second selection.
 const focusRing=torus(scene,.76,.028,0,.07,0,C.paper);focusRing.rotation.x=-Math.PI/2;focusRing.visible=false;
 const companionTarget=new THREE.Group(),travellingRing=new THREE.Group(),arrivedRing=new THREE.Group();companionTarget.add(travellingRing,arrivedRing);outdoor.add(companionTarget);
 for(let i=0;i<16;i++){const a=i*Math.PI/8,b=a+Math.PI/16;line(travellingRing,new THREE.Vector3(Math.cos(a)*1.02,.1,Math.sin(a)*1.02),new THREE.Vector3(Math.cos(b)*1.02,.1,Math.sin(b)*1.02),.035,C.paper);}
 const arrivalHoop=torus(arrivedRing,1.02,.045,0,.1,0,C.paper);arrivalHoop.rotation.x=-Math.PI/2;
 for(const x of[-.16,.16]){box(travellingRing,.13,.025,.29,x,.095,.63,C.paper);box(arrivedRing,.13,.025,.29,x,.095,.63,C.paper);}
 // Warm home, same real coordinates for arrival and ending.
 box(room,8,.4,7,0,-.2,-.5,0x896849);for(let x=-3.8;x<4;x+=.6)box(room,.025,.01,7,x,.006,-.5,0x6c513b);box(room,8,3,.2,0,1.5,-4,0xc2b59c);box(room,.2,3,7,-4,1.5,-.5,0xb7b09a);box(room,.2,3,7,4,1.5,-.5,0xb7b09a);
 asset(room,'woven_rug',0,.02,.4,1.3);box(room,2,.7,.9,MAP.console.x,.35,MAP.console.z,C.wood);box(room,1.45,.95,.12,0,1.2,-2.85,C.navy);const screen=box(room,1.25,.72,.025,0,1.2,-2.77,0x73a6ab);glyph(room,'▶',0,1.9,-2.5,'#f0ddb1',.55);asset(room,'bookshelf',-3,0,-3.2,1);asset(room,'armchair',3.4,0,1.9,1);asset(room,'table_lamp',2.4,.7,-2.5,1);
 const focusObjects:Record<string,THREE.Object3D[]>={tile:[crank],drain:[drainHandle],stopper:[stopHandle],latch:[latch,latchLever],'lever-a':[leverHandles[0]!],'lever-b':[leverHandles[1]!],observe:[observerBase],portal:[portal],begin:[screen]};
 const focusTint=new THREE.Color(0xe8c77b);
 const windowFrame=box(room,2,1.8,.08,3,1.7,-3.84,C.wood);box(room,1.7,1.5,.04,3,1.7,-3.78,0x8baab3);box(room,.08,1.6,.04,3,1.7,-3.73,C.paper);box(room,1.8,.08,.04,3,1.7,-3.73,C.paper);
 const indoorLight=new THREE.PointLight(0xffc77d,14,12,2);indoorLight.position.set(2.4,2.2,-2.5);room.add(indoorLight);
 // Snow is GPU points, no CPU pixel readback; reduced motion keeps the scene still.
 const snowPositions=new Float32Array(180*3);for(let i=0;i<180;i++){snowPositions[i*3]=(Math.sin(i*17.13)*.5+.5)*26-13;snowPositions[i*3+1]=1+(i%19)*.5;snowPositions[i*3+2]=(Math.sin(i*7.73)*.5+.5)*26-13;}const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));const snow=new THREE.Points(snowGeo,new THREE.PointsMaterial({color:0xece6d4,size:.07,transparent:true,opacity:.7}));scene.add(snow);
 let width=1,height=1,lastEra=-1,lastRoom=false,lastQuality='',time=0,walkP=0,walkT=0,lastP={x:0,z:0},lastT={x:0,z:0},started=false;const presentationFacing=[0,0];
 function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);lastEra=-1;camera.left=-8*width/height;camera.right=8*width/height;camera.top=8;camera.bottom=-8;camera.updateProjectionMatrix();optical.aspect=width/height;
  // Fit the largest possible unsolved arc (r/depth=.6), leaving UI-safe space above/below.
  // Common FOV and principal-point shift preserve all overlap relationships and the A1/B2 solution.
  const radiusPx=Math.max(24,Math.min(height*.28,width*.42,(height-140)/2));
  optical.fov=THREE.MathUtils.radToDeg(2*Math.atan(.6*height/(2*radiusPx)));
  optical.setViewOffset(width,height,0,height*.05,width,height);optical.updateProjectionMatrix();}
 resize();
 return {resize,dispose(){renderer.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){o.geometry.dispose();}});},render(s:JourneyState,dt:number,options:RenderOptions){
  time+=Math.max(0,Math.min(.1,dt));const inRoom=s.phase!=='world';outdoor.visible=!inRoom;room.visible=inRoom;scene.fog=inRoom?null:new THREE.Fog(s.era===3?0x688693:0x8ba1a5,30,85);scene.background=new THREE.Color(inRoom?0x292e32:s.era===3?0x688693:0x8ba1a5);
  if(lastEra!==s.era||lastQuality!==options.quality||lastRoom!==inRoom){const scale=!inRoom&&s.era===0?Math.min(1,360/width):!inRoom&&s.era===1?Math.min(1,720/width):options.quality==='low'?1:Math.min(devicePixelRatio||1,1.5);renderer.setPixelRatio(1);renderer.setSize(Math.round(width*scale),Math.round(height*scale),false);canvas.style.imageRendering=!inRoom&&s.era<2?'pixelated':'auto';renderer.shadowMap.enabled=(inRoom||s.era===3)&&options.quality!=='low';lastEra=s.era;lastQuality=options.quality;lastRoom=inRoom;}
  // Only the game-world canvas loses colour in E0; room, title and DOM dialogue remain untouched.
  // CSS compositing avoids GPU readback. Reduced motion applies the new palette immediately.
  canvas.style.transition=!inRoom&&s.era===1&&!options.reducedMotion?'filter 700ms ease-out':'none';
  canvas.style.filter=!inRoom&&s.era===0?'grayscale(1) contrast(1.28) brightness(.96)':'none';
  sun.color.set(inRoom?0xffe0ab:s.era===3?0xffe7c0:0xffefda);sun.intensity=inRoom?1.4:s.era===0?1.15:s.era===3?2.15:1.8;millLight.intensity=s.era===3?2.4:0;millGlow.visible=s.era>=1;millGlow.material.opacity=s.era===3?.55:.28;if(!options.reducedMotion)riverTexture.offset.x=-time*.028;hemi.intensity=inRoom?1.5:s.era===0?2.3:1.8;
  const movingP=started?distance(s.player,lastP):0,movingT=started?distance(s.toto,lastT):0;walkP+=movingP*7;walkT+=movingT*7;
  const actionTargets:Record<string,{x:number;z:number}>={begin:MAP.console,tile:{x:MAP.tileControl.x-.8,z:MAP.tileControl.z+.25},drain:{x:MAP.drainControl.x-.85,z:MAP.drainControl.z-.6},stopper:{x:MAP.stopperControl.x-.85,z:MAP.stopperControl.z-.6},latch:MAP.latch,'lever-a':MAP.leverA,'lever-b':MAP.leverB,wall:MAP.wall,observe:MAP.observe,portal:MAP.portal};
  [player,toto].forEach((g,i)=>{const a=i?s.toto:s.player,other=i?s.player:s.toto,kind=i?'toto':'player',moving=i?movingT:movingP;let facing=a.facing;
   if(options.speaker&&distance(a,other)>.2)facing=Math.atan2(other.x-a.x,other.z-a.z);
   if(i===0&&options.action){const target=actionTargets[options.action.id]??other;facing=Math.atan2(target.x-a.x,target.z-a.z);}
   if(!started||options.reducedMotion)presentationFacing[i]=facing;else if(dt>0){const delta=Math.atan2(Math.sin(facing-presentationFacing[i]!),Math.cos(facing-presentationFacing[i]!));presentationFacing[i]!+=delta*Math.min(1,dt*10);}
   g.position.set(a.x,(inRoom?0:heightAt(a))+.52*1.05,a.z);g.rotation.y=presentationFacing[i]!+Math.PI;
   poseJourneyActor(g,{kind,speaking:options.speaker===kind,expression:options.speaker===kind?(options.expression??'neutral'):'neutral',action:i===0?options.action:undefined,waiting:i===1&&s.toto.waiting,walk:moving<.001?0:Math.sin(i?walkT:walkP),time,reducedMotion:options.reducedMotion});shadows[i]!.position.set(a.x,(inRoom?0:heightAt(a))+.015,a.z);
  });
  lastP={...s.player};lastT={...s.toto};started=true;
  const focusPoint=options.focusActionPoint;focusRing.visible=!!options.focusActionId&&!!focusPoint&&s.mode!=='observe';if(focusPoint)focusRing.position.set(focusPoint.x,(inRoom?0:heightAt(focusPoint))+.075,focusPoint.z);
  const destination=s.toto.plate==='gate'?MAP.gatePlate:s.toto.plate==='front'?MAP.frontPlate:s.toto.plate==='back'?MAP.backPlate:null;companionTarget.visible=!!destination;if(destination){companionTarget.position.set(destination.x,heightAt(destination),destination.z);const arrived=s.toto.waiting&&isOnPlate(s.toto,destination);arrivedRing.visible=arrived;travellingRing.visible=!arrived;}
  for(const id of ['tile','drain','stopper']as const){const active=!inRoom&&options.focusActionId===id;controlPads[id]!.border.material.color.set(active?0xe9d599:0x50635c);controlPads[id]!.pad.material.color.set(active?0xc4bc91:0xa3ad9b);}
  for(const [id,objects]of Object.entries(focusObjects))for(const obj of objects)obj.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial){o.material.emissive.copy(focusTint);o.material.emissiveIntensity=options.focusActionId===id?.24:0;}});
  for(const [point,mesh]of [[MAP.gatePlate,gatePlate],[MAP.frontPlate,front],[MAP.backPlate,back]]as const){const selected=options.focusActionId==='wait'&&options.focusActionPoint&&distance(options.focusActionPoint,point)<.01;mesh.material.emissive.copy(focusTint);mesh.material.emissiveIntensity=selected?.3:0;}
  latchLever.rotation.y=s.gateLatched?Math.PI/2:0;
  leverHandles[0]!.rotation.x=(s.ringA-1)*.42;leverHandles[1]!.rotation.x=(s.ringB-1)*.42;
  tile.rotation.y=-s.p1*Math.PI/2;crank.rotation.z=-s.p1*Math.PI/2;p1Gate.visible=!s.solved[0];bridge.visible=!!s.solved[1];spill.visible=s.p2Drain;sluice.position.y=s.p2Drain?.7:.35;drainHandle.rotation.z=s.p2Drain?0:Math.PI/2;stopHandle.rotation.z=s.p2Stopper?0:Math.PI/2;pin.rotation.z=s.p2Stopper?0:Math.PI/2;if(s.solved[1]&&!options.reducedMotion)wheel.rotation.z=time*.55;
  const occupied=isOnPlate(s.player,MAP.gatePlate)||isOnPlate(s.toto,MAP.gatePlate),openGate=s.gateLatched||occupied;
  // Fold the open leaf into its left post; a raised opaque panel hid the friends beyond the gate.
  gate.position.set(openGate?-2.18:0,openGate?.44:.8,-35);gate.scale.set(openGate?.05:1,openGate?.55:1,1);gatePlate.scale.y=occupied?.5:1;(latch.material as THREE.MeshStandardMaterial).color.set(s.gateLatched?C.gold:C.wood);
  const flatWall=!s.wallSeen&&(s.era<2||s.quarter%2===0);wallPattern.visible=flatWall;stair.visible=!flatWall;
  armA.position.z=-(4+s.ringA)*.35;armB.position.z=-(4+s.ringB)*.35;ringCarriages[0]!.position.z=-55+armA.position.z;ringCarriages[1]!.position.z=-55+armB.position.z;castle.visible=s.mode!=='observe';portalFill.visible=portalSeal.visible=!s.portalOpen;for(const piece of portal.children.slice(0,3)){if(piece instanceof THREE.Mesh&&piece.material instanceof THREE.MeshStandardMaterial){piece.material.color.set(s.portalOpen?C.paper:C.gold);piece.material.emissiveIntensity=Math.max(piece.material.emissiveIntensity,s.portalOpen?.2:0);}}resonance.visible=s.era===3&&!!options.resonance;front.visible=back.visible=true;(front.material as THREE.MeshStandardMaterial).color.set(isOnPlate(s.player,MAP.frontPlate)||isOnPlate(s.toto,MAP.frontPlate)?C.paper:s.era===3?C.gold:C.stone);(back.material as THREE.MeshStandardMaterial).color.set(isOnPlate(s.player,MAP.backPlate)||isOnPlate(s.toto,MAP.backPlate)?C.paper:s.era===3?C.gold:C.stone);
  if(camera.zoom!==(inRoom?1.4:1)){camera.zoom=inRoom?1.4:1;camera.updateProjectionMatrix();}
  const origin=new THREE.Vector3(s.player.x,(inRoom?0:heightAt(s.player))+.3,s.player.z);const q=s.era>=2?s.quarter*Math.PI/2:0;const tableView=!inRoom&&s.era>=2?Math.max(0,Math.min(1,(6-distance(s.player,MAP.tile))/3)):0;
  // On the return trip a steeper reading angle keeps the table beyond the actors' silhouettes, even after Q.
  const y=inRoom?12:s.era===0?20:s.era===1?16:12+tableView*6;const d=inRoom?9:s.era===0?8:s.era===1?10:13-tableView*5;
  camera.position.copy(origin).add(new THREE.Vector3(Math.sin(q)*d,y,Math.cos(q)*d));camera.lookAt(origin);for(const tree of trees){const dx=tree.position.x-s.player.x,dz=tree.position.z-s.player.z,forward=dx*Math.sin(q)+dz*Math.cos(q),cross=dx*Math.cos(q)-dz*Math.sin(q);tree.visible=!(s.era>=2&&forward>0&&forward<10&&Math.abs(cross)<2.6);}
  sun.position.copy(origin).add(new THREE.Vector3(-10,20,10));sun.target.position.copy(origin);
  optical.position.set(3,4.6,-55);optical.lookAt(3,4.6,-60);const observe=!inRoom&&s.mode==='observe';player.visible=toto.visible=!observe&&(inRoom||s.era>=2);pixels.forEach((p,i)=>{const a=i?s.toto:s.player;p.sprite.visible=!inRoom&&!observe&&s.era<2;p.sprite.position.set(a.x,heightAt(a)+.025,a.z);if(s.era<2)p.update(s.era,presentationFacing[i]!,options.reducedMotion?0:(i?movingT:movingP)>.001?(i?walkT:walkP):0,{speaking:options.speaker===(i?'toto':'player'),expression:options.speaker===(i?'toto':'player')?(options.expression??'neutral'):'neutral',action:i===0?options.action:undefined,reducedMotion:options.reducedMotion});});shadows.forEach(m=>m.visible=!observe);snow.visible=!inRoom&&s.era===3&&!observe;snow.position.set(s.player.x,0,s.player.z);if(!options.reducedMotion)snow.position.y=-(time*.25)%3;
  scene.traverse(o=>{if(o.userData['journeyMarker']){const p=o.getWorldPosition(new THREE.Vector3());o.visible=distance(s.player,p)>=2&&distance(s.toto,p)>=.9;}});
  renderer.render(scene,observe?optical:camera);
 }};
}
