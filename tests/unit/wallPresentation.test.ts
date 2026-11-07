import {describe,it,expect} from 'vitest';
import {createState} from '../../src/journey/model';
import {wallProxyOpacity} from '../../src/journey/wallPresentation';
const fixture=()=>{const s=createState();s.phase='world';s.era=2;s.quarter=2;s.player.x=8;s.player.z=-42;s.toto.x=8.8;s.toto.z=-41.5;return s;};
describe('unread white-wall presentation',()=>{
 it('fades only the rear quarter without mutating state or revealing discovery',()=>{const s=fixture(),before=JSON.stringify(s);Object.freeze(s);Object.freeze(s.player);Object.freeze(s.toto);expect(wallProxyOpacity(s)).toBe(.18);expect(JSON.stringify(s)).toBe(before);expect(s.wallSeen).toBe(false);});
 it('keeps front and both discovery side views unchanged',()=>{for(const quarter of[0,1,3] as const){const s=fixture();s.quarter=quarter;expect(wallProxyOpacity(s)).toBe(1);}});
 it('keeps other eras, room and discovered wall unchanged',()=>{for(const era of[0,1] as const){const s=fixture();s.era=era;expect(wallProxyOpacity(s)).toBe(1);}const seen=fixture();seen.wallSeen=true;expect(wallProxyOpacity(seen)).toBe(1);const room=fixture();room.phase='room';expect(wallProxyOpacity(room)).toBe(1);});
 it('restores opacity away from the proxy and handles a waiting friend',()=>{const s=fixture();s.player.x=0;s.toto.x=0;expect(wallProxyOpacity(s)).toBe(1);s.toto.x=8;s.toto.waiting=true;expect(wallProxyOpacity(s)).toBe(.18);s.toto.z=-45;expect(wallProxyOpacity(s)).toBe(1);s.toto.z=-36;expect(wallProxyOpacity(s)).toBe(1);});
});
