import { affinity } from '../elements';
import type { SkillDef } from '../content';
import type { Battle } from './engine';
import type { BattleUnit } from './types';

export interface Action {
  skillIndex: number;
  targetUid?: string;
}

const hasHeal = (s: SkillDef) => s.effects.some((e) => e.kind === 'heal');
const hasDamage = (s: SkillDef) => s.effects.some((e) => e.kind === 'damage');
const hpFrac = (u: BattleUnit) => u.hp / u.stats.hp;

/**
 * ИИ для авто-боя и врагов. Простые правила:
 * 1) лечение — только если кому-то из своих ниже 60% HP;
 * 2) навыки с перезарядкой важнее базовой атаки;
 * 3) цель: тот, кого можно добить, иначе цель со слабостью к нашей стихии, иначе с меньшим HP.
 */
export function chooseAction(b: Battle, u: BattleUnit): Action {
  const friends = b.aliveOf(u.side);
  const order = u.skills.map((s, i) => ({ s, i })).sort((a, c) => c.s.cooldown - a.s.cooldown || c.i - a.i);
  for (const { s, i } of order) {
    if (!b.isReady(u, i)) continue;
    if (hasHeal(s) && !hasDamage(s)) {
      const hurt = friends.filter((f) => hpFrac(f) < 0.6);
      if (!hurt.length) continue;
      if (s.target === 'ally')
        return { skillIndex: i, targetUid: hurt.reduce((a, c) => (hpFrac(a) <= hpFrac(c) ? a : c)).uid };
      return { skillIndex: i };
    }
    if (s.target === 'ally') {
      // Бафф союзнику: самому сильному атакующему, иначе себе.
      const best = friends.find((f) => f.role === 'attacker' && f !== u) ?? u;
      return { skillIndex: i, targetUid: best.uid };
    }
    if (s.target === 'none') return { skillIndex: i };
    return { skillIndex: i, targetUid: pickEnemyTarget(b, u, s)?.uid };
  }
  return { skillIndex: 0, targetUid: pickEnemyTarget(b, u, u.skills[0]!)?.uid };
}

function pickEnemyTarget(b: Battle, u: BattleUnit, s: SkillDef): BattleUnit | undefined {
  const targets = b.validTargets(u, s);
  if (!targets.length) return undefined;
  const score = (t: BattleUnit) => {
    let v = 1 - hpFrac(t);
    const aff = affinity(u.element, t.element);
    if (aff === 'strong') v += 0.35;
    if (aff === 'weak') v -= 0.35;
    if (t.hp < u.stats.atk * 1.5) v += 1;
    if (t.role === 'healer') v += 0.15;
    return v;
  };
  return targets.reduce((a, c) => (score(c) > score(a) ? c : a));
}
