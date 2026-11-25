import type { ClanRole, DonationId, JoinMode, WeeklyGoalId } from '@/game/clan';
import type { Profile } from './types';

/** Клан, как его видит игрок в списке и в шапке. */
export interface ClanInfo {
  id: string;
  name: string;
  tag: string;
  emblem: string;
  color: string;
  description: string;
  joinMode: JoinMode;
  minLevel: number;
  xp: number;
  members: number;
  bossLevel: number;
  bossKills: number;
  createdAt: number;
}

export interface ClanToday {
  keys: number;
  damage: number;
  checkin: boolean;
  donations: DonationId[];
}

export interface ClanMemberInfo {
  profile: Profile;
  role: ClanRole;
  joinedAt: number;
  /** Вклад в опыт клана за всё время. */
  contribution: number;
  today: ClanToday;
}

export interface ClanBossInfo {
  level: number;
  hp: number;
  hpMax: number;
  kills: number;
  /** Номер дня UTC на сервере — от него стихия дня. */
  day: number;
}

export interface ClanWeek {
  week: number;
  attacks: number;
  checkins: number;
  kills: number;
  /** Полученные награды: «цель:шаг». */
  claimed: string[];
}

export interface ClanState {
  clan: ClanInfo;
  me: { role: ClanRole; joinedAt: number; today: ClanToday };
  members: ClanMemberInfo[];
  boss: ClanBossInfo;
  /** Заявки на вступление (видят глава и офицеры). */
  requests: { profile: Profile; at: number }[];
  week: ClanWeek;
  /** Уровни побеждённого босса, за которые моя награда ещё не получена. */
  pendingKills: number[];
  /** Моё место по урону за вчера, если награда не получена. */
  yesterday: { rank: number; damage: number; of: number } | null;
}

export interface ClanBrowse {
  clans: ClanInfo[];
  /** Кланы, куда отправлены мои заявки. */
  requested: string[];
  /** До какого момента нельзя вступить (после выхода). */
  cooldownUntil: number | null;
}

/** Сообщение клана. Системные хранят ключ события и параметры в JSON. */
export interface ClanMessage {
  id: string;
  clanId: string;
  from: string | null;
  nickname: string | null;
  body: string;
  kind: 'chat' | 'system';
  at: number;
}

export interface ClanSystemBody {
  k: 'created' | 'join' | 'leave' | 'kick' | 'promote' | 'demote' | 'leader' | 'kill' | 'levelUp';
  a?: Record<string, string | number>;
}

export interface BossAttempt {
  attemptId: string;
  /** Seed боя выдаёт сервер: переиграть попытку ради удачного броска нельзя. */
  seed: number;
  level: number;
  hp: number;
  hpMax: number;
  day: number;
}

export interface BossOutcome {
  /** Засчитанный урон (после проверки лимита). */
  damage: number;
  /** Уровень босса в этой попытке (по нему считается сундук). */
  level: number;
  killed: boolean;
  bossLevel: number;
  bossHp: number;
}

export interface ClanCreateInput {
  name: string;
  tag: string;
  emblem: string;
  color: string;
  description: string;
  joinMode: JoinMode;
  minLevel: number;
}

export type ClanPatch = Partial<
  Pick<ClanCreateInput, 'description' | 'joinMode' | 'minLevel' | 'emblem' | 'color'>
>;

export interface ClanApi {
  myClan(): Promise<ClanState | null>;
  browseClans(query: string): Promise<ClanBrowse>;
  createClan(input: ClanCreateInput): Promise<string>;
  joinClan(clanId: string): Promise<'joined' | 'requested'>;
  cancelClanRequest(clanId: string): Promise<void>;
  leaveClan(): Promise<void>;
  respondClanRequest(userId: string, accept: boolean): Promise<void>;
  kickClanMember(userId: string): Promise<void>;
  setClanRole(userId: string, role: 'officer' | 'member'): Promise<void>;
  transferClanLeader(userId: string): Promise<void>;
  updateClan(patch: ClanPatch): Promise<void>;
  clanCheckin(): Promise<void>;
  clanDonate(kind: DonationId): Promise<void>;
  bossBegin(): Promise<BossAttempt>;
  bossFinish(attemptId: string, damage: number): Promise<BossOutcome>;
  claimClanKill(level: number): Promise<void>;
  claimClanWeekly(goal: WeeklyGoalId, step: number): Promise<void>;
  claimClanRank(): Promise<{ rank: number; damage: number; of: number } | null>;
  clanMessages(limit?: number): Promise<ClanMessage[]>;
  sendClanMessage(body: string): Promise<ClanMessage>;
}
