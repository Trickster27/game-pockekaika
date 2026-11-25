import { Rng, hashSeed } from '@/core/rng';
import type { BattleResult } from '@/core/battle';
import type { StageEnemy } from '@/content/campaign';
import type { MaterialId, SaveData } from '@/save/schema';
import { grantReward, type ShopReward } from './shop';

const MINIONS = ['wraith', 'hound', 'drowned', 'eel', 'imp', 'golem'];
const BOSSES = ['colossus', 'abbess', 'emberlord'];
const SCENES = ['mist', 'cathedral', 'forge'] as const;

export function towerLevel(floor: number): number {
  return 3 + Math.round(floor * 1.7);
}

export function towerScene(floor: number) {
  return SCENES[Math.floor((floor - 1) / 10) % 3]!;
}

/** Состав этажа: детерминирован номером этажа. Каждый 5-й этаж — босс. */
export function towerWaves(floor: number): StageEnemy[][] {
  const rng = new Rng(hashSeed(`tower:${floor}`));
  const lv = towerLevel(floor);
  const waveCount = floor < 10 ? 2 : 3;
  const size = Math.min(5, 3 + Math.floor(floor / 15));
  const waves: StageEnemy[][] = [];
  for (let w = 0; w < waveCount; w++) {
    const last = w === waveCount - 1;
    if (last && floor % 5 === 0) {
      waves.push([
        { id: rng.pick(MINIONS), level: lv },
        { id: rng.pick(BOSSES), level: lv + 2, boss: true },
        { id: rng.pick(MINIONS), level: lv },
      ]);
    } else waves.push(Array.from({ length: size }, () => ({ id: rng.pick(MINIONS), level: lv })));
  }
  return waves;
}

/** Награда за этаж; каждые 10 этажей — крупный сундук. */
export function towerReward(floor: number): ShopReward {
  const r: ShopReward = { gold: 250 + 60 * floor };
  if (floor % 10 === 0) {
    const tier = floor / 10;
    r.shards = 60 + 15 * tier;
    const m: Partial<Record<MaterialId, number>> = { scroll: 1, starDust: 10 + 2 * tier };
    if (tier >= 2) m.awakenStone = 1 + Math.floor(tier / 2);
    r.materials = m;
  }
  return r;
}

/** Применяет результат этажа. Награда только за первое прохождение следующего этажа. */
export function applyTowerResult(
  save: SaveData,
  floor: number,
  result: BattleResult,
  now = Date.now(),
): ShopReward | null {
  if (result.winner !== 'ally') {
    save.stats.battlesLost += 1;
    return null;
  }
  save.stats.battlesWon += 1;
  if (floor !== save.tower.floor + 1) return null;
  save.tower.floor = floor;
  const r = towerReward(floor);
  grantReward(save, r, now);
  return r;
}
