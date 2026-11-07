import {ROOM_X_SCALE} from './roomPresentation';
/** Presentation only: the room is framed as one diorama, never following a player. */
export function roomCameraFrame(width:number,height:number){
 const w=Math.max(1,width),h=Math.max(1,height);
 const rise=9,run=13.5,length=Math.hypot(rise,run),sin=rise/length,cos=run/length;
 // Include the plinth, wall caps and furniture. Keep the top HUD and bottom controls clear.
 const top=3.2*cos+4.2*sin,bottom=-.45*cos-3.2*sin;
 const horizontal=8.6*ROOM_X_SCALE,vertical=top-bottom;
 const topInset=Math.min(92,h*.16),bottomInset=Math.min(92,h*.16);
 const usableHeight=Math.max(1,h-topInset-bottomInset),usableWidth=Math.max(1,w-24);
 const scale=Math.min(usableHeight/vertical,usableWidth/horizontal);
 const zoom=16*scale/h;
 const projectedCenter=(top+bottom)/2+(topInset-bottomInset)/(2*scale);
 return {zoom,rise,run,targetY:projectedCenter*cos,targetZ:-projectedCenter*sin};
}
