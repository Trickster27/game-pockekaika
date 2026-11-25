/** Базовые типы игрового мира. Модуль чистый: никаких импортов UI или платформы. */

export type Element = 'fire' | 'thorn' | 'stone' | 'tide' | 'light' | 'dark';
export type Faction = 'order' | 'grove' | 'ash' | 'abyss' | 'forge';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Role = 'attacker' | 'defender' | 'support' | 'healer';

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  /** Шанс крита, 0..1. */
  critRate: number;
  /** Бонус крит. урона: 0.5 = +50%. */
  critDmg: number;
  /** Меткость: повышает шанс наложить дебафф. */
  acc: number;
  /** Сопротивление: снижает шанс получить дебафф. */
  res: number;
}

export const STAT_KEYS: readonly (keyof Stats)[] = [
  'hp',
  'atk',
  'def',
  'spd',
  'critRate',
  'critDmg',
  'acc',
  'res',
];

export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export const ELEMENTS: readonly Element[] = ['fire', 'thorn', 'stone', 'tide', 'light', 'dark'];
export const FACTIONS: readonly Faction[] = ['order', 'grove', 'ash', 'abyss', 'forge'];
export const ROLES: readonly Role[] = ['attacker', 'defender', 'support', 'healer'];

export function emptyStats(): Stats {
  return { hp: 0, atk: 0, def: 0, spd: 0, critRate: 0, critDmg: 0, acc: 0, res: 0 };
}

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  const out = { ...a };
  for (const k of STAT_KEYS) out[k] += b[k] ?? 0;
  return out;
}
