import type { Profile } from './types';

/** Боец защитной команды (снимок героя со снаряжением). */
export interface DefenseUnit {
  defId: string;
  level: number;
  stars: number;
  awakened?: boolean;
  bonus?: Record<string, number>;
  bonusPct?: Record<string, number>;
}

/** То, что клиент сообщает серверу о своём прогрессе (сервер проверяет правдоподобие). */
export interface StatsSubmit {
  power: number;
  level: number;
  tower: number;
  collection: number;
  team: DefenseUnit[];
  teamPower: number;
}

export type LeaderKind = 'power' | 'level' | 'tower' | 'pvp' | 'boss' | 'collection';
export type LeaderScope = 'all' | 'friends' | 'clan';

export interface LeaderRow {
  rank: number;
  profile: Profile;
  value: number;
  clanTag: string | null;
}

export interface Leaderboard {
  rows: LeaderRow[];
  me: LeaderRow | null;
}

export interface PvpOpponent {
  profile: Profile;
  rating: number;
  power: number;
  team: DefenseUnit[];
  /** Этот игрок нападал на вас — реванш. */
  revenge?: boolean;
}

export interface PvpLogEntry {
  id: string;
  /** Кто нападал и на кого (один из них — вы). */
  attacker: Profile;
  defender: Profile;
  attackerWon: boolean;
  /** Изменение моего рейтинга. */
  delta: number;
  at: number;
  /** Можно отомстить (нападали на вас, реванш ещё не взят). */
  revenge: boolean;
}

export interface PvpState {
  rating: number;
  attacksLeft: number;
  opponents: PvpOpponent[];
  log: PvpLogEntry[];
  /** Ваша защита на сервере. */
  defense: DefenseUnit[];
}

export interface PvpBattle {
  battleId: string;
  seed: number;
  defender: PvpOpponent;
}

export interface PvpOutcome {
  delta: number;
  rating: number;
}

export interface PlayerCard {
  profile: Profile;
  power: number;
  level: number;
  tower: number;
  pvpRating: number;
  collection: number;
  team: DefenseUnit[];
  clanTag: string | null;
  clanName: string | null;
}

export interface SocialApi {
  submitStats(s: StatsSubmit): Promise<void>;
  leaderboard(kind: LeaderKind, scope: LeaderScope): Promise<Leaderboard>;
  pvpState(): Promise<PvpState>;
  pvpRefresh(): Promise<PvpState>;
  pvpBegin(defenderId: string): Promise<PvpBattle>;
  pvpFinish(battleId: string, attackerWon: boolean): Promise<PvpOutcome>;
  playerCard(userId: string): Promise<PlayerCard>;
}

/** Правила PvP — общие для SQL и демо-сервера. */
export const PVP = {
  dailyAttacks: 5,
  startRating: 1000,
  k: 32,
  /** Награда за победу и за поражение. */
  winReward: { gold: 4000, shards: 15 },
  loseReward: { gold: 1000, shards: 0 },
  /** Лимит правдоподобия силы и роста башни за сутки. */
  maxPower: 150_000,
  towerPerDay: 30,
} as const;

/** Изменение рейтинга по Эло (то же, что в SQL). */
export function eloDelta(me: number, opp: number, win: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (opp - me) / 400));
  return Math.round(PVP.k * ((win ? 1 : 0) - expected));
}
