import * as THREE from 'three';
import { winterAsset } from '../render/winterAssets';
import type { Expression } from './contract';

export interface ActorPerformance {
 speaking?: boolean;
 expression?: Expression;
 action?: {id: string; progress: number};
 reducedMotion?: boolean;
}
type Kind = 'player' | 'toto';
const PALETTES = {
 player: {coat:'#b96b4d',shade:'#854e3d',light:'#d29169',trim:'#e6d3aa',hair:'#50382f'},
 toto: {coat:'#57796b',shade:'#35564a',light:'#82a18a',trim:'#ad5148',hair:'#46372e'},
};

/** Authored pixels, not a filtered model. All four directions have their own readable silhouette.
 * The lower opaque pixel is always row 47: the sprite origin is the planted sole, including while stepping. */
export function pixelActor(kind: Kind) {
 const cache = new Map<string,THREE.CanvasTexture>();
 const p=PALETTES[kind], ink='#26333a', skin='#e7bb95', skinShade='#c89576';
 function texture(era:number,dir:number,gait:number,expression:Expression,speaking:boolean,gesture:number) {
  const key=[era,dir,gait,expression,speaking,gesture].join('/');const cached=cache.get(key);if(cached)return cached;
  const cv=document.createElement('canvas'),scale=era?2:1;cv.width=32*scale;cv.height=48*scale;
  const c=cv.getContext('2d')!;c.scale(scale,scale);c.imageSmoothingEnabled=false;
  const rect=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(Math.round(x*scale)/scale,Math.round(y*scale)/scale,w,h);};
  const poly=(points:number[],color:string)=>{c.fillStyle=color;c.beginPath();for(let i=0;i<points.length;i+=2){if(i===0)c.moveTo(points[i]!,points[i+1]!);else c.lineTo(points[i]!,points[i+1]!);}c.closePath();c.fill();};
  const side=dir===1||dir===3,back=dir===2,left=dir===3;
  // Drawing right profile once and mirroring the geometry preserves the front-facing eye and toe.
  if(left){c.translate(32,0);c.scale(-1,1);}
  const step=gait===1?-1:gait===3?1:0;
  // Legs move opposite the sleeves, without making the feet float above the sprite origin.
  if(side){
   rect(12-step*2,38,5,8,ink);rect(16+step*2,38,5,8,ink);
   rect(12-step*2,step<0?44:45,8,step<0?3:3,ink);rect(16+step*2,step>0?44:45,8,step>0?3:3,ink);
   rect(14+step*2,46,8,2,ink);
  }else{
   rect(10-step,38,5,9,ink);rect(18+step,38,5,9,ink);
   rect(9-step,step<0?44:45,7,step<0?3:3,ink);rect(18+step,step>0?44:45,7,step>0?3:3,ink);
  }
  const upper=gesture===2?2:gesture===1?5:0;
  if(side){
   // Rear sleeve first; narrow coat and forward face identify profile even in the coarse era.
   rect(10,25-step,5,12,p.shade);rect(10,36-step,5,4,p.trim);
   poly([12,23,22,23,24,39,12,40,10,34],ink);poly([13,24,21,24,23,38,12,38],p.coat);
   rect(14,26+step-upper,5,12,p.shade);rect(15,37+step-upper,5,4,p.trim);
   if(kind==='player'){rect(13,24,10,3,p.trim);rect(20,30,2,6,p.light);}
   else{rect(12,24,11,4,p.trim);rect(20,27,3,10,p.trim);rect(20,35,3,2,'#d67e66');}
  }else{
   rect(6,25+step,5,12,p.shade);rect(22,25-step-upper,5,12,p.shade);
   rect(6,36+step,5,4,p.trim);rect(22,36-step-upper,5,4,p.trim);
   // The protagonist's broad rounded hem and Toto's straight jacket remain distinct without colour.
   poly(kind==='player'?[10,23,23,23,25,39,23,41,9,41,8,38]:[10,23,23,23,24,39,9,39],ink);
   poly(kind==='player'?[11,24,22,24,24,38,22,40,10,40,9,38]:[11,24,22,24,23,38,10,38],p.coat);
   if(back){
    if(kind==='player'){
     // Broad pale collar and long rounded coat remain recognizable without color.
     poly([10,24,16,27,23,24,22,28,16,30,11,28],p.trim);
    }else{
     // A long asymmetric scarf tail is legible even in E0's monochrome palette.
     const scarf=era?p.trim:'#e6d3aa';
     rect(10,24,13,3,scarf);rect(19,26,4,10,scarf);rect(18,35,5,2,scarf);
     rect(19,37,1,2,scarf);rect(22,37,1,2,scarf);
    }
    rect(15,31,1,5,p.shade);rect(11,37,12,1,p.shade);
   }
   else{
    if(kind==='player'){poly([10,24,16,27,13,30,9,27],p.trim);poly([23,24,16,27,19,30,24,27],p.trim);}
    else{rect(10,24,13,4,p.trim);rect(20,27,3,11,p.trim);rect(20,36,3,2,'#d67e66');}
    rect(16,29,1,10,p.light);rect(10,34,4,3,p.shade);rect(19,34,4,3,p.shade);
    rect(18,30,1,1,'#e6c486');rect(18,33,1,1,'#e6c486');
   }
  }
  // Hair framing and short hair tufts intentionally have different outer contours.
  if(side){
   rect(9,7,13,16,p.hair);rect(13,10,11,12,skin);rect(22,16,3,4,skin);
   rect(10,6,12,6,p.hair);rect(9,10,5,13,p.hair);
   if(kind==='player'){rect(8,13,6,12,p.hair);rect(11,8,6,6,p.hair);rect(11,24,4,1,p.hair);}
   else{rect(15,4,5,4,p.hair);rect(11,7,6,7,p.hair);rect(11,18,3,3,skinShade);}
   if(expression==='relieved'){rect(20,16,3,1,ink);rect(21,15,1,1,ink);}
   else rect(21,expression==='surprised'?14:15,2,expression==='surprised'?4:3,ink);
   if(era)rect(20,expression==='curious'?12:13,3,.5,p.hair);
   else if(expression==='curious')rect(20,12,3,1,p.hair);
   rect(22,21,speaking||expression==='surprised'?2:2,speaking||expression==='surprised'?2:1,'#976952');
  }else{
   rect(8,7,17,16,p.hair);rect(10,10,13,14,skin);rect(7,8,18,5,p.hair);rect(10,5,12,4,p.hair);
   if(kind==='player'){rect(7,12,4,12,p.hair);rect(22,11,4,14,p.hair);rect(10,8,7,5,p.hair);rect(10,23,2,2,p.hair);}
   else{rect(18,3,4,5,p.hair);rect(13,5,3,3,p.hair);rect(8,9,4,6,p.hair);rect(19,9,4,3,p.hair);}
   if(back){rect(9,9,15,15,p.hair);if(kind==='player'){rect(7,19,19,7,p.hair);rect(8,25,4,2,p.hair);rect(21,25,4,2,p.hair);}else{rect(11,21,11,3,p.hair);rect(12,23,10,2,skinShade);}}
   else{
    if(expression==='relieved'){rect(12,16,3,1,ink);rect(13,15,1,1,ink);rect(19,16,3,1,ink);rect(20,15,1,1,ink);}
    else{rect(12,15,2,expression==='surprised'?4:3,ink);rect(20,15,2,expression==='surprised'?4:3,ink);}
    rect(16,18,1,2,skinShade);
    if(speaking||expression==='surprised')rect(16,21,3,2,'#976952');
    else if(expression==='relieved'){rect(15,21,1,1,'#976952');rect(16,22,3,1,'#976952');rect(19,21,1,1,'#976952');}
    else rect(16,22,3,1,'#976952');
    if(!era&&expression==='curious'){rect(12,12,3,1,p.hair);rect(19,14,3,1,p.hair);}
    if(era){rect(12,expression==='curious'?12.5:13.5,3,.5,p.hair);rect(19,expression==='curious'?14:13.5,3,.5,p.hair);rect(11,19,2,.5,'#d58d78');rect(21,19,2,.5,'#d58d78');}
   }
  }
  if(era){
   // E1 adds half-pixel stitching and material highlights, never soft filtering.
   rect(side?13:10,28,.5,8,p.light);rect(side?13:10,39,side?10:13,.5,p.light);
   if(!back){rect(side?17:12,10,3,.5,'#f6d5ae');rect(side?10:8,12,.5,7,'#79543e');}
   rect(side?15:11,45,3,.5,'#9c856c');rect(side?20:20,45,3,.5,'#9c856c');
   if(kind==='player'&&!back){rect(side?11:23,13,2,1,'#d9ad65');}
   if(kind==='toto'&&back){rect(side?13:12,28,9,.5,p.light);}
  }
  const tex=new THREE.CanvasTexture(cv);tex.magFilter=tex.minFilter=THREE.NearestFilter;tex.colorSpace=THREE.SRGBColorSpace;tex.generateMipmaps=false;cache.set(key,tex);return tex;
 }
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture(0,0,0,'neutral',false,0),alphaTest:.5,depthWrite:true}));
 sprite.center.set(.5,0);sprite.scale.set(1.15,1.725,1);sprite.name=`pixel-${kind}`;
 return {sprite,update(era:number,facing:number,walk:number,performance:ActorPerformance={}){
  const dir=((Math.round(facing/(Math.PI/2))%4)+4)%4;
  const gait=performance.reducedMotion||Math.abs(walk)<.001?0:((Math.floor(walk/(Math.PI/2))%4)+4)%4;
  const progress=performance.action?.progress??0;
  const gesture=progress>0&&progress<1?(performance.reducedMotion?1:Math.sin(progress*Math.PI)>.65?2:1):0;
  const next=texture(era>=1?1:0,dir,gait,performance.expression??'neutral',!!performance.speaking,gesture);
  if(sprite.material.map!==next)sprite.material.map=next;
 }};
}

/** Small original wardrobe details are attached to the existing rig; authored proportions and sole height stay intact. */
export function createJourneyActor(kind:Kind):THREE.Group {
 const actor=winterAsset(kind);
 const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.96,metalness:0,flatShading:true});
 const cream=mat(0xe6d3aa),amber=mat(0xd9ad65),stitch=mat(kind==='player'?0xd29169:0x82a18a);
 const addBox=(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,name:string)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const body=actor.getObjectByName('rig-body')??actor,head=actor.getObjectByName('rig-head')??actor;
 // Positions below are local to their rig, preserving shared head and arm posing.
 if(kind==='player'){
  addBox(head,.085,.022,.025,.205,.18,-.145,amber,'hair-clip');
  addBox(head,.022,.06,.025,.215,.18,-.145,amber,'hair-clip-cross');
  for(const x of[-.16,.16]){addBox(body,.115,.015,.018,x,-.01,-.285,stitch,'pocket-stitch');addBox(body,.015,.07,.018,x-.05,-.045,-.285,stitch,'pocket-edge');}
  // A scalloped cream cuff gives the protagonist a softer silhouette than Toto's scarf and straight jacket.
  for(const name of['rig-armL','rig-armR']){const arm=actor.getObjectByName(name);if(arm)addBox(arm,.135,.035,.15,name==='rig-armL'?-.07:.07,-.33,-.01,cream,'knit-cuff');}
 }else{
  addBox(body,.115,.14,.025,.16,.025,-.318,mat(0xad5148),'scarf-tip');
  // The asymmetric tail is visible from behind as well as in the portrait.
  addBox(body,.12,.27,.035,.16,.015,.29,mat(0xad5148),'scarf-back-tail');
  for(const x of [.12,.16,.20])addBox(body,.012,.055,.04,x,-.145,.29,mat(0xad5148),'scarf-back-fringe');
  for(const x of[.12,.16,.20])addBox(body,.012,.05,.028,x,-.065,-.318,mat(0xad5148),'scarf-fringe');
  addBox(body,.085,.035,.025,-.14,.20,-.265,stitch,'jacket-tab');
  addBox(body,.025,.025,.025,-.14,.20,-.285,amber,'jacket-tab-button');
 }
 actor.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
 actor.userData['characterDesign']='winter-friends-cycle009';
 return actor;
}
