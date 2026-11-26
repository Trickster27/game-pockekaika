import { Rng } from '@/core/rng';
import type { Rarity } from '@/core/types';
import { SETS, SKY_SETS, SLOTS, type SetId, type Slot } from '@/content/gear';
import type { Item, SaveData } from '@/save/schema';
import { generateItem, INVENTORY_LIMIT } from './gear';

/** Цена создания предмета в Кузне. */
export const CRAFT_COST: Record<Rarity, { gold: number; ore: number }> = {
  common: { gold: 2000, ore: 15 },
  rare: { gold: 6000, ore: 40 },
  epic: { gold: 18000, ore: 110 },
  legendary: { gold: 50000, ore: 300 },
};

const SALVAGE_ORE: Record<Rarity, number> = { common: 4, rare: 10, epic: 24, legendary: 60 };

export type ForgeError = 'noGold' | 'noOre' | 'full' | 'notFound' | 'locked';

/** Создать предмет выбранного слота, сета и редкости. Основная и доп. характеристики — случайные. */
export function craftItem(save: SaveData, slot: Slot, set: SetId, rarity: Rarity): Item | ForgeError {
  const cost = CRAFT_COST[rarity];
  if (save.items.length >= INVENTORY_LIMIT) return 'full';
  if (save.currencies.gold < cost.gold) return 'noGold';
  if (save.materials.ore < cost.ore) return 'noOre';
  save.currencies.gold -= cost.gold;
  save.materials.ore -= cost.ore;
  const rng = Rng.fromState(save.gearRng);
  const item = generateItem(save, rng, { slot, set, rarity });
  save.gearRng = rng.state;
  save.items.push(item);
  return item;
}

/** Сколько руды даст разбор: зависит от редкости и уровня улучшения. */
export function salvageValue(item: Item): number {
  return Math.round(SALVAGE_ORE[item.rarity] * (1 + item.level * 0.15));
}

export function salvageItem(save: SaveData, uid: string): number | ForgeError {
  const item = save.items.find((i) => i.uid === uid);
  if (!item) return 'notFound';
  if (item.locked) return 'locked';
  const ore = salvageValue(item);
  save.items = save.items.filter((i) => i !== item);
  save.materials.ore += ore;
  return ore;
}

export type RarityWeights = Record<Rarity, number>;

/** Случайный предмет-трофей. Возвращает null, если не выпал или сумка полна. */
export function rollGearDrop(save: SaveData, weights: RarityWeights, chance: number): Item | null {
  const rng = Rng.fromState(save.gearRng);
  let item: Item | null = null;
  if (rng.chance(chance) && save.items.length < INVENTORY_LIMIT) {
    const rarity = rng.weighted(
      (Object.entries(weights) as [Rarity, number][]).map(([r, w]) => ({ item: r, weight: w })),
    );
    item = generateItem(save, rng, {
      slot: rng.pick(SLOTS),
      set: rng.pick(SETS.filter((x) => !SKY_SETS.includes(x.id))).id,
      rarity,
    });
    save.items.push(item);
  }
  save.gearRng = rng.state;
  return item;
}

/** Шансы редкости трофеев по главе кампании. */
export function campaignDropWeights(chapter: number): RarityWeights {
  if (chapter <= 1) return { common: 70, rare: 25, epic: 5, legendary: 0 };
  if (chapter === 2) return { common: 40, rare: 40, epic: 17, legendary: 3 };
  return { common: 20, rare: 40, epic: 32, legendary: 8 };
}
