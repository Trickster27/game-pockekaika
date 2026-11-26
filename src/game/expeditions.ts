import { Rng, hashSeed } from '@/core/rng';
import { heroDef } from '@/content';
import { ELEMENTS, FACTIONS, ROLES, type Element, type Faction, type Role } from '@/core/types';
import type { SaveData } from '@/save/schema';
import { busyUids } from './busy';
import { campLevel } from './camp';
import { grantReward, periodKey, type ShopReward } from './shop';

/**
 * Экспедиции — доска поручений на день (по мотивам «доски наград» AFK-RPG и отправок отрядов в гачах).
 *
 * Каждый день на доске 6 поручений разной сложности (★1–★5). У поручения есть:
 *  - размер отряда и минимум звёзд у каждого героя;
 *  - 1–2 обязательных условия «в отряде есть …» (фракция / стихия / роль);
 *  - необязательный бонус «все из …» — +50% к награде.
 * Отправленные герои заняты до возвращения (как на тренировке): в бой не идут.
 * Награды не тратят энергию: это способ занять героев из запаса, поэтому
 * сложные поручения требуют звёзд, а не уровня.
 *
 * Отрядов одновременно: 2, с 4-го уровня лагеря 3, с 8-го — 4.
 * Обновить доску: раз в день бесплатно, дальше за осколки. Начатые поручения
 * переживают смену дня и обновление.
 */

export type ExpNeedKind = 'faction' | 'element' | 'role';
export interface ExpNeed {
  kind: ExpNeedKind;
  value: Faction | Element | Role;
}

export interface ExpeditionMission {
  id: string;
  tier: number;
  hours: number;
  size: number;
  minStars: number;
  needs: ExpNeed[];
  bonus?: ExpNeed;
  reward: ShopReward;
  party?: string[];
  startAt?: number;
  endAt?: number;
  /** Награда получена. */
  done?: boolean;
  /** Получен бонус «все из …» (фиксируется при отправке). */
  bonusMet?: boolean;
}

export interface ExpeditionState {
  day: string;
  /** Бесплатное обновление сегодня уже использовано. */
  freeUsed: boolean;
  /** Платных обновлений сегодня. */
  paid: number;
  seq: number;
  board: ExpeditionMission[];
}

export const EXP_BOARD_SIZE = 6;
export const EXP_HOURS = [1, 2, 4, 8, 12] as const;
export const EXP_SIZE = [1, 2, 2, 3, 3] as const;
export const EXP_MIN_STARS = [1, 1, 2, 3, 4] as const;
export const EXP_BONUS_MULT = 1.5;
/** Цена платного обновления: 20, 40, 60… осколков. */
export const EXP_REFRESH_STEP = 20;
/** Досрочное возвращение за осколки: 1 осколок за 5 минут. */
export const EXP_RUSH_MIN_PER_SHARD = 5;
const HOUR = 3_600_000;

/** Награды по сложности: из каждой строки выпадает одна позиция. */
const REWARDS: ShopReward[][] = [
  [
    { gold: 6_000 },
    { materials: { xpTome: 2 } },
    { materials: { starDust: 5 } },
    { materials: { ore: 25 } },
    { shards: 15 },
  ],
  [
    { gold: 11_000 },
    { materials: { xpTome: 4 } },
    { materials: { starDust: 10 } },
    { materials: { ore: 45 } },
    { shards: 30 },
    { materials: { skillBook: 1 } },
  ],
  [
    { gold: 20_000 },
    { materials: { xpTome: 7 } },
    { materials: { starDust: 18 } },
    { materials: { ore: 80 } },
    { shards: 55 },
    { materials: { skillBook: 1 } },
    { materials: { scroll: 1 } },
  ],
  [
    { gold: 36_000 },
    { materials: { xpTome: 12 } },
    { materials: { starDust: 30 } },
    { shards: 95 },
    { materials: { skillBook: 2 } },
    { materials: { scroll: 2 } },
    { materials: { ancientScroll: 1 } },
    { materials: { awakenStone: 1 } },
  ],
  [
    { gold: 60_000, materials: { xpTome: 8 } },
    { materials: { starDust: 50 } },
    { shards: 160 },
    { materials: { skillBook: 3 } },
    { materials: { ancientScroll: 1, scroll: 1 } },
    { materials: { voidScroll: 1 } },
    { materials: { awakenStone: 2 } },
  ],
];

/** Вес сложностей на доске; ★4 открывается со 2-го уровня лагеря, ★5 — с 4-го. */
export function tierWeights(camp: number): number[] {
  return [34, 30, 20, camp >= 2 ? 11 : 0, camp >= 4 ? 5 + camp : 0];
}

export function expeditionParties(save: Pick<SaveData, 'camp'>): number {
  const l = campLevel(save).level;
  return 2 + (l >= 4 ? 1 : 0) + (l >= 8 ? 1 : 0);
}

export function emptyExpeditions(): ExpeditionState {
  return { day: '', freeUsed: false, paid: 0, seq: 0, board: [] };
}

function scale(r: ShopReward, k: number): ShopReward {
  const out: ShopReward = {};
  if (r.gold) out.gold = Math.round((r.gold * k) / 100) * 100;
  if (r.shards) out.shards = Math.round(r.shards * k);
  if (r.materials)
    out.materials = Object.fromEntries(
      Object.entries(r.materials).map(([m, n]) => [m, Math.max(1, Math.round((n as number) * k))]),
    );
  return out;
}

function need(rng: Rng, kinds: ExpNeedKind[]): ExpNeed {
  const kind = rng.pick(kinds);
  const value =
    kind === 'faction' ? rng.pick(FACTIONS) : kind === 'element' ? rng.pick(ELEMENTS) : rng.pick(ROLES);
  return { kind, value };
}

function makeMission(rng: Rng, id: string, camp: number): ExpeditionMission {
  const tier = rng.weighted(tierWeights(camp).map((weight, i) => ({ item: i + 1, weight }))) as number;
  const i = tier - 1;
  const size = EXP_SIZE[i]!;
  const needs: ExpNeed[] = [need(rng, ['faction', 'element', 'role'])];
  if (tier >= 3) {
    let n2 = need(rng, ['faction', 'element', 'role']);
    for (let k = 0; k < 4 && n2.kind === needs[0]!.kind; k++) n2 = need(rng, ['faction', 'element', 'role']);
    if (n2.kind !== needs[0]!.kind) needs.push(n2);
  }
  // Бонус «все из …» — только на отряды от двух героев, иначе он бесплатный.
  const bonus = size >= 2 && rng.next() < 0.6 ? need(rng, ['faction', 'element']) : undefined;
  // Уровень лагеря повышает награду на 4% за уровень.
  // К основной добыче всегда прилагается золото: 1 500 за час пути.
  const main = rng.pick(REWARDS[i]!);
  const reward = scale({ ...main, gold: (main.gold ?? 0) + 1_500 * EXP_HOURS[i]! }, 1 + 0.04 * (camp - 1));
  return { id, tier, hours: EXP_HOURS[i]!, size, minStars: EXP_MIN_STARS[i]!, needs, bonus, reward };
}

function fill(save: SaveData, rng: Rng) {
  const camp = campLevel(save).level;
  const st = save.expeditions;
  while (st.board.filter((m) => !m.done).length < EXP_BOARD_SIZE && st.board.length < EXP_BOARD_SIZE * 2) {
    st.seq += 1;
    st.board.push(makeMission(rng, `e${st.seq}`, camp));
  }
}

/** Смена дня: всё, что не в пути, уходит, доска заполняется заново. */
export function rollExpeditions(save: SaveData, now = Date.now()) {
  const day = periodKey('day', now);
  const st = save.expeditions;
  if (st.day === day) return;
  st.day = day;
  st.freeUsed = false;
  st.paid = 0;
  st.board = st.board.filter((m) => m.party && !m.done);
  fill(save, new Rng(hashSeed(`${save.saveId}:exp:${day}`)));
}

export function refreshCost(save: SaveData): number {
  return save.expeditions.freeUsed ? EXP_REFRESH_STEP * (save.expeditions.paid + 1) : 0;
}

/** Обновить свободные поручения. Начатые и выполненные остаются. */
export function refreshExpeditions(save: SaveData, now = Date.now()): true | 'noShards' {
  rollExpeditions(save, now);
  const st = save.expeditions;
  const cost = refreshCost(save);
  if (save.currencies.shards < cost) return 'noShards';
  save.currencies.shards -= cost;
  if (st.freeUsed) st.paid += 1;
  else st.freeUsed = true;
  st.board = st.board.filter((m) => m.party);
  fill(save, new Rng(hashSeed(`${save.saveId}:exp:${st.day}:${st.seq}`)));
  return true;
}

function matches(heroId: string, n: ExpNeed): boolean {
  const d = heroDef(heroId);
  return n.kind === 'faction'
    ? d.faction === n.value
    : n.kind === 'element'
      ? d.element === n.value
      : d.role === n.value;
}

export interface PartyCheck {
  size: boolean;
  stars: boolean;
  needs: boolean[];
  bonus: boolean;
  ok: boolean;
}

export function checkParty(save: SaveData, m: ExpeditionMission, uids: string[]): PartyCheck {
  const heroes = uids.map((u) => save.heroes.find((h) => h.uid === u)).filter((h) => !!h);
  const size = heroes.length === m.size;
  const stars = heroes.length > 0 && heroes.every((h) => h.stars >= m.minStars);
  const needs = m.needs.map((n) => heroes.some((h) => matches(h.heroId, n)));
  const bonus = !!m.bonus && size && heroes.every((h) => matches(h.heroId, m.bonus!));
  return { size, stars, needs, bonus, ok: size && stars && needs.every(Boolean) };
}

/**
 * Автоподбор отряда: сначала закрываем условия, потом пытаемся собрать бонус,
 * добираем самыми слабыми подходящими (сильных лучше держать свободными для боёв).
 */
export function autoParty(save: SaveData, m: ExpeditionMission): string[] | null {
  const busy = busyUids(save);
  const free = save.heroes
    .filter((h) => !busy.has(h.uid) && h.stars >= m.minStars)
    .sort(
      (a, b) =>
        Number(save.team.includes(a.uid)) - Number(save.team.includes(b.uid)) ||
        a.stars - b.stars ||
        a.level - b.level,
    );
  const tryBuild = (pool: typeof free): string[] | null => {
    const pick: typeof free = [];
    for (const n of m.needs) {
      if (pick.some((h) => matches(h.heroId, n))) continue;
      const h = pool.find((x) => !pick.includes(x) && matches(x.heroId, n));
      if (!h) return null;
      pick.push(h);
    }
    for (const h of pool) {
      if (pick.length >= m.size) break;
      if (!pick.includes(h)) pick.push(h);
    }
    return pick.length === m.size ? pick.map((h) => h.uid) : null;
  };
  if (m.bonus) {
    const withBonus = tryBuild(free.filter((h) => matches(h.heroId, m.bonus!)));
    if (withBonus) return withBonus;
  }
  return tryBuild(free);
}

export type ExpeditionError = 'notFound' | 'started' | 'noParty' | 'busy' | 'badParty';

export function activeParties(save: SaveData): number {
  return save.expeditions.board.filter((m) => m.party && !m.done).length;
}

export function startExpedition(
  save: SaveData,
  id: string,
  uids: string[],
  now = Date.now(),
): true | ExpeditionError {
  rollExpeditions(save, now);
  const m = save.expeditions.board.find((x) => x.id === id);
  if (!m || m.done) return 'notFound';
  if (m.party) return 'started';
  if (activeParties(save) >= expeditionParties(save)) return 'noParty';
  const busy = busyUids(save);
  if (uids.some((u) => busy.has(u)) || new Set(uids).size !== uids.length) return 'busy';
  const c = checkParty(save, m, uids);
  if (!c.ok) return 'badParty';
  m.party = [...uids];
  m.startAt = now;
  m.endAt = now + m.hours * HOUR;
  m.bonusMet = c.bonus;
  // Ушедшие герои покидают боевую команду.
  save.team = save.team.filter((u) => !uids.includes(u));
  return true;
}

export function expeditionReward(m: ExpeditionMission): ShopReward {
  return m.bonusMet ? scale(m.reward, EXP_BONUS_MULT) : m.reward;
}

export function claimExpedition(save: SaveData, id: string, now = Date.now()): ShopReward | null {
  const m = save.expeditions.board.find((x) => x.id === id);
  if (!m || !m.party || m.done || (m.endAt ?? Infinity) > now) return null;
  const r = expeditionReward(m);
  grantReward(save, r, now);
  m.done = true;
  m.party = undefined;
  // Выполненное поручение со вчерашней доски просто исчезает.
  if (m.startAt && periodKey('day', m.startAt) !== save.expeditions.day)
    save.expeditions.board = save.expeditions.board.filter((x) => x !== m);
  save.stats.expeditions = (save.stats.expeditions ?? 0) + 1;
  return r;
}

/** Отозвать отряд: награды нет, поручение снова свободно. */
export function recallExpedition(save: SaveData, id: string): boolean {
  const m = save.expeditions.board.find((x) => x.id === id);
  if (!m || !m.party || m.done) return false;
  m.party = undefined;
  m.startAt = undefined;
  m.endAt = undefined;
  m.bonusMet = undefined;
  return true;
}

export function expRushCost(m: ExpeditionMission, now: number): number {
  return Math.ceil(Math.max(0, (m.endAt ?? now) - now) / (EXP_RUSH_MIN_PER_SHARD * 60_000));
}

export function rushExpedition(
  save: SaveData,
  id: string,
  now = Date.now(),
): true | 'notFound' | 'noShards' | 'done' {
  const m = save.expeditions.board.find((x) => x.id === id);
  if (!m || !m.party || m.done) return 'notFound';
  const cost = expRushCost(m, now);
  if (cost <= 0) return 'done';
  if (save.currencies.shards < cost) return 'noShards';
  save.currencies.shards -= cost;
  m.endAt = now;
  return true;
}

export function expeditionsReady(save: SaveData, now: number): number {
  return save.expeditions.board.filter((m) => m.party && !m.done && (m.endAt ?? Infinity) <= now).length;
}

export function nextExpeditionEnd(save: SaveData, now: number): number | null {
  const ends = save.expeditions.board
    .filter((m) => m.party && !m.done && (m.endAt ?? 0) > now)
    .map((m) => m.endAt!);
  return ends.length ? Math.min(...ends) : null;
}
