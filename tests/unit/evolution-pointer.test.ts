import {describe,it,expect} from 'vitest';
import {createState,interactionDevice,interact,type State} from '../../src/evolution/model';
import {STAGE_ANNOUNCEMENTS} from '../../src/evolution/stageAnnouncement';
describe('world target interaction',()=>{
 it('opens the initial chest and then requires proximity',()=>{const s=createState();expect(interactionDevice(s)).toBe('chest');interact(s);expect(s.stage).toBe(1);expect(interactionDevice(s)).toBeNull();s.actors[0]={x:3,z:2};expect(interactionDevice(s)).toBe('release');});
 it('does not allow distant levers or exit',()=>{const s={...createState(),stage:2} as State;expect(interactionDevice(s)).toBeNull();s.actors[0]={x:1,z:6};expect(interactionDevice(s)).toBe('wire-0');s.actors[0]={x:5,z:6};expect(interactionDevice(s)).toBe('wire-2');});
 it('maps lift and fragment to the original ride interaction',()=>{const s={...createState(),stage:5} as State;s.actors[0]={x:5,z:6};expect(interactionDevice(s)).toBe('platform');s.riding=0;s.platform=2;expect(interactionDevice(s)).toBe('key');});
 it('has notices for the introduction, all six puzzles and completion',()=>{expect(STAGE_ANNOUNCEMENTS).toHaveLength(8);expect(STAGE_ANNOUNCEMENTS[1].title).toContain('2D');expect(STAGE_ANNOUNCEMENTS[3].title).toContain('3D');expect(STAGE_ANNOUNCEMENTS[7].kind).toBe('ALL CLEAR');});
});
