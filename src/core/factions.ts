import type { Faction, Stats } from './types';

/**
 * Бонус за 3+ героя одной фракции в команде. Проценты к базовым характеристикам,
 * флаты (spd, critRate, acc, res) — как есть. Действует на всех героев этой фракции.
 */
export const FACTION_BONUS: Record<Faction, Record<3 | 4 | 5, Partial<Stats>>> = {
  // Орден Рассветного Щита: защита
  order: { 3: { def: 0.15 }, 4: { def: 0.22, hp: 0.05 }, 5: { def: 0.3, hp: 0.1 } },
  // Дети Вечнолиста: скорость
  grove: { 3: { spd: 8 }, 4: { spd: 12 }, 5: { spd: 16, acc: 20 } },
  // Пепельная Тризна: здоровье и сопротивление
  ash: { 3: { hp: 0.15 }, 4: { hp: 0.2, res: 20 }, 5: { hp: 0.25, res: 40 } },
  // Горнило Бездны: атака и крит. урон
  abyss: { 3: { atk: 0.12 }, 4: { atk: 0.15, critDmg: 0.1 }, 5: { atk: 0.2, critDmg: 0.2 } },
  // Клан Глубинного Горна: меткость и сопротивление
  forge: { 3: { acc: 25, res: 15 }, 4: { acc: 35, res: 25 }, 5: { acc: 45, res: 35 } },
};

/** Ключи, которые в бонусе задаются процентом от базы. */
export const PERCENT_KEYS: readonly (keyof Stats)[] = ['hp', 'atk', 'def'];

export function factionCounts(factions: readonly (Faction | undefined)[]): Map<Faction, number> {
  const m = new Map<Faction, number>();
  for (const f of factions) if (f) m.set(f, (m.get(f) ?? 0) + 1);
  return m;
}

/** Активный бонус фракции для команды или null. */
export function activeFactionBonus(faction: Faction, count: number): Partial<Stats> | null {
  if (count >= 5) return FACTION_BONUS[faction][5];
  if (count >= 4) return FACTION_BONUS[faction][4];
  if (count >= 3) return FACTION_BONUS[faction][3];
  return null;
}

/** Применяет бонус к готовым характеристикам. */
export function applyBonus(stats: Stats, bonus: Partial<Stats> | null): Stats {
  if (!bonus) return stats;
  const out = { ...stats };
  for (const [k, v] of Object.entries(bonus) as [keyof Stats, number][]) {
    out[k] = PERCENT_KEYS.includes(k) ? Math.round(out[k] * (1 + v)) : out[k] + v;
  }
  return out;
}
