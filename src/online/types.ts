/** Онлайн-часть игры: аккаунт, облачный сейв, друзья, сообщения, кланы. Провайдер прячется за этим интерфейсом. */
import type { ClanApi, ClanMessage } from './clanTypes';

export interface Profile {
  id: string;
  nickname: string;
  friendCode: string;
  avatar: string;
  level: number;
  power: number;
  arenaRating: number;
  /** unix ms */
  lastSeen: number;
}

export type FriendStatus = 'accepted' | 'incoming' | 'outgoing';

export interface Friend {
  friendshipId: string;
  status: FriendStatus;
  profile: Profile;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  body: string;
  at: number;
  readAt: number | null;
}

export interface CloudSave {
  json: string;
  version: number;
  /** updatedAt из сейва (unix ms). */
  updatedAt: number;
  device?: string;
}

export type OnlineEvent =
  { type: 'message'; message: Message } | { type: 'friends' } | { type: 'clanMessage'; message: ClanMessage };

export type OnlineErrorCode =
  | 'auth'
  | 'nickname_taken'
  | 'already'
  | 'not_friends'
  | 'not_found'
  | 'network'
  | 'invalid'
  | 'confirm_email'
  | 'clan_none'
  | 'clan_in'
  | 'clan_full'
  | 'clan_level'
  | 'clan_closed'
  | 'clan_cooldown'
  | 'clan_rights'
  | 'clan_taken'
  | 'clan_officers'
  | 'no_keys'
  | 'no_gold'
  | 'expired';

/** Коды, которые сервер присылает текстом исключения. */
export const SERVER_ERROR_CODES: readonly OnlineErrorCode[] = [
  'already',
  'not_found',
  'invalid',
  'clan_none',
  'clan_in',
  'clan_full',
  'clan_level',
  'clan_closed',
  'clan_cooldown',
  'clan_rights',
  'clan_taken',
  'clan_officers',
  'no_keys',
  'no_gold',
  'expired',
];

export class OnlineError extends Error {
  constructor(
    readonly code: OnlineErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export interface OnlineBackend extends ClanApi {
  readonly kind: 'supabase' | 'demo';
  /** Текущий пользователь (если сессия сохранена). */
  currentUserId(): Promise<string | null>;
  signUp(email: string, password: string, nickname: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  myProfile(): Promise<Profile>;
  updateProfile(
    p: Partial<Pick<Profile, 'nickname' | 'avatar' | 'level' | 'power' | 'arenaRating'>>,
  ): Promise<void>;
  /** Отметка «был в сети». */
  touch(): Promise<void>;
  pullSave(): Promise<CloudSave | null>;
  pushSave(s: CloudSave): Promise<void>;
  friends(): Promise<Friend[]>;
  /** Поиск по коду друга (6 символов) или началу ника. */
  findPlayers(query: string): Promise<Profile[]>;
  requestFriend(userId: string): Promise<void>;
  acceptFriend(friendshipId: string): Promise<void>;
  removeFriend(friendshipId: string): Promise<void>;
  messages(withUser: string, limit?: number): Promise<Message[]>;
  sendMessage(to: string, body: string): Promise<Message>;
  markRead(withUser: string): Promise<void>;
  unreadCounts(): Promise<Record<string, number>>;
  subscribe(cb: (e: OnlineEvent) => void): () => void;
}

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isOnline(p: Profile, now = Date.now()): boolean {
  return now - p.lastSeen < ONLINE_WINDOW_MS;
}

export const MAX_MESSAGE = 500;

export function validateNickname(n: string): boolean {
  const t = n.trim();
  return t.length >= 2 && t.length <= 20 && /^[\p{L}\p{N} _.-]+$/u.test(t);
}
