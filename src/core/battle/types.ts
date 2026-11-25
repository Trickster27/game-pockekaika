import type { Affinity } from '../elements';
import type { SkillDef, StatusId } from '../content';
import type { Element, Faction, Role, Stats } from '../types';

export type Side = 'ally' | 'enemy';
export type EnemyTier = 'normal' | 'elite' | 'champion';

/** Описание бойца для запуска боя. */
export interface UnitSpec {
  defId: string;
  kind: 'hero' | 'enemy';
  level: number;
  stars?: number;
  awakened?: boolean;
  /** Плоские прибавки (снаряжение и т. п.). */
  bonus?: Partial<Stats>;
  /** Процентные прибавки к hp/atk/def (0.1 = +10%). */
  bonusPct?: Partial<Pick<Stats, 'hp' | 'atk' | 'def' | 'spd'>>;
  boss?: boolean;
  /** Ранг врага: обычный, элитный, чемпион. */
  tier?: EnemyTier;
  /** Стартовое HP (доля), например для продолжения после волны. */
  hpFrac?: number;
}

export interface BattleSetup {
  allies: UnitSpec[];
  waves: UnitSpec[][];
  seed: number;
  /** Ограничение на число ходов, после которого бой считается проигранным. */
  maxTurns?: number;
  factionBonus?: boolean;
}

export interface StatusInst {
  id: StatusId;
  turns: number;
  /** Для яда: урон за тик. */
  value: number;
  source: string;
  /** Наложен в ход носителя — не уменьшать длительность в конце этого хода. */
  fresh: boolean;
}

export interface BattleUnit {
  uid: string;
  side: Side;
  slot: number;
  defId: string;
  kind: 'hero' | 'enemy';
  name: string;
  art: string;
  element: Element;
  faction?: Faction;
  role: Role;
  level: number;
  boss: boolean;
  tier: EnemyTier;
  stats: Stats;
  hp: number;
  shield: number;
  shieldTurns: number;
  /** Шкала хода 0..1000. */
  tm: number;
  skills: SkillDef[];
  cooldowns: number[];
  statuses: StatusInst[];
  alive: boolean;
}

export type BattleEvent =
  | { t: 'start'; wave: number; waves: number }
  | { t: 'wave'; wave: number; spawned: string[] }
  | { t: 'turn'; uid: string; turn: number }
  | { t: 'skill'; uid: string; skill: string; skillIndex: number; targets: string[]; fx?: string }
  | {
      t: 'damage';
      uid: string;
      from: string;
      amount: number;
      absorbed: number;
      crit: boolean;
      affinity: Affinity;
      hp: number;
    }
  | { t: 'heal'; uid: string; amount: number; hp: number }
  | { t: 'shield'; uid: string; amount: number }
  | { t: 'status'; uid: string; status: StatusId; turns: number; landed: boolean }
  | { t: 'statusEnd'; uid: string; status: StatusId }
  | { t: 'cleanse'; uid: string; removed: StatusId[] }
  | { t: 'poison'; uid: string; amount: number; hp: number }
  | { t: 'stunned'; uid: string }
  | { t: 'tm'; uid: string; delta: number; tm: number }
  | { t: 'death'; uid: string }
  | { t: 'end'; winner: Side | 'draw'; stars: number; turns: number };

export interface BattleResult {
  winner: Side | 'draw';
  stars: 0 | 1 | 2 | 3;
  turns: number;
  alliesAlive: number;
}
