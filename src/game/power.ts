import { baseStats, power, statsAt } from '@/core/stats';
import { enemyDef, heroDef } from '@/content';
import type { StageDef } from '@/content/campaign';
import type { OwnedHero, SaveData } from '@/save/schema';
import { teamHeroes } from './battleSetup';

export function heroStats(h: OwnedHero) {
  const d = heroDef(h.heroId);
  return statsAt(baseStats(d.role, d.rarity, d.mod), h.level, h.stars, h.awakened);
}

export function heroPower(h: OwnedHero): number {
  return power(heroStats(h));
}

export function teamPower(save: SaveData): number {
  return teamHeroes(save).reduce((a, h) => a + heroPower(h), 0);
}

/** Рекомендуемая сила: самая сильная волна этапа (боссы с множителем). */
export function stagePower(stage: StageDef): number {
  let best = 0;
  for (const w of stage.waves) {
    let sum = 0;
    for (const e of w) {
      const d = enemyDef(e.id);
      sum += power(statsAt(baseStats(d.role, 'common', d.mod), e.level)) * (e.boss ? 2.2 : 1);
    }
    best = Math.max(best, sum);
  }
  return Math.round(best * 1.1);
}
