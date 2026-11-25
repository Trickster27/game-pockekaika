import type { BattleSetup, UnitSpec } from '@/core/battle';
import type { StageEnemy } from '@/content/campaign';
import type { OwnedHero, SaveData } from '@/save/schema';
import { gearBonus, heroItems } from './gear';

/** Боец для движка: уровень, звёзды и бонусы надетого снаряжения. */
export function heroSpec(h: OwnedHero, save?: SaveData): UnitSpec {
  const spec: UnitSpec = {
    defId: h.heroId,
    kind: 'hero',
    level: h.level,
    stars: h.stars,
    awakened: h.awakened,
  };
  if (save) {
    const b = gearBonus(heroItems(save, h.uid));
    spec.bonus = b.flat;
    spec.bonusPct = b.pct;
  }
  return spec;
}

export function teamHeroes(save: SaveData): OwnedHero[] {
  return save.team.map((uid) => save.heroes.find((h) => h.uid === uid)).filter((h): h is OwnedHero => !!h);
}

export function enemySpec(e: StageEnemy): UnitSpec {
  return { defId: e.id, kind: 'enemy', level: e.level, boss: e.boss, tier: e.tier };
}

export function makeSetup(allies: UnitSpec[], waves: StageEnemy[][], seed: number): BattleSetup {
  return { allies, waves: waves.map((w) => w.map(enemySpec)), seed };
}
