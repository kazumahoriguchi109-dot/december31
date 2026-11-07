import * as THREE from 'three';
import { winterAsset, type WinterAsset } from '../render/winterAssets';
export const C={snow:0xdce2f4,paper:0xf1dfb3,pine:0x355b50,navy:0x263e4c,wood:0x78513a,gold:0xd9ad65,water:0x427f99,red:0xb45e4b,stone:0x8c9f9c};
export const material=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.93,metalness:0,flatShading:true});
export function box(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,color:number){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function cylinder(parent:THREE.Object3D,r:number,h:number,x:number,y:number,z:number,color:number,n=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,n),material(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function asset(parent:THREE.Object3D,name:WinterAsset,x:number,y:number,z:number,scale=1){const g=winterAsset(name);g.position.set(x,y,z);g.scale.setScalar(scale);g.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});parent.add(g);return g;}
export function glyph(parent:THREE.Object3D,symbol:string,x:number,y:number,z:number,color='#f0ddb1',size=.8){
 const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d')!;ctx.fillStyle='#263e4c';ctx.beginPath();ctx.roundRect(10,10,108,108,22);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=4;ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 76px sans-serif';ctx.fillText(symbol,64,68);
 const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:true}));m.position.set(x,y,z);m.scale.set(size,size,1);m.userData['journeyMarker']=true;parent.add(m);return m;
}
export function line(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,color:number){const delta=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),material(color));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());m.castShadow=true;parent.add(m);return m;}
export function torus(parent:THREE.Object3D,r:number,t:number,x:number,y:number,z:number,color:number){const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,6,48),material(color));m.position.set(x,y,z);parent.add(m);return m;}
export function fence(parent:THREE.Object3D,x1:number,x2:number,z:number,y=0){
 for(let x=x1;x<=x2+.1;x+=1.9){box(parent,.16,1.05,.16,x,y+.525,z,C.wood);box(parent,.26,.08,.26,x,y+1.09,z,C.snow);}
 box(parent,x2-x1,.13,.12,(x1+x2)/2,y+.7,z,C.wood);box(parent,x2-x1,.075,.22,(x1+x2)/2,y+.79,z,C.snow);box(parent,x2-x1,.11,.12,(x1+x2)/2,y+.3,z,C.wood);
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
/** Broad, seamless drifts rather than high-frequency confetti. Deterministic on reload. */
export function snowTexture(){
 const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d')!;
 c.fillStyle='#c7cde6';c.fillRect(0,0,256,256);let seed=31;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let i=0;i<38;i++){const x=rand()*256,y=rand()*256,r=20+rand()*55;for(const dx of[-256,0,256])for(const dy of[-256,0,256]){
  const g=c.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,r);g.addColorStop(0,i%3?'rgba(240,237,250,.24)':'rgba(110,128,181,.13)');g.addColorStop(1,'rgba(190,202,230,0)');c.fillStyle=g;c.fillRect(x+dx-r,y+dy-r,r*2,r*2);
 }}
 const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,5);return t;
}

/** Shared low-poly bough geometry. Each tree uses only three draw calls, and remains
 * one occlusion group. All scenery stays outside the existing walkable boundary. */
const boughGeometry=new THREE.IcosahedronGeometry(1,1),twigGeometry=new THREE.CylinderGeometry(.65,1,1,6);
const boughSnow=material(0xd8dff4),boughNeedles=material(0x3f5369),boughBark=material(0x66565e);
export function winterTree(parent:THREE.Object3D,x:number,y:number,z:number,index:number){
 const group=new THREE.Group();group.name='winter-boundary-tree';group.position.set(x,y,z);group.rotation.y=index*2.39996;
 const slender=index%3===0, bare=index%7===3, height=bare?4.7:4.5;
 group.scale.set(1,.9+(Math.sin(index*4.7)+1)*.12,1);
 const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 const trunk=new THREE.InstancedMesh(twigGeometry,boughBark,bare?15:1);
 const branch=(i:number,a:THREE.Vector3,b:THREE.Vector3,r:number)=>{const delta=b.clone().sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,delta.clone().normalize());dummy.scale.set(r,delta.length(),r);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);};
 branch(0,new THREE.Vector3(),new THREE.Vector3(.12,height,0),.15);
 const count=bare?7:25,needles=bare?null:new THREE.InstancedMesh(boughGeometry,boughNeedles,count),caps=new THREE.InstancedMesh(boughGeometry,boughSnow,count);
 for(let i=0;i<count;i++){
  const tier=Math.floor(i/5),a=i*2.39996+index*.4,reach=bare?.65:(1-tier*.18)*(slender?.85:1.15),h=bare?1.8+i*.42:1+tier*.84;
  const px=Math.cos(a)*reach*.65,pz=Math.sin(a)*reach*.65;
  if(bare){const end=new THREE.Vector3(Math.cos(a)*1.3,h+.5,Math.sin(a)*1.3);branch(i*2+1,new THREE.Vector3(0,h-.4,0),end,.055);branch(i*2+2,end.clone().multiplyScalar(.8),new THREE.Vector3(end.x*1.1,h+1,end.z*1.1),.025);}
  dummy.position.set(px,h+(bare?.2:0),pz);dummy.rotation.set(.08*Math.sin(i),a,.12*Math.cos(i));dummy.scale.set(bare?.46:reach*.8,bare?.12:.36, bare?.18:reach*.51);dummy.updateMatrix();
  if(needles)needles.setMatrixAt(i,dummy.matrix);
  dummy.position.y+=bare?0:.19;dummy.scale.multiply(new THREE.Vector3(1.03,.8,1.05));dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);
 }
 for(const mesh of[trunk,caps,...(needles?[needles]:[])]){mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);}
 parent.add(group);return group;
}

/** A shallow swept path: soft irregular edges, with no extra collision or height step. */
export function trail(parent:THREE.Object3D,points:readonly (readonly [number,number])[],width:number,color=0xaeb9d5){
 const positions:number[]=[],indices:number[]=[];points.forEach(([x,z],i)=>{const before=points[Math.max(0,i-1)]!,after=points[Math.min(points.length-1,i+1)]!,dx=after[0]-before[0],dz=after[1]-before[1],l=Math.hypot(dx,dz)||1,half=width*(.5+Math.sin(i*2.3)*.035);positions.push(x-dz/l*half,.033,z+dx/l*half,x+dz/l*half,.033,z-dx/l*half);if(i){const n=i*2;indices.push(n-2,n-1,n,n-1,n+1,n);}});
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const mat=material(color);mat.side=THREE.DoubleSide;const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function snowBank(parent:THREE.Object3D,x:number,z:number,rx:number,rz:number){const m=new THREE.Mesh(new THREE.CircleGeometry(1,12),material(0xdde3f3));m.rotation.x=-Math.PI/2;m.position.set(x,.046,z);m.scale.set(rx,rz,1);m.receiveShadow=true;parent.add(m);return m;}

/** Low-cost bank stones with settled snow; instance geometry does not change the walkable terrain. */
export function bankStones(parent:THREE.Object3D,points:readonly (readonly [number,number])[]){
 const geo=new THREE.IcosahedronGeometry(1,0),stone=new THREE.InstancedMesh(geo,material(0x7e829b),points.length),snow=new THREE.InstancedMesh(geo,material(0xdce2f4),points.length),dummy=new THREE.Object3D();
 points.forEach(([x,z],i)=>{dummy.position.set(x,.095,z);dummy.scale.set(.32+(i%3)*.055,.17,.23);dummy.rotation.set(0,i*.7,.04*Math.sin(i));dummy.updateMatrix();stone.setMatrixAt(i,dummy.matrix);dummy.position.y=.225;dummy.scale.y=.055;dummy.scale.x*=.86;dummy.scale.z*=.86;dummy.updateMatrix();snow.setMatrixAt(i,dummy.matrix);});stone.castShadow=stone.receiveShadow=true;snow.receiveShadow=true;parent.add(stone,snow);return{stone,snow};
}
export function waterTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#4c8597';ctx.fillRect(0,0,128,128);for(let row=0;row<12;row++){const y=row*11;ctx.fillStyle=row%3?'#6198a6':'#8bb8be';for(let x=(row%3)*12;x<128;x+=43)ctx.fillRect(x,y,18+(row%4)*3,1);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(7,1);t.magFilter=THREE.NearestFilter;return t;}
export function lightPool(parent:THREE.Object3D,x:number,z:number,radius:number){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!,g=ctx.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'rgba(255,196,105,.35)');g.addColorStop(1,'rgba(255,196,105,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(radius*2,radius*2),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,opacity:.7}));m.rotation.x=-Math.PI/2;m.position.set(x,.065,z);parent.add(m);return m;}

/** A clipped circular standing pad, using the same half-planes as the interaction model. */
export function operatingArea(parent:THREE.Object3D,area:{center:{x:number;z:number};radius:number;minX:number;minZ:number}){
 let points=Array.from({length:96},(_,i)=>({x:area.center.x+Math.cos(i*Math.PI/48)*area.radius,z:area.center.z+Math.sin(i*Math.PI/48)*area.radius}));
 for(const axis of ['x','z']as const){const limit=axis==='x'?area.minX:area.minZ;if(!Number.isFinite(limit))continue;const input=points;points=[];for(let i=0;i<input.length;i++){const a=input[i]!,b=input[(i+1)%input.length]!,ai=a[axis]>=limit,bi=b[axis]>=limit;if(ai)points.push(a);if(ai!==bi){const t=(limit-a[axis])/(b[axis]-a[axis]);points.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}}
 const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z))),pad=new THREE.Mesh(new THREE.ShapeGeometry(shape),material(0xa3ad9b));pad.rotation.x=-Math.PI/2;pad.position.y=.057;pad.receiveShadow=true;parent.add(pad);
 const border=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,.067,p.z))),new THREE.LineBasicMaterial({color:0x50635c}));parent.add(border);return {pad,border};
}
