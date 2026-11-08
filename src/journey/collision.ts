import { MAP, heightAt, type JourneyState, type Point } from './contract';
import { FURNITURE_X_SCALE, ROOM_X_SCALE } from './roomPresentation';

/** Foot/body clearance in rendered world units, shared by both children. */
export const ACTOR_RADIUS = .46;
export const ROOM_SOLIDS = {
 desk: { x: MAP.console.x, z: MAP.console.z, width: 2.04, depth: .96 },
 shelf: { x: -2.94, z: -3.39, width: 1.88, depth: .77 },
 chair: { x: 3.25, z: 1.7, width: 1.1, depth: .89 },
 lamp: { x: 2.25, z: -2.58, radius: .43 },
} as const;
export const LANTERN_POINTS = [[-3,-3],[4,-13],[3,-27],[-5,-38],[10.7,-48],[7,-60]] as const;
export const BANK_STONE_POINTS:readonly (readonly [number,number])[]=(()=>{
 const points:[number,number][]=[];
 for(let x=-11.6;x<12;x+=.87){if(Math.abs(x)<2.4)continue;for(const z of[-21.86,-24.14])points.push([x+.08*Math.sin(x*3),z]);}
 for(let i=0;i<7;i++)points.push([-8.82,-18.7-i*.44]);
 return points;
})();

export interface Solid {
 id: string;
 x: number;
 z: number;
 halfX: number;
 halfZ: number;
 /** Ellipses are used for round furniture, all other footprints are rectangles. */
 round?: boolean;
 bottom?: number;
 top?: number;
}
const rectangle = (id:string,x:number,z:number,halfX:number,halfZ:number):Solid => ({id,x,z,halfX,halfZ});
const roomSolids:readonly Solid[] = [
 ...(['desk','shelf','chair'] as const).map(id => {
  const o=ROOM_SOLIDS[id];return rectangle(id,o.x,o.z,o.width*FURNITURE_X_SCALE/ROOM_X_SCALE/2,o.depth/2);
 }),
 {id:'lamp',x:ROOM_SOLIDS.lamp.x,z:ROOM_SOLIDS.lamp.z,halfX:ROOM_SOLIDS.lamp.radius*FURNITURE_X_SCALE/ROOM_X_SCALE,halfZ:ROOM_SOLIDS.lamp.radius,round:true},
];
const worldSolids:readonly Solid[] = [
 rectangle('tile',MAP.tile.x,MAP.tile.z,1.75,1.75),
 rectangle('tile',1.8,-5.25,.21,.23),
 rectangle('mill',-6,-19.15,3.25,2.7),
 rectangle('mill',-7,-15.95,.475,1.25),
 ...[MAP.drainControl,MAP.stopperControl].map(p=>rectangle('mill',p.x-.85,p.z-.6,.36,.36)),
 // Raised connecting shafts are solid too; only the painted/floor-level traces are walkable.
 rectangle('mill',-6.85,-16.2,.04,1.64),
 rectangle('mill',-3.85,-16.55,.04,1.99),
 rectangle('mill',-3.35,-21.1,1.605,.055),
 rectangle('mill',-1.8,-21.55,.055,.505),
 {id:'mill',x:-1.8,z:-21.1,halfX:.355,halfZ:.355,round:true},
 ...BANK_STONE_POINTS.map(([x,z],i)=>({...rectangle('stone',x,z,.32+(i%3)*.055,.23),top:.28})),
 // The sign and its two wooden feet, not its floating star marker.
 rectangle('star-post',MAP.starPost.x,MAP.starPost.z,.425,.09),
 rectangle('star-post',MAP.starPost.x,MAP.starPost.z+.32,.365,.275),
 rectangle('post',-6,-40,.3,.29),
 ...LANTERN_POINTS.map(([x,z])=>({...rectangle('lantern',x,z,.24,.24),bottom:heightAt({x,z}),top:heightAt({x,z})+1.38})),
 rectangle('latch',MAP.latch.x,MAP.latch.z,.175,.175),
 ...[MAP.leverA,MAP.leverB].map(p=>rectangle('lever',p.x,p.z,.475,.475)),
 rectangle('ring',1.1,-56,1.135,.035),
 rectangle('ring',4.9,-56,1.135,.035),
 ...[2.2,3.8].flatMap(x=>[
  rectangle('ring',x,-56.8,.035,.835),
  ...[-56.4,-57.5].map(z=>rectangle('ring',x,z,.08,.11)),
 ]),
 ...[-1.25,1.25].map(x=>rectangle('frame',x,MAP.portal.z,.115,.115)),
 // The lower masonry, not the wider overhanging castle roofs.
 rectangle('castle',3,-64,3.537,2.2),
 ...[[-12,6.2],[10.8,12]].map(([left,right])=>({...rectangle('fence',(left!+right!)/2,-49,(right!-left!)/2,.11),bottom:3,top:4.2})),
];

// Reuse the finite geometry variants during collision sampling and pathfinding.
const worldVariants=Array.from({length:36},(_,index)=>{
 const wallSeen=index>=18,latched=index%18>=9,ringA=Math.floor(index%9/3),ringB=index%3;
 return [...worldSolids,
  ...(!wallSeen?[rectangle('wall',8.5,-42.99,2,.035)]:[]),
  rectangle('latch',MAP.latch.x+(latched?0:.22),MAP.latch.z-(latched?.22:0),latched?.09:.22,latched?.22:.09),
  rectangle('ring',2.2,-55-(4+ringA)*.35,.13,.125),
  rectangle('ring',3.8,-55-(4+ringB)*.35,.13,.125),
  // The lower optical arcs intersect head/body height, unlike the high fixed arch.
  {...rectangle('ring',2.65,-55-(4+ringA)*.35,.3675,.0175),bottom:3.8825,top:4.6175},
  {...rectangle('ring',3.42,-55-(4+ringB)*.35,.441,.021),bottom:3.739,top:4.621},
 ];
});

/** Furniture anchors are logical coordinates; their widths have a different art scale. */
export function solids(s:JourneyState):readonly Solid[] {
 return s.phase==='world'?worldVariants[Number(s.wallSeen)*18+Number(s.gateLatched)*9+s.ringA*3+s.ringB]!:roomSolids;
}

/** Rounded Minkowski footprints allow a body to slide smoothly past corners. */
export function touchesSolid(s:JourneyState,p:Point,solid:Solid):boolean {
 const sx=s.phase==='world'?1:ROOM_X_SCALE;
 if(s.phase==='world'&&(heightAt(p)>=(solid.top??Infinity)||heightAt(p)+1.6<=(solid.bottom??-Infinity)))return false;
 const dx=Math.abs(p.x-solid.x)*sx,dz=Math.abs(p.z-solid.z);
 if(solid.round)return (dx/(solid.halfX*sx+ACTOR_RADIUS))**2+(dz/(solid.halfZ+ACTOR_RADIUS))**2<1-1e-9;
 const ax=Math.max(0,dx-solid.halfX*sx),az=Math.max(0,dz-solid.halfZ);
 return ax*ax+az*az<ACTOR_RADIUS**2-1e-9;
}

export function solidObstruction(s:JourneyState,p:Point):string {
 return solids(s).find(solid=>touchesSolid(s,p,solid))?.id??'';
}
