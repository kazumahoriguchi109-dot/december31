// Shared material and procedural-texture helpers for the outdoor world. Presentation only; every texture is drawn here in code (original).
// A material made with `lam`/`lamTex` is a Lambert (smooth lit) material that carries cel-shaded Toon twins in userData,
// so the era style can swap the whole scene between lit 3D (E2/E3) and flat cel looks (E0/E1) without rebuilding geometry.
import * as THREE from 'three';

export const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

/** Stepped lighting ramps for the cel looks: E0 has two tones (flat pixel art), E1 three (richer 2.5D). */
const ramp = (v: number[]) => {
  const t = new THREE.DataTexture(new Uint8Array(v), v.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
};
export const RAMP_E0 = ramp([70, 255]);
export const RAMP_E1 = ramp([40, 150, 255]);

const cache = new Map<string, THREE.MeshLambertMaterial>();
const texCache = new Map<string, THREE.Texture>();
/** All textures registered here switch between smooth (E2/E3) and nearest (E0/E1, pixel) sampling together. */
const pixelTextures: THREE.Texture[] = [];

export interface Twins { e0: THREE.MeshToonMaterial; e1: THREE.MeshToonMaterial }

function build(color: number, map: THREE.Texture | null, key: string): THREE.MeshLambertMaterial {
  const hit = cache.get(key); if (hit) return hit;
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true, map: map ?? undefined });
  const toon = (r: THREE.Texture) => {
    const t = new THREE.MeshToonMaterial({ color, map: map ?? undefined, gradientMap: r });
    (t as unknown as { flatShading: boolean }).flatShading = true; // facets stay visible in the cel looks
    return t;
  };
  m.userData['twins'] = { e0: toon(RAMP_E0), e1: toon(RAMP_E1) } satisfies Twins;
  cache.set(key, m);
  return m;
}
export const lam = (color: number) => build(color, null, `c${color}`);
export const lamTex = (color: number, map: THREE.Texture, id: string) => build(color, map, `t${color}|${id}`);

/** Draw a repeating canvas texture. `pixel` textures use nearest sampling in the pixel eras (see setTextureStyle). */
export function canvasTexture(id: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true): THREE.CanvasTexture {
  const hit = texCache.get(id); if (hit) return hit as THREE.CanvasTexture;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!; draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  texCache.set(id, t); pixelTextures.push(t);
  return t;
}

/** Smooth (mip-mapped, linear) in E2/E3, hard texels in E0/E1. */
export function setTextureStyle(pixel: boolean) {
  for (const t of pixelTextures) {
    t.magFilter = pixel ? THREE.NearestFilter : THREE.LinearFilter;
    t.minFilter = pixel ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = !pixel;
    t.needsUpdate = true;
  }
}

// ---------- the procedural textures ----------
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Snow-dusted meadow: mottled greens, grass tufts, snow flecks. Tiles seamlessly (everything is drawn wrapped). */
export function meadowTexture(): THREE.CanvasTexture {
  return canvasTexture('meadow', 256, 256, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = '#2d4a40'; g.fillRect(0, 0, w, h);
    const wrap = (x: number, y: number, fn: (x: number, y: number) => void) => { for (const dx of [0, -w]) for (const dy of [0, -h]) fn(x + dx, y + dy); };
    const greens = ['#2a4a3d', '#34574b', '#274439', '#3a6150', '#315446'];
    for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h, rr = 8 + r() * 22; g.fillStyle = greens[(r() * greens.length) | 0]!; wrap(x, y, (X, Y) => { g.beginPath(); g.ellipse(X, Y, rr, rr * 0.7, 0, 0, 7); g.fill(); }); }
    for (let i = 0; i < 420; i++) { // grass tufts: short V strokes
      const x = r() * w, y = r() * h; g.strokeStyle = r() < 0.5 ? '#4b7a5c' : '#22392f'; g.lineWidth = 1.4;
      wrap(x, y, (X, Y) => { g.beginPath(); g.moveTo(X - 2, Y); g.lineTo(X - 1, Y - 4); g.moveTo(X, Y); g.lineTo(X, Y - 5); g.moveTo(X + 2, Y); g.lineTo(X + 1, Y - 3.5); g.stroke(); });
    }
    for (let i = 0; i < 16; i++) { // snow patches with a soft blue shadow edge
      const x = r() * w, y = r() * h, rr = 3 + r() * 7;
      wrap(x, y, (X, Y) => { g.fillStyle = '#a9bfc6'; g.beginPath(); g.ellipse(X + 1, Y + 1.5, rr, rr * 0.6, 0, 0, 7); g.fill(); g.fillStyle = '#e3eef0'; g.beginPath(); g.ellipse(X, Y, rr * 0.9, rr * 0.5, 0, 0, 7); g.fill(); });
    }
  });
}

/** Cobbled paving for the two plateaus: slabs with joints and a little snow caught in the cracks. */
export function paveTexture(): THREE.CanvasTexture {
  return canvasTexture('pave', 256, 256, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#5d7480'; g.fillRect(0, 0, w, h);
    const rows = 4, cols = 4;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const off = j % 2 ? w / cols / 2 : 0;
      const x = i * (w / cols) + off, y = j * (h / rows), sw = w / cols - 3, sh = h / rows - 3;
      const L = 0.9 + r() * 0.22; g.fillStyle = `rgb(${(106 * L) | 0},${(132 * L) | 0},${(146 * L) | 0})`;
      for (const dx of [0, -w]) g.fillRect(x + 1.5 + dx, y + 1.5, sw, sh);
      g.fillStyle = 'rgba(255,255,255,0.16)'; for (const dx of [0, -w]) g.fillRect(x + 1.5 + dx, y + 1.5, sw, 3);
    }
    g.fillStyle = '#2f4250';
    for (let j = 0; j <= rows; j++) g.fillRect(0, j * (h / rows) - 1, w, 2);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(236,244,247,0.8)'; const x = r() * w, y = r() * h; g.fillRect(x, y, 2 + r() * 8, 2); }
  });
}

/** Rock strata for plateau sides. */
export function cliffTexture(): THREE.CanvasTexture {
  return canvasTexture('cliff', 128, 128, (g, w, h) => {
    const r = rng(23);
    g.fillStyle = '#3a4d5a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { const y = (i / 9) * h; g.fillStyle = i % 2 ? '#44596a' : '#31434f'; g.fillRect(0, y, w, h / 9 - 2); }
    for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? '#2a3944' : '#58707f'; g.fillRect(r() * w, r() * h, 3 + r() * 10, 2); }
    g.fillStyle = 'rgb(138,164,182)'; g.fillRect(0, 0, w, 7); // frost on the lip (shaded blue-grey: it is seen edge-on behind the white wall)
  });
}

/** Pebbles on the packed-earth road. */
export function roadTexture(): THREE.CanvasTexture {
  return canvasTexture('road', 64, 128, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = '#b9a37c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? '#9c8762' : '#d3c196'; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2); }
    g.fillStyle = 'rgba(80,60,36,0.22)'; g.fillRect(w * 0.18, 0, 3, h); g.fillRect(w * 0.76, 0, 3, h); // two wheel ruts
    g.fillStyle = 'rgba(240,246,248,0.55)'; g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h); // snow on the verges
  });
}

/** Stream: rippled blue with light streaks along the flow (flow runs along texture v). */
export function waterTexture(): THREE.CanvasTexture {
  return canvasTexture('water', 64, 128, (g, w, h) => {
    const r = rng(13);
    g.fillStyle = '#3f7fb4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) { g.fillStyle = r() < 0.5 ? '#5aa0d0' : '#2f6a9c'; g.fillRect(r() * w, r() * h, 2 + r() * 3, 6 + r() * 14); }
    for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(230,244,252,0.7)'; g.fillRect(r() * w, r() * h, 1.5, 4 + r() * 8); }
  });
}

/** Soft round dot for snow and glows. */
export function dotTexture(id: string, inner: string, outer: string, size = 64): THREE.CanvasTexture {
  return canvasTexture(id, size, size, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);
}

/** Sky: vertical gradient. `bands` > 0 quantises it into hard stripes (pixel eras). Stars are drawn when `stars` is set. */
export function skyTexture(id: string, stops: [number, string][], bands: number, stars: number): THREE.CanvasTexture {
  const t = canvasTexture(id, 512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    for (const [p, c] of stops) gr.addColorStop(p, c);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (bands > 0) { // snap every row to the colour of the middle of its band
      const src = g.getImageData(0, 0, 1, h).data;
      for (let b = 0; b < bands; b++) {
        const y0 = Math.floor((b / bands) * h), y1 = Math.floor(((b + 1) / bands) * h), m = Math.min(h - 1, Math.floor((y0 + y1) / 2)) * 4;
        g.fillStyle = `rgb(${src[m]},${src[m + 1]},${src[m + 2]})`; g.fillRect(0, y0, w, y1 - y0);
      }
    }
    const r = rng(99);
    for (let i = 0; i < stars; i++) {
      const x = r() * w, y = r() * h * 0.8, big = r() < 0.12;
      g.fillStyle = r() < 0.5 ? 'rgb(140,170,235)' : 'rgb(240,200,110)'; // tinted so that the pale wall stays the only white thing in view
      g.fillRect(x, y, big ? 3 : 2, big ? 3 : 2);
    }
  }, false);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export const hexColor = hex;
