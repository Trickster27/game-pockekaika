import { Texture } from 'pixi.js';
import { Rng } from '@/core/rng';

export type SceneKey = 'mist' | 'cathedral' | 'forge' | 'dusk';
export const FIELD = { width: 360, height: 520 } as const;
const LEAD = '#0a0710';

const PALETTES: Record<
  SceneKey,
  { sky: string[]; mid: string[]; near: string[]; light: [number, number, number, string]; seed: number }
> = {
  mist: {
    sky: ['#1f2a55', '#2a1f4d', '#33285e', '#24346a'],
    mid: ['#2a2248', '#3a2d5c', '#30264f'],
    near: ['#2b3a2c', '#314330', '#2f402b', '#3a4a2e'],
    light: [300, 46, 160, '#f0c860'],
    seed: 7,
  },
  cathedral: {
    sky: ['#0f2a3a', '#13364a', '#1a4256', '#0e2433'],
    mid: ['#163a48', '#1d4a58', '#123240'],
    near: ['#123a44', '#0f4450', '#16505a', '#1a3f4a'],
    light: [180, 60, 220, '#bff7ff'],
    seed: 21,
  },
  forge: {
    sky: ['#3a0f12', '#4a1a14', '#2a0c10', '#5a2214'],
    mid: ['#3a1a16', '#4a2418', '#2e1410'],
    near: ['#2a1a16', '#3a2018', '#24140f', '#33201a'],
    light: [180, 520, 300, '#ff6a2a'],
    seed: 42,
  },
  dusk: {
    sky: ['#1a1036', '#24124a', '#2e1658', '#180c30'],
    mid: ['#2a1a4a', '#34205a', '#22143e'],
    near: ['#1e1630', '#261c3c', '#1a1228', '#2c2044'],
    light: [250, 70, 200, '#ffd9a0'],
    seed: 77,
  },
};

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const t = k < 0 ? 0 : 255;
  const p = Math.abs(k);
  return `rgb(${c.map((v) => Math.round((t - v) * p + v)).join(',')})`;
}
function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function poly(x: CanvasRenderingContext2D, pts: number[][]) {
  x.beginPath();
  x.moveTo(pts[0]![0]!, pts[0]![1]!);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i]![0]!, pts[i]![1]!);
  x.closePath();
}

/** Витражный фон главы, нарисованный один раз в текстуру (дешевле, чем сотни Graphics). */
export function sceneTexture(key: SceneKey, resolution = 2): Texture {
  const P = PALETTES[key];
  const c = document.createElement('canvas');
  c.width = FIELD.width * resolution;
  c.height = FIELD.height * resolution;
  const x = c.getContext('2d')!;
  x.scale(resolution, resolution);
  const R = new Rng(P.seed);
  const cols = 6,
    rows = 10;
  const pts: number[][][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: number[][] = [];
    for (let q = 0; q <= cols; q++) {
      let px = (q * FIELD.width) / cols,
        py = (r * FIELD.height) / rows;
      if (q > 0 && q < cols) px += (R.next() - 0.5) * (FIELD.width / cols) * 0.6;
      if (r > 0 && r < rows) py += (R.next() - 0.5) * (FIELD.height / rows) * 0.6;
      row.push([px, py]);
    }
    pts.push(row);
  }
  x.lineJoin = 'round';
  const pane = (p: number[][], base: string) => {
    const xs = p.map((v) => v[0]!),
      ys = p.map((v) => v[1]!);
    const g = x.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    g.addColorStop(0, shade(base, 0.1));
    g.addColorStop(1, shade(base, -0.18));
    poly(x, p);
    x.fillStyle = g;
    x.fill();
    x.strokeStyle = LEAD;
    x.lineWidth = 3;
    x.stroke();
  };
  for (let r = 0; r < rows; r++)
    for (let q = 0; q < cols; q++) {
      const a = pts[r]![q]!,
        b = pts[r]![q + 1]!,
        cc = pts[r + 1]![q + 1]!,
        d = pts[r + 1]![q]!;
      const cy = (a[1]! + cc[1]!) / 2;
      const pal = cy < 140 ? P.sky : cy < 300 ? P.mid : P.near;
      const base = pal[Math.floor(R.next() * pal.length)]!;
      if (R.next() < 0.45) {
        pane([a, b, cc], shade(base, (R.next() - 0.5) * 0.2));
        pane([a, cc, d], shade(base, (R.next() - 0.5) * 0.2));
      } else pane([a, b, cc, d], shade(base, (R.next() - 0.5) * 0.16));
    }
  x.strokeStyle = LEAD;
  x.lineWidth = 3;
  if (key === 'mist') {
    x.fillStyle = '#17112b';
    poly(x, [
      [0, 160],
      [0, 122],
      [26, 102],
      [48, 122],
      [78, 96],
      [104, 128],
      [130, 116],
      [150, 160],
    ]);
    x.fill();
    x.stroke();
    poly(x, [
      [200, 160],
      [226, 124],
      [246, 132],
      [268, 104],
      [296, 126],
      [322, 112],
      [360, 130],
      [360, 160],
    ]);
    x.fill();
    x.stroke();
    const sg = x.createLinearGradient(286, 18, 322, 64);
    sg.addColorStop(0, '#fff0b8');
    sg.addColorStop(1, '#d9902a');
    x.fillStyle = sg;
    poly(x, [
      [286, 30],
      [310, 16],
      [326, 42],
      [306, 66],
      [282, 52],
    ]);
    x.fill();
    x.stroke();
    x.globalCompositeOperation = 'lighter';
    for (const m of [
      [100, 175, 150, 22],
      [270, 222, 150, 24],
      [160, 268, 170, 18],
    ] as const) {
      x.fillStyle = 'rgba(163,124,255,.09)';
      x.beginPath();
      x.ellipse(m[0], m[1], m[2], m[3], 0, 0, Math.PI * 2);
      x.fill();
    }
    x.globalCompositeOperation = 'source-over';
  } else if (key === 'cathedral') {
    x.fillStyle = '#0a1c26';
    x.fillRect(0, 0, 28, 340);
    x.strokeRect(0, -2, 28, 342);
    x.fillRect(332, 0, 28, 340);
    x.strokeRect(332, -2, 30, 342);
    const wg = x.createLinearGradient(0, 0, 0, 150);
    wg.addColorStop(0, '#e6fdff');
    wg.addColorStop(1, '#3a8ea0');
    x.fillStyle = wg;
    x.beginPath();
    x.moveTo(126, 150);
    x.lineTo(126, 70);
    x.quadraticCurveTo(126, 12, 180, 4);
    x.quadraticCurveTo(234, 12, 234, 70);
    x.lineTo(234, 150);
    x.closePath();
    x.fill();
    x.stroke();
    x.beginPath();
    x.moveTo(162, 150);
    x.lineTo(162, 78);
    x.moveTo(198, 150);
    x.lineTo(198, 78);
    x.moveTo(126, 104);
    x.lineTo(234, 104);
    x.stroke();
    x.beginPath();
    x.arc(180, 50, 18, 0, Math.PI * 2);
    x.fillStyle = '#bff7ff';
    x.fill();
    x.stroke();
    x.globalCompositeOperation = 'lighter';
    for (const rr of [
      [140, 220, 40, 330, 0.07],
      [165, 195, 120, 260, 0.06],
      [200, 228, 250, 360, 0.07],
    ] as const) {
      x.fillStyle = `rgba(191,247,255,${rr[4]})`;
      poly(x, [
        [rr[0], 150],
        [rr[1], 150],
        [rr[3], FIELD.height],
        [rr[2], FIELD.height],
      ]);
      x.fill();
    }
    x.globalCompositeOperation = 'source-over';
  } else if (key === 'dusk') {
    // Затмение: тёмный диск с огненной короной.
    x.globalCompositeOperation = 'lighter';
    const cg = x.createRadialGradient(250, 70, 20, 250, 70, 90);
    cg.addColorStop(0, 'rgba(255,220,160,.9)');
    cg.addColorStop(0.35, 'rgba(255,140,90,.35)');
    cg.addColorStop(1, 'rgba(160,80,255,0)');
    x.fillStyle = cg;
    x.fillRect(150, 0, 210, 180);
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#0c0718';
    x.beginPath();
    x.arc(250, 70, 26, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = 'rgba(255,230,180,.9)';
    x.lineWidth = 2;
    x.stroke();
    x.strokeStyle = LEAD;
    // Парящие осколки.
    const rr = new Rng(99);
    for (let i = 0; i < 9; i++) {
      const cx = rr.int(10, 350),
        cy = rr.int(110, 300),
        s = rr.int(6, 16);
      x.fillStyle = i % 3 === 0 ? '#b48cff' : i % 3 === 1 ? '#6a4ac6' : '#ffd9a0';
      poly(x, [
        [cx, cy - s],
        [cx + s * 0.55, cy],
        [cx, cy + s * 1.2],
        [cx - s * 0.55, cy],
      ]);
      x.fill();
      x.lineWidth = 1.5;
      x.stroke();
    }
    x.lineWidth = 2;
    // Арка-разлом на горизонте.
    x.fillStyle = '#140c26';
    poly(x, [
      [20, 170],
      [40, 110],
      [70, 96],
      [92, 120],
      [100, 170],
    ]);
    x.fill();
    x.stroke();
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = 'rgba(180,140,255,.35)';
    poly(x, [
      [52, 168],
      [58, 124],
      [70, 116],
      [78, 132],
      [80, 168],
    ]);
    x.fill();
    x.globalCompositeOperation = 'source-over';
  } else {
    x.fillStyle = '#1a090b';
    poly(x, [
      [0, 160],
      [0, 120],
      [40, 70],
      [62, 74],
      [110, 150],
      [130, 160],
    ]);
    x.fill();
    x.stroke();
    poly(x, [
      [200, 160],
      [262, 64],
      [286, 68],
      [360, 134],
      [360, 160],
    ]);
    x.fill();
    x.stroke();
    x.globalCompositeOperation = 'lighter';
    for (const d of ['M0 330 Q80 306 140 338 T260 326 T360 350', 'M20 512 Q120 468 190 500 T360 470']) {
      const p = new Path2D(d);
      x.strokeStyle = 'rgba(255,90,30,.55)';
      x.lineWidth = 12;
      x.stroke(p);
      x.strokeStyle = 'rgba(255,170,70,.8)';
      x.lineWidth = 5;
      x.stroke(p);
      x.strokeStyle = 'rgba(255,240,190,.8)';
      x.lineWidth = 1.6;
      x.stroke(p);
    }
    x.globalCompositeOperation = 'source-over';
  }
  const [lx, ly, lr, lc] = P.light;
  x.globalCompositeOperation = 'lighter';
  const lg = x.createRadialGradient(lx, ly, 0, lx, ly, lr);
  lg.addColorStop(0, rgba(lc, 0.18));
  lg.addColorStop(1, rgba(lc, 0));
  x.fillStyle = lg;
  x.fillRect(0, 0, FIELD.width, FIELD.height);
  x.globalCompositeOperation = 'source-over';
  const vg = x.createRadialGradient(
    FIELD.width / 2,
    FIELD.height / 2,
    FIELD.height * 0.3,
    FIELD.width / 2,
    FIELD.height / 2,
    FIELD.height * 0.75,
  );
  vg.addColorStop(0, 'rgba(5,3,10,0)');
  vg.addColorStop(1, 'rgba(5,3,10,.55)');
  x.fillStyle = vg;
  x.fillRect(0, 0, FIELD.width, FIELD.height);
  return Texture.from(c);
}

export const SCENE_TINT: Record<SceneKey, string> = {
  mist: '#a37cff',
  cathedral: '#4fd6e0',
  forge: '#ff7a2a',
  dusk: '#c79cff',
};
