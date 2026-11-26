import { heroDef } from '@/content';
import type { Role } from '@/core/types';
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

// ———————————————————— аура лидера ————————————————————

/** Аура лидера: первый герой команды даёт бонус всем по своей роли; легендарный и мифический — ×1,5. */
export const LEADER_AURA: Record<Role, { stat: 'atk' | 'def' | 'spd' | 'hp'; pct: number }> = {
  attacker: { stat: 'atk', pct: 0.08 },
  defender: { stat: 'def', pct: 0.12 },
  support: { stat: 'spd', pct: 0.06 },
  healer: { stat: 'hp', pct: 0.08 },
};

export function leaderAura(
  save: SaveData,
): { heroId: string; stat: 'atk' | 'def' | 'spd' | 'hp'; pct: number } | null {
  const leader = teamHeroes(save)[0];
  if (!leader) return null;
  const d = heroDef(leader.heroId);
  const a = LEADER_AURA[d.role];
  const k = d.rarity === 'legendary' || d.rarity === 'mythic' ? 1.5 : 1;
  return { heroId: d.id, stat: a.stat, pct: Math.round(a.pct * k * 1000) / 1000 };
}

/** Боевые описания команды с аурой лидера. */
export function teamSpecs(save: SaveData): UnitSpec[] {
  const aura = leaderAura(save);
  return teamHeroes(save).map((h) => {
    const s = heroSpec(h, save);
    if (aura) s.bonusPct = { ...s.bonusPct, [aura.stat]: (s.bonusPct?.[aura.stat] ?? 0) + aura.pct };
    return s;
  });
}
