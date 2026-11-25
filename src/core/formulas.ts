import { AFFINITY, type Affinity } from './elements';
import type { Rng } from './rng';

/** Защита снижает урон по формуле def / (def + K). При def = K урон режется вдвое. */
export const DEF_K = 600;

export function defenseReduction(def: number): number {
  const d = Math.max(0, def);
  return d / (d + DEF_K);
}

export interface DamageInput {
  /** Значение характеристики, от которой считается урон (обычно атака). */
  power: number;
  multiplier: number;
  def: number;
  critRate: number;
  critDmg: number;
  affinity: Affinity;
  /** Игнор части защиты (0..1). */
  defIgnore?: number;
}

export interface DamageResult {
  amount: number;
  crit: boolean;
}

/** Урон одного удара: сила × множитель × стихия × крит × (1 − снижение защитой) × разброс ±5%. */
export function rollDamage(i: DamageInput, rng: Rng): DamageResult {
  const critChance = clamp(i.critRate + AFFINITY.crit[i.affinity], 0, 1);
  const crit = rng.chance(critChance);
  const critMult = crit ? 1 + Math.max(0, i.critDmg) : 1;
  const def = i.def * (1 - clamp(i.defIgnore ?? 0, 0, 1));
  const spread = rng.range(0.95, 1.05);
  const raw =
    i.power * i.multiplier * AFFINITY.damage[i.affinity] * critMult * (1 - defenseReduction(def)) * spread;
  return { amount: Math.max(1, Math.round(raw)), crit };
}

/**
 * Шанс наложить дебафф. Каждые 100 единиц разницы меткости и сопротивления дают ±25%.
 * Минимум 5%, максимум 100%. Стихия добавляет ±10%.
 */
export function debuffChance(base: number, acc: number, res: number, aff: Affinity): number {
  return clamp(base + (acc - res) / 400 + AFFINITY.debuff[aff], 0.05, 1);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
