// Blender-authored assets, exported by tools/art/build_winter_assets.py.
// Geometry is shared between instances; materials retain E0/E1 toon twins.
import * as THREE from 'three';
import library from './generated/winterMeshes.json';
import { lam } from './materials';
export type WinterAsset = keyof typeof library;
type Rig = 'body' | 'head' | 'armL' | 'armR' | 'eyes' | 'mouth' | 'brows' | 'legL' | 'legR';
interface Part { color: number; positions: number[]; normals: number[]; rig?: Rig }
// Authored world-space pivots. Facial pivots sit at their feature centres, so blinking/talking does not slide the face.
const pivots: Record<Rig, [number, number, number]> = {
  body: [0, 0, 0], head: [0, .52, 0], armL: [-.26, .32, 0], armR: [.26, .32, 0],
  legL: [-.13, -.12, 0], legR: [.13, -.12, 0],
  eyes: [0, .69, -.23], mouth: [0, .555, -.235], brows: [0, .765, -.224],
};
const facial = new Set<Rig>(['eyes', 'mouth', 'brows']);
const geometries = new Map<string, THREE.BufferGeometry>();
const warm = new THREE.MeshBasicMaterial({ color: 0xf2cf86 });
export function winterAsset(name: WinterAsset): THREE.Group {
  const group = new THREE.Group(); group.name = name; group.userData['og'] = true;
  const rigs = new Map<Rig, THREE.Group>();
  const rigGroup = (rig: Rig): THREE.Group => {
    const existing = rigs.get(rig); if (existing) return existing;
    const node = new THREE.Group(); node.name = `rig-${rig}`;
    node.position.fromArray(pivots[rig]);
    if (facial.has(rig)) { node.position.sub(new THREE.Vector3(...pivots.head)); rigGroup('head').add(node); }
    else group.add(node);
    rigs.set(rig, node); return node;
  };
  (library[name] as Part[]).forEach((part, i) => {
    const key = `${name}/${i}`;
    let geometry = geometries.get(key);
    if (!geometry) {
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
      if (part.rig) { const p = pivots[part.rig]; geometry.translate(-p[0], -p[1], -p[2]); }
      geometry.computeBoundingSphere(); geometries.set(key, geometry);
    }
    const mesh = new THREE.Mesh(geometry, part.color === 0xf2cf86 ? warm : lam(part.color));
    (part.rig ? rigGroup(part.rig) : group).add(mesh);
  });
  return group;
}
