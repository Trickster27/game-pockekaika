import { Rng } from '@/core/rng';
import type { Rarity, Role } from '@/core/types';
import { RARITY_INDEX, SETS, SLOTS, SUB_ROLL, type GearStat, type Slot } from '@/content/gear';
import { heroDef } from '@/content';
import type { Item, SaveData } from '@/save/schema';
import { equip, mainValue, setCounts } from './gear';
import { salvageValue } from './forge';

/**
 * Глубина снаряжения — по мотивам лучших игр жанра:
 * - оценка предмета по доп. характеристикам и качество каждого «срабатывания»;
 * - перековка одной доп. характеристики на предмет (+12 и выше);
 * - замок от продажи и разбора, массовый разбор по фильтру;
 * - подбор лучшего снаряжения под роль героя с учётом бонусов сетов.
 */

/** Насколько стат ценен «в среднем»: плоские прибавки слабее процентных. */
const STAT_WEIGHT: Record<GearStat, number> = {
  hp: 0.4,
  atk: 0.4,
  def: 0.4,
  hpPct: 1,
  atkPct: 1,
  defPct: 1,
  spd: 1.2,
  critRate: 1,
  critDmg: 1,
  acc: 0.8,
  res: 0.8,
};

const maxRoll = (stat: GearStat) => SUB_ROLL[stat]?.[1] ?? 1;

/** Качество доп. характеристики: 0..1, где 1 — каждое срабатывание выпало максимальным. */
export function subQuality(sub: Item['subs'][number]): number {
  const st = sub.stat as GearStat;
  const [lo, hi] = SUB_ROLL[st] ?? [0, 1];
  const per = sub.value / Math.max(1, sub.rolls);
  return Math.max(0, Math.min(1, (per - lo) / Math.max(1e-9, hi - lo)));
}

/**
 * Оценка предмета: сумма доп. характеристик в «максимальных срабатываниях» с весами.
 * Максимум для легендарного +15: 4 характеристики и 8 срабатываний ≈ 80–95.
 */
export function itemScore(item: Item): number {
  let s = 0;
  for (const sub of item.subs)
    s += (sub.value / maxRoll(sub.stat as GearStat)) * 10 * STAT_WEIGHT[sub.stat as GearStat];
  return Math.round(s);
}

// ———————————————————— замок, перековка, массовый разбор ————————————————————

export function toggleLock(save: SaveData, uid: string): boolean | null {
  const it = save.items.find((i) => i.uid === uid);
  if (!it) return null;
  it.locked = !it.locked;
  return it.locked;
}

export const REFORGE_MIN_LEVEL = 12;
export function reforgeCost(item: Item) {
  const r = RARITY_INDEX[item.rarity];
  return { gold: 15_000 * (1 + r), ore: 40 * (1 + r) };
}
export type ReforgeError = 'notFound' | 'level' | 'already' | 'noGold' | 'noOre' | 'badSub';

export function canReforge(item: Item): boolean {
  return item.level >= REFORGE_MIN_LEVEL && !item.subs.some((s) => s.reforged);
}

/**
 * Перековка: выбранная доп. характеристика меняется на новую (которой ещё нет на предмете),
 * число срабатываний сохраняется, значения выпадают заново. Одна перековка на предмет.
 */
export function reforgeSub(save: SaveData, uid: string, subIndex: number): Item | ReforgeError {
  const item = save.items.find((i) => i.uid === uid);
  if (!item) return 'notFound';
  if (item.level < REFORGE_MIN_LEVEL) return 'level';
  if (item.subs.some((s) => s.reforged)) return 'already';
  const sub = item.subs[subIndex];
  if (!sub) return 'badSub';
  const cost = reforgeCost(item);
  if (save.currencies.gold < cost.gold) return 'noGold';
  if (save.materials.ore < cost.ore) return 'noOre';
  save.currencies.gold -= cost.gold;
  save.materials.ore -= cost.ore;
  const rng = Rng.fromState(save.gearRng);
  const taken = new Set([item.main, ...item.subs.map((s) => s.stat)]);
  const pool = (Object.keys(SUB_ROLL) as GearStat[]).filter((s) => !taken.has(s));
  const stat = rng.pick(pool);
  const [a, b] = SUB_ROLL[stat];
  let value = 0;
  for (let i = 0; i < sub.rolls; i++) value += a + (b - a) * rng.next();
  item.subs[subIndex] = { stat, value, rolls: sub.rolls, reforged: true };
  save.gearRng = rng.state;
  return item;
}

export interface MassFilter {
  /** Разбирать предметы этой редкости и ниже. */
  maxRarity: Rarity;
  /** Только не улучшенные выше этого уровня. */
  maxLevel: number;
  /** Не трогать предметы с оценкой не ниже этой (0 — не учитывать). */
  keepScore: number;
}

/** Что попадёт под массовый разбор: только свободные и не под замком. */
export function massSalvagePreview(save: SaveData, f: MassFilter) {
  const items = save.items.filter(
    (i) =>
      !i.heroUid &&
      !i.locked &&
      RARITY_INDEX[i.rarity] <= RARITY_INDEX[f.maxRarity] &&
      i.level <= f.maxLevel &&
      (f.keepScore <= 0 || itemScore(i) < f.keepScore),
  );
  return { items, ore: items.reduce((a, i) => a + salvageValue(i), 0) };
}

export function massSalvage(save: SaveData, f: MassFilter): { count: number; ore: number } {
  const { items, ore } = massSalvagePreview(save, f);
  const drop = new Set(items.map((i) => i.uid));
  save.items = save.items.filter((i) => !drop.has(i.uid));
  save.materials.ore += ore;
  return { count: items.length, ore };
}

// ———————————————————— подбор под роль ————————————————————

/** Что важно каждой роли (вес стата при подборе). */
export const ROLE_WEIGHTS: Record<Role, Partial<Record<GearStat, number>>> = {
  attacker: { atkPct: 1.2, atk: 0.5, critRate: 1.2, critDmg: 1.1, spd: 1, acc: 0.3, hpPct: 0.3 },
  defender: { defPct: 1.2, def: 0.5, hpPct: 1, hp: 0.4, spd: 0.8, res: 0.6, acc: 0.4 },
  healer: { hpPct: 1.2, hp: 0.5, spd: 1.2, defPct: 0.7, res: 0.6 },
  support: { spd: 1.3, acc: 1.1, hpPct: 0.8, defPct: 0.6, res: 0.6, atkPct: 0.3 },
};

/** Ценность предмета для набора весов: основная и доп. характеристики. */
export function itemValueFor(item: Item, w: Partial<Record<GearStat, number>>): number {
  const main = item.main as GearStat;
  let v = ((w[main] ?? 0) * mainValue(item)) / maxRoll(main);
  for (const s of item.subs) v += ((w[s.stat as GearStat] ?? 0) * s.value) / maxRoll(s.stat as GearStat);
  return v;
}

function setValue(items: Item[], w: Partial<Record<GearStat, number>>): number {
  let v = 0;
  for (const [id, n] of setCounts(items)) {
    const set = SETS.find((s) => s.id === id);
    if (!set) continue;
    const add = (b: Partial<Record<GearStat, number>>) => {
      for (const [k, x] of Object.entries(b) as [GearStat, number][]) v += ((w[k] ?? 0) * x) / maxRoll(k);
    };
    if (n >= 2) add(set.two);
    if (n >= 4) add(set.four);
  }
  return v;
}

/**
 * Лучший набор для героя из свободных предметов и уже надетых на него.
 * Перебирает: просто лучшие по слотам; для каждого сета — 4 предмета сета + 2 лучших;
 * для каждого сета — 2 предмета сета + 4 лучших. Выбирает набор с максимальной ценностью.
 */
export function bestGearFor(save: SaveData, heroUid: string): Map<Slot, Item> {
  const hero = save.heroes.find((h) => h.uid === heroUid);
  if (!hero) return new Map();
  const w = ROLE_WEIGHTS[heroDef(hero.heroId).role];
  const pool = save.items.filter((i) => i.heroUid === null || i.heroUid === heroUid);
  const bySlot = new Map<Slot, Item[]>(
    SLOTS.map((s) => [
      s,
      pool.filter((i) => i.slot === s).sort((a, b) => itemValueFor(b, w) - itemValueFor(a, w)),
    ]),
  );
  const total = (m: Map<Slot, Item>) => {
    const list = [...m.values()];
    return list.reduce((a, i) => a + itemValueFor(i, w), 0) + setValue(list, w);
  };
  const greedy = (fixed: Map<Slot, Item>) => {
    const m = new Map(fixed);
    for (const s of SLOTS) if (!m.has(s) && bySlot.get(s)![0]) m.set(s, bySlot.get(s)![0]!);
    return m;
  };
  let best = greedy(new Map());
  let bestV = total(best);
  for (const set of SETS) {
    for (const need of [4, 2]) {
      // Лучшие предметы сета по слотам, берём `need` самых ценных слотов.
      const options = SLOTS.map((s) => bySlot.get(s)!.find((i) => i.set === set.id))
        .filter((i): i is Item => !!i)
        .sort((a, b) => itemValueFor(b, w) - itemValueFor(a, w));
      if (options.length < need) continue;
      const fixed = new Map<Slot, Item>(options.slice(0, need).map((i) => [i.slot as Slot, i]));
      const m = greedy(fixed);
      const v = total(m);
      if (v > bestV) {
        best = m;
        bestV = v;
      }
    }
  }
  return best;
}

/** Надевает подобранный набор. Возвращает, сколько слотов поменялось. */
export function autoEquip(save: SaveData, heroUid: string): number {
  const best = bestGearFor(save, heroUid);
  let changed = 0;
  for (const [, item] of best) {
    if (item.heroUid === heroUid) continue;
    if (equip(save, item.uid, heroUid)) changed++;
  }
  return changed;
}
