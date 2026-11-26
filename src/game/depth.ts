import { heroDef, HEROES } from '@/content';
import { FACTIONS, type Faction, type Stats } from '@/core/types';
import type { OwnedHero, SaveData } from '@/save/schema';
import type { GearBonus } from './gear';
import { findHero } from './heroes';
import { busyUids } from './busy';

/**
 * Глубина героев: книги навыков, таланты и бонус коллекции.
 * - Навык качается книгами до 4 уровня: +10% силы за уровень, на 4-м перезарядка на 1 короче.
 * - Таланты: очко за каждые 5 уровней героя (12 на 60-м), три ветки по 4 таланта, изучаются по порядку.
 * - Коллекция: чем больше разных героев фракции собрано, тем сильнее все её герои.
 */

// ———————————————————— книги навыков ————————————————————

export const SKILL_MAX_LEVEL = 4;
/** Цена повышения навыка до уровня lv: книги и золото. */
export function skillUpCost(lv: number) {
  return { books: lv - 1, gold: 5_000 * (lv - 1) };
}
export function skillLevels(h: OwnedHero): number[] {
  return heroDef(h.heroId).skills.map((_, i) => h.skillLv?.[i] ?? 1);
}
export type SkillUpError = 'notFound' | 'max' | 'noBooks' | 'noGold';
export function upgradeSkill(save: SaveData, uid: string, idx: number): number | SkillUpError {
  const h = findHero(save, uid);
  if (!h || idx < 0 || idx >= heroDef(h.heroId).skills.length) return 'notFound';
  const lv = skillLevels(h);
  const next = lv[idx]! + 1;
  if (next > SKILL_MAX_LEVEL) return 'max';
  const c = skillUpCost(next);
  if (save.materials.skillBook < c.books) return 'noBooks';
  if (save.currencies.gold < c.gold) return 'noGold';
  save.materials.skillBook -= c.books;
  save.currencies.gold -= c.gold;
  lv[idx] = next;
  h.skillLv = lv;
  return next;
}

// ———————————————————— таланты ————————————————————

export type TalentBranch = 'might' | 'guard' | 'grace';
export interface TalentNode {
  id: string;
  branch: TalentBranch;
  tier: 1 | 2 | 3 | 4;
  /** Процентные прибавки к hp/atk/def и плоские к остальным. */
  pct?: Partial<Pick<Stats, 'hp' | 'atk' | 'def'>>;
  flat?: Partial<Stats>;
}
export const TALENTS: TalentNode[] = [
  { id: 'm1', branch: 'might', tier: 1, pct: { atk: 0.04 } },
  { id: 'm2', branch: 'might', tier: 2, flat: { critRate: 0.04 } },
  { id: 'm3', branch: 'might', tier: 3, flat: { critDmg: 0.1 } },
  { id: 'm4', branch: 'might', tier: 4, pct: { atk: 0.07 } },
  { id: 'g1', branch: 'guard', tier: 1, pct: { hp: 0.04 } },
  { id: 'g2', branch: 'guard', tier: 2, pct: { def: 0.06 } },
  { id: 'g3', branch: 'guard', tier: 3, flat: { res: 15 } },
  { id: 'g4', branch: 'guard', tier: 4, pct: { hp: 0.07 } },
  { id: 'a1', branch: 'grace', tier: 1, flat: { spd: 3 } },
  { id: 'a2', branch: 'grace', tier: 2, flat: { acc: 15 } },
  { id: 'a3', branch: 'grace', tier: 3, pct: { hp: 0.03, def: 0.03 } },
  { id: 'a4', branch: 'grace', tier: 4, flat: { spd: 5 } },
];
export const TALENT_RESET_GOLD = 10_000;

export function talentPoints(h: OwnedHero): { total: number; used: number; free: number } {
  const total = Math.floor(h.level / 5);
  const used = h.talents?.length ?? 0;
  return { total, used, free: Math.max(0, total - used) };
}

export type TalentError = 'notFound' | 'noPoints' | 'locked' | 'already';
export function canLearn(h: OwnedHero, id: string): true | TalentError {
  const node = TALENTS.find((t) => t.id === id);
  if (!node) return 'notFound';
  const learned = new Set(h.talents ?? []);
  if (learned.has(id)) return 'already';
  if (talentPoints(h).free <= 0) return 'noPoints';
  const prev = TALENTS.find((t) => t.branch === node.branch && t.tier === node.tier - 1);
  if (prev && !learned.has(prev.id)) return 'locked';
  return true;
}
export function learnTalent(save: SaveData, uid: string, id: string): true | TalentError {
  const h = findHero(save, uid);
  if (!h) return 'notFound';
  const ok = canLearn(h, id);
  if (ok !== true) return ok;
  h.talents = [...(h.talents ?? []), id];
  return true;
}
export function resetTalents(save: SaveData, uid: string): true | 'notFound' | 'noGold' | 'empty' {
  const h = findHero(save, uid);
  if (!h) return 'notFound';
  if (!h.talents?.length) return 'empty';
  if (save.currencies.gold < TALENT_RESET_GOLD) return 'noGold';
  save.currencies.gold -= TALENT_RESET_GOLD;
  h.talents = [];
  return true;
}

// ———————————————————— коллекция ————————————————————

/** Бонус фракции за собранных разных героев её обычного пула (по 6 в каждой). */
export const COLLECTION_TIERS = [
  { need: 3, pct: 0.03 },
  { need: 5, pct: 0.06 },
  { need: 7, pct: 0.1 },
] as const;

export function collectionOf(save: SaveData, f: Faction): { have: number; total: number; pct: number } {
  const pool = HEROES.filter((h) => h.faction === f && !h.pool);
  const owned = new Set(save.heroes.map((h) => h.heroId));
  const have = pool.filter((h) => owned.has(h.id)).length;
  let pct = 0;
  for (const t of COLLECTION_TIERS) if (have >= t.need) pct = t.pct;
  return { have, total: pool.length, pct };
}

export function collectionAll(save: SaveData) {
  return FACTIONS.map((f) => ({ faction: f, ...collectionOf(save, f) }));
}

// ———————————————————— общий бонус ————————————————————

/** Прибавки героя от талантов и коллекции (в том же формате, что бонус снаряжения). */
export function depthBonus(save: SaveData, h: OwnedHero): GearBonus {
  const b: GearBonus = { flat: {}, pct: {} };
  for (const id of h.talents ?? []) {
    const n = TALENTS.find((t) => t.id === id);
    if (!n) continue;
    for (const [k, v] of Object.entries(n.pct ?? {}) as ['hp' | 'atk' | 'def', number][])
      b.pct[k] = (b.pct[k] ?? 0) + v;
    for (const [k, v] of Object.entries(n.flat ?? {}) as [keyof Stats, number][])
      b.flat[k] = (b.flat[k] ?? 0) + v;
  }
  const c = collectionOf(save, heroDef(h.heroId).faction).pct;
  if (c > 0) for (const k of ['hp', 'atk', 'def'] as const) b.pct[k] = (b.pct[k] ?? 0) + c;
  return b;
}

export function mergeBonus(a: GearBonus, b: GearBonus): GearBonus {
  const out: GearBonus = { flat: { ...a.flat }, pct: { ...a.pct } };
  for (const [k, v] of Object.entries(b.flat) as [keyof Stats, number][])
    out.flat[k] = (out.flat[k] ?? 0) + v;
  for (const [k, v] of Object.entries(b.pct) as ['hp' | 'atk' | 'def', number][])
    out.pct[k] = (out.pct[k] ?? 0) + v;
  return out;
}

// ———————————————————— слияние ————————————————————

export interface FusionRecipe {
  result: string;
  parts: { heroId: string; stars: number }[];
  gold: number;
  /** Звёзды героя-результата. */
  stars: number;
}
export const FUSIONS: FusionRecipe[] = [
  {
    result: 'ilia',
    parts: [
      { heroId: 'selesta', stars: 4 },
      { heroId: 'valeria', stars: 4 },
      { heroId: 'mirna', stars: 3 },
      { heroId: 'rikht', stars: 3 },
    ],
    gold: 50_000,
    stars: 4,
  },
  {
    result: 'skarn',
    parts: [
      { heroId: 'sirra', stars: 4 },
      { heroId: 'azgar', stars: 3 },
      { heroId: 'chirk', stars: 3 },
      { heroId: 'grom', stars: 3 },
    ],
    gold: 50_000,
    stars: 4,
  },
];

/** Подходящая копия для слияния: нужные звёзды, не на тренировке; лучше не из команды и с меньшим уровнем. */
export function fusionPick(save: SaveData, heroId: string, stars: number): OwnedHero | null {
  const busy = busyUids(save);
  const list = save.heroes
    .filter((h) => h.heroId === heroId && h.stars >= stars && !busy.has(h.uid))
    .sort(
      (a, b) =>
        Number(save.team.includes(a.uid)) - Number(save.team.includes(b.uid)) ||
        a.stars - b.stars ||
        a.level - b.level,
    );
  return list[0] ?? null;
}

export type FusionError = 'notFound' | 'missing' | 'noGold';
export function fuse(save: SaveData, result: string, now = Date.now()): OwnedHero | FusionError {
  const r = FUSIONS.find((x) => x.result === result);
  if (!r) return 'notFound';
  const picks = r.parts.map((p) => fusionPick(save, p.heroId, p.stars));
  if (picks.some((p) => !p)) return 'missing';
  if (save.currencies.gold < r.gold) return 'noGold';
  save.currencies.gold -= r.gold;
  const uids = new Set(picks.map((p) => p!.uid));
  // Снаряжение ингредиентов возвращается в сумку.
  for (const it of save.items) if (it.heroUid && uids.has(it.heroUid)) it.heroUid = null;
  save.heroes = save.heroes.filter((h) => !uids.has(h.uid));
  save.team = save.team.filter((u) => !uids.has(u));
  save.presets = save.presets.map((p) => ({ ...p, uids: p.uids.filter((u) => !uids.has(u)) }));
  const h: OwnedHero = {
    uid: `h${save.seq++}`,
    heroId: r.result,
    level: 1,
    xp: 0,
    stars: r.stars,
    awakened: false,
    obtainedAt: now,
  };
  save.heroes.push(h);
  return h;
}
