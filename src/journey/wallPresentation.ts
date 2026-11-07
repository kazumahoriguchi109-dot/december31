import type {JourneyState} from './contract';

/** Fade only the unread wall's rear-facing proxy when a friend is behind it.
 * This never exposes the staircase: the renderer keeps its existing flat-wall
 * visibility decision. Coordinates here describe the proxy, not collision. */
export function wallProxyOpacity(s:Pick<JourneyState,'phase'|'era'|'quarter'|'wallSeen'|'player'|'toto'>):number{
 if(s.phase!=='world'||s.era<2||s.wallSeen||s.quarter!==2)return 1;
 const behind=(p:{x:number;z:number})=>p.x>=6&&p.x<=11&&p.z>=-42.99&&p.z<=-38.99;
 return behind(s.player)||behind(s.toto)?.18:1;
}
