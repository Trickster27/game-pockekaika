import { UNIT_ART_META } from './meta';
import rigsJson from './rigs.json';

/**
 * Реестр арта. Сейчас все бойцы — SVG-заготовки в стиле «Тёмный витраж».
 * Чтобы заменить заготовку на готовый спрайт, положите рядом PNG или WebP с тем же именем
 * (например, units/knight.png): он автоматически получит приоритет над SVG.
 * Геометрия спрайта общая: ширина 120, высота 135, ноги в точке (60, 130).
 */
const svg = import.meta.glob<string>('./units/*.svg', { eager: true, query: '?url', import: 'default' });
const raster = import.meta.glob<string>('./units/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function keyOf(path: string) {
  return path.replace(/^.*\//, '').replace(/\.\w+$/, '');
}

const urls: Record<string, string> = {};
for (const [p, url] of Object.entries(svg)) urls[keyOf(p)] = url;
for (const [p, url] of Object.entries(raster)) urls[keyOf(p)] = url;

export const UNIT_FRAME = { width: 120, height: 135, footX: 60, footY: 130 } as const;

export function unitArtUrl(key: string): string | undefined {
  return urls[key];
}

const stills = import.meta.glob<string>('./still/*.svg', { eager: true, query: '?url', import: 'default' });
/** Статичная версия (без анимации) — для плиток в длинных списках, чтобы не грузить телефон. */
export function unitStillUrl(key: string): string | undefined {
  return stills[`./still/${key}.svg`] ?? urls[key];
}

export function unitArtMeta(key: string) {
  const base = UNIT_ART_META[key] ?? { top: 100, scale: 1, idle: 'bob' as const };
  // У «живых» персонажей рост и стиль стойки берутся из описания слоёв.
  const r = RIGS_INFO()[key];
  return r ? { ...base, top: r.top ?? base.top, idle: (r.idle as typeof base.idle) ?? base.idle } : base;
}

export const UNIT_ART_KEYS = Object.keys(urls).sort();

// ———————————————————— «живые» герои: слои с точками вращения ————————————————————

export type RigMotion =
  | { kind: 'sway' | 'swing'; amp: number; period: number; phase?: number }
  | { kind: 'breathe' | 'bob' | 'pulse'; amp: number; period: number; phase?: number }
  | { kind: 'blink'; period: number; phase?: number };

export interface RigPart {
  id: string;
  /** Точка вращения в координатах кадра (ноги в 0,0). */
  pivot: [number, number];
  motion?: RigMotion;
  /** Едет вместе с дыханием торса. */
  follow?: boolean;
  /** Роль для поз в бою: голова, оружие (рука с оружием), свечение. */
  role?: 'head' | 'weapon' | 'fx';
  url: string;
}

/** Точка руки/оружия (откуда летят снаряды и где собирается сила) и рост персонажа. */
export function unitRigInfo(key: string): { hand?: [number, number]; top?: number } | null {
  const r = RIGS_INFO()[key];
  return r ? { hand: r.hand, top: r.top } : null;
}
function RIGS_INFO() {
  return rigsJson as unknown as Record<string, { hand?: [number, number]; top?: number; idle?: string }>;
}

const rigParts = import.meta.glob<string>('./rig/*/*.svg', { eager: true, query: '?url', import: 'default' });
const RIGS = rigsJson as unknown as Record<string, { parts: Omit<RigPart, 'url'>[] }>;

/** Слои героя для анимации в бою; null — у героя обычный цельный спрайт. */
export function unitRig(key: string): RigPart[] | null {
  const r = RIGS[key];
  if (!r) return null;
  const parts = r.parts.map((p) => ({ ...p, url: rigParts[`./rig/${key}/${p.id}.svg`] ?? '' }));
  return parts.every((p) => p.url) ? parts : null;
}

/**
 * Значение движения слоя в момент t (мс). Одна формула для боя и для SVG-анимации карточек:
 * sway/swing — градусы, breathe — доля растяжения, bob — сдвиг, pulse — прозрачность, blink — видимость.
 */
export function rigValue(m: RigMotion, t: number): number {
  const per = m.period * 1000;
  const s = Math.sin((2 * Math.PI * t) / per + (m.phase ?? 0));
  switch (m.kind) {
    case 'pulse':
      return 1 - m.amp * (0.5 + 0.5 * s);
    case 'blink': {
      const ph = (((t / per + (m.phase ?? 0) / (2 * Math.PI)) % 1) + 1) % 1;
      return ph > 0.955 && ph < 0.97 ? 1 : 0;
    }
    default:
      return m.amp * s;
  }
}
