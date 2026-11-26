import type { UnitSpec } from '@/core/battle';
import { ELEMENTS, type Element, type Rarity } from '@/core/types';
import { clanBossId, heroDef } from '@/content';
import { affinity } from '@/core/elements';
import { heroTags } from './synergy';
import { heroPower } from './power';
import type { Item, MaterialId, SaveData } from '@/save/schema';
import { grantReward, periodKey, type ShopReward } from './shop';
import { rollGearDrop } from './forge';

/**
 * Кланы и босс клана — общие правила. Их же повторяют серверные функции
 * (supabase/migrations/0003_clans.sql) и демо-сервер (src/online/clanSim.ts):
 * если меняете число здесь, поменяйте и там (тест clan.test.ts сверяет SQL с этими константами).
 *
 * Что взято у жанра:
 * - общий запас здоровья босса на весь клан и награда всем участникам за убийство (охота гильдии);
 * - 2 ключа в день, бой на время, сундуки по урону за одну попытку (клановый босс);
 * - рост уровня босса после каждого убийства — клан сам выбирает темп (как у химеры);
 * - ежедневная отметка и пожертвования, уровень клана с бонусами, клановый магазин (гильдии);
 * - недельные цели клана и награда лучшим по урону за вчера.
 */
export const CLAN = {
  createCost: 25_000,
  createMinLevel: 5,
  nameMin: 3,
  nameMax: 20,
  tagMin: 2,
  tagMax: 4,
  descMax: 200,
  maxOfficers: 3,
  /** После выхода из клана нельзя вступить в новый столько часов. */
  leaveCooldownH: 4,
  keysPerDay: 2,
  /** Сколько ходов босса длится бой. */
  bossTurns: 30,
  /** Ярость босса: +3% атаки за каждый его ход. */
  enrage: 0.03,
  /** Опыт клана. */
  xp: { checkin: 10, attack: 5, kill: 100 },
  checkinReward: { gold: 2_000, coins: 20 },
  /** Лимит урона за попытку на сервере: max(floor, сила × mult). */
  damageCap: { floor: 60_000, powerMult: 60 },
} as const;

export type ClanRole = 'leader' | 'officer' | 'member';
export type JoinMode = 'open' | 'request' | 'closed';

export const DONATIONS = [
  { id: 'gold', cost: { gold: 20_000 }, xp: 25, coins: 40 },
  { id: 'shards', cost: { shards: 30 }, xp: 60, coins: 90 },
] as const;
export type DonationId = (typeof DONATIONS)[number]['id'];

/** Порог опыта для уровня (индекс = уровень − 1). */
export const CLAN_LEVEL_XP = [0, 300, 800, 1600, 2800, 4500, 7000, 10500, 15000, 21000] as const;
export const CLAN_MAX_LEVEL = CLAN_LEVEL_XP.length;
const MEMBER_CAP = [15, 18, 20, 22, 24, 26, 27, 28, 29, 30] as const;

export function clanLevel(xp: number): { level: number; cur: number; next: number | null } {
  let level = 1;
  for (let i = 0; i < CLAN_LEVEL_XP.length; i++) if (xp >= CLAN_LEVEL_XP[i]!) level = i + 1;
  const next = level < CLAN_MAX_LEVEL ? CLAN_LEVEL_XP[level]! : null;
  return { level, cur: CLAN_LEVEL_XP[level - 1]!, next };
}

/** Бонусы уровня клана. */
export function clanPerks(level: number) {
  const l = Math.max(1, Math.min(CLAN_MAX_LEVEL, level));
  return {
    memberCap: MEMBER_CAP[l - 1]!,
    /** Прибавка к наградам босса и отметки. */
    rewardBonus: (l - 1) * 0.03,
  };
}

// ———————————————————— время ————————————————————

const DAY_MS = 86_400_000;
/** Номер дня по UTC — общий для клиента и сервера. */
export function dayIndex(now: number): number {
  return Math.floor(now / DAY_MS);
}
/** Номер недели (с понедельника по UTC), как periodKey('week'). */
export function weekIndex(day: number): number {
  return Math.floor((day + 3) / 7);
}
export function msToNextDay(now: number): number {
  return (dayIndex(now) + 1) * DAY_MS - now;
}

// ———————————————————— босс ————————————————————

/** Стихия босса на день: шесть стихий по кругу. */
export function bossElement(day: number): Element {
  return ELEMENTS[((day % 6) + 6) % 6]!;
}

/** Запас здоровья босса уровня L: 300 000 × 1.25^(L−1). */
export function bossHp(level: number): number {
  return Math.round(300_000 * Math.pow(1.25, Math.max(0, level - 1)));
}

/** Уровень характеристик босса (атака, защита, скорость). */
export function bossStatLevel(level: number): number {
  return Math.min(100, 4 + 5 * level);
}

export function bossSpec(level: number, element: Element, hpNow: number): UnitSpec {
  return {
    defId: clanBossId(element),
    kind: 'enemy',
    level: bossStatLevel(level),
    boss: true,
    hpMax: bossHp(level),
    hpNow: Math.max(1, hpNow),
    ccImmune: true,
    enrage: CLAN.enrage,
  };
}

export function damageCap(power: number): number {
  return Math.max(CLAN.damageCap.floor, power * CLAN.damageCap.powerMult);
}

// ———————————————————— сундуки за попытку ————————————————————

export const CHEST_TIERS = [
  { id: 'copper', share: 0 },
  { id: 'bronze', share: 0.02 },
  { id: 'silver', share: 0.05 },
  { id: 'gold', share: 0.1 },
  { id: 'mythic', share: 0.18 },
  { id: 'rift', share: 0.3 },
] as const;
export type ChestId = (typeof CHEST_TIERS)[number]['id'];

/** Номер сундука по урону одной попытки (доля от полного здоровья босса этого уровня). */
export function chestTier(damage: number, level: number): number {
  if (damage <= 0) return -1;
  const share = damage / bossHp(level);
  let t = 0;
  for (let i = 0; i < CHEST_TIERS.length; i++) if (share >= CHEST_TIERS[i]!.share) t = i;
  return t;
}

/** Урон до следующего сундука. */
export function nextChestAt(damage: number, level: number): number | null {
  const t = chestTier(damage, level);
  const next = CHEST_TIERS[t + 1];
  return next ? Math.ceil(next.share * bossHp(level)) : null;
}

export interface ClanReward extends ShopReward {
  coins?: number;
  /** Шанс и редкости выпадения предмета. */
  gear?: { chance: number; weights: Record<Rarity, number> };
}

const CHEST_GEAR: Record<number, Record<Rarity, number>> = {
  0: { common: 70, rare: 30, epic: 0, legendary: 0 },
  1: { common: 50, rare: 42, epic: 8, legendary: 0 },
  2: { common: 25, rare: 50, epic: 23, legendary: 2 },
  3: { common: 0, rare: 50, epic: 43, legendary: 7 },
  4: { common: 0, rare: 25, epic: 60, legendary: 15 },
  5: { common: 0, rare: 0, epic: 70, legendary: 30 },
};

/** Содержимое сундука: растёт с номером сундука и уровнем босса, плюс бонус уровня клана. */
export function chestReward(tier: number, bossLevel: number, clanLvl: number): ClanReward {
  const k = (1 + 0.12 * (bossLevel - 1)) * (1 + clanPerks(clanLvl).rewardBonus);
  const t = Math.max(0, tier);
  const m: Partial<Record<MaterialId, number>> = { ore: Math.round((6 + 6 * t) * k) };
  if (t >= 1) m.xpTome = Math.round((1 + t) * Math.min(k, 3));
  if (t >= 2) m.starDust = Math.round((4 + 4 * t) * k);
  if (t >= 4) m.awakenStone = t - 3;
  if (t >= 5) m.scroll = 1;
  return {
    gold: Math.round((3_000 + 3_000 * t) * k),
    coins: Math.round((15 + 15 * t) * k),
    shards: t >= 3 ? Math.round((10 + 10 * (t - 2)) * Math.min(k, 3)) : undefined,
    materials: m,
    gear: { chance: [0.15, 0.3, 0.55, 0.8, 1, 1][t]!, weights: CHEST_GEAR[t]! },
  };
}

/** Награда каждому, кто бил босса этого уровня, когда клан его победил. */
export function killReward(level: number, clanLvl: number): ClanReward {
  const k = 1 + clanPerks(clanLvl).rewardBonus;
  return {
    shards: Math.round((30 + 5 * level) * k),
    coins: Math.round((100 + 20 * level) * k),
    gold: Math.round(10_000 * (1 + 0.15 * level) * k),
    materials: level % 3 === 0 ? { scroll: 1 } : { starDust: 10 + 2 * level },
    gear:
      level >= 3
        ? {
            chance: 1,
            weights: {
              common: 0,
              rare: 0,
              epic: 80 - Math.min(40, 4 * level),
              legendary: 20 + Math.min(40, 4 * level),
            },
          }
        : undefined,
  };
}

/** Награда за место по урону за вчера (среди участников клана). */
export function rankReward(rank: number): ClanReward {
  if (rank === 1) return { coins: 150, shards: 50 };
  if (rank === 2) return { coins: 100, shards: 30 };
  if (rank === 3) return { coins: 70, shards: 20 };
  return { coins: 30 };
}

// ———————————————————— недельные цели ————————————————————

export const WEEKLY_GOALS = [
  { id: 'attacks', steps: [20, 50, 100] },
  { id: 'checkins', steps: [25, 60, 100] },
  { id: 'kills', steps: [1, 3, 6] },
] as const;
export type WeeklyGoalId = (typeof WEEKLY_GOALS)[number]['id'];

export function weeklyReward(step: number): ClanReward {
  return [{ coins: 60 }, { coins: 120, shards: 20 }, { coins: 200, shards: 40, materials: { scroll: 1 } }][
    step
  ]!;
}

// ———————————————————— выдача наград ————————————————————

/** Выдаёт награду в сейв. Клановые монеты лежат в save.clan.coins. */
export function grantClanReward(save: SaveData, r: ClanReward, now = Date.now()): { item?: Item } {
  grantReward(save, r, now);
  if (r.coins) save.clan.coins += r.coins;
  let item: Item | null = null;
  if (r.gear) item = rollGearDrop(save, r.gear.weights, r.gear.chance);
  return item ? { item } : {};
}

// ———————————————————— клановый магазин ————————————————————

export interface ClanShopOffer {
  id: string;
  /** Ключ иконки для RewardIcon/MaterialIcon. */
  icon:
    | 'scroll'
    | 'tome'
    | 'dust'
    | 'stone'
    | 'ore'
    | 'energy'
    | 'shards'
    | 'item'
    | 'ancientScroll'
    | 'factionScroll'
    | 'voidScroll'
    | 'goldScroll'
    | 'skillBook';
  price: number;
  limit: number;
  /** Нужный уровень клана. */
  minLevel: number;
  reward: ClanReward;
  /** Гарантированный предмет этой редкости. */
  item?: Rarity;
}

export const CLAN_SHOP: ClanShopOffer[] = [
  { id: 'tomes', icon: 'tome', price: 120, limit: 5, minLevel: 1, reward: { materials: { xpTome: 5 } } },
  { id: 'ore', icon: 'ore', price: 100, limit: 5, minLevel: 1, reward: { materials: { ore: 30 } } },
  { id: 'energy', icon: 'energy', price: 80, limit: 5, minLevel: 1, reward: { energy: 60 } },
  { id: 'dust', icon: 'dust', price: 150, limit: 3, minLevel: 2, reward: { materials: { starDust: 20 } } },
  { id: 'scroll', icon: 'scroll', price: 300, limit: 2, minLevel: 2, reward: { materials: { scroll: 1 } } },
  {
    id: 'ancient',
    icon: 'ancientScroll',
    price: 250,
    limit: 2,
    minLevel: 2,
    reward: { materials: { ancientScroll: 1 } },
  },
  {
    id: 'factionScroll',
    icon: 'factionScroll',
    price: 450,
    limit: 1,
    minLevel: 3,
    reward: { materials: { factionScroll: 1 } },
  },
  {
    id: 'voidScroll',
    icon: 'voidScroll',
    price: 800,
    limit: 1,
    minLevel: 5,
    reward: { materials: { voidScroll: 1 } },
  },
  {
    id: 'goldScroll',
    icon: 'goldScroll',
    price: 2500,
    limit: 1,
    minLevel: 8,
    reward: { materials: { goldScroll: 1 } },
  },
  {
    id: 'stone',
    icon: 'stone',
    price: 400,
    limit: 2,
    minLevel: 3,
    reward: { materials: { awakenStone: 1 } },
  },
  { id: 'epicItem', icon: 'item', price: 500, limit: 1, minLevel: 4, reward: {}, item: 'epic' },
  { id: 'shards', icon: 'shards', price: 600, limit: 1, minLevel: 5, reward: { shards: 100 } },
  { id: 'legItem', icon: 'item', price: 1500, limit: 1, minLevel: 7, reward: {}, item: 'legendary' },
];

export function clanShopBought(save: SaveData, id: string, now: number): number {
  const rec = save.clan.bought[id];
  return rec && rec.period === periodKey('week', now) ? rec.count : 0;
}

export type ClanBuyError = 'level' | 'soldOut' | 'noCoins' | 'full';

export function buyClanOffer(
  save: SaveData,
  id: string,
  clanLvl: number,
  now = Date.now(),
): { item?: Item } | ClanBuyError {
  const o = CLAN_SHOP.find((x) => x.id === id);
  if (!o || clanLvl < o.minLevel) return 'level';
  const n = clanShopBought(save, id, now);
  if (n >= o.limit) return 'soldOut';
  if (save.clan.coins < o.price) return 'noCoins';
  if (o.item && save.items.length >= 300) return 'full';
  save.clan.coins -= o.price;
  save.clan.bought[id] = { period: periodKey('week', now), count: n + 1 };
  const out = grantClanReward(save, o.reward, now);
  if (o.item) {
    const w: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    w[o.item] = 1;
    const it = rollGearDrop(save, w, 1);
    if (it) out.item = it;
  }
  return out;
}

// ———————————————————— проверки ввода ————————————————————

export function validateClanName(n: string): boolean {
  const t = n.trim();
  return t.length >= CLAN.nameMin && t.length <= CLAN.nameMax && /^[\p{L}\p{N} '_.-]+$/u.test(t);
}
export function normalizeTag(t: string): string {
  return t.trim().toUpperCase();
}
export function validateClanTag(t: string): boolean {
  return /^[A-ZА-ЯЁ0-9]{2,4}$/u.test(normalizeTag(t));
}

export const CLAN_EMBLEMS = [
  'shield',
  'sword',
  'crown',
  'flame',
  'leaf',
  'wave',
  'moon',
  'sun',
  'skull',
  'anvil',
  'eye',
  'star',
] as const;
export type ClanEmblem = (typeof CLAN_EMBLEMS)[number];
export const CLAN_COLORS = [
  '#d9a94a',
  '#e0503a',
  '#5fb070',
  '#4fb3d9',
  '#a37cff',
  '#5fbfb2',
  '#c98a45',
  '#e6e0f0',
] as const;

// ———————————————————— советчик под босса ————————————————————

export type BossPickReason = 'strong' | 'weak' | 'defDown' | 'atkDown' | 'heal' | 'shield' | 'poison';

/**
 * Лучшие герои игрока против Стража сегодня: сила × множители за стихию и полезные умения.
 * Повторов одного героя нет; если есть лекарь, он обязательно попадает в пятёрку.
 */
export function bossPicks(save: SaveData, element: Element, n = 5) {
  const scored = save.heroes.map((h) => {
    const d = heroDef(h.heroId);
    const tags = new Set(heroTags(d));
    const reasons: BossPickReason[] = [];
    const bonus: [boolean, BossPickReason, number][] = [
      [affinity(d.element, element) === 'strong', 'strong', 0.3],
      [affinity(element, d.element) === 'strong', 'weak', -0.2],
      [tags.has('defDown'), 'defDown', 0.15],
      [tags.has('atkDown'), 'atkDown', 0.1],
      [tags.has('heal'), 'heal', 0.1],
      [tags.has('shield'), 'shield', 0.08],
      [tags.has('poison'), 'poison', 0.06],
    ];
    let k = 1;
    for (const [on, why, add] of bonus)
      if (on) {
        k += add;
        reasons.push(why);
      }
    return { uid: h.uid, heroId: h.heroId, score: Math.round(heroPower(h, save) * k), reasons };
  });
  scored.sort((a, b) => b.score - a.score);
  const out: typeof scored = [];
  for (const s of scored) if (out.length < n && !out.some((x) => x.heroId === s.heroId)) out.push(s);
  if (!out.some((x) => x.reasons.includes('heal'))) {
    const healer = scored.find((s) => s.reasons.includes('heal') && !out.some((x) => x.heroId === s.heroId));
    if (healer && out.length) out[out.length - 1] = healer;
  }
  return out;
}
