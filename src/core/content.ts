import type { Element, Faction, HeroRarity, Role, Stats } from './types';

/** Статусы. Баффы вешаются на союзников, дебаффы — на врагов (с проверкой меткости). */
export type StatusId =
  'stun' | 'poison' | 'defDown' | 'atkDown' | 'slow' | 'atkUp' | 'defUp' | 'haste' | 'taunt';

export const BUFFS: readonly StatusId[] = ['atkUp', 'defUp', 'haste', 'taunt'];
export const DEBUFFS: readonly StatusId[] = ['stun', 'poison', 'defDown', 'atkDown', 'slow'];

/** Сила статусов. */
export const STATUS_POWER = {
  atkUp: 0.25,
  atkDown: 0.25,
  defUp: 0.5,
  defDown: 0.5,
  haste: 0.3,
  slow: 0.3,
  /** Яд: доля макс. HP за ход (одно наложение). */
  poison: 0.05,
  /** Сколько наложений яда может висеть одновременно. */
  poisonStacks: 5,
} as const;

/** Кому применяется эффект навыка. target — выбранная цель. */
export type Scope =
  'target' | 'self' | 'allEnemies' | 'allAllies' | 'randomEnemies3' | 'lowestAlly' | 'otherAllies';

export type EffectDef =
  | {
      kind: 'damage';
      to?: Scope;
      mult: number;
      stat?: 'atk' | 'def' | 'hp';
      hits?: number;
      defIgnore?: number;
    }
  | { kind: 'heal'; to?: Scope; pct: number }
  | { kind: 'shield'; to?: Scope; pct: number; turns: number }
  | { kind: 'status'; to?: Scope; status: StatusId; turns: number; chance?: number }
  | { kind: 'turnMeter'; to?: Scope; amount: number }
  | { kind: 'cleanse'; to?: Scope };

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  /** Через сколько собственных ходов навык снова доступен. 0 — всегда. */
  cooldown: number;
  /** Что выбирает игрок: врага, союзника или ничего (массовый навык). */
  target: 'enemy' | 'ally' | 'none';
  effects: EffectDef[];
  /** Визуальный тип для рендера анимации. */
  fx?: string;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  faction: Faction;
  element: Element;
  rarity: HeroRarity;
  role: Role;
  art: string;
  skills: string[];
  mod?: Partial<Stats>;
  lore?: string;
  /** Особый пул призыва: такие герои выпадают только из своего свитка. */
  pool?: 'void' | 'gold';
}

export interface EnemyDef {
  id: string;
  name: string;
  element: Element;
  role: Role;
  art: string;
  skills: string[];
  mod?: Partial<Stats>;
  boss?: boolean;
}

export interface ContentDb {
  hero(id: string): HeroDef | undefined;
  enemy(id: string): EnemyDef | undefined;
  skill(id: string): SkillDef | undefined;
}
