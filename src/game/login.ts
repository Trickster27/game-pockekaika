import type { SaveData } from '@/save/schema';
import { grantReward, periodKey, type ShopReward } from './shop';

export const LOGIN_CYCLE = 28;

/** Награда за N-й день входа (1..28). 7, 14, 21 — особые, 28 — главная. */
export function loginReward(day: number): ShopReward {
  if (day === 28) return { shards: 500, materials: { scroll: 5, awakenStone: 5 } };
  if (day % 7 === 0) return { shards: 150, materials: { scroll: 2 } };
  switch (day % 4) {
    case 1:
      return { gold: 5000 + day * 300 };
    case 2:
      return { materials: { xpTome: 3 + Math.floor(day / 7) } };
    case 3:
      return { materials: { starDust: 8 + day } };
    default:
      return { energy: 30, shards: 20 };
  }
}

export function canClaimLogin(save: SaveData, now: number): boolean {
  return save.login.lastClaimDay !== periodKey('day', now);
}

/** Номер следующей награды в цикле (1..28). */
export function nextLoginDay(save: SaveData): number {
  return (save.login.claimed % LOGIN_CYCLE) + 1;
}

export function claimLogin(save: SaveData, now = Date.now()): { day: number; reward: ShopReward } | null {
  if (!canClaimLogin(save, now)) return null;
  const day = nextLoginDay(save);
  const reward = loginReward(day);
  grantReward(save, reward, now);
  save.login.claimed += 1;
  save.login.lastClaimDay = periodKey('day', now);
  return { day, reward };
}
