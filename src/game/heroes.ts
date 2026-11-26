import { MAX_STARS, heroLevelCap, maxLevel } from '@/core/stats';
import { heroDef } from '@/content';
import type { HeroRarity } from '@/core/types';
import { MAX_TEAM, type OwnedHero, type SaveData } from '@/save/schema';
import { addHeroXp, heroXpToNext } from './progression';

export const XP_TOME_VALUE = 1500;
export const AWAKEN_COST = { stones: 40, gold: 60_000 };

/** Цена повышения звёзд: золото + либо герои-копии, либо звёздная пыль. */
/** Потолок уровня героя с учётом редкости (мифические — сразу 60). */
export function capOf(h: OwnedHero): number {
  return heroLevelCap(heroDef(h.heroId).rarity, h.stars);
}

export function starUpCost(stars: number) {
  return { gold: 600 * stars * stars, fodder: stars, dust: 15 * stars };
}

/** С какими звёздами герой приходит из призыва. */
/** Мифические приходят с 1★, но качаются сразу до 60 уровня (см. heroLevelCap). */
export const RARITY_START_STARS: Record<HeroRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 1,
};

export function addHero(save: SaveData, heroId: string, now = Date.now()): OwnedHero {
  const d = heroDef(heroId);
  const h: OwnedHero = {
    uid: `h${save.seq++}`,
    heroId,
    level: 1,
    xp: 0,
    stars: RARITY_START_STARS[d.rarity],
    awakened: false,
    obtainedAt: now,
  };
  save.heroes.push(h);
  if (save.team.length < MAX_TEAM) save.team.push(h.uid);
  return h;
}

export function findHero(save: SaveData, uid: string): OwnedHero | undefined {
  return save.heroes.find((h) => h.uid === uid);
}

function removeHeroes(save: SaveData, uids: string[]) {
  const set = new Set(uids);
  save.heroes = save.heroes.filter((h) => !set.has(h.uid));
  save.team = save.team.filter((u) => !set.has(u));
  for (const p of save.presets) p.uids = p.uids.filter((u) => !set.has(u));
}

export type ActionError =
  | 'notFound'
  | 'maxLevel'
  | 'noTomes'
  | 'notMaxLevel'
  | 'maxStars'
  | 'noGold'
  | 'noFodder'
  | 'badFodder'
  | 'noDust'
  | 'notSixStar'
  | 'awakened'
  | 'noStones';

/** Тратит тома опыта, пока герой не упрётся в потолок или не кончатся тома. Возвращает число потраченных томов. */
export function spendXpTomes(save: SaveData, uid: string, count: number): { used: number } | ActionError {
  const h = findHero(save, uid);
  if (!h) return 'notFound';
  if (h.level >= capOf(h)) return 'maxLevel';
  if (save.materials.xpTome <= 0) return 'noTomes';
  let used = 0;
  while (used < count && save.materials.xpTome > 0 && h.level < capOf(h)) {
    addHeroXp(h, XP_TOME_VALUE);
    save.materials.xpTome -= 1;
    used++;
  }
  return { used };
}

/** Можно ли использовать героя как «корм» для повышения звёзд target. */
export function isValidFodder(target: OwnedHero, f: OwnedHero): boolean {
  return f.uid !== target.uid && f.stars >= target.stars;
}

/** Повышение звёзд. fodder — uid героев-копий; если пусто, тратится звёздная пыль. */
export function starUp(save: SaveData, uid: string, fodder: string[] = []): { stars: number } | ActionError {
  const h = findHero(save, uid);
  if (!h) return 'notFound';
  if (h.stars >= MAX_STARS) return 'maxStars';
  if (h.level < maxLevel(h.stars)) return 'notMaxLevel';
  const cost = starUpCost(h.stars);
  if (save.currencies.gold < cost.gold) return 'noGold';
  if (fodder.length) {
    if (fodder.length !== cost.fodder) return 'noFodder';
    if (fodder.some((u) => save.training?.slots.some((t) => t.heroUid === u))) return 'badFodder';
    const list = fodder.map((u) => findHero(save, u));
    if (list.some((f) => !f || !isValidFodder(h, f))) return 'badFodder';
    removeHeroes(save, fodder);
  } else {
    if (save.materials.starDust < cost.dust) return 'noDust';
    save.materials.starDust -= cost.dust;
  }
  save.currencies.gold -= cost.gold;
  h.stars += 1;
  // Накопленный сверх потолка опыт сразу идёт в уровни.
  const xp = h.xp;
  h.xp = 0;
  addHeroXp(h, xp);
  return { stars: h.stars };
}

export function awaken(save: SaveData, uid: string): true | ActionError {
  const h = findHero(save, uid);
  if (!h) return 'notFound';
  if (h.awakened) return 'awakened';
  if (h.stars < MAX_STARS || h.level < maxLevel(MAX_STARS)) return 'notSixStar';
  if (save.materials.awakenStone < AWAKEN_COST.stones) return 'noStones';
  if (save.currencies.gold < AWAKEN_COST.gold) return 'noGold';
  save.materials.awakenStone -= AWAKEN_COST.stones;
  save.currencies.gold -= AWAKEN_COST.gold;
  h.awakened = true;
  return true;
}

export function setTeam(save: SaveData, uids: string[]) {
  const owned = new Set(save.heroes.map((h) => h.uid));
  const busy = new Set(save.training?.slots.map((s) => s.heroUid) ?? []);
  save.team = [...new Set(uids.filter((u) => owned.has(u) && !busy.has(u)))].slice(0, MAX_TEAM);
}

export function xpProgress(h: OwnedHero): number {
  if (h.level >= capOf(h)) return 1;
  return Math.min(1, h.xp / heroXpToNext(h.level));
}
