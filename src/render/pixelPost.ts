// Pixel-era post pass (E0, E1): the scene is drawn without anti-aliasing into a small render target, once with flat object ids
// (so outlines follow the shapes) and once in colour, then reduced to a palette and outlined on the CPU. Only 320x180 / 640x360 pixels.
import * as THREE from 'three';
import type { Era } from '../domain/types';

/** E0: a fixed hand-made palette (no dithering, no smooth gradients). Snow, greens, navy, wood, red roofs, gold, sand, stone, water, skin. */
const PAL0 = [
  0x101d30, 0x263d52, 0x4c6477, 0x8299aa, 0xc9d8df, 0xf0eee5,
  0x19352e, 0x39594b, 0x708374, 0x3d302b, 0x786052, 0xb88b68,
  0x9a5145, 0xd1a96b, 0xf2d8a1, 0x427c99, 0x8bb9c9, 0xe8b88f,
].map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const);

export class PixelPost {
  private rtColour: THREE.WebGLRenderTarget | null = null;
  private rtId: THREE.WebGLRenderTarget | null = null;
  private w = 0;
  private h = 0;
  private readonly ids = new Map<THREE.Object3D, number>();
  private readonly idMats = new Map<number, THREE.MeshBasicMaterial>();
  private next = 1;
  private lut: Uint8Array | null = null;

  constructor(private readonly renderer: THREE.WebGLRenderer) {}

  private ensure(w: number, h: number) {
    if (this.w === w && this.h === h && this.rtColour) return;
    this.rtColour?.dispose(); this.rtId?.dispose();
    const opt = { depthBuffer: true, samples: 0, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.rtColour = new THREE.WebGLRenderTarget(w, h, opt); this.rtColour.texture.colorSpace = THREE.SRGBColorSpace;
    this.rtId = new THREE.WebGLRenderTarget(w, h, opt);
    this.w = w; this.h = h;
  }

  private idOf(m: THREE.Mesh): number {
    if (m.userData['flat']) return 0;
    let o: THREE.Object3D = m, key: THREE.Object3D = m;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p.userData['og']) key = p;
    o = key;
    let id = this.ids.get(o);
    if (id === undefined) { id = this.next++; this.ids.set(o, id); }
    return id;
  }
  private bufs = new Map<string, Uint8Array>();
  private img: ImageData | null = null;
  private ids16: Uint16Array | null = null;
  /** Read-back buffers are reused between renders (a fresh ~1 MB array per call was the main garbage source). */
  private buf(key: string, n: number): Uint8Array {
    let b = this.bufs.get(key);
    if (!b || b.length !== n) { b = new Uint8Array(n); this.bufs.set(key, b); }
    return b;
  }
  private idMat(id: number): THREE.MeshBasicMaterial {
    let m = this.idMats.get(id);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ fog: false, toneMapped: false, side: THREE.DoubleSide });
      m.color.setRGB(((id % 16) * 16 + 8) / 255, ((Math.floor(id / 16) % 16) * 16 + 8) / 255, ((Math.floor(id / 256)) * 16 + 8) / 255, THREE.LinearSRGBColorSpace);
      this.idMats.set(id, m);
    }
    return m;
  }

  /** Renders both passes and writes the finished picture into `out`. The caller renders the true frame to the canvas afterwards. */
  run(scene: THREE.Scene, camera: THREE.Camera, era: Era, w: number, h: number, clear: number, out: CanvasRenderingContext2D) {
    this.ensure(w, h);
    const r = this.renderer;
    const prevTarget = r.getRenderTarget(), prevFog = scene.fog;
    // --- id pass
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData['flat']) { if (o.visible) { o.visible = false; hidden.push(o); } } // ground-like: never outlined, and nothing stands behind it
      else if (m.isMesh) { swapped.push([m, m.material]); m.material = this.idMat(this.idOf(m)); }
      else if ((o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite) { if (o.visible) { o.visible = false; hidden.push(o); } }
    });
    scene.fog = null;
    r.setRenderTarget(this.rtId); r.setClearColor(0x000000, 1); r.clear(); r.render(scene, camera);
    const idBuf = this.buf('id', w * h * 4); r.readRenderTargetPixels(this.rtId!, 0, 0, w, h, idBuf);
    for (const [m, mat] of swapped) m.material = mat;
    for (const o of hidden) o.visible = true;
    scene.fog = prevFog;
    // --- colour pass
    r.setRenderTarget(this.rtColour); r.setClearColor(clear, 1); r.clear(); r.render(scene, camera);
    const colBuf = this.buf('col', w * h * 4); r.readRenderTargetPixels(this.rtColour!, 0, 0, w, h, colBuf);
    r.setRenderTarget(prevTarget);
    // --- CPU: flip rows, reduce colours, outline
    if (!this.img || this.img.width !== w || this.img.height !== h) this.img = out.createImageData(w, h);
    const img = this.img, d = img.data;
    const rowIdx = (y: number) => (h - 1 - y) * w * 4;
    // shape ids once per pixel (top-down), instead of up to three decodes per pixel in the loop
    if (!this.ids16 || this.ids16.length !== w * h) this.ids16 = new Uint16Array(w * h);
    const ids16 = this.ids16;
    for (let y = 0; y < h; y++) { const src = rowIdx(y); for (let x = 0; x < w; x++) { const i = src + x * 4; ids16[y * w + x] = (idBuf[i]! >> 4) | ((idBuf[i + 1]! >> 4) << 4) | ((idBuf[i + 2]! >> 4) << 8); } }
    const idAt = (x: number, y: number) => ids16[y * w + x]!;
    const e0 = era === 'E0';
    if (e0 && !this.lut) this.lut = this.buildLut();
    for (let y = 0; y < h; y++) {
      const src = rowIdx(y);
      for (let x = 0; x < w; x++) {
        const s = src + x * 4, o = (y * w + x) * 4;
        let R = colBuf[s]!, G = colBuf[s + 1]!, B = colBuf[s + 2]!;
        if (e0) { const p = PAL0[this.lut![32768 + (((R >> 3) << 10) | ((G >> 3) << 5) | (B >> 3))]!]!; R = p[0]; G = p[1]; B = p[2]; }
        // E1 keeps the rendered colours: independent RGB rounding caused coloured contour noise on snow gradients.
        // outline: this pixel differs in shape from the one to its left or above (so lines are one pixel thick)
        const me = idAt(x, y);
        const l = x > 0 ? idAt(x - 1, y) : me, u = y > 0 ? idAt(x, y - 1) : me;
        if ((l !== me && (l !== 0 || me !== 0)) || (u !== me && (u !== 0 || me !== 0))) {
          if (e0) { R = 0x0b; G = 0x12; B = 0x20; }
          else { R = Math.round(R * 0.62); G = Math.round(G * 0.65); B = Math.round(B * 0.70); }
        }
        d[o] = R; d[o + 1] = G; d[o + 2] = B; d[o + 3] = 255;
      }
    }
    out.putImageData(img, 0, 0);
  }

  /** 32x32x32 nearest-palette table (5 bits per channel) so each pixel costs one lookup. Stored in the first half; index in the second half. */
  private buildLut(): Uint8Array {
    const t = new Uint8Array(65536);
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
      const R = (r << 3) | 4, G = (g << 3) | 4, B = (b << 3) | 4;
      let best = 0, bd = 1e9;
      PAL0.forEach((p, k) => { const dr = R - p[0], dg = G - p[1], db = B - p[2]; const e = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (e < bd) { bd = e; best = k; } });
      t[32768 + ((r << 10) | (g << 5) | b)] = best;
    }
    return t;
  }
}
