import { pixelActor } from '../journey/actorArt';
import { materialPortrait } from '../journey/materialPortrait';
import type { DialogueEmotion } from '../ui/portraits';
import type { Expression } from '../journey/contract';
import type { View } from './model';

const expressions: Record<DialogueEmotion, Expression> = {neutral:'neutral',question:'curious',surprise:'surprised',relief:'relieved'};
const portraits = new Map<string, string>();
/** 2D portraits come from the world actor itself, never a second character design. */
export function characterPortrait(speaker:string, emotion:DialogueEmotion, view:View):string {
 if(view!=='mono'&&view!=='color')return materialPortrait(speaker,emotion);
 const kind=speaker==='トト'?'toto':'player';
 const key=`${kind}/${view}/${emotion}`;
 let url=portraits.get(key);
 if(!url){
  const actor=pixelActor(kind);
  const initial=actor.sprite.material.map;
  actor.update(view==='color'?1:0,0,0,{expression:expressions[emotion],reducedMotion:true});
  const texture=actor.sprite.material.map!;
  const source=texture.image as HTMLCanvasElement;
  const scale=source.width/32;
  const crop=document.createElement('canvas');crop.width=26*scale;crop.height=26*scale;
  const context=crop.getContext('2d')!;context.imageSmoothingEnabled=false;
  context.drawImage(source,4*scale,2*scale,26*scale,26*scale,0,0,crop.width,crop.height);
  url=crop.toDataURL();portraits.set(key,url);
  initial?.dispose();if(texture!==initial)texture.dispose();actor.sprite.material.dispose();
 }
 return `<img class="world-character-portrait" data-character="${kind}" data-portrait-era="${view}" src="${url}" alt=""/>`;
}
