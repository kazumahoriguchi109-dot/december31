import type * as THREE from 'three';
import { poseFigure } from '../render/characterPose';
import type { Expression } from './contract';

export interface JourneyActorPose {
 kind:'player'|'toto'; speaking:boolean; expression:Expression;
 action?:{id:string;progress:number}; waiting:boolean; walk:number; time:number; reducedMotion:boolean;
}
const finite=(n:number,fallback=0)=>Number.isFinite(n)?n:fallback;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,finite(n)));

/** Presentation only. Root transforms and gameplay state belong to the renderer/model. */
export function poseJourneyActor(actor:THREE.Object3D,opts:JourneyActorPose):void {
 const time=finite(opts.time),quiet=opts.reducedMotion,walk=quiet?0:clamp(opts.walk,-1,1);
 const pulse=quiet?0:Math.sin(time*6.2+(opts.kind==='toto'?.8:0));
 poseFigure(actor,{speaking:opts.speaking,waiting:opts.waiting,walk,pulse});
 const head=actor.getObjectByName('rig-head'),left=actor.getObjectByName('rig-armL'),right=actor.getObjectByName('rig-armR');
 const eyes=actor.getObjectByName('rig-eyes'),mouth=actor.getObjectByName('rig-mouth'),brows=actor.getObjectByName('rig-brows');
 // Tiny head motion suggests breathing without moving the feet or actor origin.
 if(head&&!quiet)head.rotation.x+=Math.sin(time*1.8)*.009*(1-Math.abs(walk));
 switch(opts.expression){
  case 'curious':
   if(head){head.rotation.z+=opts.kind==='toto'?-.085:.065;head.rotation.x-=.035;}
   if(brows)brows.rotation.z=opts.kind==='toto'?-.045:.045;
   break;
  case 'surprised':
   if(head)head.rotation.x-=.09;
   if(eyes)eyes.scale.y=1.12;
   if(mouth){mouth.scale.x=.72;mouth.scale.y=opts.speaking?1.5:1.15;}
   if(brows)brows.rotation.z=.055;
   break;
  case 'relieved':
   if(head)head.rotation.x+=.035;
   if(eyes)eyes.scale.y=.88;
   if(mouth){mouth.scale.x=1.12;mouth.scale.y=opts.speaking?1.05:.6;}
   break;
 }
 if(!opts.action)return;
 const p=clamp(opts.action.progress,0,1);
 // Actions ease out at both ends. Reduced motion retains a stable readable pose.
 const weight=p<=0||p>=1?0:quiet?.65:Math.sin(Math.PI*p);
 const id=opts.action.id;
 if(['tile','drain','stopper','lever-a','lever-b'].includes(id)){
  if(left){left.rotation.x+=.66*weight;left.rotation.z-=.14*weight;}
  if(right){right.rotation.x+=.9*weight;right.rotation.z+=(quiet?.08:Math.sin(p*Math.PI*2)*.17)*weight;}
  if(head)head.rotation.x+=.1*weight;
 }else if(id==='latch'){
  const pull=quiet?.5:p;
  if(left){left.rotation.x+=(1.05-.45*pull)*weight;left.rotation.z-=.12*weight;}
  if(right){right.rotation.x+=(1.05-.45*pull)*weight;right.rotation.z+=.12*weight;}
  if(head)head.rotation.x-=.045*weight;
 }else if(id==='call'||id==='partner'||id==='wait'){
  if(right){right.rotation.x+=.85*weight;right.rotation.z+=.48*weight;}
  if(head)head.rotation.y+=(opts.kind==='toto'?-.16:.16)*weight;
 }
}
