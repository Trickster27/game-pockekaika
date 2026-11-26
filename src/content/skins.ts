/**
 * Облики героев: перекраска «живой» модели. Открываются звёздами героя и подходят любому герою.
 * В интерфейсе облик — CSS-фильтр картинки, в бою — цветовая матрица Pixi с теми же параметрами.
 */
export interface SkinDef {
  id: 'dusk' | 'gilded';
  /** Нужно звёзд у героя, чтобы открыть облик. */
  stars: number;
  css: string;
  /** Параметры для Pixi ColorMatrixFilter: поворот оттенка, насыщенность, сепия. */
  hue: number;
  saturate: number;
  sepia?: boolean;
  brightness?: number;
}

export const SKINS: SkinDef[] = [
  {
    id: 'dusk',
    stars: 4,
    css: 'sepia(0.55) hue-rotate(215deg) saturate(1.5) brightness(0.96)',
    hue: 215,
    saturate: 0.5,
    sepia: true,
    brightness: 0.96,
  },
  {
    id: 'gilded',
    stars: 6,
    css: 'sepia(0.55) saturate(1.7) hue-rotate(-8deg) brightness(1.06)',
    hue: -8,
    saturate: 0.6,
    sepia: true,
    brightness: 1.06,
  },
];

export function skinDef(id?: string): SkinDef | undefined {
  return SKINS.find((s) => s.id === id);
}

/** CSS-фильтр облика (пустая строка — облик по умолчанию). */
export function skinCss(id?: string): string | undefined {
  return skinDef(id)?.css;
}
