import * as THREE from 'three';
import { winterAsset, type WinterAsset } from '../render/winterAssets';
export const C={snow:0xe1e5d9,paper:0xf1dfb3,pine:0x355b50,navy:0x263e4c,wood:0x78513a,gold:0xd9ad65,water:0x427f99,red:0xb45e4b,stone:0x8c9f9c};
export const material=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.93,metalness:0,flatShading:true});
export function box(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,color:number){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function cylinder(parent:THREE.Object3D,r:number,h:number,x:number,y:number,z:number,color:number,n=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,n),material(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function asset(parent:THREE.Object3D,name:WinterAsset,x:number,y:number,z:number,scale=1){const g=winterAsset(name);g.position.set(x,y,z);g.scale.setScalar(scale);g.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});parent.add(g);return g;}
export function glyph(parent:THREE.Object3D,symbol:string,x:number,y:number,z:number,color='#f0ddb1',size=.8){
 const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d')!;ctx.fillStyle='#263e4c';ctx.beginPath();ctx.roundRect(10,10,108,108,22);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=4;ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 76px sans-serif';ctx.fillText(symbol,64,68);
 const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:true}));m.position.set(x,y,z);m.scale.set(size,size,1);parent.add(m);return m;
}
export function line(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,color:number){const delta=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),material(color));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());m.castShadow=true;parent.add(m);return m;}
export function torus(parent:THREE.Object3D,r:number,t:number,x:number,y:number,z:number,color:number){const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,6,48),material(color));m.position.set(x,y,z);parent.add(m);return m;}
export function fence(parent:THREE.Object3D,x1:number,x2:number,z:number,y=0){
 for(let x=x1;x<=x2+.1;x+=1.9){box(parent,.16,1.05,.16,x,y+.525,z,C.wood);box(parent,.26,.08,.26,x,y+1.09,z,C.snow);}
 box(parent,x2-x1,.13,.12,(x1+x2)/2,y+.7,z,C.wood);box(parent,x2-x1,.11,.12,(x1+x2)/2,y+.3,z,C.wood);
}

/** Hand-pixelled storybook actors: separate E0/E1 artwork, not a downsampled mesh. Bottom centre is the exact foot contact. */
export function pixelActor(kind:'player'|'toto'){
 const textures:THREE.CanvasTexture[][][]=[];
 for(let era=0;era<2;era++){textures[era]=[];for(let facing=0;facing<4;facing++){textures[era]![facing]=[];for(let frame=0;frame<2;frame++){
  const cv=document.createElement('canvas');const scale=era?2:1;cv.width=32*scale;cv.height=48*scale;const c=cv.getContext('2d')!;c.scale(scale,scale);const rect=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const coat=kind==='player'?'#b96b4d':'#57796b',dark=kind==='player'?'#854e3d':'#35564a',scarf=kind==='player'?'#e6d3aa':'#ad5148',ink='#26333a',hair='#4c362e';
  rect(8,23,16,20,ink);rect(9,24,14,16,coat);rect(11,39,4,6,ink);rect(18,39,4,6,ink);rect(10,44-frame,6,3,ink);rect(17,43+frame,6,3,ink);
  rect(5,25+frame,4,13,dark);rect(24,26-frame,4,12,dark);rect(5,37+frame,4,4,scarf);rect(24,37-frame,4,4,scarf);rect(9,24,14,4,scarf);
  rect(8,7,16,17,hair);rect(10,9,13,14,'#e7bb95');rect(7,7,17,6,hair);rect(10,5,11,3,hair);
  if(kind==='player'){rect(7,12,3,12,hair);rect(22,11,3,13,hair);rect(10,8,8,5,hair);}else{rect(18,4,4,5,hair);rect(7,9,5,6,hair);rect(19,26,3,10,scarf);}
  if(facing===2){rect(9,10,15,14,hair);rect(10,22,12,3,scarf);}else if(facing===1||facing===3){const left=facing===3;rect(left?9:20,15,2,3,ink);rect(left?6:23,17,3,3,'#e7bb95');rect(left?18:8,10,5,14,hair);}else{rect(12,15,2,3,ink);rect(19,15,2,3,ink);rect(15,21,4,1,'#854e3d');}
  if(facing!==2){rect(16,29,1,9,'#d9ad65');rect(10,34,4,3,dark);rect(20,34,3,3,dark);}
  if(era){rect(10,28,1,10,'#d2a17c');rect(11,10,5,.5,'#f2d0ab');rect(12,14,2,.5,hair);rect(19,14,2,.5,hair);rect(9,40,4,.5,'#d9ad65');rect(21,27,1,6,'#cfb691');}
  const tex=new THREE.CanvasTexture(cv);tex.magFilter=tex.minFilter=THREE.NearestFilter;tex.colorSpace=THREE.SRGBColorSpace;tex.generateMipmaps=false;textures[era]![facing]![frame]=tex;
 }}}
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:textures[0]![0]![0],alphaTest:.5}));sprite.center.set(.5,0);sprite.scale.set(1.15,1.725,1);
 return{sprite,update(era:number,facing:number,walk:number){let dir=Math.round(facing/(Math.PI/2));dir=((dir%4)+4)%4;(sprite.material as THREE.SpriteMaterial).map=textures[era]![dir]![Math.sin(walk)>0?1:0]!;}};
}
export function snowTexture(){const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d')!;c.fillStyle='#e1e5d9';c.fillRect(0,0,128,128);let seed=31;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);for(let i=0;i<210;i++){c.fillStyle=i%4?'#d4ddd1':'#edf0e4';const x=rand()*128,y=rand()*128;c.fillRect(x,y,2+rand()*5,1+rand()*2);}const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,14);t.magFilter=THREE.NearestFilter;return t;}
