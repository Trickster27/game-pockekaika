import { ALL_STAGES } from '@/content/campaign';
import type { SaveData } from '@/save/schema';
import { addHeroXp, type LevelUp } from './progression';
import { teamHeroes } from './battleSetup';
import { campLevel } from './camp';

/** Лимит накопления idle-наград. */
export const IDLE_CAP_MS = 12 * 60 * 60 * 1000;
/** Меньше этого экран «С возвращением» не показываем. */
export const IDLE_MIN_SHOW_MS = 5 * 60 * 1000;

export interface IdleRates {
  /** Всё в единицах «за час». */
  gold: number;
  heroXp: number;
  xpTome: number;
  starDust: number;
  awakenStone: number;
}

/** Сколько этапов кампании пройдено: от этого растут idle-награды. */
export function clearedStages(save: SaveData): number {
  return ALL_STAGES.filter((s) => (save.campaign.stars[s.id] ?? 0) > 0).length;
}

/** Добыча в час без бонуса лагеря. */
export function baseIdleRates(save: SaveData): IdleRates {
  const g = clearedStages(save);
  return {
    gold: 1200 + 260 * g,
    heroXp: 500 + 140 * g,
    xpTome: 0.35 + 0.03 * g,
    starDust: 0.5 + 0.12 * g,
    awakenStone: g >= 20 ? 0.15 + 0.02 * (g - 20) : 0,
  };
}

/** Добыча в час с бонусом уровня лагеря: золото — goldMult, опыт и томы — xpMult. */
export function idleRates(save: SaveData): IdleRates {
  const b = baseIdleRates(save);
  const c = campLevel(save);
  return { ...b, gold: b.gold * c.goldMult, heroXp: b.heroXp * c.xpMult, xpTome: b.xpTome * c.xpMult };
}

export interface IdleReward {
  ms: number;
  gold: number;
  heroXp: number;
  xpTome: number;
  starDust: number;
  awakenStone: number;
}

/** Сколько накопилось к моменту now (с учётом лимита 12 ч). */
export function pendingIdle(save: SaveData, now: number): IdleReward {
  const ms = Math.max(0, Math.min(IDLE_CAP_MS, now - save.idle.lastClaimAt));
  const h = ms / 3_600_000;
  const r = idleRates(save);
  return {
    ms,
    gold: Math.floor(r.gold * h),
    heroXp: Math.floor(r.heroXp * h),
    xpTome: Math.floor(r.xpTome * h),
    starDust: Math.floor(r.starDust * h),
    awakenStone: Math.floor(r.awakenStone * h),
  };
}

/** Забрать накопленное: золото и материалы в сейв, опыт — героям команды. */
export function claimIdle(save: SaveData, now: number): IdleReward & { levelUps: LevelUp[] } {
  const r = pendingIdle(save, now);
  save.currencies.gold += r.gold;
  save.materials.xpTome += r.xpTome;
  save.materials.starDust += r.starDust;
  save.materials.awakenStone += r.awakenStone;
  const levelUps: LevelUp[] = [];
  for (const h of teamHeroes(save)) {
    const up = addHeroXp(h, r.heroXp);
    if (up) levelUps.push(up);
  }
  save.idle.lastClaimAt = now;
  return { ...r, levelUps };
}

/** Когда копилка заполнится (для уведомления). */
export function idleFullAt(save: SaveData): number {
  return save.idle.lastClaimAt + IDLE_CAP_MS;
}
