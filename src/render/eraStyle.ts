// The look of each era. The geometry and landmark positions never change between eras; what changes is how the world is drawn:
//   E0  flat 2D pixel art   : 320x180, two-tone unlit-style cel lighting, hard texels, flat sky bands, 18-colour palette, black outlines
//   E1  richer 2D / 2.5D    : 640x360, three-tone cel shading, depth haze, coloured outlines, a moon
//   E2  lit low-poly 3D     : full resolution, smooth lighting, textured ground, smooth sky gradient
//   E3  rich 3D             : E2 plus soft shadows, depth haze, falling snow, warm lamp and window glow, starry sky with a moon
// Presentation only: nothing here is read by the game logic.
import * as THREE from 'three';
import type { Era } from '../domain/types';
import { dotTexture, rng, setTextureStyle, skyTexture, type Twins } from './materials';

export type Mode = 'pixel' | 'lit';
export const isPixelEra = (e: Era) => e === 'E0' || e === 'E1';

interface Ctx {
  era: Era;
  /** camera target in world space (the shadow and snow volumes follow it) */
  target: THREE.Vector3;
  /** a horizontal camera that looks at the white wall: no weather, nothing pale may appear behind the silhouette */
  wallView: boolean;
  reduced: boolean;
  /** quality setting 'low': no shadow map */
  low: boolean;
}

const SUN_DIR = new THREE.Vector3(-5, 10, 2).normalize();

const SKY: [number, string][] = [[0, '#34536e'], [0.3, '#26425e'], [0.65, '#172a45'], [1, '#0d1829']];
const SKY_E3: [number, string][] = [[0, '#3b5c7c'], [0.22, '#2a4766'], [0.55, '#182c4a'], [1, '#0a1424']];

export class EraStyle {
  readonly amb = new THREE.AmbientLight(0xffffff, 1);
  readonly hemi = new THREE.HemisphereLight(0xb4c8ff, 0x3a4a3a, 0);
  readonly sun = new THREE.DirectionalLight(0xffffff, 1.6);
  private readonly backdrop = new THREE.Group();
  private readonly sky: THREE.Mesh;
  private readonly ridges: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private readonly stars: THREE.Points;
  private readonly moon = new THREE.Group();
  private readonly glow = new THREE.Group();
  private readonly snow: THREE.Points;
  private readonly flakes: Float32Array;
  private readonly phase: Float32Array;
  private readonly skyTex = new Map<string, THREE.Texture>();
  private mode: 'e0' | 'e1' | 'lit' | '' = '';
  private lastEra: Era | '' = '';
  private t = 0;
  private readonly snowBox = { x: 20, y: 11, z: 18 };

  constructor(root: THREE.Object3D, lamps: readonly (readonly [number, number, number])[]) {
    this.sun.position.copy(SUN_DIR).multiplyScalar(20);
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 45;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04; this.sun.shadow.radius = 3.5;
    root.add(this.amb, this.hemi, this.sun, this.sun.target);

    // sky plane behind everything the wall cameras can see, plus layered ridges (the distant landscape)
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(300, 12), new THREE.MeshBasicMaterial({ fog: false, side: THREE.DoubleSide }));
    this.sky.rotation.y = -Math.PI / 2; this.sky.position.set(85, 6, 14);
    this.sky.userData['flat'] = true;
    this.backdrop.add(this.sky);
    const layers: [number, number, number, number][] = [[64, 3.0, 5.5, 1], [56, 2.0, 3.6, 2], [47, 1.1, 2.1, 3]];
    for (const [x, hMax, wl, seed] of layers) {
      const r = rng(seed * 17);
      const phases = [r() * 6, r() * 6, r() * 6];
      const pts: THREE.Vector2[] = [new THREE.Vector2(-30, 0)];
      for (let z = -30; z <= 60; z += 0.35) {
        const n = 0.5 + 0.28 * Math.sin(z / wl + phases[0]!) + 0.17 * Math.sin(z / (wl * 0.37) + phases[1]!) + 0.08 * Math.sin(z / (wl * 0.13) + phases[2]!);
        const tooth = seed === 3 ? (((z * 1.6) % 1) < 0.5 ? ((z * 1.6) % 1) * 0.5 : (1 - ((z * 1.6) % 1)) * 0.5) * 0.45 : 0; // pine-top teeth on the nearest ridge
        pts.push(new THREE.Vector2(z, Math.max(0.05, (n + tooth) * hMax)));
      }
      pts.push(new THREE.Vector2(60, 0));
      const geo = new THREE.ShapeGeometry(new THREE.Shape(pts));
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, x, pos.getY(i), pos.getX(i));
      const mat = new THREE.MeshBasicMaterial({ color: 0x142238, fog: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat); m.userData['flat'] = true;
      this.ridges.push({ mesh: m, mat }); this.backdrop.add(m);
    }
    // stars (tinted, never white) and the moon
    const r = rng(77), n = 150, sp = new Float32Array(n * 3), sc2 = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      sp.set([76, 0.9 + r() * 3.6, 2 + r() * 30], i * 3);
      const warm = r() < 0.5; sc2.set(warm ? [0.94, 0.78, 0.43] : [0.55, 0.66, 0.92], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc2, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ color: 0xe4aa5a, fog: false }));
    disc.rotation.y = -Math.PI / 2; disc.position.set(78, 2.6, 18.4); disc.userData['flat'] = true;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture('moonhalo', 'rgba(110,140,210,0.4)', 'rgba(110,140,210,0)', 128), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.set(2.6, 2.6, 1); halo.position.set(79, 2.6, 18.4); halo.userData['flat'] = true;
    this.moon.add(disc, halo);
    this.backdrop.add(this.stars, this.moon);
    root.add(this.backdrop);

    // warm glows (E3): lantern halos, lit windows, and pools of light on the ground
    const warmTex = dotTexture('warmglow', 'rgba(255,200,110,0.95)', 'rgba(255,150,60,0)', 128);
    const mk = (x: number, y: number, z: number, s: number, a: number) => {
      const sp2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: warmTex, blending: THREE.AdditiveBlending, depthWrite: false, opacity: a, fog: false }));
      sp2.scale.set(s, s, 1); sp2.position.set(x, y, z); sp2.userData['flat'] = true; this.glow.add(sp2);
    };
    const poolMat = new THREE.MeshBasicMaterial({ map: dotTexture('warmpool', 'rgba(255,190,100,0.35)', 'rgba(255,150,60,0)', 128), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (const [x, y, z] of lamps) {
      mk(x, y, z, 1.65, 0.6);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(x, y - 1.2, z); pool.userData['flat'] = true; this.glow.add(pool);
    }
    mk(9.58, 1.0, 6.0, 1.7, 0.8); mk(28, 4.4, 26.6, 2.4, 0.7); mk(26, 4.4, 26.6, 1.3, 0.6); mk(30, 4.4, 26.6, 1.3, 0.6); mk(19.2, 2.8, 20.8, 1.6, 0.75);
    root.add(this.glow);

    // snow
    const nf = 640; this.flakes = new Float32Array(nf * 3); this.phase = new Float32Array(nf);
    const rs = rng(5);
    for (let i = 0; i < nf; i++) { this.flakes.set([(rs() - 0.5) * 2 * this.snowBox.x, rs() * this.snowBox.y, (rs() - 0.5) * 2 * this.snowBox.z], i * 3); this.phase[i] = rs() * 6.28; }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.flakes), 3));
    this.snow = new THREE.Points(fg, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, map: dotTexture('flake', 'rgba(255,255,255,1)', 'rgba(255,255,255,0)', 32), transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    this.snow.frustumCulled = false; this.snow.userData['flat'] = true;
    root.add(this.snow);
  }

  private skyFor(era: Era): THREE.Texture {
    const key = era;
    let t = this.skyTex.get(key);
    if (!t) {
      t = era === 'E0' ? skyTexture('sky0', SKY, 4, 0) : era === 'E1' ? skyTexture('sky1', SKY, 8, 0) : era === 'E2' ? skyTexture('sky2', SKY, 0, 0) : skyTexture('sky3', SKY_E3, 0, 0);
      this.skyTex.set(key, t);
    }
    return t;
  }

  /** Swap every registered material between its smooth Lambert and cel Toon twin (one traverse, only when the mode changes). */
  private swapMaterials(root: THREE.Object3D, mode: 'e0' | 'e1' | 'lit') {
    if (mode === this.mode) return;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const orig = (m.userData['mat0'] ??= m.material) as THREE.Material | THREE.Material[];
      const pick = (x: THREE.Material) => { const tw = x.userData['twins'] as Twins | undefined; return !tw || mode === 'lit' ? x : mode === 'e0' ? tw.e0 : tw.e1; };
      m.material = Array.isArray(orig) ? orig.map(pick) : pick(orig);
    });
    this.mode = mode;
  }

  /** Mark who casts and who receives shadows (E3). Called once after the scene is built. */
  static tagShadows(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData['blob']) return;
      const flat = !!m.userData['flat'] || (m.material as THREE.Material).type === 'MeshBasicMaterial';
      m.castShadow = !flat;
      m.receiveShadow = !!m.userData['flat'] || !!m.userData['recv'] || !!m.userData['ground'];
      if (m.userData['ground'] || m.userData['recv']) m.receiveShadow = true;
    });
  }

  apply(root: THREE.Object3D, ctx: Ctx): { clear: number; fog: boolean } {
    const era = ctx.era;
    const pixel = isPixelEra(era);
    this.swapMaterials(root, era === 'E0' ? 'e0' : era === 'E1' ? 'e1' : 'lit');
    if (era !== this.lastEra) {
      setTextureStyle(pixel);
      (this.sky.material as THREE.MeshBasicMaterial).map = this.skyFor(era);
      (this.sky.material as THREE.MeshBasicMaterial).needsUpdate = true;
      this.lastEra = era;
    }
    const e3 = era === 'E3';
    // lights
    this.amb.color.set(0xffffff);
    if (era === 'E0') { this.amb.intensity = 1.25; this.hemi.intensity = 0; this.sun.intensity = 0.35; this.sun.color.set(0xffffff); }
    else if (era === 'E1') { this.amb.intensity = 0.55; this.hemi.intensity = .45; this.hemi.color.set(0xb9d5ef); this.hemi.groundColor.set(0x647080); this.sun.intensity = 1.8; this.sun.color.set(0xfff1dc); }
    else if (era === 'E2') { this.amb.intensity = 1.0; this.hemi.intensity = 0; this.sun.intensity = 1.6; this.sun.color.set(0xffffff); }
    else { this.amb.intensity = 0.5; this.amb.color.set(0xb4c4ff); this.hemi.intensity = 0.75; this.hemi.color.set(0xa4bcff); this.hemi.groundColor.set(0x44584e); this.sun.intensity = 1.7; this.sun.color.set(0xffdca8); }
    // shadow volume follows the camera
    this.sun.target.position.copy(ctx.target); this.sun.target.updateMatrixWorld();
    this.sun.position.copy(ctx.target).addScaledVector(SUN_DIR, 20);
    const wasShadow = this.sun.castShadow;
    this.sun.castShadow = e3 && !ctx.wallView && !ctx.low;
    if (wasShadow !== this.sun.castShadow) root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const mats = Array.isArray(m.material) ? m.material : [m.material]; mats.forEach((x) => { x.needsUpdate = true; }); } });
    // backdrop
    this.backdrop.visible = true;
    const palettes: Record<string, number[]> = {
      E0: [0x1e3350, 0x142238, 0x0f1722], E1: [0x24405f, 0x192e47, 0x101e30], E2: [0x2d4a68, 0x203a52, 0x15283a], E3: [0x36587a, 0x274560, 0x182f42],
    };
    this.ridges.forEach((r, i) => r.mat.color.set(palettes[era]![i]!));
    this.stars.visible = e3;
    this.moon.visible = era !== 'E0';
    this.glow.visible = e3;
    this.snow.visible = e3 && !ctx.wallView;
    // depth haze in E1 and E3; the E1 pixel grid and cel lighting carry its distinct look
    const fogOn = era === 'E1' || e3;
    return { clear: e3 ? 0x1c3048 : 0x1e2f45, fog: fogOn };
  }

  fogFor(era: Era): THREE.Fog | null {
    if (era === 'E1') return new THREE.Fog(0x638199, 14, 38);
    if (era === 'E3') return new THREE.Fog(0x22405a, 7, 36);
    return null;
  }

  /** Move the snow volume to the camera target and advance it. dt in seconds (0 = just place). */
  updateSnow(target: THREE.Vector3, dt: number) {
    if (!this.snow.visible && dt > 0) return;
    this.t += dt;
    const p = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
    const n = this.phase.length, b = this.snowBox;
    for (let i = 0; i < n; i++) {
      let y = this.flakes[i * 3 + 1]! - dt * (0.9 + (i % 7) * 0.12);
      if (y < 0) y += b.y;
      this.flakes[i * 3 + 1] = y;
      const sway = Math.sin(this.t * 0.7 + this.phase[i]!) * 0.35;
      p.setXYZ(i, target.x + this.flakes[i * 3]! + sway, y, target.z + this.flakes[i * 3 + 2]!);
    }
    p.needsUpdate = true;
  }
}
