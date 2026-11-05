/** Evolution rebuild: independent save format and direct-control world. */
export type Era = 0|1|2|3;
export type Phase = 'room'|'world'|'ending';
export interface Point {x:number;z:number}
export interface Actor extends Point {facing:number}
export interface JourneyState {
 version:2; phase:Phase; player:Actor; toto:Actor & {waiting:boolean;plate:'gate'|'front'|'back'|null};
 era:Era; quarter:0|1|2|3; mode:'walk'|'observe';
 p1:number; p2Drain:boolean; p2Stopper:boolean; gateLatched:boolean; wallSeen:boolean;
 ringA:0|1|2; ringB:0|1|2; solved:boolean[]; portalOpen:boolean;
 seen:string[]; steps:number;
}
export interface InputFrame {x:number;z:number;run:boolean}
export interface JourneyEvent {type:'dialogue'|'evolution'|'sound'|'notice'|'ending';id:string;text?:string;speaker?:'主人公'|'トト';era?:Era}
export interface ContextAction {id:string;label:string;hint:string;point:Point;enabled:boolean}
export const MAP = {
 spawn:{x:0,z:0}, console:{x:0,z:-2.5}, tile:{x:0,z:-6}, tileControl:{x:2.6,z:-5.5}, mill:{x:-5,z:-18}, drain:{x:-7,z:-18}, stopper:{x:-3.6,z:-18.7},
 gatePlate:{x:-3,z:-31.5}, gate:{x:0,z:-35}, latch:{x:2,z:-38},
 wall:{x:8,z:-43}, wallTop:{x:8,z:-50.5}, observe:{x:3,z:-54}, leverA:{x:0,z:-56}, leverB:{x:6,z:-56}, ring:{x:3,z:-58},
 castle:{x:3,z:-62}, portal:{x:0,z:4}, frontPlate:{x:0,z:2.5}, backPlate:{x:0,z:5.5},
} as const;
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
/** Shared terrain height. The stair is broad and has no fall/jump requirement. */
export function heightAt(p:Point):number {
 if(p.z<=-49)return 3;
 if(p.x>=6.5&&p.x<=10.5&&p.z< -43)return Math.max(0,Math.min(3,(-p.z-43)/6*3));
 return 0;
}
export interface RenderOptions {reducedMotion:boolean;quality:'normal'|'low';resonance?:boolean}
export interface JourneyRenderer {
 render(state:JourneyState,dt:number,options:RenderOptions):void;
 resize():void;dispose():void;
}
