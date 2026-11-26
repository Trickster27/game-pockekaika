import { Rng, hashSeed } from '@/core/rng';
import { ELEMENTS, FACTIONS, type Element, type Faction } from '@/core/types';
import type { BattleSetup, UnitSpec } from '@/core/battle/types';
import { heroDef } from '@/content';
import type { SaveData } from '@/save/schema';
import { heroSpec, teamHeroes } from './battleSetup';
import { grantReward, periodKey, type ShopReward } from './shop';

/**
 * Еженедельный рейд: Пожиратель звёзд. Одиночный босс с бездонным здоровьем —
 * считается только нанесённый урон (как «стенд урона» в гачах).
 *
 * Неделя (с понедельника, UTC) задаёт три правила:
 *  - стихию босса (подбирайте героев с преимуществом);
 *  - благословлённую фракцию: её герои получают +25% атаки;
 *  - мутацию босса (ярость, панцирь, стремительность или голод).
 * Попыток 3 в день (не копятся) + одна покупная за осколки. Бой длится 25 ходов босса.
 * Урон за неделю складывается и открывает 8 ступеней наград; за каждую попытку — золото и руда.
 * Баланс (симуляция без снаряжения): ~20 тыс. урона за попытку в начале, ~100 тыс. к 80-му уровню героев;
 * за неделю это 0,4–2 млн — первые 4 ступени доступны новичку, последние требуют снаряжения и подбора состава.
 */

export const RAID_BOSS_ID = 'star_devourer';
export const RAID = {
  attemptsPerDay: 3,
  extraCost: 60,
  bossTurns: 25,
  hp: 1_000_000_000,
  enrage: 0.03,
  blessing: 0.25,
} as const;

export interface RaidMutation {
  id: 'fury' | 'carapace' | 'haste' | 'hunger';
  name: string;
  desc: string;
}
export const RAID_MUTATIONS: RaidMutation[] = [
  { id: 'fury', name: 'Ярость', desc: 'Атака босса +25%.' },
  { id: 'carapace', name: 'Панцирь', desc: 'Защита босса +40%.' },
  { id: 'haste', name: 'Стремительность', desc: 'Скорость босса +15%.' },
  { id: 'hunger', name: 'Голод', desc: 'Ярость растёт вдвое быстрее: +6% атаки за ход.' },
];

/** Ступени недельного урона. */
export const RAID_MILESTONES: { damage: number; reward: ShopReward }[] = [
  { damage: 60_000, reward: { gold: 15_000, materials: { ore: 30 } } },
  { damage: 150_000, reward: { shards: 40, materials: { xpTome: 5 } } },
  { damage: 300_000, reward: { gold: 40_000, materials: { skillBook: 1 } } },
  { damage: 500_000, reward: { shards: 80, materials: { starDust: 25 } } },
  { damage: 800_000, reward: { materials: { ancientScroll: 1, skillBook: 1 } } },
  { damage: 1_200_000, reward: { shards: 150, materials: { awakenStone: 2 } } },
  { damage: 1_800_000, reward: { materials: { voidScroll: 1, skillBook: 2 } } },
  { damage: 2_600_000, reward: { shards: 250, materials: { goldScroll: 1 } } },
];

export interface RaidState {
  week: string;
  damage: number;
  best: number;
  claimed: number[];
  day: string;
  used: number;
  extra: number;
}

export function emptyRaid(): RaidState {
  return { week: '', damage: 0, best: 0, claimed: [], day: '', used: 0, extra: 0 };
}

export interface RaidWeek {
  week: string;
  element: Element;
  blessed: Faction;
  mutation: RaidMutation;
  endsAt: number;
}

export function raidWeek(now: number): RaidWeek {
  const week = periodKey('week', now);
  const n = Number(week.slice(1));
  const rng = new Rng(hashSeed(`raid:${week}`));
  return {
    week,
    // Стихия идёт по кругу, чтобы за 6 недель были все; остальное — случайно.
    element: ELEMENTS[n % ELEMENTS.length]!,
    blessed: rng.pick(FACTIONS),
    mutation: rng.pick(RAID_MUTATIONS),
    endsAt: ((n + 1) * 7 - 3) * 86_400_000,
  };
}

export function rollRaid(save: SaveData, now = Date.now()) {
  const r = save.raid;
  const week = periodKey('week', now);
  if (r.week !== week) Object.assign(r, { week, damage: 0, best: 0, claimed: [] });
  const day = periodKey('day', now);
  if (r.day !== day) Object.assign(r, { day, used: 0, extra: 0 });
}

export function raidAttemptsLeft(save: SaveData, now: number): number {
  const day = periodKey('day', now);
  if (save.raid.day !== day) return RAID.attemptsPerDay;
  return Math.max(0, RAID.attemptsPerDay + save.raid.extra - save.raid.used);
}

export function canBuyRaidAttempt(save: SaveData, now: number): boolean {
  return (
    (save.raid.day !== periodKey('day', now) || save.raid.extra < 1) && raidAttemptsLeft(save, now) === 0
  );
}

export function buyRaidAttempt(save: SaveData, now = Date.now()): true | 'noShards' | 'limit' {
  rollRaid(save, now);
  if (!canBuyRaidAttempt(save, now)) return 'limit';
  if (save.currencies.shards < RAID.extraCost) return 'noShards';
  save.currencies.shards -= RAID.extraCost;
  save.raid.extra += 1;
  return true;
}

/** Уровень босса идёт за уровнем игрока, чтобы бой оставался вызовом всю игру. */
export function raidBossLevel(save: SaveData): number {
  return Math.max(15, Math.min(100, save.player.level + 8));
}

export function raidBossSpec(save: SaveData, now: number): UnitSpec {
  const w = raidWeek(now);
  const m = w.mutation.id;
  return {
    defId: RAID_BOSS_ID,
    kind: 'enemy',
    level: raidBossLevel(save),
    boss: true,
    hpMax: RAID.hp,
    hpNow: RAID.hp,
    element: w.element,
    ccImmune: true,
    enrage: m === 'hunger' ? RAID.enrage * 2 : RAID.enrage,
    bonusPct:
      m === 'fury' ? { atk: 0.25 } : m === 'carapace' ? { def: 0.4 } : m === 'haste' ? { spd: 0.15 } : {},
  };
}

/** Состав на рейд: герои благословлённой фракции получают +25% атаки. */
export function raidSetup(save: SaveData, now: number, seed: number): BattleSetup {
  const w = raidWeek(now);
  const allies = teamHeroes(save).map((h) => {
    const s = heroSpec(h, save);
    if (heroDef(h.heroId).faction === w.blessed)
      s.bonusPct = { ...s.bonusPct, atk: (s.bonusPct?.atk ?? 0) + RAID.blessing };
    return s;
  });
  return { allies, waves: [[raidBossSpec(save, now)]], seed, bossTurns: RAID.bossTurns };
}

/** Начать попытку: списывает её сразу (сдача боя попытку не возвращает). */
export function beginRaid(save: SaveData, now = Date.now()): { seed: number } | 'noAttempts' | 'noTeam' {
  rollRaid(save, now);
  if (teamHeroes(save).length === 0) return 'noTeam';
  if (raidAttemptsLeft(save, now) <= 0) return 'noAttempts';
  save.raid.used += 1;
  return { seed: hashSeed(`${save.saveId}:raid:${save.raid.day}:${save.raid.used}`) };
}

export function attemptReward(damage: number): ShopReward {
  return {
    gold: Math.round(Math.min(25_000, 3_000 + damage * 0.15) / 100) * 100,
    materials: { ore: Math.min(40, 5 + Math.floor(damage / 5_000)) },
  };
}

/** Записать результат попытки. */
export function finishRaid(
  save: SaveData,
  damage: number,
  now = Date.now(),
): { reward: ShopReward; newBest: boolean } {
  rollRaid(save, now);
  const dmg = Math.max(0, Math.floor(damage));
  save.raid.damage += dmg;
  const newBest = dmg > save.raid.best;
  if (newBest) save.raid.best = dmg;
  save.stats.raidBest = Math.max(save.stats.raidBest ?? 0, dmg);
  const reward = attemptReward(dmg);
  grantReward(save, reward, now);
  return { reward, newBest };
}

export function raidClaimable(save: SaveData, now: number): number {
  if (save.raid.week !== periodKey('week', now)) return 0;
  return RAID_MILESTONES.filter((m, i) => save.raid.damage >= m.damage && !save.raid.claimed.includes(i))
    .length;
}

export function claimRaidMilestone(save: SaveData, i: number, now = Date.now()): ShopReward | null {
  rollRaid(save, now);
  const m = RAID_MILESTONES[i];
  if (!m || save.raid.damage < m.damage || save.raid.claimed.includes(i)) return null;
  save.raid.claimed.push(i);
  grantReward(save, m.reward, now);
  return m.reward;
}
