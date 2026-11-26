import { Rng } from '@/core/rng';
import { HEROES } from '@/content/heroes';
import { SCROLLS, scrollDef, type ScrollDef, type ScrollId } from '@/content/scrolls';
import { HERO_RARITY_ORDER, type Faction, type HeroRarity } from '@/core/types';
import type { HeroDef } from '@/core/content';
import type { OwnedHero, SaveData } from '@/save/schema';
import { addHero } from './heroes';

/** Шансы редкости обычного призыва (свиток призыва и осколки). */
export const SUMMON_RATES = scrollDef('basic').rates as Record<
  'common' | 'rare' | 'epic' | 'legendary',
  number
>;
/** Жёсткая гарантия: легендарный не позже этого призыва (обычный пул). */
export const PITY_LEGENDARY = 60;
/** Эпический или лучше хотя бы раз за столько призывов. */
export const PITY_EPIC = 10;
/** С этого призыва шанс легендарного растёт на +2% за призыв (мягкая гарантия). */
export const SOFT_PITY_FROM = 45;

export const SUMMON_COST = { shards: 100, shards10: 900, scroll: 1 };

/** Чем платить: осколками (обычный пул) или свитком. 'scroll' — то же, что 'basic'. */
export type SummonPay = 'shards' | 'scroll' | ScrollId;

export interface SummonResult {
  heroes: OwnedHero[];
  rarities: HeroRarity[];
}

const rank = (r: HeroRarity) => HERO_RARITY_ORDER.indexOf(r);

function rollBasic(rng: Rng, sinceLegendary: number, sinceEpic: number): HeroRarity {
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

function rollScroll(rng: Rng, def: ScrollDef, since: number, sinceEpic: number): HeroRarity {
  if (since + 1 >= def.pity.at) return def.pity.rarity;
  const r = rng.weighted(
    (Object.entries(def.rates) as [HeroRarity, number][]).map(([item, weight]) => ({ item, weight })),
  );
  if (def.epicEvery && sinceEpic + 1 >= def.epicEvery && rank(r) < rank('epic')) return 'epic';
  return r;
}

/** Герои, которые могут выпасть из свитка. */
export function scrollPool(id: ScrollId, faction?: Faction): HeroDef[] {
  const def = scrollDef(id);
  return HEROES.filter((h) => def.pool(h, faction));
}

/** Герой нужной редкости из пула; если такой редкости в пуле нет — ближайшая ниже, затем выше. */
function pickHero(rng: Rng, pool: HeroDef[], r: HeroRarity): HeroDef {
  const order = [...HERO_RARITY_ORDER];
  const i = order.indexOf(r);
  const tries = [r, ...order.slice(0, i).reverse(), ...order.slice(i + 1)];
  for (const t of tries) {
    const list = pool.filter((h) => h.rarity === t);
    if (list.length) return rng.pick(list);
  }
  return rng.pick(pool);
}

export type SummonError = 'noShards' | 'noScrolls' | 'noFaction';

/** Сколько призывов осталось до гарантии лучшей редкости свитка. */
export function pityLeft(save: SaveData, id: ScrollId): number {
  const def = scrollDef(id);
  const since = id === 'basic' ? save.summon.sinceLegendary : (save.summon.pity[id] ?? 0);
  return Math.max(1, def.pity.at - since);
}

/** Призыв count героев. Детерминирован через RNG в сейве. */
export function summon(
  save: SaveData,
  count: 1 | 10,
  pay: SummonPay,
  now = Date.now(),
  opts: { faction?: Faction } = {},
): SummonResult | SummonError {
  const id: ScrollId = pay === 'shards' || pay === 'scroll' ? 'basic' : pay;
  const def = scrollDef(id);
  if (def.chooseFaction && !opts.faction) return 'noFaction';
  const pool = HEROES.filter((h) => def.pool(h, opts.faction));
  if (!pool.length) return 'noFaction';
  if (pay === 'shards') {
    const price = count === 10 ? SUMMON_COST.shards10 : SUMMON_COST.shards;
    if (save.currencies.shards < price) return 'noShards';
    save.currencies.shards -= price;
  } else {
    if (save.materials[def.material] < count) return 'noScrolls';
    save.materials[def.material] -= count;
  }
  const rng = Rng.fromState(save.summon.rng);
  const out: SummonResult = { heroes: [], rarities: [] };
  for (let i = 0; i < count; i++) {
    let rarity: HeroRarity;
    if (id === 'basic') {
      rarity = rollBasic(rng, save.summon.sinceLegendary, save.summon.sinceEpic);
      save.summon.sinceLegendary = rarity === 'legendary' ? 0 : save.summon.sinceLegendary + 1;
      save.summon.sinceEpic = rank(rarity) >= rank('epic') ? 0 : save.summon.sinceEpic + 1;
    } else {
      const since = save.summon.pity[id] ?? 0;
      const sinceEpic = save.summon.epicPity[id] ?? 0;
      rarity = rollScroll(rng, def, since, sinceEpic);
      save.summon.pity[id] = rank(rarity) >= rank(def.pity.rarity) ? 0 : since + 1;
      if (def.epicEvery) save.summon.epicPity[id] = rank(rarity) >= rank('epic') ? 0 : sinceEpic + 1;
    }
    const hero = pickHero(rng, pool, rarity);
    out.heroes.push(addHero(save, hero.id, now));
    out.rarities.push(hero.rarity);
    save.summon.total += 1;
  }
  save.summon.rng = rng.state;
  return out;
}

/** Шанс получить именно этого героя за один призыв из свитка (без учёта гарантий). */
export function heroChance(h: HeroDef, id: ScrollId, faction?: Faction): number {
  const def = scrollDef(id);
  const fac = def.chooseFaction ? (faction ?? h.faction) : undefined;
  if (!def.pool(h, fac)) return 0;
  const same = HEROES.filter((x) => def.pool(x, fac) && x.rarity === h.rarity).length;
  return (def.rates[h.rarity] ?? 0) / Math.max(1, same);
}

/** Из каких свитков выпадает герой и с каким шансом. */
export function heroSources(h: HeroDef): { id: ScrollId; chance: number }[] {
  return SCROLLS.map((s) => ({ id: s.id, chance: heroChance(h, s.id) })).filter((x) => x.chance > 0);
}
