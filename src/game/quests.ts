import type { SaveData } from '@/save/schema';
import { grantReward, periodKey, type ShopReward } from './shop';

export type QuestEvent = 'login' | 'campaign' | 'dungeon' | 'summon' | 'arena' | 'tower' | 'upgrade' | 'idle';

export interface QuestDef {
  id: string;
  name: string;
  event: QuestEvent;
  goal: number;
  points: number;
}

export const DAILY_QUESTS: QuestDef[] = [
  { id: 'login', name: 'Зайти в Лагерь', event: 'login', goal: 1, points: 10 },
  { id: 'idle', name: 'Собрать добычу лагеря', event: 'idle', goal: 1, points: 10 },
  { id: 'campaign', name: 'Пройти 3 этапа кампании', event: 'campaign', goal: 3, points: 20 },
  { id: 'dungeon', name: 'Пройти 2 подземелья', event: 'dungeon', goal: 2, points: 20 },
  { id: 'arena', name: 'Провести 2 боя на арене', event: 'arena', goal: 2, points: 20 },
  { id: 'tower', name: 'Пройти этаж башни', event: 'tower', goal: 1, points: 10 },
  { id: 'summon', name: 'Призвать героя', event: 'summon', goal: 1, points: 10 },
  { id: 'upgrade', name: 'Улучшить снаряжение', event: 'upgrade', goal: 1, points: 10 },
];

export const QUEST_CHESTS: { points: number; reward: ShopReward }[] = [
  { points: 30, reward: { gold: 5000, materials: { xpTome: 3 } } },
  { points: 60, reward: { shards: 60, materials: { starDust: 10 } } },
  { points: 100, reward: { shards: 100, materials: { scroll: 1 } } },
];

function roll(save: SaveData, now: number) {
  const day = periodKey('day', now);
  if (save.quests.day !== day) save.quests = { day, progress: {}, claimed: [], chests: [] };
}

/** Отметить событие для ежедневных заданий. */
export function trackQuest(save: SaveData, event: QuestEvent, n = 1, now = Date.now()) {
  roll(save, now);
  for (const q of DAILY_QUESTS)
    if (q.event === event)
      save.quests.progress[q.id] = Math.min(q.goal, (save.quests.progress[q.id] ?? 0) + n);
}

export function questPoints(save: SaveData, now: number): number {
  if (save.quests.day !== periodKey('day', now)) return 0;
  return DAILY_QUESTS.filter((q) => save.quests.claimed.includes(q.id)).reduce((a, q) => a + q.points, 0);
}

export function questProgress(save: SaveData, id: string, now: number): number {
  return save.quests.day === periodKey('day', now) ? (save.quests.progress[id] ?? 0) : 0;
}

export function claimQuest(save: SaveData, id: string, now = Date.now()): boolean {
  roll(save, now);
  const q = DAILY_QUESTS.find((x) => x.id === id);
  if (!q || save.quests.claimed.includes(id) || (save.quests.progress[id] ?? 0) < q.goal) return false;
  save.quests.claimed.push(id);
  return true;
}

export function claimChest(save: SaveData, index: number, now = Date.now()): ShopReward | null {
  roll(save, now);
  const c = QUEST_CHESTS[index];
  if (!c || save.quests.chests.includes(index) || questPoints(save, now) < c.points) return null;
  save.quests.chests.push(index);
  grantReward(save, c.reward, now);
  return c.reward;
}

/** Сколько наград ждут сбора (для красного значка). */
export function questsReady(save: SaveData, now: number): number {
  roll(save, now);
  const q = DAILY_QUESTS.filter(
    (x) => !save.quests.claimed.includes(x.id) && (save.quests.progress[x.id] ?? 0) >= x.goal,
  ).length;
  const pts = questPoints(save, now);
  const c = QUEST_CHESTS.filter((x, i) => !save.quests.chests.includes(i) && pts >= x.points).length;
  return q + c;
}
