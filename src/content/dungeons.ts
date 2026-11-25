import type { Rarity } from '@/core/types';
import type { MaterialId } from '@/save/schema';
import type { SetId } from './gear';
import type { StageEnemy } from './campaign';

export type DungeonId = 'crypt' | 'starcave' | 'forgevault';

export interface DungeonDef {
  id: DungeonId;
  name: string;
  desc: string;
  scene: 'mist' | 'cathedral' | 'forge';
  minions: [string, string];
  boss: string;
  /** Что падает: снаряжение каких сетов или какие материалы. */
  gearSets?: SetId[];
  materials?: Partial<Record<MaterialId, [number, number]>>;
}

export const DUNGEON_LEVELS = 10;

export const DUNGEONS: DungeonDef[] = [
  {
    id: 'crypt',
    name: 'Склеп снаряжения',
    desc: 'Затопленный склеп рыцарей. Здесь находят оружие и доспехи всех сетов.',
    scene: 'cathedral',
    minions: ['drowned', 'eel'],
    boss: 'abbess',
    gearSets: ['fury', 'bulwark', 'life', 'swift', 'precision', 'warding'],
  },
  {
    id: 'starcave',
    name: 'Звёздная пещера',
    desc: 'Сюда падают крупицы расколотого солнца. Звёздная пыль и тома опыта.',
    scene: 'mist',
    minions: ['wraith', 'hound'],
    boss: 'colossus',
    materials: { starDust: [6, 14], xpTome: [1, 3] },
  },
  {
    id: 'forgevault',
    name: 'Хранилище горнила',
    desc: 'Сокровищница демонов. Камни пробуждения и редкие свитки призыва.',
    scene: 'forge',
    minions: ['imp', 'golem'],
    boss: 'emberlord',
    materials: { awakenStone: [1, 3], scroll: [0, 1] },
  },
];

export function dungeonDef(id: DungeonId): DungeonDef {
  return DUNGEONS.find((d) => d.id === id)!;
}

export function dungeonEnemyLevel(level: number): number {
  return 4 + level * 5;
}

export function dungeonEnergy(level: number): number {
  return 8 + Math.floor(level / 2) * 2;
}

/** Волны уровня подземелья: две волны прислужников и босс. */
export function dungeonWaves(d: DungeonDef, level: number): StageEnemy[][] {
  const lv = dungeonEnemyLevel(level);
  const n = level < 4 ? 3 : 4;
  // Во второй волне один элитный враг; с 5-го уровня элита стоит и рядом с боссом.
  const wave = (k: number): StageEnemy[] =>
    Array.from({ length: n }, (_, i) => ({
      id: d.minions[(i + k) % 2]!,
      level: lv,
      tier: k === 1 && i === 0 ? ('elite' as const) : ('normal' as const),
    }));
  const guard = level >= 5 ? ('elite' as const) : ('normal' as const);
  return [
    wave(0),
    wave(1),
    [
      { id: d.minions[0], level: lv, tier: guard },
      { id: d.boss, level: lv + 2, boss: true },
      { id: d.minions[1], level: lv, tier: guard },
    ],
  ];
}

/** Шансы редкости снаряжения по уровню подземелья (1..10). */
export function gearRarityWeights(level: number): Record<Rarity, number> {
  const t = (level - 1) / (DUNGEON_LEVELS - 1);
  return {
    common: Math.max(0, 70 - 70 * t),
    rare: 25 + 5 * t,
    epic: 5 + 45 * t,
    legendary: 20 * t * t + 0.5,
  };
}
