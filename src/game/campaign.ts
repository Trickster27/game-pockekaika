import type { BattleResult } from '@/core/battle';
import { ALL_STAGES, stageById, type StageDef } from '@/content/campaign';
import type { SaveData } from '@/save/schema';
import { addHeroXp, addPlayerXp, type LevelUp } from './progression';
import { teamHeroes } from './battleSetup';
import { campaignDropWeights, rollGearDrop } from './forge';
import type { Item } from '@/save/schema';

/** Этап доступен, если пройден предыдущий (первый доступен всегда). */
export function isStageUnlocked(save: SaveData, stageId: string): boolean {
  const i = ALL_STAGES.findIndex((s) => s.id === stageId);
  if (i <= 0) return i === 0;
  return (save.campaign.stars[ALL_STAGES[i - 1]!.id] ?? 0) > 0;
}

/** Самый дальний открытый этап — на него ведёт кнопка «В поход». */
export function currentStage(save: SaveData): StageDef {
  let last = ALL_STAGES[0]!;
  for (const s of ALL_STAGES) {
    if (isStageUnlocked(save, s.id)) last = s;
    else break;
  }
  return last;
}

export function chapterStars(save: SaveData, chapter: number): number {
  return ALL_STAGES.filter((s) => s.chapter === chapter).reduce(
    (a, s) => a + (save.campaign.stars[s.id] ?? 0),
    0,
  );
}

export interface StageRewards {
  gold: number;
  shards: number;
  heroXp: number;
  playerXp: number;
  firstClear: boolean;
  levelUps: LevelUp[];
  playerLevelUps: number;
  newStars: number;
  items: Item[];
  ore: number;
}

/** Записывает результат этапа в сейв и выдаёт награды. Поражение даёт треть опыта. */
export function applyStageResult(save: SaveData, stageId: string, result: BattleResult): StageRewards {
  const stage = stageById(stageId);
  if (!stage) throw new Error(`Нет этапа ${stageId}`);
  const win = result.winner === 'ally';
  const prev = save.campaign.stars[stageId] ?? 0;
  const firstClear = win && prev === 0;
  const k = win ? 1 : 0.33;
  const gold = win ? stage.rewards.gold + (firstClear ? stage.firstClear.gold : 0) : 0;
  const shards = firstClear ? stage.firstClear.shards : 0;
  const heroXp = Math.round(stage.rewards.heroXp * k);
  const playerXp = Math.round(stage.rewards.playerXp * k);
  save.currencies.gold += gold;
  save.currencies.shards += shards;
  const levelUps: LevelUp[] = [];
  for (const h of teamHeroes(save)) {
    const up = addHeroXp(h, heroXp);
    if (up) levelUps.push(up);
  }
  const playerLevelUps = addPlayerXp(save, playerXp);
  let newStars = 0;
  if (win && result.stars > prev) {
    newStars = result.stars - prev;
    save.campaign.stars[stageId] = result.stars;
  }
  // Трофеи: снаряжение (у босса — всегда) и рунная руда.
  const items: Item[] = [];
  let ore = 0;
  if (win) {
    const drop = rollGearDrop(save, campaignDropWeights(stage.chapter), stage.boss ? 1 : 0.35);
    if (drop) items.push(drop);
    ore = 2 + stage.chapter * 2 + (stage.boss ? 10 : 0);
    save.materials.ore += ore;
  }
  if (win) save.stats.battlesWon += 1;
  else save.stats.battlesLost += 1;
  return { gold, shards, heroXp, playerXp, firstClear, levelUps, playerLevelUps, newStars, items, ore };
}
