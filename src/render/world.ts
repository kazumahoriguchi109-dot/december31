import * as THREE from 'three';
import { anchorDef, puzzles, world } from '../content/load';
import type { Anchor, Era, View } from '../domain/types';
import { ARM_STEMS, ribbon, spec, zOf, type Piece } from './p05Geometry';

/** Everything the renderer needs. It is a pure projection of game state; the renderer never writes state back. */
export interface ViewModel {
  era: Era;
  presetId: string;
  anchor: Anchor;
  view: View;
  p04Solved: boolean;
  p05: { a: number; b: number };
  /** Early puzzles (placeholder shapes). `gateOpen` is the visual formula: latched OR Toto holds the plate OR the player's own test. */
  p01: { rotation: number; solved: boolean };
  p02: { drain: 'open' | 'closed'; stopper: 'locked' | 'released'; solved: boolean };
  p03: { gateOpen: boolean; latched: boolean; plateDown: boolean };
  totoWait: 'p03_plate' | 'p06_front' | 'p06_back' | null;
  p06: { latched: boolean; frontHeld: boolean; backHeld: boolean };
}

const C = {
  sky: 0x1e2f45, observeBg: 0x121c2b, ground: 0x2d4a40, plateau: 0x3c5a68, wall: 0xf0eee5, gold: 0xd9ac5b,
  player: 0xd98f5b, toto: 0x527d69, rail: 0x4a5c72, fixed: 0xffffff, a: 0xffd166, b: 0x66d9ef,
};
const WALL_FRONT_X = 13.99;

export const RES = { E0: [320, 180], E1: [640, 360] } as const;

export class WorldView {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  /** Quality setting 'low': render at device pixel ratio 1 (cheaper on weak GPUs). */
  lowQuality = false;
  private readonly cameras = new Map<string, THREE.Camera>();
  private readonly wallBoxes = new THREE.Group();
  private readonly wallFlat = new THREE.Group();
  private readonly pieces: Record<'a' | 'b', THREE.Mesh[]> = { a: [], b: [] };
  private readonly carriages: Record<'a' | 'b', THREE.Group[]> = { a: [], b: [] };
  private readonly player: THREE.Mesh;
  private readonly toto: THREE.Mesh;
  private readonly early = new EarlyPuzzles();
  private readonly room = new RoomScene();
  /** The room is a separate scene so none of the outer world can show through. */
  private readonly roomScene = new THREE.Scene();
  private vm: ViewModel | null = null;
  private stageW = 960;
  private stageH = 540;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(C.sky);
    this.buildStatic();
    this.buildWall();
    this.buildApparatus();
    this.scene.add(this.early.root);
    this.roomScene.add(this.room.root, new THREE.AmbientLight(0xffffff, 1.0));
    const cap = new THREE.CapsuleGeometry(0.25, 0.5, 4, 10);
    this.player = new THREE.Mesh(cap, new THREE.MeshLambertMaterial({ color: C.player }));
    this.toto = new THREE.Mesh(cap, new THREE.MeshLambertMaterial({ color: C.toto }));
    this.scene.add(this.player, this.toto);
  }

  // ---------- scene construction ----------
  private buildStatic() {
    const amb = new THREE.AmbientLight(0xffffff, 1.0);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-5, 10, 2); // from the viewer side of the wall, so -X faces are evenly lit and tops are brighter
    this.scene.add(amb, sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ color: C.ground }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(14, 0, 14);
    this.scene.add(ground);
    // vertical bands so that horizontal wall cameras still show a floor line and a sky
    const band = new THREE.Mesh(new THREE.PlaneGeometry(240, 30), new THREE.MeshBasicMaterial({ color: C.ground, side: THREE.DoubleSide }));
    band.rotation.y = -Math.PI / 2;
    band.position.set(50, -15, 14);
    this.scene.add(band);
    // plateaus the observatory and the castle stand on (anchors are at y=2)
    for (const [x, z] of [[22, 20], [28, 26]] as const) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 8), new THREE.MeshLambertMaterial({ color: C.plateau }));
      p.position.set(x, 1, z);
      this.scene.add(p);
    }
    // placeholder landmarks (temporary original shapes; not final art)
    const gold = new THREE.MeshLambertMaterial({ color: C.gold });
    const black = new THREE.MeshBasicMaterial({ color: 0x05080d });
    const frame = new THREE.Group();
    frame.add(box(0.3, 3, 0.3, gold, -1.35, 1.5, 0), box(0.3, 3, 0.3, gold, 1.35, 1.5, 0), box(3, 0.3, 0.3, gold, 0, 3.15, 0), box(2.4, 3, 0.05, black, 0, 1.5, 0));
    this.scene.add(frame);
    this.scene.add(box(2.4, 0.15, 2.4, new THREE.MeshLambertMaterial({ color: 0x8aa1b5 }), 0, 0.08, 5));
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.4, 24), new THREE.MeshLambertMaterial({ color: 0xaf6654 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(6, 1.5, 8);
    this.scene.add(wheel);
    const gate = new THREE.Group();
    gate.add(box(0.4, 3, 0.4, gold, 8.8, 1.5, 12), box(0.4, 3, 0.4, gold, 11.2, 1.5, 12), box(2.8, 0.4, 0.4, gold, 10, 3, 12));
    this.scene.add(gate);
    const castle = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial({ color: 0xcfd6dd });
    castle.add(box(3.6, 2.4, 3.6, stone, 28, 3.2, 26), box(1.6, 2.4, 1.6, stone, 28, 5.6, 26), box(0.9, 0.9, 0.9, gold, 28, 7.3, 26));
    this.scene.add(castle);
  }

  private buildWall() {
    const mat = new THREE.MeshLambertMaterial({ color: C.wall });
    for (const b of puzzles.p04Geometry.boxes) {
      const [x0, y0, z0] = b.min as [number, number, number];
      const [x1, y1, z1] = b.max as [number, number, number];
      this.wallBoxes.add(box(x1 - x0, y1 - y0, z1 - z0, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    }
    // E0/E1: the same silhouette as one flat shape built from the documented front mask polygon
    const poly = puzzles.p04Geometry.frontMaskPolygonUV as [number, number][];
    const shape = new THREE.Shape(poly.map(([u, v]) => new THREE.Vector2(u, v)));
    const g = new THREE.ShapeGeometry(shape);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, WALL_FRONT_X, pos.getY(i), 14 + pos.getX(i));
    pos.needsUpdate = true;
    this.wallFlat.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: C.wall, side: THREE.DoubleSide })));
    this.scene.add(this.wallBoxes, this.wallFlat);
  }

  private buildApparatus() {
    // Local frame: +Z forward, 1 unit = 0.25 m; world = (22+.25X, 3.6+.25Y, 20-.25Z) via the parent transform.
    const root = new THREE.Group();
    root.position.set(...world.p05LocalToWorld.origin);
    const s = world.p05LocalToWorld.scale;
    root.scale.set(s, s, -s);
    const mk = (piece: Piece, pos: number, color: number) => {
      const { positions, indices } = ribbon(piece, pos, 72);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setIndex(indices);
      return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    };
    root.add(mk('fixed', 0, C.fixed));
    const railMat = new THREE.MeshBasicMaterial({ color: C.rail });
    for (const piece of ['a', 'b'] as const) {
      const color = piece === 'a' ? C.a : C.b;
      const st = ARM_STEMS[piece];
      const dx = Math.cos(st.midAngle), dy = Math.sin(st.midAngle);
      const r = spec(piece).radius;
      for (let pos = 0; pos < 3; pos++) {
        const m = mk(piece, pos, color);
        const z = zOf(piece, pos);
        // stem: mid-arc outward only (never across the ring interior or an end point), then a carriage on a rail
        const sx = (r + 0.05) * dx, sy = (r + 0.05) * dy;
        const ex = (r + st.length) * dx, ey = (r + st.length) * dy;
        const grp = new THREE.Group();
        grp.add(m, tube(sx, sy, z, ex, ey, z, 0.05, railMat), box(0.3, 0.3, 0.3, railMat, ex, ey, z));
        this.pieces[piece].push(m);
        this.carriages[piece].push(grp);
        root.add(grp);
      }
      const ex = (r + st.length) * dx, ey = (r + st.length) * dy;
      root.add(box(0.12, 0.12, 3.4, railMat, ex, ey, 5)); // rail along the depth axis
    }
    this.scene.add(root);
  }

  // ---------- cameras ----------
  private camera(id: string): THREE.Camera {
    let c = this.cameras.get(id);
    if (c) return c;
    const p = world.cameraPresets[id];
    if (!p) throw new Error(`unknown camera preset ${id}`);
    if (p.projection === 'perspective') {
      c = new THREE.PerspectiveCamera(p.verticalFovDegrees!, p.aspect, p.near, p.far);
    } else {
      const f = p.frustum!;
      c = new THREE.OrthographicCamera(f.left, f.right, f.top, f.bottom, p.near, p.far);
    }
    c.position.set(...p.position);
    c.up.set(...p.up);
    c.lookAt(new THREE.Vector3(...p.target));
    c.updateMatrixWorld(true);
    this.cameras.set(id, c);
    return c;
  }

  static presetFor(anchor: Anchor, view: View): string {
    const id = anchorDef(anchor).cameraByView[view];
    if (!id) throw new Error(`no camera for ${anchor}/${view}`);
    return id;
  }

  /** Square observation frame vs 16:9 scene frame. */
  static isSquare(presetId: string): boolean {
    return world.cameraPresets[presetId]?.projection === 'perspective';
  }

  // ---------- frame ----------
  resize(stageW: number, stageH: number) {
    this.stageW = Math.max(1, Math.round(stageW));
    this.stageH = Math.max(1, Math.round(stageH));
    if (this.vm) this.render(this.vm);
  }

  render(vm: ViewModel) {
    this.vm = vm;
    const square = WorldView.isSquare(vm.presetId);
    const lowRes = !square && (vm.era === 'E0' || vm.era === 'E1');
    if (lowRes) {
      const [w, h] = RES[vm.era as 'E0' | 'E1'];
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(w, h, false);
      this.canvas.style.imageRendering = 'pixelated';
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowQuality ? 1 : 1.5));
      this.renderer.setSize(this.stageW, this.stageH, false);
      this.canvas.style.imageRendering = 'auto';
    }
    this.renderer.setClearColor(square ? C.observeBg : this.room.root.visible ? 0x2a2118 : C.sky);
    const flat = vm.era === 'E0' || vm.era === 'E1';
    this.wallBoxes.visible = !flat;
    this.wallFlat.visible = flat;
    for (const piece of ['a', 'b'] as const) {
      const sel = vm.p05[piece];
      this.pieces[piece].forEach((_, i) => { this.carriages[piece][i]!.visible = i === sel; });
    }
    this.early.apply(vm);
    this.room.apply(vm);
    this.placeFigures(vm);
    this.renderer.render(this.room.root.visible ? this.roomScene : this.scene, this.camera(vm.presetId));
  }

  private placeFigures(vm: ViewModel) {
    const def = anchorDef(vm.anchor);
    const [x, y, z] = def.position;
    const wall = vm.anchor === 'wall_base' || vm.anchor === 'wall_top';
    // On the wall cameras the figures are drawn beside the pattern (render offset only), so the silhouette is never covered.
    const pz = wall ? (vm.anchor === 'wall_base' ? 13.2 : 17.5) : z;
    const px = wall && vm.anchor === 'wall_top' ? 14.6 : x;
    const tz = wall ? (vm.anchor === 'wall_base' ? 12.5 : 17.5) : z;
    const tx = wall ? (vm.anchor === 'wall_top' ? 14.6 : x) : x + 0.6;
    this.player.position.set(px, y + 0.5, pz);
    this.toto.position.set(tx, y + 0.5, wall && vm.anchor === 'wall_top' ? tz - 0.9 : tz);
    if (vm.totoWait === 'p03_plate') this.toto.position.set(10, 0.5, 9.2); // on the plate
    else if (vm.totoWait === 'p06_front') this.toto.position.set(0, 0.5, -1.5);
    else if (vm.totoWait === 'p06_back') this.toto.position.set(0, 0.5, 1.5);
    this.player.visible = this.toto.visible = def.space === 'world';
  }

  /** Screen position (0..1 within the stage frame) of a world point under the current camera. */
  project(p: [number, number, number]): { x: number; y: number } {
    const c = this.vm ? this.camera(this.vm.presetId) : this.camera('wall_base_front');
    const v = new THREE.Vector3(...p).project(c);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  get canvasEl() { return this.canvas; }
}

/**
 * The room the story starts and ends in: a small enclosed shell around the origin (so nothing of the outer world shows),
 * a desk with a screen, a window onto a winter evening, a table calendar and the two friends side by side. Original shapes.
 * At the ending the screen shows the two rings settled (a still, steady mark).
 */
class RoomScene {
  readonly root = new THREE.Group();
  private readonly screen: THREE.Mesh;
  private readonly rings = new THREE.Group();
  constructor() {
    const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c });
    const basic = (c: number) => new THREE.MeshBasicMaterial({ color: c });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 14), new THREE.MeshLambertMaterial({ color: 0xb59a7a, side: THREE.BackSide }));
    shell.position.set(0, 3, 0);
    const floor = box(14, 0.1, 14, mat(0x8a6a4a), 0, 0.05, 0);
    const rug = box(5, 0.04, 3.4, mat(0x6e8fb0), 0, 0.12, -0.6);
    // window on the +Z wall, snow outside
    const win = box(3.2, 2.4, 0.1, basic(0x2a3d63), -2.4, 3.2, 6.9);
    const snow = box(3.2, 0.6, 0.12, basic(0xe9eef5), -2.4, 2.3, 6.88);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), basic(0xf6e7b4)); moon.position.set(-1.6, 4.0, 6.82); moon.rotation.y = Math.PI;
    const frame = box(3.5, 2.7, 0.08, mat(0x5a4632), -2.4, 3.2, 6.95);
    // desk, screen and chairs
    const desk = box(4.2, 0.18, 1.6, mat(0x6b4f35), 1.2, 1.5, 4.8);
    const legs = [[-0.9, 4.2], [3.3, 4.2], [-0.9, 5.4], [3.3, 5.4]].map(([x, z]) => box(0.18, 1.5, 0.18, mat(0x4f3a27), x!, 0.75, z!));
    this.screen = box(2.0, 1.2, 0.1, basic(0x203a5c), 1.2, 2.3, 5.4);
    const stand = box(0.2, 0.5, 0.2, mat(0x333c4a), 1.2, 1.85, 5.4);
    // table calendar: a small card with a red top
    const cal = box(0.5, 0.45, 0.1, basic(0xf4f0e6), 3.0, 1.84, 4.9);
    const calTop = box(0.5, 0.12, 0.12, basic(0xd05a4e), 3.0, 2.0, 4.9);
    // two friends seen from behind, sharing one screen
    const body = (x: number, c: number) => {
      const g = new THREE.Group();
      g.add(box(0.7, 0.9, 0.5, mat(c), 0, 1.0, 0), new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), mat(0xf0c7a0)));
      g.children[1]!.position.set(0, 1.78, 0);
      g.position.set(x, 0, 3.4);
      return g;
    };
    const me = body(0.4, C.player), toto = body(2.0, C.toto);
    const lamp = new THREE.PointLight(0xffe2b0, 40, 14); lamp.position.set(0, 5, 2);
    // two steady rings on the screen (visible at the ending only)
    for (const r of [0.2, 0.34]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.025, r, 40), basic(0xffd166));
      ring.position.set(1.2, 2.3, 5.33); ring.rotation.y = Math.PI;
      this.rings.add(ring);
    }
    this.root.add(shell, floor, rug, win, snow, moon, frame, desk, ...legs, this.screen, stand, cal, calTop, me, toto, lamp, this.rings);
    this.root.visible = false;
  }
  apply(vm: ViewModel) {
    const here = vm.anchor === 'room' || vm.anchor === 'home';
    this.root.visible = here;
    this.rings.visible = vm.anchor === 'home';
  }
}

function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}
function tube(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, m: THREE.Material): THREE.Mesh {
  const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1);
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
  mesh.position.copy(a.clone().add(b).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

/**
 * Placeholder shapes for P01-P03 (original, single-colour; not final art). Every shape is a pure projection of the state:
 * the verdicts live in the domain, nothing here decides anything.
 */
class EarlyPuzzles {
  readonly root = new THREE.Group();
  private readonly g1 = new THREE.Group();
  private readonly g2 = new THREE.Group();
  private readonly g3 = new THREE.Group();
  private readonly g4 = new THREE.Group();
  private readonly plateF: THREE.Mesh;
  private readonly plateB: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private readonly tile = new THREE.Group();
  private readonly lineIn: THREE.Mesh;
  private readonly lineOut: THREE.Mesh;
  private readonly gateLeaf: THREE.Mesh;
  private readonly plate: THREE.Mesh;
  private readonly latch: THREE.Mesh;
  private readonly drainBox: THREE.Mesh;
  private readonly spill: THREE.Mesh;
  private readonly pin: THREE.Mesh;
  private readonly bridge: THREE.Mesh;
  private readonly water: THREE.Mesh;
  private readonly mats = {
    off: new THREE.MeshBasicMaterial({ color: 0x6d7f95 }), on: new THREE.MeshBasicMaterial({ color: 0xffd166 }),
    water: new THREE.MeshBasicMaterial({ color: 0x4aa3df }), dark: new THREE.MeshBasicMaterial({ color: 0x05080d }),
    red: new THREE.MeshBasicMaterial({ color: 0xe0605a }), wood: new THREE.MeshLambertMaterial({ color: 0x9a7a52 }),
    leaf: new THREE.MeshLambertMaterial({ color: 0xd9ac5b }),
  };

  constructor() {
    const m = this.mats;
    // P01: an L-shaped tile (ports W+N at rotation 0), the fixed entry line from the north and the exit line to the east
    this.tile.position.set(0, 0.06, 5);
    this.tile.add(box(1.4, 0.12, 0.4, m.off, -0.5, 0, 0), box(0.4, 0.12, 1.4, m.off, 0, 0, 0.5));
    this.lineIn = box(0.3, 0.1, 2.4, m.off, 0, 0.05, 7.2);
    this.lineOut = box(2.6, 0.1, 0.3, m.off, 1.9, 0.05, 5);
    const gate1 = new THREE.Group();
    gate1.add(box(0.3, 2, 0.3, m.leaf, 3.4, 1, 4.4), box(0.3, 2, 0.3, m.leaf, 3.4, 1, 5.6), box(0.3, 0.3, 1.5, m.leaf, 3.4, 2, 5));
    this.g1.add(this.tile, this.lineIn, this.lineOut, gate1);
    // P02: water channel, drain, wheel pin, bridge
    this.water = box(5, 0.08, 0.7, m.water, 3.5, 0.05, 9.5);
    this.drainBox = box(0.8, 0.1, 0.8, m.dark, 3, 0.07, 9.5);
    this.spill = box(0.5, 0.08, 2.6, m.water, 3, 0.04, 7.9);
    this.pin = box(0.25, 0.9, 0.25, m.red, 6, 2.1, 8.9);
    this.bridge = box(2.2, 0.15, 1.4, m.wood, 7.4, 0.1, 10.4);
    this.g2.add(this.water, this.drainBox, this.spill, this.pin, this.bridge);
    // P03: plate, gate leaf, latch
    this.plate = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 20), m.off);
    this.plate.position.set(10, 0.05, 9.2);
    this.gateLeaf = box(2.4, 2.6, 0.2, m.leaf, 10, 1.3, 12);
    this.latch = box(0.4, 0.4, 0.4, m.off, 10, 0.9, 14.6);
    this.g3.add(this.plate, this.gateLeaf, this.latch);
    // P06: one plate on each side of the frame, and a light inside the frame once it is latched open
    this.plateF = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 20), m.off);
    this.plateF.position.set(0, 0.05, -1.5);
    this.plateB = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 20), m.off);
    this.plateB.position.set(0, 0.05, 1.5);
    this.glow = box(2.4, 3, 0.06, new THREE.MeshBasicMaterial({ color: 0xf6e7b4 }), 0, 1.5, 0);
    this.g4.add(this.plateF, this.plateB, this.glow);
    this.root.add(this.g1, this.g2, this.g3, this.g4);
  }

  apply(vm: ViewModel) {
    const m = this.mats;
    // show only the puzzle of the current place so each camera reads clearly
    this.g1.visible = vm.anchor === 'arrival' || vm.anchor === 'p01_panel';
    this.g2.visible = vm.anchor === 'mill';
    this.g3.visible = vm.anchor === 'gate_near' || vm.anchor === 'gate_far';
    this.g4.visible = vm.anchor === 'portal_front' || vm.anchor === 'portal_back';
    this.plateF.material = vm.p06.frontHeld ? m.on : m.off;
    this.plateB.material = vm.p06.backHeld ? m.on : m.off;
    this.glow.visible = vm.p06.latched;
    const p1 = vm.p01;
    this.tile.rotation.y = -p1.rotation * (Math.PI / 2); // clockwise on screen, in 90-degree steps
    const lit = p1.solved ? m.on : m.off;
    this.lineIn.material = lit; this.lineOut.material = lit;
    for (const c of this.tile.children) (c as THREE.Mesh).material = lit;
    const p2 = vm.p02;
    this.drainBox.material = p2.drain === 'open' ? m.dark : m.off;
    this.spill.visible = p2.drain === 'open'; // water leaves through the open drain
    this.pin.visible = p2.stopper === 'locked';
    this.bridge.rotation.x = p2.solved ? 0 : -0.9;
    this.bridge.position.y = p2.solved ? 0.1 : 0.9;
    const p3 = vm.p03;
    this.gateLeaf.position.y = p3.gateOpen ? 4.2 : 1.3;
    this.plate.material = p3.plateDown ? m.on : m.off;
    this.plate.position.y = p3.plateDown ? 0.02 : 0.05;
    this.latch.material = p3.latched ? m.on : m.off;

  }
}
