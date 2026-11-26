import type { BattleSetup, UnitSpec } from '@/core/battle';
import type { StageEnemy } from '@/content/campaign';
import type { OwnedHero, SaveData } from '@/save/schema';
import { gearBonus, heroItems } from './gear';
import { depthBonus, mergeBonus } from './depth';
import { busyUids } from './busy';

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
    const b = mergeBonus(gearBonus(heroItems(save, h.uid)), depthBonus(save, h));
    spec.bonus = b.flat;
    spec.bonusPct = b.pct;
  }
  if (h.skillLv?.some((x) => x > 1)) spec.skillLv = [...h.skillLv];
  if (h.skin) spec.skin = h.skin;
  return spec;
}

export function teamHeroes(save: SaveData): OwnedHero[] {
  // Герои на тренировке в бой не идут.
  const busy = busyUids(save);
  return save.team
    .filter((uid) => !busy.has(uid))
    .map((uid) => save.heroes.find((h) => h.uid === uid))
    .filter((h): h is OwnedHero => !!h);
}

export function enemySpec(e: StageEnemy): UnitSpec {
  return { defId: e.id, kind: 'enemy', level: e.level, boss: e.boss, tier: e.tier };
}

export function makeSetup(allies: UnitSpec[], waves: StageEnemy[][], seed: number): BattleSetup {
  return { allies, waves: waves.map((w) => w.map(enemySpec)), seed };
}
