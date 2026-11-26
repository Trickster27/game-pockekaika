import { sendMail } from './mail';
import type { ShopReward } from './shop';
import { Rng, hashSeed } from '@/core/rng';
import type { UnitSpec, BattleResult } from '@/core/battle';
import { HEROES } from '@/content/heroes';
import type { SaveData } from '@/save/schema';
import { RARITY_START_STARS } from './heroes';
import { periodKey } from './shop';
import { teamHeroes } from './battleSetup';
import { teamPower } from './power';
import { baseStats, power, statsAt, maxLevel } from '@/core/stats';

export const ARENA_DAILY_BATTLES = 5;

export interface League {
  id: string;
  name: string;
  min: number;
  color: string;
  dailyShards: number;
}

export const LEAGUES: League[] = [
  { id: 'bronze', name: 'Бронза', min: 0, color: '#c98a45', dailyShards: 30 },
  { id: 'silver', name: 'Серебро', min: 1100, color: '#c7d0e0', dailyShards: 50 },
  { id: 'gold', name: 'Золото', min: 1400, color: '#f0c860', dailyShards: 80 },
  { id: 'platinum', name: 'Платина', min: 1700, color: '#7fe7ff', dailyShards: 120 },
  { id: 'legend', name: 'Легенда', min: 2000, color: '#ff7ad9', dailyShards: 180 },
];

export function leagueOf(rating: number): League {
  return [...LEAGUES].reverse().find((l) => rating >= l.min)!;
}

/** Подуровень I/II/III внутри лиги (у Легенды нет). */
export function leagueTier(rating: number): string {
  const l = leagueOf(rating);
  const i = LEAGUES.indexOf(l);
  const next = LEAGUES[i + 1];
  if (!next) return '';
  const step = (next.min - l.min) / 3;
  const t = Math.min(2, Math.floor((rating - l.min) / step));
  return ['III', 'II', 'I'][t]!;
}

const NAMES = [
  'Мирон',
  'Агата',
  'Велемир',
  'Злата',
  'Тихон',
  'Ярина',
  'Бор',
  'Олеся',
  'Добрыня',
  'Лада',
  'Святогор',
  'Марфа',
  'Радим',
  'Есения',
  'Гордей',
  'Весна',
];
const TITLES = ['Хранитель', 'Странник', 'Ловчий', 'Рунник', 'Пепельный', 'Вольный', 'Сумеречный'];

export interface ArenaOpponent {
  id: string;
  name: string;
  rating: number;
  power: number;
  team: UnitSpec[];
}

function resetDay(save: SaveData, now: number) {
  const day = periodKey('day', now);
  if (save.arena.day !== day) {
    save.arena.day = day;
    save.arena.battlesToday = 0;
  }
  rollSeason(save, now);
}

// ———————————————————— сезоны ————————————————————

/** Сезон арены — 14 дней. В конце: награда по лучшей лиге сезона (письмом) и мягкий сброс рейтинга. */
export const SEASON_DAYS = 14;
export function arenaSeason(now: number): number {
  return Math.floor(Math.floor(now / 86_400_000) / SEASON_DAYS);
}
export function seasonEndsAt(now: number): number {
  return (arenaSeason(now) + 1) * SEASON_DAYS * 86_400_000;
}
export const SEASON_REWARDS: Record<string, ShopReward> = {
  bronze: { gold: 20_000, shards: 50 },
  silver: { gold: 40_000, shards: 120, materials: { scroll: 1 } },
  gold: { gold: 70_000, shards: 220, materials: { ancientScroll: 1 } },
  platinum: { gold: 110_000, shards: 350, materials: { ancientScroll: 1, skillBook: 2 } },
  legend: { gold: 160_000, shards: 500, materials: { voidScroll: 1, skillBook: 3 } },
};

export function rollSeason(save: SaveData, now: number) {
  const cur = arenaSeason(now);
  const a = save.arena;
  if (a.season === cur) return;
  if (a.season !== undefined && (a.wins + a.losses > 0 || (a.seasonBest ?? 0) > 1000)) {
    const best = leagueOf(Math.max(a.seasonBest ?? a.rating, a.rating));
    sendMail(
      save,
      {
        key: `arena-season-${a.season}`,
        title: 'mail.season.title',
        body: 'mail.season.body',
        params: { league: best.id },
        reward: SEASON_REWARDS[best.id],
      },
      now,
    );
    // Мягкий сброс: половина пути к 1000.
    a.rating = Math.round(1000 + (a.rating - 1000) / 2);
  }
  a.season = cur;
  a.seasonBest = a.rating;
}

export function battlesLeft(save: SaveData, now: number): number {
  const day = periodKey('day', now);
  return save.arena.day === day
    ? Math.max(0, ARENA_DAILY_BATTLES - save.arena.battlesToday)
    : ARENA_DAILY_BATTLES;
}

/** Три соперника-ИИ: слабее, равный и сильнее. Детерминированы номером обновления. */
export function arenaOpponents(save: SaveData): ArenaOpponent[] {
  const rng = new Rng(hashSeed(`arena:${save.saveId}:${save.arena.refresh}`));
  const myPower = Math.max(1, teamPower(save));
  const team = teamHeroes(save);
  const avgLevel = team.length ? team.reduce((a, h) => a + h.level, 0) / team.length : 1;
  const teams = [0.82, 1, 1.18].map((mult) => {
    // Для слабого соперника не берём легендарных: на низких уровнях он иначе оказывается сильнее.
    const pool = mult < 1 ? HEROES.filter((h) => h.rarity !== 'legendary') : HEROES;
    const picks = rng.shuffle(pool).slice(0, 5);
    // Подбираем уровень так, чтобы сила была близка к целевой.
    let level = Math.max(1, Math.round(avgLevel * mult));
    const specs = () =>
      picks.map((d) => {
        const stars = Math.min(6, Math.max(RARITY_START_STARS[d.rarity], Math.ceil(level / 10)));
        return { defId: d.id, kind: 'hero' as const, level: Math.min(level, maxLevel(stars)), stars };
      });
    const pw = () =>
      specs().reduce(
        (a, s) =>
          a +
          power(
            statsAt(
              baseStats(
                HEROES.find((h) => h.id === s.defId)!.role,
                HEROES.find((h) => h.id === s.defId)!.rarity,
              ),
              s.level,
              s.stars,
            ),
          ),
        0,
      );
    for (let k = 0; k < 40 && pw() < myPower * mult * 0.97 && level < 60; k++) level++;
    for (let k = 0; k < 40 && pw() > myPower * mult * 1.03 && level > 1; k++) level--;
    return {
      name: `${rng.pick(TITLES)} ${rng.pick(NAMES)}`,
      power: pw(),
      team: specs(),
      jitter: rng.int(-25, 25),
    };
  });
  // Порядок всегда «слабее → равный → сильнее», рейтинг раздаём после сортировки.
  teams.sort((a, b) => a.power - b.power);
  return teams.map((t, i) => ({
    id: `o${save.arena.refresh}_${i}`,
    name: t.name,
    rating: Math.max(0, save.arena.rating + (i - 1) * 70 + t.jitter),
    power: t.power,
    team: t.team,
  }));
}

/** Изменение рейтинга по Эло (K = 32). Победа даёт минимум +5. */
export function ratingDelta(me: number, opp: number, win: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (opp - me) / 400));
  const d = Math.round(32 * ((win ? 1 : 0) - expected));
  return win ? Math.max(5, d) : Math.min(-3, d);
}

export type ArenaError = 'noTickets';

export function startArenaBattle(save: SaveData, now: number): true | ArenaError {
  resetDay(save, now);
  if (save.arena.battlesToday >= ARENA_DAILY_BATTLES) return 'noTickets';
  save.arena.battlesToday += 1;
  return true;
}

export function applyArenaResult(
  save: SaveData,
  opp: ArenaOpponent,
  result: BattleResult,
): { delta: number; gold: number } {
  const win = result.winner === 'ally';
  const delta = ratingDelta(save.arena.rating, opp.rating, win);
  save.arena.rating = Math.max(0, save.arena.rating + delta);
  save.arena.seasonBest = Math.max(save.arena.seasonBest ?? 0, save.arena.rating);
  const gold = win ? 600 + Math.round(save.arena.rating / 4) : 150;
  save.currencies.gold += gold;
  if (win) {
    save.arena.wins += 1;
    save.stats.battlesWon += 1;
  } else {
    save.arena.losses += 1;
    save.stats.battlesLost += 1;
  }
  save.arena.refresh += 1;
  return { delta, gold };
}

export function refreshOpponents(save: SaveData) {
  save.arena.refresh += 1;
}

export function canClaimLeague(save: SaveData, now: number): boolean {
  return save.arena.leagueClaimedDay !== periodKey('day', now);
}

export function claimLeague(save: SaveData, now: number): number {
  if (!canClaimLeague(save, now)) return 0;
  const n = leagueOf(save.arena.rating).dailyShards;
  save.currencies.shards += n;
  save.arena.leagueClaimedDay = periodKey('day', now);
  return n;
}
