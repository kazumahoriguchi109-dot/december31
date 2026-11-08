import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {createRoomArt} from '../../src/journey/roomArt';
import {ROOM_SOLIDS} from '../../src/journey/collision';
import {FURNITURE_X_SCALE} from '../../src/journey/roomPresentation';
afterEach(()=>vi.unstubAllGlobals());
describe('room furniture presentation',()=>{
 it('uses a wall-mounted calendar with December, 31 and the story star, plus physical two-player hardware',()=>{
  const text:string[]=[];
  const ctx=new Proxy({fillText:(value:string)=>text.push(value),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key as keyof typeof target]:()=>{},set:(target,key,value)=>{Reflect.set(target,key,value);return true;}});
  vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>ctx})});
  const room=new THREE.Group();const {screen,calendar}=createRoomArt(room);room.updateMatrixWorld(true);
  expect(text).toEqual(expect.arrayContaining(['12月','31','✦','2 PLAYER']));
  expect(calendar.getObjectByName('calendar-paper-face')).toBeInstanceOf(THREE.Mesh);
  expect(calendar.children.some(o=>o instanceof THREE.Sprite)).toBe(false);
  expect(calendar.children.filter(o=>o instanceof THREE.Mesh).length).toBeGreaterThan(5);
  expect(screen.name).toBe('game-television-screen');
  const desk=room.getObjectByName('console-desk')!;
  const hardware=desk.children.filter(o=>['game-console-body','game-controller'].includes(o.name));
  expect(hardware.map(o=>o.name)).toEqual(['game-console-body','game-controller','game-controller']);
  for(const item of hardware){const bounds=new THREE.Box3().setFromObject(item);expect(bounds.min.x).toBeGreaterThan(-ROOM_SOLIDS.desk.width*FURNITURE_X_SCALE/2);expect(bounds.max.x).toBeLessThan(ROOM_SOLIDS.desk.width*FURNITURE_X_SCALE/2);expect(bounds.max.z).toBeLessThan(ROOM_SOLIDS.desk.z+ROOM_SOLIDS.desk.depth/2);}
 });
});
