import type { SaveData } from '@/save/schema';
import { regenEnergy } from './energy';

/**
 * Прокачка лагеря: 10 уровней. Каждый следующий требует уровень игрока, золото и осколки,
 * а взамен ускоряет добычу лагеря (золото, опыт героев, томы) и восстановление энергии.
 *
 * Расчёт: игрок тратит ~360 энергии в сутки (~40 боёв), к 3-му дню у него ~13 уровень,
 * к 7-му ~26, к 14-му ~43. Требования растянуты примерно на две недели игры.
 * 2-й уровень окупается за день добычи, 10-й — примерно за две недели (плюс опыт и энергия).
 */
export interface CampLevel {
  level: number;
  /** Требования для перехода на этот уровень. */
  req: { playerLevel: number; gold: number; shards: number };
  /** Множитель золота в добыче лагеря. */
  goldMult: number;
  /** Множитель опыта героев и томов опыта в добыче лагеря. */
  xpMult: number;
  /** Секунд на одну единицу энергии. */
  regenSec: number;
}

export const CAMP_LEVELS: CampLevel[] = [
  { level: 1, req: { playerLevel: 1, gold: 0, shards: 0 }, goldMult: 1, xpMult: 1, regenSec: 240 },
  { level: 2, req: { playerLevel: 3, gold: 5_000, shards: 0 }, goldMult: 1.1, xpMult: 1.08, regenSec: 230 },
  { level: 3, req: { playerLevel: 6, gold: 15_000, shards: 30 }, goldMult: 1.2, xpMult: 1.16, regenSec: 220 },
  {
    level: 4,
    req: { playerLevel: 10, gold: 35_000, shards: 60 },
    goldMult: 1.32,
    xpMult: 1.25,
    regenSec: 210,
  },
  {
    level: 5,
    req: { playerLevel: 14, gold: 70_000, shards: 100 },
    goldMult: 1.45,
    xpMult: 1.35,
    regenSec: 200,
  },
  {
    level: 6,
    req: { playerLevel: 19, gold: 120_000, shards: 150 },
    goldMult: 1.6,
    xpMult: 1.46,
    regenSec: 190,
  },
  {
    level: 7,
    req: { playerLevel: 24, gold: 190_000, shards: 220 },
    goldMult: 1.76,
    xpMult: 1.58,
    regenSec: 180,
  },
  {
    level: 8,
    req: { playerLevel: 30, gold: 280_000, shards: 300 },
    goldMult: 1.93,
    xpMult: 1.7,
    regenSec: 170,
  },
  {
    level: 9,
    req: { playerLevel: 36, gold: 400_000, shards: 400 },
    goldMult: 2.11,
    xpMult: 1.83,
    regenSec: 160,
  },
  {
    level: 10,
    req: { playerLevel: 42, gold: 560_000, shards: 500 },
    goldMult: 2.3,
    xpMult: 2.0,
    regenSec: 150,
  },
];
export const CAMP_MAX_LEVEL = CAMP_LEVELS.length;

export function campLevel(save: Pick<SaveData, 'camp'>): CampLevel {
  const l = Math.max(1, Math.min(CAMP_MAX_LEVEL, save.camp?.level ?? 1));
  return CAMP_LEVELS[l - 1]!;
}

export function nextCampLevel(save: Pick<SaveData, 'camp'>): CampLevel | null {
  return CAMP_LEVELS[campLevel(save).level] ?? null;
}

/** Мс на единицу энергии с учётом уровня лагеря. */
export function energyRegenMs(save: Pick<SaveData, 'camp'>): number {
  return campLevel(save).regenSec * 1000;
}

/** Энергии в сутки при постоянной игре (для подсказки). */
export function energyPerDay(regenSec: number): number {
  return Math.floor(86_400 / regenSec);
}

export type CampUpgradeError = 'max' | 'level' | 'gold' | 'shards';

export function canUpgradeCamp(save: SaveData): true | CampUpgradeError {
  const next = nextCampLevel(save);
  if (!next) return 'max';
  if (save.player.level < next.req.playerLevel) return 'level';
  if (save.currencies.gold < next.req.gold) return 'gold';
  if (save.currencies.shards < next.req.shards) return 'shards';
  return true;
}

/** Улучшить лагерь. Энергия сперва досчитывается по старой скорости, чтобы не потерять накопленное. */
export function upgradeCamp(save: SaveData, now = Date.now()): CampLevel | CampUpgradeError {
  const ok = canUpgradeCamp(save);
  if (ok !== true) return ok;
  const next = nextCampLevel(save)!;
  regenEnergy(save.currencies, now, energyRegenMs(save));
  save.currencies.gold -= next.req.gold;
  save.currencies.shards -= next.req.shards;
  save.camp.level = next.level;
  return next;
}
