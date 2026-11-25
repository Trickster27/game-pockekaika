import { Rng } from '@/core/rng';
import type { Rarity, Stats } from '@/core/types';
import {
  MAIN_VALUE,
  RARITY_INDEX,
  SETS,
  SLOT_MAIN,
  SLOTS,
  STAT_TARGET,
  SUB_ROLL,
  type GearStat,
  type SetId,
  type Slot,
} from '@/content/gear';
import type { Item, SaveData } from '@/save/schema';

export const MAX_ITEM_LEVEL = 15;
export const INVENTORY_LIMIT = 300;
const ALL_SUBS = Object.keys(SUB_ROLL) as GearStat[];

export function mainValue(item: Pick<Item, 'main' | 'rarity' | 'level'>): number {
  const m = MAIN_VALUE[item.main as GearStat];
  if (!m) return 0;
  return (m.base[RARITY_INDEX[item.rarity]] ?? 0) * (1 + m.perLevel * item.level);
}

function rollSub(rng: Rng, stat: GearStat): number {
  const [a, b] = SUB_ROLL[stat];
  return a + (b - a) * rng.next();
}

function pickNewSub(rng: Rng, item: Item): GearStat {
  const taken = new Set<string>([item.main, ...item.subs.map((s) => s.stat)]);
  return rng.pick(ALL_SUBS.filter((s) => !taken.has(s)));
}

/** Создаёт предмет. Кол-во стартовых доп. характеристик = индекс редкости (0..3). */
export function generateItem(save: SaveData, rng: Rng, o: { slot?: Slot; set: SetId; rarity: Rarity }): Item {
  const slot = o.slot ?? rng.pick(SLOTS);
  const item: Item = {
    uid: `i${save.seq++}`,
    slot,
    set: o.set,
    rarity: o.rarity,
    level: 0,
    main: rng.pick(SLOT_MAIN[slot]),
    subs: [],
    heroUid: null,
    locked: false,
  };
  for (let i = 0; i < RARITY_INDEX[o.rarity]; i++) {
    const stat = pickNewSub(rng, item);
    item.subs.push({ stat, value: rollSub(rng, stat), rolls: 1 });
  }
  return item;
}

export function upgradeCost(item: Item): number {
  return Math.round((90 + 55 * item.level) * (1 + RARITY_INDEX[item.rarity] * 0.6));
}

export function sellPrice(item: Item): number {
  return Math.round(80 * (1 + RARITY_INDEX[item.rarity]) * (1 + item.level * 0.3));
}

export type GearError = 'notFound' | 'maxLevel' | 'noGold' | 'full' | 'locked';

/** Улучшение +1. На +3/+6/+9/+12 добавляется новая доп. характеристика или растёт одна из имеющихся. */
export function upgradeItem(save: SaveData, uid: string): Item | GearError {
  const item = save.items.find((i) => i.uid === uid);
  if (!item) return 'notFound';
  if (item.level >= MAX_ITEM_LEVEL) return 'maxLevel';
  const cost = upgradeCost(item);
  if (save.currencies.gold < cost) return 'noGold';
  save.currencies.gold -= cost;
  item.level += 1;
  if (item.level % 3 === 0 && item.level <= 12) {
    const rng = Rng.fromState(save.gearRng);
    if (item.subs.length < 4) {
      const stat = pickNewSub(rng, item);
      item.subs.push({ stat, value: rollSub(rng, stat), rolls: 1 });
    } else {
      const sub = rng.pick(item.subs);
      sub.value += rollSub(rng, sub.stat as GearStat);
      sub.rolls += 1;
    }
    save.gearRng = rng.state;
  }
  return item;
}

export function sellItem(save: SaveData, uid: string): number | GearError {
  const item = save.items.find((i) => i.uid === uid);
  if (!item) return 'notFound';
  if (item.locked) return 'locked';
  const price = sellPrice(item);
  save.items = save.items.filter((i) => i !== item);
  save.currencies.gold += price;
  return price;
}

/** Надеть предмет на героя: старый предмет из этого слота снимается. */
export function equip(save: SaveData, itemUid: string, heroUid: string): boolean {
  const item = save.items.find((i) => i.uid === itemUid);
  if (!item || !save.heroes.some((h) => h.uid === heroUid)) return false;
  for (const i of save.items) if (i.heroUid === heroUid && i.slot === item.slot) i.heroUid = null;
  item.heroUid = heroUid;
  return true;
}

export function unequip(save: SaveData, itemUid: string) {
  const item = save.items.find((i) => i.uid === itemUid);
  if (item) item.heroUid = null;
}

export function heroItems(save: SaveData, heroUid: string): Item[] {
  return save.items.filter((i) => i.heroUid === heroUid);
}

export function setCounts(items: Item[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.set, (m.get(i.set) ?? 0) + 1);
  return m;
}

export interface GearBonus {
  flat: Partial<Stats>;
  pct: Partial<Pick<Stats, 'hp' | 'atk' | 'def'>>;
}

function addStat(b: GearBonus, stat: GearStat, v: number) {
  const t = STAT_TARGET[stat];
  if (t.pct) {
    const k = t.key as 'hp' | 'atk' | 'def';
    b.pct[k] = (b.pct[k] ?? 0) + v;
  } else b.flat[t.key] = (b.flat[t.key] ?? 0) + v;
}

/** Сумма бонусов снаряжения героя: основные, дополнительные характеристики и сеты (2 и 4 предмета). */
export function gearBonus(items: Item[]): GearBonus {
  const b: GearBonus = { flat: {}, pct: {} };
  for (const i of items) {
    addStat(b, i.main as GearStat, mainValue(i));
    for (const s of i.subs) addStat(b, s.stat as GearStat, s.value);
  }
  for (const [setId, n] of setCounts(items)) {
    const set = SETS.find((s) => s.id === setId);
    if (!set) continue;
    if (n >= 2) for (const [k, v] of Object.entries(set.two) as [GearStat, number][]) addStat(b, k, v);
    if (n >= 4) for (const [k, v] of Object.entries(set.four) as [GearStat, number][]) addStat(b, k, v);
  }
  // Целые значения для плоских характеристик (кроме шансов).
  for (const k of ['hp', 'atk', 'def', 'spd', 'acc', 'res'] as const)
    if (b.flat[k] !== undefined) b.flat[k] = Math.round(b.flat[k]!);
  return b;
}

/** Применить бонус к характеристикам (для отображения и расчёта силы). */
export function applyGear(stats: Stats, b: GearBonus): Stats {
  const out = { ...stats };
  for (const k of ['hp', 'atk', 'def'] as const) out[k] = Math.round(out[k] * (1 + (b.pct[k] ?? 0)));
  for (const [k, v] of Object.entries(b.flat) as [keyof Stats, number][]) out[k] += v;
  return out;
}
