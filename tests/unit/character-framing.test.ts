import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import world from '../../data/world.json';

describe('wall summit framing',()=>{
  for(const id of ['wall_top_front','wall_top_wall_side'] as const)it(`${id} retains headroom for both friends`,()=>{
    const p=world.cameraPresets[id],f=p.frustum;
    const cam=new THREE.OrthographicCamera(f.left,f.right,f.top,f.bottom,p.near,p.far);
    cam.position.fromArray(p.position);cam.up.fromArray(p.up);cam.lookAt(new THREE.Vector3(...p.target));cam.updateMatrixWorld(true);
    // Authored summit placements and character envelope, independently checked against the framing contract.
    for(const z of [17.5,16.6])for(const dx of [-.3,.3])for(const dz of [-.3,.3])for(const y of [2,3.55]){
      const projected=new THREE.Vector3(14.6+dx,y,z+dz).project(cam);
      expect(Math.abs(projected.x)).toBeLessThan(.98);expect(Math.abs(projected.y)).toBeLessThan(.98);
    }
  });
});
