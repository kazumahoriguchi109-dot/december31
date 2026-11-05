import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import { poseJourneyActor,type JourneyActorPose } from '../../src/journey/acting';
const base:JourneyActorPose={kind:'player',speaking:false,expression:'neutral',waiting:false,walk:0,time:0,reducedMotion:false};
function actor(){const g=new THREE.Group();g.name='player';for(const name of ['head','armL','armR','eyes','mouth','brows','legL','legR']){const n=new THREE.Group();n.name=`rig-${name}`;g.add(n);}return g;}
const poses=(g:THREE.Object3D)=>g.children.map(n=>[...n.rotation.toArray(),...n.scale.toArray()]);
describe('journey actor acting',()=>{
 it('changes only rig presentation and does not mutate input or actor root',()=>{
  const g=actor();g.position.set(3,2,-8);g.rotation.set(.1,1.4,.2);g.scale.setScalar(1.2);
  const root=[...g.position.toArray(),...g.rotation.toArray(),...g.scale.toArray()];
  const opts={...base,speaking:true,expression:'curious' as const,action:{id:'tile',progress:.5}};const saved=structuredClone(opts);
  poseJourneyActor(g,opts);expect(opts).toEqual(saved);
  expect([...g.position.toArray(),...g.rotation.toArray(),...g.scale.toArray()]).toEqual(root);
  expect(g.getObjectByName('rig-armR')!.rotation.x).toBeGreaterThan(.8);
 });
 it('resets expressions and completed gestures without accumulating transforms',()=>{
  const g=actor();poseJourneyActor(g,base);const neutral=poses(g);
  poseJourneyActor(g,{...base,expression:'surprised',action:{id:'latch',progress:.5}});
  expect(poses(g)).not.toEqual(neutral);
  poseJourneyActor(g,{...base,action:{id:'latch',progress:1}});expect(poses(g)).toEqual(neutral);
  poseJourneyActor(g,base);expect(poses(g)).toEqual(neutral);
 });
 it('keeps reduced-motion semantics static across time, gait, and action progress',()=>{
  const g=actor(),opts={...base,reducedMotion:true,speaking:true,expression:'relieved' as const,action:{id:'tile',progress:.3}};
  poseJourneyActor(g,opts);const still=poses(g);
  poseJourneyActor(g,{...opts,time:9,walk:1,action:{id:'tile',progress:.7}});expect(poses(g)).toEqual(still);
 });
 it('handles missing rigs and non-finite animation inputs with finite transforms',()=>{
  expect(()=>poseJourneyActor(new THREE.Group(),base)).not.toThrow();const g=actor();
  for(const id of ['tile','latch','call','unknown']){
   poseJourneyActor(g,{...base,time:Infinity,walk:NaN,action:{id,progress:NaN}});
   g.traverse(n=>expect([...n.rotation.toArray().slice(0,3),...n.scale.toArray()].every(v=>typeof v==='number'&&Number.isFinite(v))).toBe(true));
  }
 });
});
