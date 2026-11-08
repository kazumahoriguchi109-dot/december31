import {describe,it,expect} from 'vitest';
import {createState,getScene,getGuidance,circuitReady,interact,restore,WIRE_ROUTES} from '../../src/evolution/model';
describe('observable puzzle guidance',()=>{
 it('reflects every circuit combination without changing save state',()=>{
  for(let mask=0;mask<8;mask++){
   const s=createState();s.stage=2;s.solved[0]=true;s.actors=[{x:3,z:1},{x:3,z:2}];s.wires=[!!(mask&1),!!(mask&2),!!(mask&4)];
   const snapshot=JSON.stringify(s),v=getScene(s);
   expect(v.devices.find(d=>d.id==='exit')!.active).toBe(mask===5);
   expect(v.status).toContain(mask===5?'出口：開いた':'出口：閉じている');
   expect(circuitReady(s)).toBe(mask===5);expect(JSON.stringify(s)).toBe(snapshot);expect(restore(s)).not.toBeNull();
   interact(s);expect(s.stage).toBe(mask===5?3:2);
  }
 });
 it('pairs each cable with its own control and endpoint',()=>{
  expect(WIRE_ROUTES.map(r=>r[0]!.x)).toEqual([1,3,5]);expect(WIRE_ROUTES.map(r=>r.at(-1)!.x)).toEqual([5,1,3]);
  for(const r of WIRE_ROUTES)for(let i=1;i<r.length;i++)expect(Math.abs(r[i]!.x-r[i-1]!.x)+Math.abs(r[i]!.z-r[i-1]!.z)).toBe(1);
 });
 it('distinguishes closed gear phases and charge waiting reasons',()=>{
  const s=createState();s.stage=1;const a=getGuidance(s).status;s.gear=1;expect(getGuidance(s).status).not.toBe(a);
  s.stage=6;s.actors=[{x:1,z:6},{x:5,z:6}];expect(getGuidance(s).status).toContain('床 空');s.actors[1]={x:5,z:3};expect(getGuidance(s).status).toContain('床 人がいる');s.gear=2;expect(getGuidance(s).status).toContain('今の部屋へ切替で再開');s.active=1;expect(getGuidance(s).status).toContain('充電中');
 });
 it('names the reversible action at a lever',()=>{
  const s=createState();s.stage=2;s.actors=[{x:1,z:6},{x:3,z:7}];expect(getScene(s).context).toContain('入れる');interact(s);expect(getScene(s).context).toContain('切る');expect(s.message).toContain('右のロックが外れた');
 });
});
