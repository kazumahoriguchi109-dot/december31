import {describe,it,expect} from 'vitest';
import {createState,move,interact,switchActor,tick,restore,resetRoom,getScene,getView,isGateOpen,waitForToto,type State} from '../../src/evolution/model';
const copy=(s:State)=>JSON.parse(JSON.stringify(s)) as State;
function walk(s:State,x:number,z:number){const queue:[State,[number,number][]][]=[[copy(s),[]]],seen=new Set<string>();while(queue.length){const [v,path]=queue.shift()!;const p=v.actors[v.active];if(p.x===x&&p.z===z){for(const [dx,dz]of path)move(s,dx,dz);return;}const key=[p.x,p.z,v.gear,v.platform].join(',');if(seen.has(key))continue;seen.add(key);for(const [dx,dz]of [[0,-1],[0,1],[-1,0],[1,0]]){const w=copy(v);move(w,dx!,dz!);if(w.actors[w.active].x!==p.x||w.actors[w.active].z!==p.z)queue.push([w,[...path,[dx!,dz!]]]);}}throw Error(`No route stage ${s.stage} actor ${s.active} to ${x},${z}`);}
function stage(n:number){const s=createState();s.stage=n;s.solved=s.solved.map((_,i)=>i<n-1);resetRoom(s);return s;}
describe('evolving puzzles',()=>{
 it('can release waiting and restore an old first-puzzle save',()=>{const s=stage(1);walk(s,3,4);waitForToto(s);expect(restore(s)).not.toBe(null);waitForToto(s);expect(isGateOpen(s)).toBe(false);waitForToto(s);resetRoom(s);expect(s.totoWaiting).toBe(false);const old=stage(1);delete old.totoWaiting;expect(restore(old)).not.toBe(null);});
 it('opens the chest then requires Toto to wait before the gate can be crossed',()=>{const s=createState();interact(s);walk(s,3,4);expect(isGateOpen(s)).toBe(false);move(s,0,-1);expect(s.actors[0].z).toBe(4);waitForToto(s);expect(isGateOpen(s)).toBe(true);walk(s,3,2);expect(s.actors[1].z).toBe(5);interact(s);expect(s.stage).toBe(1);expect(s.latch).toBe(true);walk(s,3,1);interact(s);expect(s.stage).toBe(2);});
 it('keeps switches reversible and requires the actual symbol circuit',()=>{const s=stage(2);walk(s,1,6);interact(s);expect(s.wires[0]).toBe(true);interact(s);expect(s.wires[0]).toBe(false);walk(s,3,1);interact(s);expect(s.stage).toBe(2);walk(s,1,6);interact(s);walk(s,5,6);interact(s);walk(s,3,1);interact(s);expect(s.stage).toBe(3);});
 it('requires physical plate occupancy, then latches the gate without stranding either child',()=>{const s=stage(3);walk(s,1,5);expect(isGateOpen(s)).toBe(true);switchActor(s);walk(s,5,2);interact(s);expect(s.latch).toBe(true);walk(s,4,1);switchActor(s);walk(s,3,1);interact(s);expect(s.stage).toBe(4);});
 it('freezes old time while the other child crosses and rejoins through the corridor',()=>{const s=stage(4);move(s,0,-1);move(s,0,-1);expect(s.gear).toBe(2);switchActor(s);tick(s,1);expect(s.gear).toBe(2);walk(s,6,2);interact(s);expect(s.latch).toBe(true);walk(s,5,1);switchActor(s);walk(s,4,1);switchActor(s);interact(s);expect(s.stage).toBe(5);});
 it('lets old steps drive the lift, new waiting move it, and a rider safely leave upstairs',()=>{const s=stage(5);tick(s,1);expect(s.platform).toBe(0);move(s,0,-1);expect(s.platform).toBe(1);move(s,0,1);expect(s.platform).toBe(2);switchActor(s);for(let i=0;i<4;i++)tick(s,1);expect(s.platform).toBe(0);interact(s);expect(s.riding).toBe(1);move(s,1,0);expect(s.actors[1].x).toBe(5);for(let i=0;i<4;i++)tick(s,1);expect(s.platform).toBe(2);interact(s);expect(s.key).toBe(true);expect(s.riding).toBe(null);walk(s,6,1);switchActor(s);walk(s,6,2);switchActor(s);interact(s);expect(s.stage).toBe(6);});
 it('charges only with a physically occupied receiver and aligned frozen old circuit, then brings both home',()=>{const s=stage(6);move(s,0,-1);move(s,0,-1);switchActor(s);for(let i=0;i<4;i++)tick(s,1);expect(s.charge).toBe(0);walk(s,5,3);for(let i=0;i<4;i++)tick(s,1);expect(s.charge).toBe(1);walk(s,5,1);switchActor(s);walk(s,4,1);switchActor(s);interact(s);expect(s.stage).toBe(7);expect(s.solved.every(Boolean)).toBe(true);expect(restore(JSON.stringify(s))).not.toBe(null);});
 it('round-trips state and rejects malformed or inconsistent snapshots',()=>{for(let n=0;n<=7;n++){const s=stage(n);expect(restore(JSON.stringify(s))).toEqual(s);}const s=stage(5);switchActor(s);interact(s);expect(restore(s)).not.toBe(null);expect(restore({...s,riding:null})).toBe(null);expect(restore({...s,platform:4})).toBe(null);expect(restore({...s,version:3})).toBe(null);expect(restore({...s,charge:Infinity})).toBe(null);expect(restore('{')).toBe(null);});
 it('resets only the present room and selects its fixed camera and view',()=>{const s=stage(4);move(s,0,-1);expect(getView(s)).toBe('three');switchActor(s);expect(getScene(s).view).toBe('three');resetRoom(s);expect(s.gear).toBe(0);expect(s.solved).toEqual([true,true,true,false,false,false]);});
 it('never replaces an existing rider or disembarks onto the other child',()=>{const s=stage(5);switchActor(s);interact(s);switchActor(s);walk(s,5,6);interact(s);expect(s.riding).toBe(1);switchActor(s);interact(s);expect(s.riding).toBe(1);expect(restore(s)).not.toBe(null);});
 it('keeps waiting Toto before the first gate and blocks the upper landing before the lift key',()=>{const s=stage(1);walk(s,3,4);waitForToto(s);walk(s,3,1);expect(s.actors[1].z).toBe(5);const t=stage(5);switchActor(t);walk(t,6,4);move(t,0,-1);expect(t.actors[1].z).toBe(4);expect(restore({...t,actors:[t.actors[0],{x:6,z:1}]})).toBe(null);});

 it('requires the second child to stay in the old room during final charging',()=>{const s=stage(6);walk(s,1,4);walk(s,1,7);walk(s,4,6);expect(s.gear).toBe(2);switchActor(s);walk(s,5,3);for(let i=0;i<4;i++)tick(s,1);expect(s.charge).toBe(0);switchActor(s);walk(s,1,6);expect(s.gear).toBe(2);tick(s,1);expect(s.charge).toBe(0);switchActor(s);for(let i=0;i<4;i++)tick(s,1);expect(s.charge).toBe(1);});

 it.each([4,5,6])('keeps stage %i camera and 3D presentation stable across switches, crossings and restore',n=>{
  const s=stage(n),camera=getScene(s).camera;
  const check=()=>{expect(getView(s)).toBe('three');expect(getScene(s).camera).toBe(camera);};
  check();for(let i=0;i<4;i++){switchActor(s);check();}
  const before=copy(s);move(s,1,0);expect(s.actors).toEqual(before.actors);
  move(s,0,-1);expect(s.gear).toBe(1);check();
  walk(s,1,7);walk(s,4,6);check();walk(s,1,6);check();
  expect(getScene(restore(JSON.stringify(s))!).camera).toBe(camera);
  resetRoom(s);check();
 });

});
