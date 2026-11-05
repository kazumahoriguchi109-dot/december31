/** Evolution rebuild: independent save format and direct-control world. */
export type Era = 0|1|2|3;
export type Phase = 'room'|'world'|'ending';
export interface Point {x:number;z:number}
export interface Actor extends Point {facing:number}
export interface JourneyState {
 version:3; phase:Phase; player:Actor; toto:Actor & {/** True only after reaching the reserved plate centre. */ waiting:boolean;/** Non-null while walking to or waiting on this plate. */ plate:'gate'|'front'|'back'|null};
 era:Era; quarter:0|1|2|3; mode:'walk'|'observe';
 p1:number; p2Drain:boolean; p2Stopper:boolean; gateLatched:boolean; wallSeen:boolean;
 ringA:0|1|2; ringB:0|1|2; solved:boolean[]; portalOpen:boolean;
 seen:string[]; steps:number;
}
export interface InputFrame {x:number;z:number;run:boolean}
export interface JourneyEvent {type:'dialogue'|'evolution'|'sound'|'notice'|'ending';id:string;text?:string;speaker?:'主人公'|'トト';era?:Era}
export interface ContextAction {id:string;label:string;hint:string;point:Point;enabled:boolean}
export const MAP = {
 spawn:{x:0,z:0}, console:{x:0,z:-2.5}, tile:{x:0,z:-6}, tileControl:{x:2.6,z:-5.5}, mill:{x:-5,z:-18}, drain:{x:-7,z:-18}, stopper:{x:-3.6,z:-18.7}, drainControl:{x:-6,z:-14}, stopperControl:{x:-3,z:-14},
 gatePlate:{x:-3,z:-31.5}, gate:{x:0,z:-35}, latch:{x:2,z:-38},
 wall:{x:8,z:-43}, wallTop:{x:8,z:-50.5}, observe:{x:3,z:-54}, leverA:{x:0,z:-56}, leverB:{x:6,z:-56}, ring:{x:3,z:-58},
 castle:{x:3,z:-62}, portal:{x:0,z:4}, frontPlate:{x:0,z:2.5}, backPlate:{x:0,z:5.5},
} as const;
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
export const PLATE_RADIUS=.9;
export const isOnPlate=(actor:Point,plate:Point)=>distance(actor,plate)<=PLATE_RADIUS;
/** Shared permitted standing areas; renderer draws these same clipped circles. */
export const CONTROL_AREAS={
 tile:{center:MAP.tileControl,radius:1.1,minX:MAP.tileControl.x,minZ:-Infinity},
 drain:{center:MAP.drainControl,radius:.8,minX:MAP.drainControl.x-.1,minZ:MAP.drainControl.z-.15},
 stopper:{center:MAP.stopperControl,radius:.8,minX:MAP.stopperControl.x-.1,minZ:MAP.stopperControl.z-.15},
} as const;
export type ControlId=keyof typeof CONTROL_AREAS;
export function inControlArea(player:Point,id:ControlId):boolean {
 const area=CONTROL_AREAS[id];return player.x>=area.minX&&player.z>=area.minZ&&distance(player,area.center)<=area.radius;
}
/** Shared terrain height. The stair is broad and has no fall/jump requirement. */
export function heightAt(p:Point):number {
 if(p.z<=-49)return 3;
 if(p.x>=6.5&&p.x<=10.5&&p.z< -43)return Math.max(0,Math.min(3,(-p.z-43)/6*3));
 return 0;
}
export type Expression = 'neutral'|'curious'|'surprised'|'relieved';
export interface RenderOptions {reducedMotion:boolean;quality:'normal'|'low';resonance?:boolean;focusActionId?:string;focusActionPoint?:Point;speaker?:'player'|'toto';expression?:Expression;action?:{id:string;progress:number}}
export interface JourneyRenderer {
 render(state:JourneyState,dt:number,options:RenderOptions):void;
 resize():void;dispose():void;
}
