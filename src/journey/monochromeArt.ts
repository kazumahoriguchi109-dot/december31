import * as THREE from 'three';
import {MAP,type JourneyState,type RenderOptions} from './contract';

/** Original, individually drawn tiles and actors. This is a live view of the model,
 * not concept art: positions, facing, walking, crank orientation and focus come from state.
 * Only era zero uses it. World physics and saves are deliberately outside this module. */
export function monochromeFrame(width:number,height:number,player:{x:number;z:number}) {
 const h=320,w=Math.max(64,Math.round(h*width/Math.max(1,height)));
 // Keep a useful area around the player on portrait screens without stretching pixels.
 const unit=Math.min(18,w/15),centerZ=player.z-4;
 return {w,h,unit,x:(x:number)=>Math.round(w/2+(x-player.x)*unit),y:(z:number)=>Math.round(h*.54+(z-centerZ)*unit*.65)};
}
export function createMonochromeArt(){
 const cv=document.createElement('canvas'),ctx=cv.getContext('2d')!;
 const texture=new THREE.CanvasTexture(cv);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);
 const geometry=new THREE.PlaneGeometry(2,2),material=new THREE.MeshBasicMaterial({map:texture,depthTest:false,depthWrite:false});
 scene.add(new THREE.Mesh(geometry,material));camera.position.z=1;
 let time=0,walk=[0,0],last=[{x:0,z:0},{x:0,z:0}];
 const ink='#181818',shadow='#696969',stone='#9c9c9c',light='#c9c9c9',snow='#f4f4f4';
 const rect=(x:number,y:number,w:number,h:number,c:string)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 const poly=(p:number[],c:string)=>{ctx.fillStyle=c;ctx.beginPath();for(let i=0;i<p.length;i+=2)i?ctx.lineTo(p[i]!,p[i+1]!):ctx.moveTo(p[i]!,p[i+1]!);ctx.closePath();ctx.fill();};
 function tree(x:number,y:number,size=1){
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);
  rect(-14,-3,28,5,'#bcbcbc');rect(-3,-12,7,13,ink);rect(-1,-11,2,10,shadow);
  for(const [w,yy]of [[21,-11],[17,-25],[12,-38]] as const){
   const p=[-w,yy,-w,yy-7,-w+5,yy-7,-w+5,yy-12,-w+10,yy-12,0,yy-24,w-10,yy-12,w-5,yy-12,w-5,yy-7,w,yy-7,w,yy,w-5,yy+3,6,yy+3,3,yy+6,-3,yy+6,-6,yy+3,-w+5,yy+3];
   poly(p,ink);poly(p.map((v,i)=>i%2?v-3:v*.88),snow);
   rect(-w+5,yy-3,7,3,light);rect(4,yy-2,5,4,light);rect(w-9,yy-7,4,4,'#dedede');
  }ctx.restore();
 }
 function masonry(x:number,y:number,w:number,h:number){
  rect(x,y,w,h,ink);rect(x+2,y+2,w-4,h-4,stone);
  for(let row=0;row<h-4;row+=8){rect(x+2,y+row+2,w-4,2,shadow);for(let col=(row/8)%2?8:0;col<w-4;col+=17)rect(x+2+col,y+row+2,2,8,shadow);}
  rect(x+2,y+2,w-4,2,light);
 }
 function castle(x:number,y:number,u:number){
  ctx.save();ctx.translate(x,y);ctx.scale(u/18,u/18*.6);
  masonry(-72,-47,144,47);
  for(const xx of [-72,-44,36,64]){masonry(xx,-55,10,12);rect(xx,-57,10,4,snow);}
  for(const xx of [-62,40]){masonry(xx,-75,23,75);rect(xx-2,-78,27,7,ink);rect(xx,-79,23,6,snow);rect(xx+8,-60,6,14,ink);rect(xx+8,-58,2,10,light);rect(xx+9,-100,2,22,ink);rect(xx+11,-99,15,9,ink);rect(xx+11,-98,12,6,snow);}
  masonry(-23,-84,46,49);rect(-25,-88,50,7,ink);rect(-23,-90,46,7,snow);
  for(const xx of [-23,-5,13]){rect(xx,-96,10,10,ink);rect(xx,-97,10,5,snow);}
  // The gate meets the existing impassable z=-10 line. Nothing is added to collision.
  poly([-23,0,-23,-28,-17,-39,-10,-43,10,-43,17,-39,23,-28,23,0],ink);
  poly([-19,0,-19,-27,-13,-35,-8,-38,8,-38,13,-35,19,-27,19,0],snow);
  poly([-16,0,-16,-26,-10,-33,10,-33,16,-26,16,0],ink);
  for(const xx of [-12,-6,1,7])rect(xx,-27,3,27,shadow);
  rect(-15,-12,30,3,stone);rect(-2,-30,3,30,ink);rect(-5,-13,2,3,snow);rect(4,-13,2,3,snow);
  rect(-26,0,52,9,ink);rect(-24,1,48,2,snow);rect(-24,5,48,2,light);
  for(const xx of [-70,27])rect(xx,-47,43,4,snow);
  ctx.restore();
 }
 function actor(x:number,y:number,kind:number,facing:number,gait:number,scale:number){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);const side=Math.abs(Math.sin(facing))>.55,back=Math.cos(facing)<-.55;
  if(side&&Math.sin(facing)<0)ctx.scale(-1,1);
  rect(-7,-1,15,3,'#b4b4b4');const step=Math.round(Math.sin(gait));
  rect(-5-step,-7,5,7,ink);rect(2+step,-7,5,7,ink);rect(-5-step,-1,6,2,ink);rect(2+step,-1,6,2,ink);
  rect(-7,-18,15,12,ink);rect(-5,-17,11,10,kind?shadow:stone);rect(-8,-16+step,3,8,ink);rect(7,-16-step,3,8,ink);
  rect(-7,-8+step,3,3,snow);rect(7,-8-step,3,3,light);
  rect(-6,-18,13,3,snow);if(kind)rect(3,-15,3,7,light);else{rect(-4,-14,2,5,light);rect(3,-12,1,1,ink);}
  // Broad dark hair / short spiky hair and scarf distinguish the pair in pure grey.
  rect(-7,-31,15,14,ink);rect(-5,-33,11,4,ink);if(kind){rect(-2,-35,4,3,ink);rect(6,-32,4,3,ink);}else{rect(-9,-26,4,12,ink);rect(6,-25,3,11,ink);}
  if(!back){rect(side?-1:-4,-27,side?10:10,9,snow);rect(side?7:-2,-25,2,3,ink);if(!side)rect(4,-25,2,3,ink);rect(side?6:1,-20,3,1,shadow);rect(-5,-29,side?9:6,4,ink);}
  else if(!kind){rect(-6,-27,13,13,ink);rect(-4,-16,9,2,light);}
  ctx.restore();
 }
 return {scene,camera,dispose(){geometry.dispose();material.dispose();texture.dispose();},render(s:JourneyState,dt:number,options:RenderOptions,width:number,height:number){
  const f=monochromeFrame(width,height,s.player);if(cv.width!==f.w||cv.height!==f.h){cv.width=f.w;cv.height=f.h;texture.dispose();}ctx.imageSmoothingEnabled=false;
  if(!options.reducedMotion)time+=Math.min(.1,dt);
  rect(0,0,f.w,f.h,snow);
  // World-anchored 16px snow tiles: never a screen-space noise veil over the actors.
  for(let z=Math.floor((s.player.z-4-f.h/f.unit)/.8)*.8;z<s.player.z+f.h/f.unit;z+=.8)for(let x=Math.floor((s.player.x-f.w/f.unit)/.8)*.8;x<s.player.x+f.w/f.unit;x+=.8){const hash=Math.abs(Math.sin(x*73+z*31));rect(f.x(x)+Math.floor(hash*6),f.y(z),1+(hash>.8?1:0),1,hash>.5?'#e4e4e4':'#ececec');}
  // The path bends around, never through, the actual raised puzzle-table footprint.
  const path=[[0,8],[0,0],[0,-2.6],[1.1,-3.4],[3.25,-4.3],[3.3,-6.8],[2.8,-8.1],[.1,-9.1],[0,-10.4]];
  ctx.strokeStyle='#b8b8b8';ctx.lineWidth=f.unit*2;ctx.lineJoin='miter';ctx.beginPath();path.forEach(([x,z],i)=>i?ctx.lineTo(f.x(x!),f.y(z!)):ctx.moveTo(f.x(x!),f.y(z!)));ctx.stroke();
  for(let i=0;i<24;i++){const z=7-i*.72;if(z< -3&&z> -9)continue;rect(f.x((i%2?-.25:.25)),f.y(z),2,2,light);}
  // Optional paired tracks remain discoverable at the model's footprints interaction.
  for(let i=0;i<7;i++)for(const [j,x]of[-6.16,-5.84].entries())rect(f.x(x),f.y(-3.5-i*.45),Math.max(1,f.unit*(j?.14:.17)),Math.max(2,f.unit*(j?.25:.3)),shadow);
  // Depth-sorted scenery and actors preserve feet, approach positions and clear interaction.
  const draw:{z:number;run:()=>void}[]=[];
  for(const side of [-1,1])for(let z=7;z>=-18;z-=6.8){const x=side*(12.35+.3*Math.sin(z));draw.push({z,run:()=>tree(f.x(x),f.y(z),f.unit/18*.9)});}
  // Low shrubs / rocks stay outside the walking corridor and never impersonate controls.
  for(let i=0;i<26;i++){const x=(i%2?-1:1)*(8.8+Math.sin(i*9.1)),z=6-i*.65;draw.push({z,run:()=>{const xx=f.x(x),yy=f.y(z);rect(xx,yy-3,2,4,shadow);rect(xx-3,yy-5,2,4,shadow);rect(xx+3,yy-4,2,3,shadow);}});}
  draw.push({z:-10,run:()=>{for(const side of [-1,1]){const x=f.x(side<0?-12:4);masonry(x,f.y(-10)-16,f.unit*8,16);rect(x,f.y(-10)-18,f.unit*8,4,snow);}castle(f.x(0),f.y(-10),f.unit);}});
  // P01 table and its L-shaped channel use the exact model orientation.
  const tx=f.x(MAP.tile.x),ty=f.y(MAP.tile.z),half=1.75*f.unit;
  rect(tx-half-1,ty-half*.65-1,half*2+2,half*1.3+6,ink);rect(tx-half+2,ty-half*.65+2,half*2-4,half*1.3-4,shadow);
  rect(tx-half+4,ty-half*.65+4,half*2-8,half*1.3-8,'#303030');
  ctx.save();ctx.translate(tx,ty);ctx.scale(1,.65);ctx.rotate(s.p1*Math.PI/2);rect(-1.575*f.unit,-2,1.575*f.unit+2,4,snow);rect(-2,-1.575*f.unit,4,1.575*f.unit+2,snow);ctx.restore();
  rect(f.x(0)-2,f.y(-8.9),4,f.unit*1.4*.65,snow);rect(f.x(1.55),f.y(-6)-2,f.unit*.55,4,snow);
  // The east handle is offset from the feet, matching the 3D control and collider.
  draw.push({z:MAP.tileControl.z+.25,run:()=>{ctx.save();ctx.translate(f.x(MAP.tileControl.x-.8),f.y(MAP.tileControl.z+.25));ctx.scale(f.unit/18,f.unit/18);const x=0,y=0;rect(x-2,y-14,4,15,ink);rect(x-7,y-19,15,10,ink);rect(x-5,y-17,11,6,light);rect(x-1,y-18,3,8,ink);rect(x-7,y-15,15,2,ink);rect(x+5,y-20,3,4,snow);ctx.restore();}});
  // A worn standing board, not an automatic hint or a new control.
  rect(f.x(MAP.tileControl.x)-5,f.y(MAP.tileControl.z)+2,10,4,shadow);
  draw.push({z:-3,run:()=>{ctx.save();ctx.translate(f.x(-3),f.y(-3));ctx.scale(f.unit/18,f.unit/18);const x=0,y=0;rect(x-3,y-3,6,4,ink);rect(x-1,y-20,2,18,ink);rect(x-5,y-27,10,9,ink);rect(x-3,y-25,6,5,snow);rect(x-6,y-29,12,3,shadow);ctx.restore();}});
  draw.push({z:MAP.starPost.z,run:()=>{ctx.save();ctx.translate(f.x(MAP.starPost.x),f.y(MAP.starPost.z));ctx.scale(f.unit/18,f.unit/18);const x=0,y=0;rect(x-2,y-20,4,21,ink);rect(x-14,y-31,29,15,ink);rect(x-12,y-29,25,11,light);rect(x-10,y-26,12,2,shadow);rect(x-10,y-22,10,2,snow);poly([x+7,y-28,x+8,y-25,x+11,y-24,x+8,y-23,x+7,y-20,x+6,y-23,x+3,y-24,x+6,y-25],ink);rect(x-12,y-32,24,3,snow);ctx.restore();}});
  // Portal behind the arrival point: its occupied uprights retain their visible positions.
  draw.push({z:MAP.portal.z,run:()=>{for(const side of[-1,1]){const x=f.x(MAP.portal.x+side*1.25);masonry(x-4,f.y(MAP.portal.z)-24,8,24);rect(x-5,f.y(MAP.portal.z)-26,10,4,snow);}rect(f.x(MAP.portal.x-1.25),f.y(MAP.portal.z)-25,f.unit*2.5,4,ink);for(let i=0;i<16;i++)for(const side of[-1,1])rect(f.x(MAP.portal.x+side*(-.95+i*1.9/15)),f.y(MAP.portal.z)-3-i*1.2,2,2,shadow);}});
  draw.push({z:8,run:()=>{for(let x=-12;x<=12;x+=1.5)rect(f.x(x),f.y(8)-9,2,10,ink);rect(f.x(-12),f.y(8)-7,24*f.unit,2,shadow);}});
  for(const [i,a]of [s.player,s.toto].entries()){
   const d=Math.hypot(a.x-last[i]!.x,a.z-last[i]!.z);walk[i]!+=d*8;last[i]={x:a.x,z:a.z};
   let facing=a.facing;if(options.speaker){const other=i?s.player:s.toto;facing=Math.atan2(other.x-a.x,other.z-a.z);}
   draw.push({z:a.z,run:()=>actor(f.x(a.x),f.y(a.z),i,facing,options.reducedMotion||d<.001?0:walk[i]!,f.unit/18)});
  }
  draw.sort((a,b)=>a.z-b.z).forEach(item=>item.run());
  if(options.focusActionPoint&&options.focusActionId){const x=f.x(options.focusActionPoint.x),y=f.y(options.focusActionPoint.z);rect(x-8,y+4,5,2,ink);rect(x+4,y+4,5,2,ink);rect(x-9,y+1,2,4,ink);rect(x+8,y+1,2,4,ink);}
  // Sparse snow is decorative, respects reduced motion and does not conceal the puzzle.
  for(let i=0;i<25;i++){const x=(i*83+Math.floor(time*2))%f.w,y=(i*47+Math.floor(time*5))%f.h;rect(x,y,1,2,'#ffffff');}
  texture.needsUpdate=true;
 }};
}
