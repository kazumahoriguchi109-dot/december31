import type {JourneyEvent,JourneyState} from './contract';

type Speaker='主人公'|'トト';
type StoryLine=readonly [Speaker,string];
/** Approved opening dialogue. Stage directions are not spoken as character lines. */
export const OPENING_ROOM:readonly StoryLine[]=[
 ['主人公','今年も、もう終わりだね'],
 ['トト','ほんとだ。カレンダー、最後の一枚だ'],
 ['主人公','なんか、あっという間だったなあ'],
 ['トト','毎年そう言ってない？'],
 ['主人公','……言ってるかも'],
 ['トト','去年も言ってたよ。たぶん一昨年も'],
 ['主人公','覚えてるの？'],
 ['トト','覚えてないけど、言ってそうだから'],
 ['主人公','なんだそれ'],
 ['主人公','でも、今年もいろいろあったね'],
 ['トト','うん。……楽しかった？'],
 ['主人公','うん、楽しかったよ。トトは？'],
 ['トト','もちろん。まだ今年、終わってないけどね'],
 ['主人公','そっか。じゃあ、最後まで楽しまないと'],
 ['トト','さっき描いた星も、まだ今日のままだし'],
 ['主人公','ちょっと曲がっちゃったけどね'],
 ['トト','それもいいじゃん。二人で描いたんだから'],
 ['主人公','じゃあ今日も、このゲームの続きをやって今年を締めようか'],
 ['トト','いいね。今日はどこまで進めるかな'],
 ['主人公','前より先に進めたらいいな'],
 ['トト','よーし、準備はいい？'],
 ['主人公','うん、始めよう！'],
];
export const OPENING_DESK:readonly StoryLine[]=[
 ['主人公','あれ？　こんな画面、あったっけ？'],
 ['トト','……なかったと思う'],
 ['主人公','えっ、ちょっと待って……！'],
 ['トト','うわっ！'],
];
export const OPENING_ARRIVAL:readonly StoryLine[]=[
 ['主人公','あれ……本当に、ゲームの中にいる。'],
 ['トト','道の先に城がある。まずは、あの光る石まで行ってみよう。'],
];
const tracks={room:OPENING_ROOM,desk:OPENING_DESK,arrival:OPENING_ARRIVAL};
type Track=keyof typeof tracks;
const VERSION='opening-story-v1';
export const hasOpeningStory=(s:JourneyState)=>s.seen.includes(VERSION);
const mark=(s:JourneyState,id:string)=>{if(!s.seen.includes(id))s.seen.push(id);};
const count=(s:JourneyState,track:Track)=>{
 const value=s.seen.find(id=>id.startsWith(`opening-read-${track}-`));
 const n=Number(value?.slice(`opening-read-${track}-`.length)??0);
 return Number.isInteger(n)&&n>=0&&n<=tracks[track].length?n:0;
};
function lines(s:JourneyState,track:Track):JourneyEvent[]{
 return tracks[track].slice(count(s,track)).map(([speaker,text],index)=>({type:'dialogue',id:`opening-${track}-${index+count(s,track)}`,speaker,text}));
}
export function beginOpeningStory(s:JourneyState):JourneyEvent[]{
 mark(s,VERSION);return lines(s,'room');
}
export function beginDeskStory(s:JourneyState):JourneyEvent[]{
 if(!hasOpeningStory(s)||s.phase!=='room')return [];
 mark(s,'opening-desk-started');return lines(s,'desk');
}
export function beginArrivalStory(s:JourneyState):JourneyEvent[]{
 if(hasOpeningStory(s)){mark(s,'opening-arrival-started');return lines(s,'arrival');}
 return OPENING_ARRIVAL.map(([speaker,text],i)=>({type:'dialogue',id:i?'arrival-two':'arrival-one',speaker,text}));
}
/** At most one small progress marker per track, not one seen entry per sentence. */
export function acknowledgeOpeningLine(s:JourneyState,id:string):{changed:boolean;enterWorld:boolean}{
 const match=/^opening-(room|desk|arrival)-(\d+)$/.exec(id);
 if(!hasOpeningStory(s)||!match)return {changed:false,enterWorld:false};
 const track=match[1] as Track,index=Number(match[2]);
 if(index!==count(s,track)||index>=tracks[track].length)return {changed:false,enterWorld:false};
 s.seen=s.seen.filter(item=>!item.startsWith(`opening-read-${track}-`));
 mark(s,`opening-read-${track}-${index+1}`);
 return {changed:true,enterWorld:track==='desk'&&index+1===OPENING_DESK.length};
}
export function pendingOpeningStory(s:JourneyState):JourneyEvent[]{
 if(!hasOpeningStory(s))return [];
 if(s.phase==='room')return s.seen.includes('opening-desk-started')?lines(s,'desk'):lines(s,'room');
 if(s.phase==='world'&&s.seen.includes('opening-arrival-started'))return lines(s,'arrival');
 return [];
}

/** A completed desk conversation is saved before its cinematic; reload resumes it safely. */
export const pendingPortalEntry=(s:JourneyState)=>hasOpeningStory(s)&&s.phase==='room'&&s.seen.includes('opening-desk-started')&&count(s,'desk')===OPENING_DESK.length;
