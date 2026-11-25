import { Rng } from '@/core/rng';
import { HEROES } from '@/content/heroes';
import type { Rarity } from '@/core/types';
import type { OwnedHero, SaveData } from '@/save/schema';
import { addHero } from './heroes';

/** Шансы редкости (в сумме 1). */
export const SUMMON_RATES: Record<Rarity, number> = { common: 0.5, rare: 0.32, epic: 0.14, legendary: 0.04 };
/** Жёсткая гарантия: легендарный не позже этого призыва. */
export const PITY_LEGENDARY = 60;
/** Эпический или лучше хотя бы раз за столько призывов. */
export const PITY_EPIC = 10;
/** С этого призыва шанс легендарного растёт на +2% за призыв (мягкая гарантия). */
export const SOFT_PITY_FROM = 45;

export const SUMMON_COST = { shards: 100, shards10: 900, scroll: 1 };

export type SummonPay = 'shards' | 'scroll';

export interface SummonResult {
  heroes: OwnedHero[];
  rarities: Rarity[];
}

function rollRarity(rng: Rng, sinceLegendary: number, sinceEpic: number): Rarity {
  if (sinceLegendary + 1 >= PITY_LEGENDARY) return 'legendary';
  const soft = sinceLegendary + 1 >= SOFT_PITY_FROM ? (sinceLegendary + 1 - SOFT_PITY_FROM + 1) * 0.02 : 0;
  const leg = SUMMON_RATES.legendary + soft;
  const roll = rng.next();
  if (roll < leg) return 'legendary';
  if (sinceEpic + 1 >= PITY_EPIC) return 'epic';
  if (roll < leg + SUMMON_RATES.epic) return 'epic';
  if (roll < leg + SUMMON_RATES.epic + SUMMON_RATES.rare) return 'rare';
  return 'common';
}

export type SummonError = 'noShards' | 'noScrolls';

/** Призыв count героев. Оплата: осколки (10 за 900) или свитки. Детерминирован через RNG в сейве. */
export function summon(
  save: SaveData,
  count: 1 | 10,
  pay: SummonPay,
  now = Date.now(),
): SummonResult | SummonError {
  if (pay === 'shards') {
    const price = count === 10 ? SUMMON_COST.shards10 : SUMMON_COST.shards;
    if (save.currencies.shards < price) return 'noShards';
    save.currencies.shards -= price;
  } else {
    if (save.materials.scroll < count * SUMMON_COST.scroll) return 'noScrolls';
    save.materials.scroll -= count * SUMMON_COST.scroll;
  }
  const rng = Rng.fromState(save.summon.rng);
  const out: SummonResult = { heroes: [], rarities: [] };
  for (let i = 0; i < count; i++) {
    const rarity = rollRarity(rng, save.summon.sinceLegendary, save.summon.sinceEpic);
    const pool = HEROES.filter((h) => h.rarity === rarity);
    const def = rng.pick(pool);
    out.heroes.push(addHero(save, def.id, now));
    out.rarities.push(rarity);
    save.summon.total += 1;
    save.summon.sinceLegendary = rarity === 'legendary' ? 0 : save.summon.sinceLegendary + 1;
    save.summon.sinceEpic = rarity === 'legendary' || rarity === 'epic' ? 0 : save.summon.sinceEpic + 1;
  }
  save.summon.rng = rng.state;
  return out;
}
