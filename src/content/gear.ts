import type { Rarity, Stats } from '@/core/types';

export type Slot = 'weapon' | 'helmet' | 'armor' | 'gloves' | 'boots' | 'amulet';
export const SLOTS: readonly Slot[] = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'amulet'];

/** Характеристика предмета: ключ + процент или плоское значение. */
export type GearStat =
  'hp' | 'atk' | 'def' | 'hpPct' | 'atkPct' | 'defPct' | 'spd' | 'critRate' | 'critDmg' | 'acc' | 'res';

/** Какая основная характеристика может выпасть в слоте. Первые три слота фиксированы. */
export const SLOT_MAIN: Record<Slot, GearStat[]> = {
  weapon: ['atk'],
  helmet: ['hp'],
  armor: ['def'],
  gloves: ['atkPct', 'hpPct', 'defPct', 'critRate', 'critDmg'],
  boots: ['spd', 'atkPct', 'hpPct', 'defPct'],
  amulet: ['acc', 'res', 'atkPct', 'hpPct'],
};

/** Основная характеристика на +0 по редкости и прирост за каждый уровень улучшения. */
export const MAIN_VALUE: Record<GearStat, { base: [number, number, number, number]; perLevel: number }> = {
  hp: { base: [220, 300, 400, 520], perLevel: 0.22 },
  atk: { base: [16, 22, 30, 40], perLevel: 0.22 },
  def: { base: [14, 19, 26, 34], perLevel: 0.22 },
  hpPct: { base: [0.03, 0.04, 0.05, 0.06], perLevel: 0.2 },
  atkPct: { base: [0.03, 0.04, 0.05, 0.06], perLevel: 0.2 },
  defPct: { base: [0.03, 0.04, 0.05, 0.06], perLevel: 0.2 },
  spd: { base: [3, 4, 5, 6], perLevel: 0.2 },
  critRate: { base: [0.02, 0.03, 0.04, 0.05], perLevel: 0.2 },
  critDmg: { base: [0.04, 0.05, 0.07, 0.09], perLevel: 0.2 },
  acc: { base: [6, 8, 10, 12], perLevel: 0.22 },
  res: { base: [6, 8, 10, 12], perLevel: 0.22 },
};

/** Дополнительная характеристика: значение за одно «срабатывание» (на +3/+6/+9/+12 она может вырасти). */
export const SUB_ROLL: Record<GearStat, [number, number]> = {
  hp: [90, 160],
  atk: [8, 14],
  def: [7, 12],
  hpPct: [0.02, 0.04],
  atkPct: [0.02, 0.04],
  defPct: [0.02, 0.04],
  spd: [2, 4],
  critRate: [0.02, 0.04],
  critDmg: [0.03, 0.06],
  acc: [6, 12],
  res: [6, 12],
};

export type SetId = 'fury' | 'bulwark' | 'life' | 'swift' | 'precision' | 'warding';

export interface SetDef {
  id: SetId;
  name: string;
  color: string;
  two: Partial<Record<GearStat, number>>;
  four: Partial<Record<GearStat, number>>;
}

export const SETS: SetDef[] = [
  { id: 'fury', name: 'Ярость', color: '#ff7a2a', two: { atkPct: 0.15 }, four: { critDmg: 0.3 } },
  {
    id: 'bulwark',
    name: 'Оплот',
    color: '#9cc8ff',
    two: { defPct: 0.15 },
    four: { defPct: 0.2, hpPct: 0.1 },
  },
  { id: 'life', name: 'Жизнь', color: '#5fcf6f', two: { hpPct: 0.15 }, four: { hpPct: 0.25 } },
  { id: 'swift', name: 'Быстрота', color: '#7fe7ff', two: { spd: 12 }, four: { spd: 18 } },
  { id: 'precision', name: 'Точность', color: '#f0c860', two: { acc: 40 }, four: { acc: 40, critRate: 0.1 } },
  { id: 'warding', name: 'Оберег', color: '#b07cff', two: { res: 40 }, four: { res: 40, hpPct: 0.1 } },
];

export const SLOT_NAME: Record<Slot, string> = {
  weapon: 'Оружие',
  helmet: 'Шлем',
  armor: 'Доспех',
  gloves: 'Перчатки',
  boots: 'Сапоги',
  amulet: 'Амулет',
};

export const STAT_NAME: Record<GearStat, string> = {
  hp: 'Здоровье',
  atk: 'Атака',
  def: 'Защита',
  hpPct: 'Здоровье',
  atkPct: 'Атака',
  defPct: 'Защита',
  spd: 'Скорость',
  critRate: 'Шанс крита',
  critDmg: 'Крит. урон',
  acc: 'Меткость',
  res: 'Сопротивление',
};

export const PCT_STATS = new Set<GearStat>(['hpPct', 'atkPct', 'defPct', 'critRate', 'critDmg']);

export function formatStat(stat: GearStat, v: number): string {
  return PCT_STATS.has(stat) ? `+${Math.round(v * 1000) / 10}%` : `+${Math.round(v)}`;
}

/** В какую характеристику героя уходит бонус. */
export const STAT_TARGET: Record<GearStat, { key: keyof Stats; pct: boolean }> = {
  hp: { key: 'hp', pct: false },
  atk: { key: 'atk', pct: false },
  def: { key: 'def', pct: false },
  hpPct: { key: 'hp', pct: true },
  atkPct: { key: 'atk', pct: true },
  defPct: { key: 'def', pct: true },
  spd: { key: 'spd', pct: false },
  critRate: { key: 'critRate', pct: false },
  critDmg: { key: 'critDmg', pct: false },
  acc: { key: 'acc', pct: false },
  res: { key: 'res', pct: false },
};

export const RARITY_INDEX: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

/** Текст бонуса сета: «Атака +15%, Крит. урон +30%». */
export function bonusText(b: Partial<Record<GearStat, number>>): string {
  return Object.entries(b)
    .map(([k, v]) => `${STAT_NAME[k as GearStat]} ${formatStat(k as GearStat, v)}`)
    .join(', ');
}
