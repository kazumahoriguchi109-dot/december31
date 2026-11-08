import * as THREE from 'three';
import { MAP } from './contract';
import { box, cylinder, lightPool, torus } from './sceneArt';

import {FURNITURE_X_SCALE,ROOM_X_SCALE} from './roomPresentation';
import {ROOM_SOLIDS} from './collision';

/** Small deterministic, locally painted surfaces. No network assets or gameplay state. */
function painted(width:number,height:number,draw:(c:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 draw(canvas.getContext('2d')!);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=4;return texture;
}
function grain(){
 return painted(128,512,c=>{
  c.fillStyle='#ac855f';c.fillRect(0,0,128,512);
  for(let i=0;i<65;i++){
   const x=(i*37.7)%128;c.strokeStyle=i%3?'rgba(71,45,27,.055)':'rgba(245,226,197,.09)';c.lineWidth=i%4===0?1.3:.6;
   c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+5,150,x-5,350,x+2,512);c.stroke();
  }
 });
}
function weave(){
 return painted(256,256,c=>{
  c.fillStyle='#324b56';c.fillRect(0,0,256,256);
  for(let i=0;i<256;i+=3){c.fillStyle=i%2?'rgba(213,220,204,.035)':'rgba(4,21,32,.04)';c.fillRect(i,0,1,256);c.fillRect(0,i,256,1);}
  c.strokeStyle='rgba(218,212,182,.18)';c.lineWidth=1;c.strokeRect(7,7,242,242);
 });
}
function snowView(){
 return painted(512,320,c=>{
  const sky=c.createLinearGradient(0,0,0,320);sky.addColorStop(0,'#516a7a');sky.addColorStop(1,'#91a6ad');c.fillStyle=sky;c.fillRect(0,0,512,320);
  const fir=(x:number,y:number,s:number)=>{
   c.fillStyle='#465e62';c.fillRect(x-3*s,y-110*s,6*s,125*s);
   for(let i=0;i<4;i++){
    const top=y-(150-i*29)*s,w=(19+i*12)*s;
    c.fillStyle='#4f696c';c.beginPath();c.moveTo(x,top);c.lineTo(x-w,top+58*s);c.lineTo(x+w,top+58*s);c.closePath();c.fill();
    c.fillStyle='#d6ddd6';c.beginPath();c.moveTo(x,top-2*s);c.lineTo(x-w*.78,top+44*s);c.lineTo(x-w*.3,top+38*s);c.lineTo(x,top+43*s);c.lineTo(x+w*.32,top+36*s);c.lineTo(x+w*.78,top+44*s);c.closePath();c.fill();
   }
  };
  fir(267,260,.7);fir(455,270,1.25);fir(67,278,1.45);fir(390,280,.65);
  c.fillStyle='#dce2da';c.beginPath();c.moveTo(0,288);c.quadraticCurveTo(160,268,260,294);c.quadraticCurveTo(390,275,512,290);c.lineTo(512,320);c.lineTo(0,320);c.fill();
  for(let i=0;i<36;i++){c.fillStyle='rgba(238,236,213,.55)';c.beginPath();c.arc((i*93.7)%512,(i*67.3)%290,1.2+i%3*.4,0,Math.PI*2);c.fill();}
 });
}

/** Presentation-only replacement for the original room; model coordinates stay untouched. */
export function createRoomArt(room:THREE.Group):{screen:THREE.Object3D;calendar:THREE.Object3D}{
 const wood=grain(),cloth=weave();
 // Explicit section boundaries preserve assembled furniture proportions: map the
 // anchor like actors, but widen its component offsets by only the art scale.
 let sectionStart=room.children.length;
 const finishSection=(name:string,anchorX:number,widthScale=FURNITURE_X_SCALE)=>{
  const pieces=room.children.slice(sectionStart),group=new THREE.Group();group.name=name;
  group.position.x=anchorX*ROOM_X_SCALE;group.scale.x=widthScale;
  for(const piece of pieces){piece.position.x-=anchorX;group.add(piece);}
  room.add(group);sectionStart=room.children.length;return group;
 };
 const timber=(w:number,h:number,d:number,x:number,y:number,z:number,color=0xffffff)=>{
  const mesh=box(room,w,h,d,x,y,z,color);mesh.material.map=wood;return mesh;
 };
 box(room,8,.34,7,0,-.19,-.5,0x604029);
 // Narrow seams and staggered end joints keep the timber readable without noisy grain.
 for(let i=0;i<20;i++){
  const x=-3.8+i*.4,split=-1.8+(i%3)*1.3;
  timber(.391,.055,split+4-.012,x,-.027,(-4+split)/2, i%3===0?0xe9d1ad:0xffe6c5);
  timber(.391,.055,3-split-.012,x,-.027,(3+split)/2,i%4===0?0xebcea8:0xffdfb4);
 }
 const plaster=painted(256,256,c=>{c.fillStyle='#eee0c4';c.fillRect(0,0,256,256);for(let i=0;i<1100;i++){c.fillStyle=i%2?'rgba(131,104,70,.012)':'rgba(255,255,247,.022)';c.fillRect(i*37%256,i*53%256,1,1);}});
 for(const [w,d,x,z] of [[8,.18,0,-4],[.18,7,-4,-.5],[.18,7,4,-.5]]){
  const height=x===0?3:.72; // Cutaway side walls leave edge actors visible from the fixed camera.
  const shellWidth=x===0?w!:w!/ROOM_X_SCALE;
  const wall=box(room,shellWidth,height,d!,x!,height/2,z!,0xffffff);wall.material.map=plaster;
  box(room,shellWidth, .16,d!+.025,x!, .09,z!,0xb79b72);
 }
 box(room,7.82,.08,.12,0,.21,-3.87,0xf0dfb9);
 for(const x of[-3.87,3.87]){box(room,.13/ROOM_X_SCALE,.23,6.94,x,.12,-.5,0xcdb58c);box(room,.16/ROOM_X_SCALE,.065,6.94,x,.26,-.5,0xf1dfb8);}
 box(room,8.12,.15,.16,0,-.07,3,0x8e5d38);
 finishSection('room-shell',0,ROOM_X_SCALE);
 // Walnut case, recessed shelf interiors and a quiet handful of books.
 const {x:shelfX,z:shelfZ}=ROOM_SOLIDS.shelf;
 timber(1.65,2.22,.12,shelfX,1.14,-3.73,0x78513b);
 for(const x of[shelfX-.84,shelfX+.84])timber(.13,2.28,.68,x,1.16,shelfZ,0xb28b66);
 for(const y of[.12,.8,1.47,2.23]){timber(1.8,.11,.73,shelfX,y,shelfZ,0xb08a64);timber(1.8,.05,.05,shelfX,y+.04,-3.01,0xd0a575);}
 timber(ROOM_SOLIDS.shelf.width,.25,ROOM_SOLIDS.shelf.depth,shelfX,2.32,shelfZ,0xa77b53);
 for(let i=0;i<5;i++){
  const book=box(room,.105,.32+(i%3)*.05,.27,-3.52+i*.12,.34+(i%3)*.025,-3.29,[0x465d55,0xa96e4c,0xb5a17b,0x5c6b72,0x805849][i]!);
  book.rotation.z=i===4?-.12:0;box(room,.07,.018,.012,book.position.x,.26,-3.148,0xd2b98b);
 }
 finishSection('walnut-bookcase',shelfX);
 // Rug sits almost flush to the unchanged walkable floor.
 box(room,3.6,.035,2.85,0,.019,.55,0x314751);
 box(room,3.46,.014,2.71,0,.044,.55,0xe2c496);
 const rug=box(room,3.19,.012,2.44,0,.056,.55,0xffffff);rug.material.map=cloth;
 for(let i=0;i<17;i++)for(const z of[-.96,2.06]){
  box(room,.047,.018,.19,-1.62+i*.2025,.023,z,0xe5cda3);
 }
 finishSection('woven-rug',0);
 // The console anchor follows the shared display mapping, not model/collision coordinates.
 const {x:cx,z:cz}=MAP.console;
 timber(1.95,.53,.85,cx,.36,cz,0x9b6b48);timber(ROOM_SOLIDS.desk.width,.12,ROOM_SOLIDS.desk.depth,cx,.69,cz,0xd6a06b);
 for(const x of[cx-.82,cx+.82])for(const z of[cz-.32,cz+.32])timber(.13,.24,.13,x,.12,z,0x865a3c);
 box(room,.58,.055,.3,cx,.78,cz-.23,0x26383b);box(room,.13,.3,.1,cx,.91,cz-.29,0x2b3c3e);
 box(room,1.46,.88,.13,cx,1.3,cz-.29,0x23363b);
 const screen=box(room,1.27,.67,.025,cx,1.31,cz-.213,0xffffff);
 screen.name='game-television-screen';
 screen.material.map=painted(640,360,c=>{
  const glow=c.createLinearGradient(0,0,0,360);glow.addColorStop(0,'#162c48');glow.addColorStop(1,'#527f87');c.fillStyle=glow;c.fillRect(0,0,640,360);
  // Original pixel-game landscape, clearly distinct from the window view.
  c.fillStyle='#f4d798';for(const [x,y] of [[60,48],[146,93],[520,60],[573,128]] as const){c.fillRect(x,y,6,6);}
  c.fillStyle='#829fa3';c.beginPath();c.moveTo(0,260);c.lineTo(130,124);c.lineTo(245,251);c.lineTo(446,112);c.lineTo(640,273);c.closePath();c.fill();
  c.fillStyle='#e3e9d8';c.beginPath();c.moveTo(0,284);c.lineTo(125,261);c.lineTo(251,281);c.lineTo(434,251);c.lineTo(640,279);c.lineTo(640,360);c.lineTo(0,360);c.fill();
  for(const [x,color] of [[119,'#c17b51'],[491,'#64896f']] as const){c.fillStyle='#302c2c';c.fillRect(x,228,26,18);c.fillStyle='#f4d5ae';c.fillRect(x+3,241,20,16);c.fillStyle=color;c.fillRect(x-3,257,32,33);c.fillStyle='#243844';c.fillRect(x,290,10,13);c.fillRect(x+17,290,10,13);}
  c.fillStyle='#193747';c.beginPath();c.roundRect(257,116,126,112,18);c.fill();c.strokeStyle='#efcf8e';c.lineWidth=5;c.stroke();
  c.fillStyle='#ffe0a2';c.beginPath();c.moveTo(303,140);c.lineTo(350,172);c.lineTo(303,204);c.closePath();c.fill();
  c.fillStyle='#f6e6bd';c.font='bold 24px sans-serif';c.textAlign='center';c.fillText('2 PLAYER',320,52);
  c.fillStyle='rgba(231,239,224,.1)';c.fillRect(0,0,640,9);
 });
 // Keep the renderer-owned proximity highlight; the painted game image supplies the screen colors.
 // Physical two-player console and controllers stay within the existing desk collider.
 const consoleBody=box(room,.53,.13,.3,cx,.825,cz+.13,0xd7d2bb);consoleBody.name='game-console-body';
 box(room,.49,.035,.285,cx,.891,cz+.13,0xe9e2cb);
 box(room,.27,.014,.03,cx,.914,cz+.09,0x283b40);
 for(let i=0;i<5;i++)box(room,.014,.012,.095,cx+.14+i*.025,.915,cz+.15,0x596765);
 box(room,.025,.02,.012,cx-.19,.835,cz+.287,0x85cbb0);
 for(const x of[cx-.43,cx+.43]){
  const pad=box(room,.28,.065,.17,x,.795,cz+.30,0x344b50);pad.name='game-controller';
  cylinder(room,.065,.065,x-.105,.795,cz+.335,0x344b50,12);cylinder(room,.065,.065,x+.105,.795,cz+.335,0x344b50,12);
  box(room,.065,.014,.025,x-.07,.835,cz+.30,0xe5d8b7);box(room,.025,.014,.065,x-.07,.835,cz+.30,0xe5d8b7);
  cylinder(room,.018,.015,x+.065,.835,cz+.28,0xdca56a,12);cylinder(room,.018,.015,x+.10,.835,cz+.32,0x9dbb9c,12);
  const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x,.79,cz+.22),new THREE.Vector3(x*.9,.78,cz+.03),new THREE.Vector3(x*.4,.79,cz+.26)]),16,.009,5,false),new THREE.MeshStandardMaterial({color:0x293b3e,roughness:1}));room.add(cable);
 }
 for(const x of[cx-.79,cx+.79]){
  cylinder(room,.085,.15,x,.825,cz+.12,0xe6cca0,16);
  cylinder(room,.069,.007,x,.902,cz+.12,0x96704b,16);
  const rim=torus(room,.073,.01,x,.906,cz+.12,0xf2ddb7);rim.rotation.x=Math.PI/2;
  const handle=torus(room,.038,.014,x+.091,.84,cz+.12,0xe6cca0);handle.scale.y=.9;
 }
 finishSection('console-desk',cx);
 // Wall-mounted geometry, not a camera-facing sprite: paper edges and binding cast real shadows.
 const calendar=new THREE.Group();calendar.name='december-calendar';calendar.position.set(-1.48,1.97,-3.78);room.add(calendar);
 box(calendar,1.02,1.36,.065,0,0,0,0x8b6545);
 for(let i=0;i<3;i++)box(calendar,.96,1.27,.012,.008*i,-.015*i,.044+i*.013,0xe8d8b7);
 const page=painted(512,640,c=>{
  c.fillStyle='#f6e8c9';c.fillRect(0,0,512,640);
  c.fillStyle='#9c5945';c.fillRect(0,0,512,124);
  c.fillStyle='#fff1d1';c.textAlign='center';c.textBaseline='middle';c.font='bold 70px sans-serif';c.fillText('12月',256,68);
  c.fillStyle='#38372e';c.font='bold 244px sans-serif';c.fillText('31',256,306);
  c.strokeStyle='#cbb58a';c.lineWidth=3;c.beginPath();c.moveTo(55,456);c.lineTo(457,456);c.stroke();
  c.fillStyle='#9b7851';c.font='25px sans-serif';c.fillText('DECEMBER',190,516);
  c.fillStyle='#c98e35';c.font='76px sans-serif';c.fillText('✦',397,533);
 });
 const calendarPage=new THREE.Mesh(new THREE.PlaneGeometry(.96,1.27),new THREE.MeshStandardMaterial({map:page,roughness:1}));calendarPage.name='calendar-paper-face';calendarPage.position.z=.084;calendar.add(calendarPage);
 for(const x of[-.32,.32]){const ring=torus(calendar,.055,.016,x,.65,.055,0x444c46);ring.rotation.y=Math.PI/2;}
 finishSection('calendar-display',calendar.position.x);
 // Framed winter view is a locally painted diorama backing, safely inside the room shell.
 const wx=2.65,wy=2.03,wz=-3.86;
 timber(2.04,1.48,.14,wx,wy,wz,0x9b6947);
 const window=new THREE.Mesh(new THREE.PlaneGeometry(1.82,1.27),new THREE.MeshBasicMaterial({map:snowView()}));window.position.set(wx,wy,wz+.078);room.add(window);
 for(const x of[wx-.99,wx+.99])timber(.095,1.48,.16,x,wy,wz+.045,0xb98253);
 for(const y of[wy-.72,wy+.72])timber(2.08,.095,.17,wx,y,wz+.045,0xbd8d60);
 box(room,.065,1.28,.065,wx,wy,wz+.135,0xe7cf9f);box(room,1.86,.06,.065,wx,wy,wz+.135,0xe7cf9f);
 timber(2.17,.1,.28,wx,wy-.77,wz+.11,0xd6ae7c);
 finishSection('winter-window',wx);
 // Faceted linen lamp with warm spill rather than a uniform orange room wash.
 const {x:lx,z:lz}=ROOM_SOLIDS.lamp;
 cylinder(room,.3,.12,lx,.12,lz,0xa3743e,12);cylinder(room,.23,.29,lx,.31,lz,0xf0c375,12);
 cylinder(room,.04,.52,lx,.66,lz,0x967143,10);
 const shade=new THREE.Mesh(new THREE.CylinderGeometry(.22,ROOM_SOLIDS.lamp.radius,.57,10,1,true),new THREE.MeshStandardMaterial({color:0xf0d6a2,side:THREE.DoubleSide,roughness:1,flatShading:true,emissive:0xffca76,emissiveIntensity:.16}));shade.position.set(lx,.97,lz);shade.castShadow=true;room.add(shade);
 const lampTop=new THREE.Mesh(new THREE.CircleGeometry(.215,10),new THREE.MeshBasicMaterial({color:0xfff1b8}));lampTop.rotation.x=-Math.PI/2;lampTop.position.set(lx,1.257,lz);room.add(lampTop);
 const pool=lightPool(room,lx,lz,1.65);pool.material.opacity=.8;
 const indoorLight=new THREE.PointLight(0xffbd6c,9,9,2);indoorLight.position.set(lx,1.48,lz+.15);room.add(indoorLight);
 finishSection('reading-lamp',lx);
 // Green upholstered reading chair and its walnut frame stay at the original edge.
 const {x:ax,z:az}=ROOM_SOLIDS.chair;
 for(const x of[ax-.4,ax+.4])for(const z of[az-.34,az+.36])timber(.105,.38,.11,x,.19,z,0x8a5a39);
 timber(.97,.14,.86,ax,.38,az,0x966a46);
 box(room,.81,.23,.76,ax,.55,az,0x63745b);
 const back=box(room,.85,.7,.19,ax,.88,az-.34,0x5b7059);back.rotation.x=-.06;
 box(room,.7,.12,.16,ax,1.22,az-.36,0x718066);
 for(const x of[ax-(ROOM_SOLIDS.chair.width/2-.07),ax+(ROOM_SOLIDS.chair.width/2-.07)]){timber(.13,.55,.13,x,.58,az-.25,0x94623f);timber(.14,.13,ROOM_SOLIDS.chair.depth,x,.8,az,0xb38352);}
 finishSection('green-armchair',ax);
 return {screen,calendar};
}
