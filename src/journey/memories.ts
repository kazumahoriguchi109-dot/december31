import {distance, type JourneyState, type Point} from './contract';

/** Optional memories are discovered by returning to places the children have changed. */
export const MEMORIES = [
 {id:'gate', point:{x:2.8,z:-39.8}, title:'門の向こう', lines:[['トト','あの門の前、ひとりで待つのは少しこわかった。'],['主人公','声をかけたら、ちゃんと来てくれたね。'],['トト','うん。離れても、声は届くんだね。']]},
 {id:'water', point:{x:1.8,z:-19.5}, title:'水の音', lines:[['主人公','水が動いたとき、トト、いちばんに笑った。'],['トト','だって、止まっていた景色が動き出したんだよ。'],['主人公','ふたりで動かした景色だね。']]},
 {id:'first', point:{x:4.5,z:-8.8}, title:'はじめの一歩', lines:[['トト','ここでは、まだ色もなかったね。'],['主人公','あのときは、帰り道がこんなに遠いと思わなかった。'],['トト','でも、隣にいたから歩けたよ。']]}] as const;
export function memoryAt(s:JourneyState,enabled:boolean):typeof MEMORIES[number]|null {
 if(!enabled||s.phase!=='world'||s.mode!=='walk'||s.era<3)return null;
 return MEMORIES.find(m=>distance(s.player,m.point as Point)<1.25)??null;
}

/** Remembering is optional. A lit trace remains in the world and in the ordinary save. */
export function lightMemory(s:JourneyState,id:string):boolean {
 if(s.phase!=='world'||s.mode!=='walk'||s.era<3||!MEMORIES.some(m=>m.id===id))return false;
 const key=`memory-lit-${id}`;if(s.seen.includes(key))return false;s.seen.push(key);return true;
}
export const memoryLit=(s:JourneyState,id:string)=>s.seen.includes(`memory-lit-${id}`);

/** A lit trail is saved immediately; its explanation is only marked read after dismissal. */
export function pendingMemoryExplanation(s:JourneyState):string|null {
 if(s.phase!=='world')return null;
 return MEMORIES.find(m=>memoryLit(s,m.id)&&!s.seen.includes(`memory-explained-${m.id}`))?.id??null;
}
export function acknowledgeMemoryExplanation(s:JourneyState,id:string):boolean {
 if(!MEMORIES.some(m=>m.id===id)||!memoryLit(s,id)||s.seen.includes(`memory-explained-${id}`))return false;
 s.seen.push(`memory-explained-${id}`);return true;
}

/** Remember which individual conversation lines the player actually dismissed. */
export function acknowledgeMemoryLine(s:JourneyState,id:string,index:number):boolean {
 const memory=MEMORIES.find(m=>m.id===id);
 if(!memory||!memoryLit(s,id)||!Number.isInteger(index)||index<0||index>=memory.lines.length)return false;
 const key=`memory-line-${id}-${index}`;if(s.seen.includes(key))return false;s.seen.push(key);return true;
}
export function unreadMemoryLines(s:JourneyState,id:string) {
 const memory=MEMORIES.find(m=>m.id===id);if(!memory||!memoryLit(s,id))return [];
 return memory.lines.map(([speaker,text],index)=>({speaker,text,index})).filter(line=>!s.seen.includes(`memory-line-${id}-${line.index}`));
}
