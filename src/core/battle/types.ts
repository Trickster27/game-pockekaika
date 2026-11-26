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
  /** Точный запас здоровья (босс клана: общий пул). Перекрывает расчёт и hpFrac. */
  hpMax?: number;
  hpNow?: number;
  /** Перекрыть стихию (босс клана меняет стихию по дням). */
  element?: Element;
  /** Иммунитет к оглушению и сбиву шкалы хода. */
  ccImmune?: boolean;
  /** Отражение урона (шипы): доля полученного урона, возвращаемая атакующему. */
  thorns?: number;
  /** Облик героя (перекраска модели). */
  skin?: string;
  /** Ярость: прибавка к атаке за каждый свой ход (0.04 = +4%). */
  enrage?: number;
  /** Уровни навыков 1..4 (книги навыков): +10% силы за уровень, на 4-м перезарядка на 1 короче. */
  skillLv?: number[];
}

export interface BattleSetup {
  allies: UnitSpec[];
  waves: UnitSpec[][];
  seed: number;
  /** Ограничение на число ходов, после которого бой считается проигранным. */
  maxTurns?: number;
  /** Бой с боссом на время: после стольких ходов босса бой заканчивается (ничья, урон засчитывается). */
  bossTurns?: number;
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
  ccImmune: boolean;
  thorns: number;
  skin?: string;
  /** Здоровье из общего пула (босс клана): яд ограничен атакой отравителя. */
  pooled: boolean;
  /** Прирост атаки за ход и сколько раз он уже сработал. */
  enrage: number;
  enrageStacks: number;
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
      /** Урон от шипов цели. */
      reflect?: boolean;
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
  | { t: 'immune'; uid: string; what: 'stun' | 'tm' }
  | { t: 'enrage'; uid: string; stacks: number; atk: number }
  | { t: 'end'; winner: Side | 'draw'; stars: number; turns: number };

export interface BattleResult {
  winner: Side | 'draw';
  stars: 0 | 1 | 2 | 3;
  turns: number;
  alliesAlive: number;
  /** Урон союзников по врагам (реально снятое здоровье, с ядом). */
  damage?: number;
  /** Урон по каждому союзнику (uid → урон). */
  damageBy?: Record<string, number>;
  /** Сколько ходов сделал босс (для боя на время). */
  bossTurns?: number;
  /** Игрок сам вышел из боя. */
  surrendered?: boolean;
  /** Статистика по каждому бойцу (союзники и все враги всех волн). */
  report?: UnitReport[];
}

/** Итоги бойца за бой. */
export interface UnitReport {
  uid: string;
  name: string;
  art: string;
  side: Side;
  element: Element;
  /** Урон по противникам (по здоровью и щитам), включая яд. */
  dealt: number;
  /** Полученный урон. */
  taken: number;
  /** Сколько здоровья восстановил союзникам (без лечения сверх максимума). */
  healed: number;
  /** Сколько щитов повесил. */
  shielded: number;
  crits: number;
  maxCrit: number;
  kills: number;
  /** Сколько ослаблений наложил на противников. */
  debuffs: number;
  /** Жив к концу боя. */
  alive: boolean;
}
