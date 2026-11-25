import type { SaveData } from '@/save/schema';
import { grantReward, type ShopReward } from './shop';

/** Награда за пройденное обучение. */
export const TUTORIAL_REWARD: ShopReward = { shards: 100, materials: { scroll: 1, xpTome: 5 } };

export function advanceTutorial(save: SaveData, to: number) {
  if (save.tutorial.done) return;
  save.tutorial.step = Math.max(save.tutorial.step, to);
}

export function finishTutorial(save: SaveData, rewarded: boolean, now = Date.now()) {
  if (save.tutorial.done) return;
  save.tutorial.done = true;
  if (rewarded && !save.tutorial.rewarded) {
    save.tutorial.rewarded = true;
    grantReward(save, TUTORIAL_REWARD, now);
  }
}

export function restartTutorial(save: SaveData) {
  save.tutorial = { ...save.tutorial, step: 0, done: false };
}
