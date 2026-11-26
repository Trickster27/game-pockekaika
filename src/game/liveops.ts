import { CHAPTERS, HEROES } from '@/content';
import { scrollDef, type ScrollId } from '@/content/scrolls';
import type { SaveData } from '@/save/schema';
import { grantReward, type ShopReward } from './shop';
import type { QuestEvent } from './quests';

/**
 * «Живая» игра: ограниченные события, повышенный шанс в свитках, сезонный пропуск и достижения.
 * Всё вычисляется по календарю (UTC), без сервера: у всех игроков одинаковые события в одни и те же дни.
 */
const DAY = 86_400_000;
const dayOf = (now: number) => Math.floor(now / DAY);

// ———————————————————— события ————————————————————

export type EventKind = 'summon' | 'campaign' | 'forge' | 'ascent';
export interface EventDef {
  kind: EventKind;
  /** Очки за действия (по событиям ежедневных заданий). */
  points: Partial<Record<QuestEvent, number>>;
  milestones: { points: number; reward: ShopReward }[];
}

/** Событие длится 3 дня, четыре события по кругу (цикл 12 дней). */
export const EVENT_DAYS = 3;
export const EVENTS: EventDef[] = [
  {
    kind: 'summon',
    // Очки за призыв дополнительно зависят от свитка (см. summonEventPoints).
    points: { summon: 1 },
    milestones: [
      { points: 10, reward: { gold: 20_000 } },
      { points: 30, reward: { shards: 100 } },
      { points: 60, reward: { materials: { ancientScroll: 2 } } },
      { points: 100, reward: { materials: { skillBook: 3 } } },
      { points: 160, reward: { materials: { voidScroll: 1 } } },
    ],
  },
  {
    kind: 'campaign',
    points: { campaign: 2, dungeon: 3 },
    milestones: [
      { points: 20, reward: { gold: 20_000 } },
      { points: 50, reward: { energy: 60 } },
      { points: 90, reward: { materials: { xpTome: 10 } } },
      { points: 140, reward: { shards: 150 } },
      { points: 200, reward: { materials: { factionScroll: 1 } } },
    ],
  },
  {
    kind: 'forge',
    points: { upgrade: 2 },
    milestones: [
      { points: 10, reward: { gold: 15_000 } },
      { points: 30, reward: { materials: { ore: 60 } } },
      { points: 60, reward: { materials: { skillBook: 2 } } },
      { points: 100, reward: { shards: 150 } },
      { points: 150, reward: { materials: { ancientScroll: 2 } } },
    ],
  },
  {
    kind: 'ascent',
    points: { tower: 5, arena: 3 },
    milestones: [
      { points: 15, reward: { gold: 20_000 } },
      { points: 40, reward: { materials: { starDust: 30 } } },
      { points: 75, reward: { shards: 120 } },
      { points: 120, reward: { materials: { awakenStone: 3 } } },
      { points: 180, reward: { materials: { goldScroll: 1 } } },
    ],
  },
];

export function currentEvent(now: number) {
  const d = dayOf(now);
  const n = Math.floor(d / EVENT_DAYS);
  const def = EVENTS[n % EVENTS.length]!;
  return { def, key: `${def.kind}-${n}`, endsAt: (n + 1) * EVENT_DAYS * DAY };
}

function rollEvent(save: SaveData, now: number) {
  const { key } = currentEvent(now);
  if (save.events.key !== key) save.events = { key, points: 0, claimed: [] };
}

/** Очки события за действие. Вызывается из trackQuest. */
export function trackEvent(save: SaveData, event: QuestEvent, n: number, now: number) {
  rollEvent(save, now);
  const { def } = currentEvent(now);
  const per = def.points[event];
  if (per) save.events.points += per * n;
}

/** Дополнительные очки турнира призыва за ценные свитки. */
export const SUMMON_EVENT_WEIGHT: Record<ScrollId, number> = {
  basic: 1,
  ancient: 3,
  faction: 5,
  void: 5,
  gold: 10,
};
export function summonEventPoints(save: SaveData, scroll: ScrollId, count: number, now: number) {
  rollEvent(save, now);
  if (currentEvent(now).def.kind !== 'summon') return;
  // 1 очко уже дал trackQuest('summon'), добавляем разницу.
  save.events.points += (SUMMON_EVENT_WEIGHT[scroll] - 1) * count;
}

export function eventState(save: SaveData, now: number) {
  const ev = currentEvent(now);
  const same = save.events.key === ev.key;
  return { ...ev, points: same ? save.events.points : 0, claimed: same ? save.events.claimed : [] };
}

export function claimEventMilestone(save: SaveData, i: number, now = Date.now()): ShopReward | null {
  rollEvent(save, now);
  const m = currentEvent(now).def.milestones[i];
  if (!m || save.events.claimed.includes(i) || save.events.points < m.points) return null;
  save.events.claimed.push(i);
  grantReward(save, m.reward, now);
  return m.reward;
}

// ———————————————————— повышенный шанс ————————————————————

/** Герой недели в свитке: половина шанса его редкости достаётся ему. Неделя — с понедельника UTC. */
export const RATE_UP_SHARE = 0.5;
export function weekOf(now: number) {
  return Math.floor((dayOf(now) + 3) / 7);
}
export function featuredHero(scroll: ScrollId, now: number): string | null {
  const def = scrollDef(scroll);
  const top = scroll === 'gold' ? 'mythic' : 'legendary';
  if (scroll === 'basic' || scroll === 'ancient' || scroll === 'faction') return null;
  const pool = HEROES.filter((h) => def.pool(h) && h.rarity === top).sort((a, b) => a.id.localeCompare(b.id));
  if (!pool.length) return null;
  return pool[weekOf(now) % pool.length]!.id;
}
export function rateUpEndsAt(now: number) {
  return ((weekOf(now) + 1) * 7 - 3) * DAY;
}

// ———————————————————— сезонный пропуск ————————————————————

export const PASS_DAYS = 28;
export const PASS_LEVELS = 30;
export const PASS_XP_PER_LEVEL = 100;
/** Открыть премиум-линию: здесь — за осколки (место под настоящую покупку). */
export const PASS_PREMIUM_SHARDS = 1_500;

export interface PassLevel {
  level: number;
  free: ShopReward;
  premium: ShopReward;
}
export const PASS_REWARDS: PassLevel[] = Array.from({ length: PASS_LEVELS }, (_, i) => {
  const l = i + 1;
  const free: ShopReward =
    l % 10 === 0
      ? { shards: 150, materials: { ancientScroll: 1 } }
      : l % 5 === 0
        ? { materials: { skillBook: 1, starDust: 15 } }
        : l % 2 === 0
          ? { materials: { xpTome: 3 } }
          : { gold: 8_000 + 500 * l };
  const premium: ShopReward =
    l === 30
      ? { materials: { goldScroll: 1 }, shards: 300 }
      : l % 10 === 0
        ? { materials: { voidScroll: 1 }, shards: 100 }
        : l % 5 === 0
          ? { materials: { skillBook: 2, awakenStone: 2 } }
          : l % 3 === 0
            ? { materials: { ancientScroll: 1 } }
            : { shards: 40, materials: { ore: 20 } };
  return { level: l, free, premium };
});

export function currentSeason(now: number) {
  const s = Math.floor(dayOf(now) / PASS_DAYS);
  return { season: s, endsAt: (s + 1) * PASS_DAYS * DAY };
}
function rollPass(save: SaveData, now: number) {
  const { season } = currentSeason(now);
  if (save.pass.season !== season) save.pass = { season, xp: 0, premium: false, free: [], prem: [] };
}
export function passLevel(save: SaveData, now: number): { level: number; xp: number; into: number } {
  rollPass(save, now);
  const level = Math.min(PASS_LEVELS, Math.floor(save.pass.xp / PASS_XP_PER_LEVEL));
  return { level, xp: save.pass.xp, into: save.pass.xp % PASS_XP_PER_LEVEL };
}
/** Опыт пропуска: очки ежедневных заданий и ежедневный вход. */
export function addPassXp(save: SaveData, n: number, now: number) {
  rollPass(save, now);
  save.pass.xp = Math.min(PASS_LEVELS * PASS_XP_PER_LEVEL, save.pass.xp + n);
}
export type PassError = 'level' | 'claimed' | 'premium';
export function claimPass(
  save: SaveData,
  level: number,
  track: 'free' | 'premium',
  now = Date.now(),
): ShopReward | PassError {
  rollPass(save, now);
  const def = PASS_REWARDS[level - 1];
  if (!def || passLevel(save, now).level < level) return 'level';
  const list = track === 'free' ? save.pass.free : save.pass.prem;
  if (list.includes(level)) return 'claimed';
  if (track === 'premium' && !save.pass.premium) return 'premium';
  list.push(level);
  const r = track === 'free' ? def.free : def.premium;
  grantReward(save, r, now);
  return r;
}
export function buyPremium(save: SaveData, now = Date.now()): true | 'noShards' | 'already' {
  rollPass(save, now);
  if (save.pass.premium) return 'already';
  if (save.currencies.shards < PASS_PREMIUM_SHARDS) return 'noShards';
  save.currencies.shards -= PASS_PREMIUM_SHARDS;
  save.pass.premium = true;
  return true;
}
export function passClaimable(save: SaveData, now: number): number {
  const { level } = passLevel(save, now);
  let n = 0;
  for (let l = 1; l <= level; l++) {
    if (!save.pass.free.includes(l)) n++;
    if (save.pass.premium && !save.pass.prem.includes(l)) n++;
  }
  return n;
}

// ———————————————————— достижения ————————————————————

export interface AchievementDef {
  id: string;
  /** Пороги ступеней и награда за каждую. */
  steps: number[];
  reward: (step: number) => ShopReward;
  value: (s: SaveData) => number;
}
const shardsBy = (base: number) => (i: number) => ({ shards: base * (i + 1) });
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'wins', steps: [10, 50, 200, 1000], reward: shardsBy(30), value: (s) => s.stats.battlesWon },
  {
    id: 'summons',
    steps: [10, 50, 200, 500],
    reward: (i) => ({ materials: { ancientScroll: i + 1 } }),
    value: (s) => s.summon.total,
  },
  {
    id: 'collection',
    steps: [10, 20, 30, 40],
    reward: shardsBy(50),
    value: (s) => new Set(s.heroes.map((h) => h.heroId)).size,
  },
  {
    id: 'tower',
    steps: [10, 30, 60, 100],
    reward: (i) => ({ materials: { skillBook: i + 1 } }),
    value: (s) => s.tower.floor,
  },
  {
    id: 'chapters',
    steps: [1, 2, 3, 4],
    reward: (i) => ({ shards: 100 * (i + 1) }),
    value: (s) => CHAPTERS.filter((c) => c.stages.every((st) => (s.campaign.stars[st.id] ?? 0) > 0)).length,
  },
  {
    id: 'stars',
    steps: [30, 60, 90, 120],
    reward: shardsBy(40),
    value: (s) => Object.values(s.campaign.stars).reduce((a, b) => a + b, 0),
  },
  { id: 'camp', steps: [3, 6, 10], reward: (i) => ({ gold: 50_000 * (i + 1) }), value: (s) => s.camp.level },
  {
    id: 'sixstar',
    steps: [1, 3, 5],
    reward: (i) => ({ materials: { awakenStone: 3 * (i + 1) } }),
    value: (s) => s.heroes.filter((h) => h.stars >= 6).length,
  },
  {
    id: 'mythic',
    steps: [1, 2, 4],
    reward: (i) => ({ shards: 200 * (i + 1) }),
    value: (s) =>
      new Set(
        s.heroes
          .filter((h) => HEROES.find((d) => d.id === h.heroId)?.rarity === 'mythic')
          .map((h) => h.heroId),
      ).size,
  },
  {
    id: 'fusion',
    steps: [1, 2],
    reward: () => ({ materials: { voidScroll: 1 } }),
    value: (s) =>
      new Set(
        s.heroes.filter((h) => HEROES.find((d) => d.id === h.heroId)?.pool === 'fusion').map((h) => h.heroId),
      ).size,
  },
  {
    id: 'gear',
    steps: [1, 5, 15],
    reward: (i) => ({ materials: { ore: 50 * (i + 1) } }),
    value: (s) => s.items.filter((i) => i.level >= 15).length,
  },
  {
    id: 'skills',
    steps: [1, 10, 30],
    reward: (i) => ({ materials: { skillBook: 2 * (i + 1) } }),
    value: (s) => s.heroes.reduce((a, h) => a + (h.skillLv ?? []).filter((x) => x >= 4).length, 0),
  },
];

export function achievementState(save: SaveData) {
  return ACHIEVEMENTS.map((a) => {
    const v = a.value(save);
    return {
      def: a,
      value: v,
      steps: a.steps.map((need, i) => ({
        need,
        done: v >= need,
        claimed: save.achievements.includes(`${a.id}:${i}`),
      })),
    };
  });
}
export function claimAchievement(
  save: SaveData,
  id: string,
  step: number,
  now = Date.now(),
): ShopReward | null {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  const need = a?.steps[step];
  const key = `${id}:${step}`;
  if (!a || need == null || save.achievements.includes(key) || a.value(save) < need) return null;
  save.achievements.push(key);
  const r = a.reward(step);
  grantReward(save, r, now);
  return r;
}
export function achievementsClaimable(save: SaveData): number {
  return achievementState(save).reduce((n, a) => n + a.steps.filter((s) => s.done && !s.claimed).length, 0);
}

/** Есть ли что забрать (для красной точки): события, пропуск, достижения. */
export function liveopsReady(save: SaveData, now: number): number {
  const ev = eventState(save, now);
  const evReady = ev.def.milestones.filter((m, i) => ev.points >= m.points && !ev.claimed.includes(i)).length;
  return evReady + passClaimable(save, now) + achievementsClaimable(save);
}
