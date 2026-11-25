import { Texture } from 'pixi.js';
import type { StatusId } from '@/core/content';

/** Текстуры, нарисованные через Canvas 2D один раз и переиспользуемые всеми спрайтами. */
const glowCache = new Map<string, Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Мягкое круглое свечение: основа почти всех частиц. */
export function glowTexture(color: string): Texture {
  let t = glowCache.get(color);
  if (!t) {
    const c = canvas(64, 64);
    const x = c.getContext('2d')!;
    const [r, g, b] = hexToRgb(color);
    const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grad;
    x.fillRect(0, 0, 64, 64);
    t = Texture.from(c);
    glowCache.set(color, t);
  }
  return t;
}

const ICONS: Record<StatusId, { bg: string; fg: string; path: string; stroke?: boolean; slash?: boolean }> = {
  poison: {
    bg: '#24502a',
    fg: '#8be37a',
    path: 'M0 -3.6 Q3 0 2.4 1.6 A2.5 2.5 0 0 1 -2.4 1.6 Q-3 0 0 -3.6Z',
  },
  stun: {
    bg: '#5a4a12',
    fg: '#ffd84a',
    path: 'M0 -3.6 L1 -1 L3.6 -1 L1.5 .7 L2.3 3.3 L0 1.7 L-2.3 3.3 L-1.5 .7 L-3.6 -1 L-1 -1Z',
  },
  defDown: { bg: '#5a1a1a', fg: '#ff8a7a', path: 'M-3 -3 L3 -3 L3 0 Q0 3.6 -3 0Z', slash: true },
  atkDown: { bg: '#5a1a1a', fg: '#ff8a7a', path: 'M-3 3 L3 -3 M1 -3 L3 -3 L3 -1', stroke: true, slash: true },
  slow: { bg: '#3a2a4a', fg: '#c6a8ff', path: 'M3 -3 L0 0 L3 3 M-0.5 -3 L-3.5 0 L-0.5 3', stroke: true },
  atkUp: { bg: '#5a3a12', fg: '#ffd36b', path: 'M-3 3 L3 -3 M1 -3 L3 -3 L3 -1', stroke: true },
  defUp: { bg: '#1d3a6e', fg: '#9cc8ff', path: 'M-3 -3 L3 -3 L3 0 Q0 3.6 -3 0Z' },
  haste: { bg: '#1d4a5e', fg: '#7fe7ff', path: 'M-3 -3 L0 0 L-3 3 M0.5 -3 L3.5 0 L0.5 3', stroke: true },
  taunt: { bg: '#5a1a2a', fg: '#ff9a9a', path: 'M0 -3.5 L3.2 3 L-3.2 3 Z M0 -1 L0 1.2', stroke: true },
};

const iconCache = new Map<string, Texture>();

/** Иконка статуса 32×32 (рисуется в масштабе 2.8 от схемы 12×12). */
export function statusTexture(id: StatusId): Texture {
  let t = iconCache.get(id);
  if (!t) {
    const c = canvas(32, 32);
    const x = c.getContext('2d')!;
    const d = ICONS[id];
    x.translate(16, 16);
    x.scale(2.6, 2.6);
    x.beginPath();
    x.arc(0, 0, 5.5, 0, Math.PI * 2);
    x.fillStyle = d.bg;
    x.fill();
    x.strokeStyle = '#0a0710';
    x.lineWidth = 1.4;
    x.stroke();
    const p = new Path2D(d.path);
    if (d.stroke) {
      x.strokeStyle = d.fg;
      x.lineWidth = 1.5;
      x.lineCap = 'round';
      x.stroke(p);
    } else {
      x.fillStyle = d.fg;
      x.fill(p);
    }
    if (d.slash) {
      x.strokeStyle = '#0a0710';
      x.lineWidth = 1.3;
      x.beginPath();
      x.moveTo(-3.6, 3.4);
      x.lineTo(3.6, -3.6);
      x.stroke();
    }
    t = Texture.from(c);
    iconCache.set(id, t);
  }
  return t;
}

export const STATUS_LABEL: Record<StatusId, string> = {
  poison: 'Яд',
  stun: 'Оглушение',
  defDown: 'Защита −',
  atkDown: 'Атака −',
  slow: 'Замедление',
  atkUp: 'Атака +',
  defUp: 'Защита +',
  haste: 'Ускорение',
  taunt: 'Провокация',
};
