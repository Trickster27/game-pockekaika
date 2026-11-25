import { Rng } from '@/core/rng';
import type { BattleResult } from '@/core/battle';
import type { Rarity } from '@/core/types';
import { dungeonDef, gearRarityWeights, type DungeonId } from '@/content/dungeons';
import type { SetId } from '@/content/gear';
import type { Item, MaterialId, SaveData } from '@/save/schema';
import { generateItem, INVENTORY_LIMIT } from './gear';
import { addPlayerXp } from './progression';

export function isDungeonLevelUnlocked(save: SaveData, id: DungeonId, level: number): boolean {
  return level <= (save.dungeons[id] ?? 0) + 1;
}

export interface DungeonDrop {
  items: Item[];
  materials: Partial<Record<MaterialId, number>>;
  gold: number;
  firstClear: boolean;
}

/** Награда за победу в подземелье. Выпадение детерминировано RNG в сейве. */
export function applyDungeonResult(
  save: SaveData,
  id: DungeonId,
  level: number,
  result: BattleResult,
): DungeonDrop {
  const drop: DungeonDrop = { items: [], materials: {}, gold: 0, firstClear: false };
  if (result.winner !== 'ally') {
    save.stats.battlesLost += 1;
    return drop;
  }
  save.stats.battlesWon += 1;
  const d = dungeonDef(id);
  const rng = Rng.fromState(save.gearRng);
  drop.gold = 400 + 220 * level;
  save.currencies.gold += drop.gold;
  if (d.gearSets) {
    const w = gearRarityWeights(level);
    const count = rng.chance(0.25 + level * 0.04) ? 2 : 1;
    for (let i = 0; i < count && save.items.length < INVENTORY_LIMIT; i++) {
      const rarity = rng.weighted(
        (Object.entries(w) as [Rarity, number][]).map(([item, weight]) => ({ item, weight })),
      );
      const item = generateItem(save, rng, { set: rng.pick(d.gearSets) as SetId, rarity });
      save.items.push(item);
      drop.items.push(item);
    }
  }
  for (const [m, range] of Object.entries(d.materials ?? {}) as [MaterialId, [number, number]][]) {
    const n = Math.round((range[0] + (range[1] - range[0]) * rng.next()) * (1 + (level - 1) * 0.15));
    if (n > 0) {
      save.materials[m] += n;
      drop.materials[m] = n;
    }
  }
  save.gearRng = rng.state;
  const prev = save.dungeons[id] ?? 0;
  if (level > prev) {
    save.dungeons[id] = level;
    drop.firstClear = true;
    save.currencies.shards += 20;
  }
  addPlayerXp(save, 10 + level * 4);
  return drop;
}
