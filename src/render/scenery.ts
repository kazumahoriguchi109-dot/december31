// Original scenery: a snowy-green countryside made of simple faceted shapes, placed deterministically.
// Presentation only: nothing here is read by the game logic, and the white wall and the P05 apparatus keep clear backgrounds.
// Flags used by the era style (see eraStyle.ts / world.ts): userData.og = "outline this whole group as one shape",
// userData.flat = "ground-like: casts no shadow and gets no outline", userData.recv = "receives shadows".
import * as THREE from 'three';
import { cliffTexture, lam, lamTex, meadowTexture, paveTexture, rng, roadTexture, waterTexture } from './materials';

function mesh(g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x: number, y: number, z: number): THREE.Mesh {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o;
}
const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
const basic = (c: number) => new THREE.MeshBasicMaterial({ color: c });
const og = <T extends THREE.Object3D>(o: T): T => { o.userData['og'] = true; return o; };
const flat = <T extends THREE.Object3D>(o: T): T => { o.userData['flat'] = true; o.userData['recv'] = true; return o; };

/** The road that is "connected" through the story: frame -> tile -> mill -> gate -> wall -> observatory -> castle. */
export const ROAD: [number, number][] = [[0, -1], [0, 5], [4, 7], [6, 9], [10, 10], [10, 14], [13, 15.5], [18, 18], [22, 20], [25, 23], [28, 24.5]];
const nearRoad = (x: number, z: number, r: number) => ROAD.some(([a, b], i) => {
  const [c, d] = ROAD[i + 1] ?? [a, b];
  const vx = c - a, vz = d - b, l2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((x - a) * vx + (z - b) * vz) / l2));
  return Math.hypot(x - (a + t * vx), z - (b + t * vz)) < r;
});
/** Warm lamps: where the lantern glow is added in the richest era. */
export const LAMPS: [number, number][] = [[-1.8, 1.5], [1.8, 1.5], [8.4, 10], [11.6, 10], [3, 5.2]];
/** Plateaus the observatory and the castle stand on (anchor y = 2). */
export const PLATEAUS: [number, number][] = [[22, 20], [28, 26]];

export function tree(x: number, z: number, s: number, snow: boolean): THREE.Group {
  const g = og(new THREE.Group());
  g.add(mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.7 * s, 6), lam(0x6b4a30), 0, 0.35 * s, 0));
  for (let i = 0; i < 3; i++) {
    const r = (0.95 - i * 0.25) * s;
    g.add(mesh(new THREE.ConeGeometry(r, 0.9 * s, 7), lam(i % 2 ? 0x2f6b4c : 0x3a7a57), 0, (1.0 + i * 0.6) * s, 0));
    if (snow) g.add(mesh(new THREE.ConeGeometry(r * 0.62, 0.34 * s, 7), lam(0xf4f8fb), 0, (1.22 + i * 0.6) * s, 0));
  }
  g.position.set(x, 0, z);
  return g;
}

export function house(x: number, z: number, w: number, d: number, h: number, wall: number, roof: number): THREE.Group {
  const g = og(new THREE.Group());
  g.add(box(w, h, d, lam(wall), 0, h / 2, 0));
  const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.7, 4), lam(roof));
  r.rotation.y = Math.PI / 4; r.position.set(0, h + h * 0.35, 0);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.62, h * 0.34, 4), lam(0xf1f6f8));
  cap.rotation.y = Math.PI / 4; cap.position.set(0, h + h * 0.62, 0);
  g.add(r, cap, box(w * 0.22, h * 0.5, 0.05, lam(0x4a3322), 0, h * 0.25, -d / 2 - 0.01), box(0.3, 0.3, 0.05, basic(0xf6e7b4), w * 0.3, h * 0.62, -d / 2 - 0.01));
  g.add(box(0.3, 0.3, 0.05, lam(0x5a4632), w * 0.3, h * 0.62, -d / 2 - 0.005), box(0.28, 0.6, 0.28, lam(0x8a6a58), -w * 0.28, h + 0.5, 0.2), box(0.34, 0.08, 0.34, lam(0xf1f6f8), -w * 0.28, h + 0.84, 0.2));
  g.add(box(w + 0.12, 0.1, d + 0.12, lam(0x8d7e68), 0, 0.05, 0)); // stone plinth
  g.position.set(x, 0, z);
  return g;
}

export function waterwheel(): THREE.Group {
  // axis along Z so the cameras that look along +Z see the wheel face-on
  const g = og(new THREE.Group());
  const wood = lam(0xaf6654), dark = lam(0x7a4438);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 6, 24), wood));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = box(2.8, 0.1, 0.1, dark, 0, 0, 0); spoke.rotation.z = a; g.add(spoke);
    const paddle = box(0.5, 0.34, 0.5, wood, Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0); paddle.rotation.z = a; g.add(paddle);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.7, 10), dark, 0, 0, 0).rotateX(Math.PI / 2));
  return g;
}

export function castleModel(): THREE.Group {
  const g = og(new THREE.Group());
  const stone = lam(0xd6dce3), shade = lam(0xaab4c0), roofM = lam(0x4f6ea8), goldM = lam(0xd9ac5b);
  g.add(box(4.4, 2.6, 3.4, stone, 0, 1.3, 0), box(5.0, 0.3, 4.0, shade, 0, 0.15, 0));
  for (const x of [-2.4, 2.4]) {
    g.add(box(1.5, 4.0, 1.5, stone, x, 2.0, 0.2));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.3, 8), roofM); cone.position.set(x, 4.65, 0.2); g.add(cone);
    g.add(box(0.28, 0.5, 0.05, lam(0x2a3d63), x, 3.0, -0.56));
  }
  g.add(box(2.0, 3.4, 1.8, stone, 0, 1.7, 0.4));
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.6, 8), roofM); top.position.set(0, 4.2, 0.4); g.add(top);
  g.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), goldM, 0, 5.2, 0.4), box(0.04, 0.5, 0.04, goldM, 0, 5.0, 0.4));
  g.add(box(1.0, 1.4, 0.06, lam(0x3c2a1d), 0, 0.8, -1.32), box(0.5, 0.7, 0.05, basic(0xf6e7b4), 0, 2.4, -0.5));
  for (let i = -4; i <= 4; i++) g.add(box(0.28, 0.3, 0.3, stone, i * 0.5, 2.75, -1.55));
  // banners on the two side towers and lit slit windows (cosmetic)
  for (const x of [-2.4, 2.4]) g.add(box(0.5, 0.34, 0.04, lam(0xc4453b), x + 0.3, 5.6, 0.2), box(0.04, 0.9, 0.04, goldM, x, 5.35, 0.2), box(0.28, 0.5, 0.05, basic(0xf6e7b4), x, 2.2, -0.56));
  return g;
}

export function observatoryDome(): THREE.Group {
  const g = og(new THREE.Group());
  g.add(mesh(new THREE.CylinderGeometry(1.6, 1.8, 1.4, 12), lam(0xd6dce3), 0, 0.7, 0));
  g.add(mesh(new THREE.SphereGeometry(1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0x6f86b8), 0, 1.4, 0));
  const tube = mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 8), lam(0x3b4a66), 0.2, 2.3, -0.7); tube.rotation.x = -0.9; g.add(tube);
  g.add(box(0.3, 0.5, 0.05, basic(0xf6e7b4), 0, 0.8, -1.74), box(0.04, 1.2, 0.04, lam(0x3b4a66), 0, 3.0, 0)); // door light, little mast
  return g;
}

export function lantern(x: number, z: number): THREE.Group {
  const g = og(new THREE.Group());
  g.add(box(0.1, 1.1, 0.1, lam(0x4a3322), 0, 0.55, 0), box(0.3, 0.3, 0.3, basic(0xffe6a0), 0, 1.25, 0), box(0.4, 0.08, 0.4, lam(0x4a3322), 0, 1.45, 0), box(0.28, 0.05, 0.28, lam(0xf1f6f8), 0, 1.52, 0));
  g.position.set(x, 0, z);
  return g;
}

/** Wooden fence: posts and two rails, along a straight line. */
function fence(x0: number, z0: number, x1: number, z1: number): THREE.Group {
  const g = og(new THREE.Group());
  const wood = lam(0x7a5c3c), snow = lam(0xeaf2f4);
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.1));
  const ang = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
    g.add(box(0.12, 0.8, 0.12, wood, px, 0.4, pz), box(0.16, 0.05, 0.16, snow, px, 0.82, pz));
  }
  for (const y of [0.3, 0.6]) {
    const rail = box(0.06, 0.07, len, wood, (x0 + x1) / 2, y, (z0 + z1) / 2); rail.rotation.y = ang; g.add(rail);
  }
  return g;
}

/** One InstancedMesh from a list of placements (x, z, scale, rotation). */
function scatter(geo: THREE.BufferGeometry, mat: THREE.Material, at: { x: number; y?: number; z: number; sx: number; sy: number; sz: number; ry: number }[]): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, at.length);
  const o = new THREE.Object3D();
  at.forEach((a, i) => { o.position.set(a.x, a.y ?? 0, a.z); o.scale.set(a.sx, a.sy, a.sz); o.rotation.set(0, a.ry, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; // placements span the whole map
  m.userData['flat'] = true;
  return m;
}

export function buildScenery(scene: THREE.Object3D) {
  const rand = rng(31);
  const inPlateau = (x: number, z: number, m: number) => PLATEAUS.some(([px, pz]) => Math.abs(x - px) < 4 + m && Math.abs(z - pz) < 4 + m);
  const nearFrame = (x: number, z: number) => Math.abs(x) < 2.5 && z > -3 && z < 3;
  /** The strip behind the white wall as the horizontal wall cameras see it (any x past the camera, z 12..20): nothing pale or tall may stand there. */
  const corridor = (x: number, z: number) => x > 7 && z > 10.5 && z < 21.5;

  // snow drifts lying on the meadow (the meadow texture itself is the ground, see world.ts)
  const patch = (c: number, x: number, z: number, w: number, d: number, y: number) => {
    const m = flat(new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), new THREE.MeshLambertMaterial({ color: c })));
    m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.set(x, y, z); scene.add(m);
  };
  for (let i = 0; i < 26; i++) {
    const x = -14 + rand() * 62, z = -14 + rand() * 62;
    if (nearRoad(x, z, 2.5) || inPlateau(x, z, 0.5)) { rand(); rand(); continue; }
    patch(i % 3 === 0 ? 0xcfdde0 : 0xe4eef0, x, z, 1.2 + rand() * 3, 1.0 + rand() * 2.6, 0.012);
  }
  // frozen ponds: pale ice with a darker rim, off the road
  for (const [x, z, r] of [[-6, 6, 1.9], [17, 2, 2.2], [3, 16, 1.7], [-4, 21, 2.0], [31, 11, 2.0]] as const) {
    const rim = flat(new THREE.Mesh(new THREE.CircleGeometry(r * 1.12, 20), lam(0x5d7f92)));
    rim.rotation.x = -Math.PI / 2; rim.position.set(x, 0.014, z); rim.scale.set(1, 0.7, 1);
    const ice = flat(new THREE.Mesh(new THREE.CircleGeometry(r, 20), lam(0xa9d3e6)));
    ice.rotation.x = -Math.PI / 2; ice.position.set(x, 0.018, z); ice.scale.set(1, 0.7, 1);
    const glint = flat(new THREE.Mesh(new THREE.CircleGeometry(r * 0.35, 12), lam(0xe6f4fa)));
    glint.rotation.x = -Math.PI / 2; glint.position.set(x - r * 0.25, 0.022, z - r * 0.1); glint.scale.set(1.4, 0.5, 1);
    scene.add(rim, ice, glint);
  }
  // road, textured with pebbles and ruts
  const road = roadTexture();
  for (let i = 0; i < ROAD.length - 1; i++) {
    const [a, b] = ROAD[i]!, [c, d] = ROAD[i + 1]!;
    const len = Math.hypot(c - a, d - b);
    const m = flat(new THREE.Mesh(new THREE.PlaneGeometry(1.7, len + 0.3), lamTex(0xffffff, road, 'road')));
    m.rotation.set(-Math.PI / 2, 0, 0);
    const holder = new THREE.Group(); holder.position.set((a + c) / 2, 0.02, (b + d) / 2); holder.rotation.y = Math.atan2(c - a, d - b);
    holder.add(m); scene.add(holder);
  }
  // trees, bushes, stones, tufts: kept off the road, the white wall's backdrop and the plateaus
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < 70; tries++) {
    const x = -12 + rand() * 56, z = -12 + rand() * 54;
    if (nearRoad(x, z, 2.2)) continue;
    if (corridor(x, z) || (x > 8 && x < 31 && z > 10 && z < 24)) continue; // wall backdrop, observatory and castle area
    if (nearFrame(x, z)) continue;
    scene.add(tree(x, z, 0.8 + rand() * 0.7, true)); placed++;
  }
  for (let i = 0; i < 40; i++) {
    const x = -8 + rand() * 44, z = -8 + rand() * 44;
    if (nearRoad(x, z, 1.4) || inPlateau(x, z, 0.5) || nearFrame(x, z) || corridor(x, z)) continue;
    const s = 0.25 + rand() * 0.25;
    scene.add(mesh(new THREE.DodecahedronGeometry(s, 0), lam(0x8d99a6), x, s * 0.6, z));
  }
  const pick = (n: number, ok: (x: number, z: number) => boolean) => {
    const out: { x: number; z: number; r: number }[] = [];
    for (let t = 0; t < n * 6 && out.length < n; t++) { const x = -14 + rand() * 64, z = -14 + rand() * 62; if (ok(x, z)) out.push({ x, z, r: rand() * 6.28 }); }
    return out;
  };
  const free = (x: number, z: number) => !nearRoad(x, z, 1.3) && !inPlateau(x, z, 0.3) && !nearFrame(x, z);
  // grass tufts: three crossed blades per cluster (also in the wall zone: it keeps the foreground from being bare)
  const tuftGeo = new THREE.ConeGeometry(0.07, 0.34, 4);
  for (const [c, n] of [[0x3f6b4f, 220], [0x2a4a3d, 180]] as const)
    scene.add(scatter(tuftGeo, lam(c), pick(n, free).flatMap((p) => [-0.09, 0, 0.09].map((o, k) => ({ x: p.x + o, y: 0.15, z: p.z + (k === 1 ? 0.07 : 0), sx: 1, sy: 0.7 + (p.r % 1) * 0.8, sz: 1, ry: p.r })))));
  scene.add(scatter(new THREE.SphereGeometry(1, 8, 5), lam(0xe4eef0), pick(22, (x, z) => free(x, z) && !corridor(x, z)).map((p) => ({ x: p.x, y: 0, z: p.z, sx: 0.5 + (p.r % 1.7) * 0.5, sy: 0.22, sz: 0.4 + (p.r % 1.3) * 0.4, ry: p.r }))));
  const bushes = pick(52, (x, z) => free(x, z) && !corridor(x, z));
  scene.add(scatter(new THREE.IcosahedronGeometry(0.5, 0), lam(0x2f6b4c), bushes.map((p) => ({ x: p.x, y: 0.3, z: p.z, sx: 1, sy: 0.8, sz: 1, ry: p.r }))));
  scene.add(scatter(new THREE.IcosahedronGeometry(0.34, 0), lam(0xeaf2f4), bushes.filter((_, i) => i % 2 === 0).map((p) => ({ x: p.x, y: 0.56, z: p.z, sx: 1, sy: 0.5, sz: 1, ry: p.r })))); // snow lying on every second bush
  // fences along two paddocks beside the road
  scene.add(fence(-5.5, 2.5, -2.4, 2.5), fence(5.6, 3.2, 8, 3.2), fence(13, 6.2, 16, 6.2), fence(-3, 10, -3, 13));
  // places
  scene.add(house(8.8, 7.2, 2.6, 2.2, 1.6, 0xe8dcc4, 0xa8553f));       // mill house
  const wheel = waterwheel(); wheel.position.set(6, 1.5, 8); scene.add(wheel);
  const streamMat = lamTex(0xffffff, waterTexture(), 'water');
  const stream = flat(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 9), streamMat)); stream.position.set(6, 0.04, 5.5);
  stream.userData['stream'] = true; scene.add(stream);
  for (const sx of [-0.8, 0.8]) scene.add(flat(box(0.25, 0.1, 9, lam(0xc9d6da), 6 + sx, 0.06, 5.5))); // snowy banks
  // the plateaus: paved top, rock sides, a parapet along the open edges and steps up from the road
  const pave = paveTexture(); pave.repeat.set(3, 3);
  const cliff = cliffTexture(); cliff.repeat.set(4, 1);
  const top = lamTex(0xffffff, pave, 'pave'), side = lamTex(0xffffff, cliff, 'cliff');
  PLATEAUS.forEach(([x, z], i) => {
    const h = 2 + i * 0.004; // the second plateau is a hair higher so that where they overlap no two faces share a plane
    const p = box(8, h, 8, [side, side, top, side, side, side], x, h / 2, z);
    p.userData['recv'] = true; scene.add(p);
    const stone = lam(0x6e8794), snow = lam(0x7f99a8); // capped with shaded slate, not snow: nothing near-white may stand behind the wall silhouette
    for (const [dx, dz, w, d] of [[-3.9, 0, 0.3, 8], [3.9, 0, 0.3, 8], [0, -3.9, 8, 0.3], [0, 3.9, 8, 0.3]] as const) {
      if (i === 0 && dx > 0 && dz === 0) continue; if (i === 1 && dx < 0) continue; if (i === 0 && dz > 0) continue; if (i === 1 && dz < 0) continue; // the two plateaus join
      scene.add(box(w, 0.45, d, stone, x + dx, h + 0.22, z + dz), box(w * 0.7, 0.07, d * 0.7, snow, x + dx, h + 0.47, z + dz));
    }
    const steps = og(new THREE.Group());
    for (let s = 0; s < 3; s++) steps.add(box(2.4, 0.66 * (s + 1), 0.55, lam(0x7d95a3), x, 0.33 * (s + 1), z - 4 - 0.28 - (2 - s) * 0.55));
    scene.add(steps);
    // a pair of stone urns with a cap of snow: small furniture so that the terraces read as places
    for (const ux of [x - 2.3, x + 2.3]) {
      const u = og(new THREE.Group());
      u.add(mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.45, 8), lam(0x8d99a6), 0, 0.22, 0));
      const cap = mesh(new THREE.SphereGeometry(0.26, 8, 5), lam(0x93a9b6), 0, 0.5, 0); cap.scale.set(1, 0.5, 1); u.add(cap);
      u.position.set(ux, h, z - 3.3); scene.add(u);
    }
  });
  const castle = castleModel(); castle.position.set(28, 2, 27.2); scene.add(castle);
  const dome = observatoryDome(); dome.position.set(19.2, 2, 22.6); scene.add(dome);
  // a snow-dusted terrace path ring around the dome and a courtyard strip before the castle door
  const ring = flat(new THREE.Mesh(new THREE.RingGeometry(1.9, 2.4, 20), lam(0xcfdde4))); ring.rotation.x = -Math.PI / 2; ring.position.set(19.2, 2.02, 22.6); scene.add(ring);
  const court = flat(box(2.2, 0.04, 3.2, lam(0x9db2bd), 28, 2.02, 24.8)); scene.add(court);
  for (const [x, z] of LAMPS) scene.add(lantern(x, z));
  for (const [x, z] of [[24.2, 22.0], [31.2, 28.2]] as const) { const l = lantern(x, z); l.position.y = 2; scene.add(l); }
  return { lamps: [...LAMPS.map(([x, z]) => [x, 1.25, z] as const), [24.2, 3.25, 22.0] as const, [31.2, 3.25, 28.2] as const] };
}

/** A small friend: rounded body, head, scarf and a hat (player) or ears (Toto). Origin at the waist so it sits at anchor y + 0.5. */
export function figure(coat: number, scarf: number, kind: 'player' | 'toto'): THREE.Group {
  const g = og(new THREE.Group());
  g.add(mesh(new THREE.CapsuleGeometry(0.26, 0.45, 4, 10), lam(coat), 0, 0, 0));
  g.add(mesh(new THREE.SphereGeometry(0.24, 12, 10), lam(0xf0c7a0), 0, 0.62, 0));
  g.add(mesh(new THREE.TorusGeometry(0.27, 0.07, 6, 12), lam(scarf), 0, 0.34, 0).rotateX(Math.PI / 2));
  const eye = new THREE.MeshBasicMaterial({ color: 0x1b1b1b });
  g.add(mesh(new THREE.SphereGeometry(0.035, 6, 6), eye, -0.09, 0.64, -0.21), mesh(new THREE.SphereGeometry(0.035, 6, 6), eye, 0.09, 0.64, -0.21));
  if (kind === 'player') g.add(mesh(new THREE.CylinderGeometry(0.25, 0.26, 0.14, 12), lam(0xc4453b), 0, 0.84, 0));
  else for (const x of [-0.15, 0.15]) g.add(mesh(new THREE.ConeGeometry(0.09, 0.2, 5), lam(0x8a6a4a), x, 0.88, 0));
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 14), new THREE.MeshBasicMaterial({ color: 0x0b1410, transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.48; shadow.userData['flat'] = true; shadow.userData['blob'] = true; g.add(shadow);
  return g;
}
