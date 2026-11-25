import type { BattleSetup, UnitSpec } from '@/core/battle';
import type { StageEnemy } from '@/content/campaign';
import type { OwnedHero, SaveData } from '@/save/schema';

export function heroSpec(h: OwnedHero): UnitSpec {
  return { defId: h.heroId, kind: 'hero', level: h.level, stars: h.stars, awakened: h.awakened };
}

export function teamHeroes(save: SaveData): OwnedHero[] {
  return save.team.map((uid) => save.heroes.find((h) => h.uid === uid)).filter((h): h is OwnedHero => !!h);
}

export function enemySpec(e: StageEnemy): UnitSpec {
  return { defId: e.id, kind: 'enemy', level: e.level, boss: e.boss };
}

export function makeSetup(allies: UnitSpec[], waves: StageEnemy[][], seed: number): BattleSetup {
  return { allies, waves: waves.map((w) => w.map(enemySpec)), seed };
}
