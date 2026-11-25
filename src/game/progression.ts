import { maxLevel } from '@/core/stats';
import type { OwnedHero, SaveData } from '@/save/schema';

/** Опыт до следующего уровня героя. */
export function heroXpToNext(level: number): number {
  return Math.round(60 * Math.pow(level, 1.45));
}

/** Опыт до следующего уровня аккаунта. */
export function playerXpToNext(level: number): number {
  return 60 + level * 40;
}

export interface LevelUp {
  uid: string;
  from: number;
  to: number;
}

/** Даёт герою опыт. Уровень упирается в потолок по звёздам, лишний опыт копится до повышения звёзд. */
export function addHeroXp(h: OwnedHero, amount: number): LevelUp | null {
  const from = h.level;
  const cap = maxLevel(h.stars);
  h.xp += Math.max(0, Math.floor(amount));
  while (h.level < cap && h.xp >= heroXpToNext(h.level)) {
    h.xp -= heroXpToNext(h.level);
    h.level += 1;
  }
  if (h.level >= cap) h.xp = Math.min(h.xp, heroXpToNext(h.level));
  return h.level > from ? { uid: h.uid, from, to: h.level } : null;
}

export function addPlayerXp(save: SaveData, amount: number): number {
  const p = save.player;
  const from = p.level;
  p.xp += Math.max(0, Math.floor(amount));
  while (p.xp >= playerXpToNext(p.level)) {
    p.xp -= playerXpToNext(p.level);
    p.level += 1;
  }
  return p.level - from;
}
