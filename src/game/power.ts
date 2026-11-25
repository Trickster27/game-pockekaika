import { baseStats, power, statsAt } from '@/core/stats';
import { enemyDef, heroDef } from '@/content';
import type { StageDef } from '@/content/campaign';
import type { OwnedHero, SaveData } from '@/save/schema';
import { teamHeroes } from './battleSetup';
import { applyGear, gearBonus, heroItems } from './gear';

/** Характеристики героя; если передан сейв — вместе со снаряжением. */
export function heroStats(h: OwnedHero, save?: SaveData) {
  const d = heroDef(h.heroId);
  const s = statsAt(baseStats(d.role, d.rarity, d.mod), h.level, h.stars, h.awakened);
  return save ? applyGear(s, gearBonus(heroItems(save, h.uid))) : s;
}

export function heroPower(h: OwnedHero, save?: SaveData): number {
  return power(heroStats(h, save));
}

export function teamPower(save: SaveData): number {
  return teamHeroes(save).reduce((a, h) => a + heroPower(h, save), 0);
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
