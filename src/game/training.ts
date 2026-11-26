import { heroDef } from '@/content';
import { heroLevelCap } from '@/core/stats';
import type { OwnedHero, SaveData } from '@/save/schema';
import { addHeroXp, heroXpToNext, type LevelUp } from './progression';
import { campLevel } from './camp';

/**
 * Тренировочный зал. Герой тренируется выбранное время и получает опыт за золото,
 * но пока тренируется — недоступен для боёв (команда, арена, босс клана).
 *
 * Расчёт: опыт в час 600 + 120 × уровень (на 1 ур. ~720/ч, на 20 ур. ~3 000/ч, на 40 ур. ~5 400/ч), цена 0,35 золота
 * за единицу опыта — дешевле томов из магазина (~0,8), зато медленно и герой выключен из боёв.
 * Уровень лагеря ускоряет тренировку на 5% за уровень (бонус бесплатный).
 * Для сравнения: лагерь даёт героям команды ~2 000 опыта в час бесплатно (середина игры),
 * поэтому зал нужен прежде всего героям из запаса: 12 ч на 20 ур. ≈ +6 уровней за ~12,6 тыс. золота.
 */
export const TRAINING_HOURS = [1, 4, 8, 12] as const;
export type TrainingHours = (typeof TRAINING_HOURS)[number];
export const TRAINING_GOLD_PER_XP = 0.35;
/** Ускорение за осколки: 1 осколок за 4 минуты остатка. */
export const RUSH_MIN_PER_SHARD = 4;
const HOUR = 3_600_000;

export interface TrainingSlot {
  heroUid: string;
  startAt: number;
  endAt: number;
  /** Опыт в час, зафиксирован на старте. */
  xpPerHour: number;
  gold: number;
}

/** Сколько мест в зале: 1 сразу, дальше — с уровнем лагеря 3, 5, 7, 9. */
export function trainingSlots(save: Pick<SaveData, 'camp'>): number {
  const l = campLevel(save).level;
  return 1 + [3, 5, 7, 9].filter((x) => l >= x).length;
}
export const TRAINING_SLOT_UNLOCK = [1, 3, 5, 7, 9] as const;

export function trainingRate(level: number, camp: number): { base: number; total: number } {
  const base = 600 + 120 * level;
  return { base, total: Math.round(base * (1 + 0.05 * (camp - 1))) };
}

export function isTraining(save: Pick<SaveData, 'training'>, uid: string): boolean {
  return save.training.slots.some((s) => s.heroUid === uid);
}

/** Сколько опыта нужно герою до потолка уровня по звёздам. */
export function xpToCap(h: OwnedHero): number {
  const cap = heroLevelCap(heroDef(h.heroId).rarity, h.stars);
  let need = -h.xp;
  for (let l = h.level; l < cap; l++) need += heroXpToNext(l);
  return Math.max(0, need);
}

/** Уровень, до которого герой дорастёт, получив xp опыта. */
export function levelAfter(h: OwnedHero, xp: number): number {
  const copy = { ...h };
  addHeroXp(copy, xp);
  return copy.level;
}

export interface TrainingPlan {
  hours: number;
  /** Сколько часов реально займёт (меньше, если упрётся в потолок). */
  realMs: number;
  xp: number;
  gold: number;
  toLevel: number;
  capped: boolean;
}

/** План тренировки: опыт, цена и итоговый уровень. Если герой упрётся в потолок — платится только до потолка. */
export function planTraining(save: SaveData, h: OwnedHero, hours: number): TrainingPlan {
  const rate = trainingRate(h.level, campLevel(save).level);
  const full = rate.total * hours;
  const cap = xpToCap(h);
  const capped = full >= cap;
  const xp = Math.min(full, cap);
  const share = full > 0 ? xp / full : 0;
  return {
    hours,
    realMs: Math.ceil(hours * HOUR * share),
    xp,
    // Платим за «базовый» опыт: бонус лагеря бесплатный.
    gold: Math.ceil(rate.base * hours * share * TRAINING_GOLD_PER_XP),
    toLevel: levelAfter(h, xp),
    capped,
  };
}

export type TrainingError = 'noSlot' | 'busy' | 'notFound' | 'atCap' | 'noGold';

export function startTraining(
  save: SaveData,
  uid: string,
  hours: number,
  now = Date.now(),
): TrainingSlot | TrainingError {
  const h = save.heroes.find((x) => x.uid === uid);
  if (!h) return 'notFound';
  if (isTraining(save, uid)) return 'busy';
  if (save.training.slots.length >= trainingSlots(save)) return 'noSlot';
  const plan = planTraining(save, h, hours);
  if (plan.xp <= 0) return 'atCap';
  if (save.currencies.gold < plan.gold) return 'noGold';
  save.currencies.gold -= plan.gold;
  const slot: TrainingSlot = {
    heroUid: uid,
    startAt: now,
    endAt: now + plan.realMs,
    xpPerHour: trainingRate(h.level, campLevel(save).level).total,
    gold: plan.gold,
  };
  save.training.slots.push(slot);
  // Тренирующийся герой уходит из боевой команды.
  save.team = save.team.filter((u) => u !== uid);
  return slot;
}

/** Опыт, накопленный к моменту now. */
export function trainedXp(slot: TrainingSlot, now: number): number {
  const ms = Math.max(0, Math.min(now, slot.endAt) - slot.startAt);
  return Math.floor((slot.xpPerHour * ms) / HOUR);
}

export function trainingDone(slot: TrainingSlot, now: number): boolean {
  return now >= slot.endAt;
}

/** Забрать героя: опыт за прошедшее время; золото за неотработанное не возвращается. */
export function claimTraining(
  save: SaveData,
  uid: string,
  now = Date.now(),
): { xp: number; up: LevelUp | null; early: boolean } | null {
  const slot = save.training.slots.find((s) => s.heroUid === uid);
  const h = save.heroes.find((x) => x.uid === uid);
  if (!slot) return null;
  save.training.slots = save.training.slots.filter((s) => s !== slot);
  if (!h) return { xp: 0, up: null, early: false };
  const xp = trainedXp(slot, now);
  const up = addHeroXp(h, xp);
  return { xp, up, early: now < slot.endAt };
}

export function rushCost(slot: TrainingSlot, now: number): number {
  const left = Math.max(0, slot.endAt - now);
  return Math.ceil(left / (RUSH_MIN_PER_SHARD * 60_000));
}

/** Закончить тренировку сразу за осколки. */
export function rushTraining(
  save: SaveData,
  uid: string,
  now = Date.now(),
): true | 'notFound' | 'noShards' | 'done' {
  const slot = save.training.slots.find((s) => s.heroUid === uid);
  if (!slot) return 'notFound';
  const cost = rushCost(slot, now);
  if (cost <= 0) return 'done';
  if (save.currencies.shards < cost) return 'noShards';
  save.currencies.shards -= cost;
  // Сдвигаем всю тренировку назад: длительность (и опыт) сохраняются, заканчивается сейчас.
  const dur = slot.endAt - slot.startAt;
  slot.startAt = now - dur;
  slot.endAt = now;
  return true;
}

/** Ближайшее окончание тренировки (для уведомления). */
export function nextTrainingEnd(save: SaveData, now: number): number | null {
  const ends = save.training.slots.map((s) => s.endAt).filter((t) => t > now);
  return ends.length ? Math.min(...ends) : null;
}
