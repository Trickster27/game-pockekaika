import { STAT_KEYS, type Stats } from '@/core/types';
import type { OwnedHero, SaveData } from '@/save/schema';
import { heroPower, heroStats } from './power';

export interface StatRow {
  key: keyof Stats;
  a: number;
  b: number;
  /** b − a */
  diff: number;
  better: 'a' | 'b' | 'equal';
}

/** Характеристики двух героев рядом (со снаряжением) и кто лучше по каждой. */
export function compareHeroes(
  save: SaveData,
  a: OwnedHero,
  b: OwnedHero,
): { rows: StatRow[]; powerA: number; powerB: number } {
  const sa = heroStats(a, save);
  const sb = heroStats(b, save);
  const rows = STAT_KEYS.map((key) => {
    const diff = sb[key] - sa[key];
    const eps = key === 'critRate' || key === 'critDmg' ? 1e-4 : 0.5;
    return {
      key,
      a: sa[key],
      b: sb[key],
      diff,
      better: Math.abs(diff) < eps ? 'equal' : diff > 0 ? 'b' : 'a',
    } as StatRow;
  });
  return { rows, powerA: heroPower(a, save), powerB: heroPower(b, save) };
}
