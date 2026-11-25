import type { Rarity, Role, Stats } from './types';

/** Базовые характеристики роли на 1 уровне, 1 звезде, редкость «обычный». */
export const ROLE_BASE: Record<Role, Stats> = {
  attacker: { hp: 1100, atk: 125, def: 70, spd: 100, critRate: 0.15, critDmg: 0.5, acc: 10, res: 10 },
  defender: { hp: 1550, atk: 85, def: 125, spd: 94, critRate: 0.1, critDmg: 0.5, acc: 10, res: 25 },
  support: { hp: 1250, atk: 98, def: 92, spd: 108, critRate: 0.12, critDmg: 0.5, acc: 30, res: 15 },
  healer: { hp: 1300, atk: 92, def: 92, spd: 104, critRate: 0.1, critDmg: 0.5, acc: 15, res: 20 },
};

export const RARITY_MULT: Record<Rarity, { core: number; spd: number; accRes: number }> = {
  common: { core: 1, spd: 0, accRes: 0 },
  rare: { core: 1.12, spd: 3, accRes: 10 },
  epic: { core: 1.26, spd: 6, accRes: 20 },
  legendary: { core: 1.42, spd: 9, accRes: 30 },
};

/** Базовые характеристики героя с учётом роли, редкости и личного модификатора. */
export function baseStats(role: Role, rarity: Rarity, mod: Partial<Stats> = {}): Stats {
  const b = ROLE_BASE[role];
  const r = RARITY_MULT[rarity];
  const pct = (k: 'hp' | 'atk' | 'def') => Math.round(b[k] * r.core * (1 + (mod[k] ?? 0)));
  return {
    hp: pct('hp'),
    atk: pct('atk'),
    def: pct('def'),
    spd: b.spd + r.spd + (mod.spd ?? 0),
    critRate: b.critRate + (mod.critRate ?? 0),
    critDmg: b.critDmg + (mod.critDmg ?? 0),
    acc: b.acc + r.accRes + (mod.acc ?? 0),
    res: b.res + r.accRes + (mod.res ?? 0),
  };
}

export const MAX_STARS = 6;
export const MAX_LEVEL_BY_STARS = [0, 10, 20, 30, 40, 50, 60] as const;

export function maxLevel(stars: number): number {
  return MAX_LEVEL_BY_STARS[Math.max(1, Math.min(MAX_STARS, stars))] ?? 60;
}

/**
 * Рост характеристик:
 * - уровень: +7% к HP/атаке/защите за каждый уровень после первого;
 * - звёзды: +12% за каждую звезду после первой;
 * - пробуждение (на 6 звёздах): +10% и +6 скорости.
 */
export function statsAt(base: Stats, level: number, stars = 1, awakened = false): Stats {
  const lv = 1 + 0.07 * (Math.max(1, level) - 1);
  const st = 1 + 0.12 * (Math.max(1, stars) - 1);
  const aw = awakened ? 1.1 : 1;
  const k = lv * st * aw;
  return {
    hp: Math.round(base.hp * k),
    atk: Math.round(base.atk * k),
    def: Math.round(base.def * k),
    spd: base.spd + (stars - 1) * 1 + (awakened ? 6 : 0),
    critRate: base.critRate,
    critDmg: base.critDmg,
    acc: base.acc + (stars - 1) * 3,
    res: base.res + (stars - 1) * 3,
  };
}

/** Суммарная «сила» для отображения и подбора соперников. */
export function power(s: Stats): number {
  return Math.round(
    s.hp * 0.08 +
      s.atk * 1.6 +
      s.def * 1.2 +
      s.spd * 4 +
      s.critRate * 300 +
      s.critDmg * 150 +
      s.acc * 0.8 +
      s.res * 0.8,
  );
}
