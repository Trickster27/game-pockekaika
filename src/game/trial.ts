import { Rng, hashSeed } from '@/core/rng';
import type { StageEnemy } from '@/content/campaign';
import type { MaterialId, SaveData } from '@/save/schema';
import { grantReward, periodKey, type ShopReward } from './shop';

/**
 * Испытание дня: по дням недели своё испытание со своей добычей (как «ежедневные подземелья» жанра).
 * Энергии не нужно — 3 попытки в день (засчитывается только победа). 10 уровней сложности на каждое
 * испытание: открываются по порядку, награда растёт с уровнем. В воскресенье доступно любое испытание.
 */
export type TrialKind = 'tomes' | 'dust' | 'ore' | 'books' | 'stones' | 'gold';
export const TRIAL_ATTEMPTS = 3;
export const TRIAL_LEVELS = 10;

export interface TrialDef {
  kind: TrialKind;
  scene: 'mist' | 'cathedral' | 'forge' | 'dusk' | 'sky';
  minions: [string, string];
  boss: string;
  color: string;
}
export const TRIALS: TrialDef[] = [
  { kind: 'tomes', scene: 'cathedral', minions: ['drowned', 'siren'], boss: 'abbess', color: '#6fb3ff' },
  {
    kind: 'dust',
    scene: 'dusk',
    minions: ['dusk_wisp', 'star_lancer'],
    boss: 'eclipse_queen',
    color: '#f0c860',
  },
  { kind: 'ore', scene: 'forge', minions: ['imp', 'golem'], boss: 'emberlord', color: '#7fe7ff' },
  {
    kind: 'books',
    scene: 'mist',
    minions: ['shade_archer', 'gloom_knight'],
    boss: 'colossus',
    color: '#ff7ad9',
  },
  {
    kind: 'stones',
    scene: 'sky',
    minions: ['storm_harpy', 'sky_sentinel'],
    boss: 'storm_king',
    color: '#4fd6e0',
  },
  { kind: 'gold', scene: 'forge', minions: ['cultist', 'firedrake'], boss: 'emberlord', color: '#ffd36b' },
];

/** Пн — томы, Вт — пыль, Ср — руда, Чт — книги, Пт — камни, Сб — золото, Вс — любое. */
const BY_WEEKDAY: (TrialKind | 'any')[] = ['any', 'tomes', 'dust', 'ore', 'books', 'stones', 'gold'];

export function trialToday(now: number): TrialKind[] {
  const wd = new Date(now).getUTCDay();
  const k = BY_WEEKDAY[wd]!;
  return k === 'any' ? TRIALS.map((t) => t.kind) : [k];
}

export function trialDef(kind: TrialKind): TrialDef {
  return TRIALS.find((t) => t.kind === kind)!;
}

function roll(save: SaveData, now: number) {
  const day = periodKey('day', now);
  if (save.trial.day !== day) Object.assign(save.trial, { day, used: 0 });
}

export function trialAttemptsLeft(save: SaveData, now: number): number {
  return save.trial.day === periodKey('day', now)
    ? Math.max(0, TRIAL_ATTEMPTS - save.trial.used)
    : TRIAL_ATTEMPTS;
}

export function trialUnlocked(save: SaveData, kind: TrialKind, level: number): boolean {
  return level >= 1 && level <= TRIAL_LEVELS && level <= (save.trial.best[kind] ?? 0) + 1;
}

export function trialEnemyLevel(level: number): number {
  return 8 + level * 6;
}

export function trialWaves(kind: TrialKind, level: number): StageEnemy[][] {
  const d = trialDef(kind);
  const lv = trialEnemyLevel(level);
  const n = level < 4 ? 3 : 4;
  const wave = (k: number): StageEnemy[] =>
    Array.from({ length: n }, (_, i) => ({
      id: d.minions[(i + k) % 2]!,
      level: lv,
      tier: k === 1 && i === 0 ? ('elite' as const) : ('normal' as const),
    }));
  return [
    wave(0),
    wave(1),
    [
      { id: d.minions[0], level: lv, tier: 'elite' },
      { id: d.boss, level: lv + 3, boss: true },
    ],
  ];
}

const MAT: Partial<Record<TrialKind, MaterialId>> = {
  tomes: 'xpTome',
  dust: 'starDust',
  ore: 'ore',
  books: 'skillBook',
  stones: 'awakenStone',
};

/** Награда за победу: растёт с уровнем; небольшой разброс от RNG сейва. */
export function trialReward(kind: TrialKind, level: number): ShopReward {
  const L = level;
  switch (kind) {
    case 'tomes':
      return { materials: { xpTome: 3 + L * 2 } };
    case 'dust':
      return { materials: { starDust: 6 + L * 4 } };
    case 'ore':
      return { materials: { ore: 20 + L * 12 } };
    case 'books':
      return { materials: { skillBook: 1 + Math.floor(L / 3) } };
    case 'stones':
      return { materials: { awakenStone: 1 + Math.floor(L / 2) } };
    case 'gold':
      return { gold: 10_000 + L * 8_000 };
  }
}

export function beginTrial(
  save: SaveData,
  kind: TrialKind,
  level: number,
  now = Date.now(),
): { seed: number } | 'noAttempts' | 'locked' | 'closed' {
  roll(save, now);
  if (!trialToday(now).includes(kind)) return 'closed';
  if (!trialUnlocked(save, kind, level)) return 'locked';
  if (trialAttemptsLeft(save, now) <= 0) return 'noAttempts';
  return { seed: hashSeed(`${save.saveId}:trial:${save.trial.day}:${kind}:${level}:${save.trial.used}`) };
}

/** Итог: победа тратит попытку, даёт награду и открывает следующий уровень. Поражение попытку не тратит. */
export function finishTrial(
  save: SaveData,
  kind: TrialKind,
  level: number,
  won: boolean,
  now = Date.now(),
): ShopReward | null {
  roll(save, now);
  if (!won) return null;
  save.trial.used += 1;
  save.trial.best[kind] = Math.max(save.trial.best[kind] ?? 0, level);
  const r = trialReward(kind, level);
  // Удачная добыча: каждый 4-й раз в среднем +50%.
  const rng = new Rng(hashSeed(`${save.saveId}:trialbonus:${save.trial.day}:${save.trial.used}`));
  if (rng.next() < 0.25) {
    if (r.gold) r.gold = Math.round(r.gold * 1.5);
    for (const k of Object.keys(r.materials ?? {}) as MaterialId[])
      r.materials![k] = Math.ceil(r.materials![k]! * 1.5);
  }
  grantReward(save, r, now);
  return r;
}

export function trialMaterial(kind: TrialKind): MaterialId | null {
  return MAT[kind] ?? null;
}
