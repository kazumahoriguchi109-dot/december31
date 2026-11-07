import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {winterTree,fence,C} from '../../src/journey/sceneArt';
describe('presentation-only winter scenery',()=>{
 it('uses deterministic bounded per-tree instances with shared geometry',()=>{
  const parent=new THREE.Group(),a=winterTree(parent,12.4,0,-5,0),b=winterTree(parent,12.4,0,-5,0);
  expect(a.children).toHaveLength(3);
  for(let i=0;i<3;i++){const x=a.children[i] as THREE.InstancedMesh,y=b.children[i] as THREE.InstancedMesh;expect(x.geometry).toBe(y.geometry);expect([...x.instanceMatrix.array]).toEqual([...y.instanceMatrix.array]);expect(x.count).toBeLessThanOrEqual(25);}
  const bounds=new THREE.Box3().setFromObject(a);expect(bounds.min.x).toBeGreaterThan(10.5);expect(bounds.max.y).toBeLessThan(7);
  a.visible=false;expect(parent.children[0]!.visible).toBe(false);
 });
 it('keeps bare branches in the same independently occludable group',()=>{
  const tree=winterTree(new THREE.Group(),12.4,3,-52,3);expect(tree.children).toHaveLength(2);expect((tree.children[0] as THREE.InstancedMesh).count).toBe(15);
  tree.traverse(o=>{if(o instanceof THREE.Mesh)expect(o.castShadow).toBe(true);});
 });
 it('adds a snow cap to a fence without moving its wooden rails',()=>{
  const g=new THREE.Group();fence(g,0,3,8);const caps=g.children.filter(o=>o instanceof THREE.Mesh&&o.material.color.getHex()===C.snow);expect(caps).toHaveLength(3);
  expect(g.children.some(o=>o.position.y===.7&&o.position.z===8)).toBe(true);
 });
});
