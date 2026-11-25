import { UNIT_ART_META } from './meta';

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

export function unitArtMeta(key: string) {
  return UNIT_ART_META[key] ?? { top: 100, scale: 1, idle: 'bob' as const };
}

export const UNIT_ART_KEYS = Object.keys(urls).sort();
