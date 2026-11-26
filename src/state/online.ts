import { create } from 'zustand';
import {
  createOnlineBackend,
  decideSync,
  OnlineError,
  type ClanMessage,
  type CloudSave,
  type Friend,
  type Message,
  type OnlineBackend,
  type Profile,
} from '@/online';
import { SAVE_VERSION, type SaveData } from '@/save';
import { heroSpec, teamHeroes, teamPower } from '@/game';
import { heroDef } from '@/content';
import { tr } from '@/i18n';
import { platform, saves } from './services';
import { useGame } from './store';

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error' | 'conflict';

export interface SaveSummary {
  level: number;
  gold: number;
  heroes: number;
  stars: number;
  updatedAt: number;
}

interface OnlineState {
  ready: boolean;
  kind: 'supabase' | 'demo' | null;
  userId: string | null;
  profile: Profile | null;
  status: SyncStatus;
  lastSync: number | null;
  error: string | null;
  friends: Friend[];
  unread: Record<string, number>;
  chatWith: string | null;
  chat: Message[];
  conflict: { remote: CloudSave; local: SaveSummary; cloud: SaveSummary } | null;
}

export const useOnline = create<OnlineState>(() => ({
  ready: false,
  kind: null,
  userId: null,
  profile: null,
  status: 'off',
  lastSync: null,
  error: null,
  friends: [],
  unread: {},
  chatWith: null,
  chat: [],
  conflict: null,
}));

let backend: OnlineBackend | null = null;
const clanListeners = new Set<(m: ClanMessage) => void>();

/** Текущий онлайн-бэкенд (после initOnline). */
export function onlineBackend(): OnlineBackend | null {
  return backend;
}
/** Подписка на сообщения клана (их слушает src/state/clan.ts). */
export function onClanMessage(cb: (m: ClanMessage) => void): () => void {
  clanListeners.add(cb);
  return () => clanListeners.delete(cb);
}
let unsub: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let syncing = false;

const set = useOnline.setState;
const syncKey = (uid: string) => `online.lastSync.${uid}`;

export function errorText(e: unknown): string {
  if (e instanceof OnlineError) {
    const k = `online.err.${e.code}`;
    const t = tr(k);
    return t === k ? e.message : t;
  }
  return e instanceof Error ? e.message : String(e);
}

function summary(s: SaveData): SaveSummary {
  return {
    level: s.player.level,
    gold: s.currencies.gold,
    heroes: s.heroes.length,
    stars: Object.values(s.campaign.stars).reduce((a, b) => a + b, 0),
    updatedAt: s.updatedAt,
  };
}

function isFresh(s: SaveData): boolean {
  return s.stats.battlesWon + s.stats.battlesLost === 0 && s.summon.total === 0;
}

/** Запуск онлайна после загрузки сейва. */
export async function initOnline() {
  backend = await createOnlineBackend();
  set({ kind: backend.kind, ready: true });
  const uid = await backend.currentUserId().catch(() => null);
  if (uid) await afterLogin(uid);
  platform().lifecycle.onPause(() => void syncNow());
  platform().lifecycle.onResume(() => {
    if (useOnline.getState().userId) void syncNow().then(refreshSocial);
  });
}

async function afterLogin(uid: string) {
  set({ userId: uid, error: null });
  try {
    set({ profile: await backend!.myProfile() });
  } catch (e) {
    set({ error: errorText(e) });
  }
  unsub?.();
  unsub = backend!.subscribe((ev) => {
    if (ev.type === 'friends') void refreshSocial();
    else if (ev.type === 'clanMessage') for (const l of clanListeners) l(ev.message);
    else {
      const st = useOnline.getState();
      if (st.chatWith === ev.message.from) {
        set({ chat: [...st.chat, ev.message] });
        void backend!.markRead(ev.message.from);
      } else {
        set({ unread: { ...st.unread, [ev.message.from]: (st.unread[ev.message.from] ?? 0) + 1 } });
        const f = st.friends.find((x) => x.profile.id === ev.message.from);
        useGame.getState().showToast(tr('online.newMessage', { name: f?.profile.nickname ?? '…' }));
        platform().haptics.impact('light');
      }
    }
  });
  if (timer) clearInterval(timer);
  timer = setInterval(() => void syncNow(), 120_000);
  await syncNow();
  await refreshSocial();
}

export async function signUp(email: string, password: string, nickname: string) {
  await backend!.signUp(email, password, nickname);
  const uid = await backend!.currentUserId();
  if (uid) await afterLogin(uid);
}

export async function signIn(email: string, password: string) {
  await backend!.signIn(email, password);
  const uid = await backend!.currentUserId();
  if (uid) await afterLogin(uid);
}

export async function signOut() {
  await syncNow();
  unsub?.();
  unsub = null;
  if (timer) clearInterval(timer);
  timer = null;
  await backend!.signOut();
  set({
    userId: null,
    profile: null,
    status: 'off',
    friends: [],
    unread: {},
    chat: [],
    chatWith: null,
    conflict: null,
  });
}

/** Синхронизация сейва с облаком и публикация профиля (уровень, сила, рейтинг арены). */
export async function syncNow(): Promise<void> {
  const st = useOnline.getState();
  if (!backend || !st.userId || syncing || st.conflict) return;
  syncing = true;
  set({ status: 'syncing' });
  try {
    const p = platform();
    const local = saves().data;
    const remote = await backend.pullSave();
    const lastSynced = Number((await p.storage.get(syncKey(st.userId))) ?? 0);
    let action = decideSync(local.updatedAt, remote?.updatedAt ?? null, lastSynced);
    // Новая установка на втором устройстве: облачный прогресс подтягиваем без вопросов.
    if (remote && lastSynced === 0 && isFresh(local)) action = 'pull';
    if (action === 'conflict' && remote) {
      const cloud = saves().parse(remote.json);
      set({ status: 'conflict', conflict: { remote, local: summary(local), cloud: summary(cloud) } });
      return;
    }
    if (action === 'push') {
      await backend.pushSave({
        json: JSON.stringify(local),
        version: SAVE_VERSION,
        updatedAt: local.updatedAt,
        device: p.name,
      });
      await p.storage.set(syncKey(st.userId), String(local.updatedAt));
    } else if (action === 'pull' && remote) {
      await saves().importJson(remote.json);
      await p.storage.set(syncKey(st.userId), String(remote.updatedAt));
      useGame.getState().showToast(tr('online.pulled'));
    }
    await publishProfile();
    set({ status: 'ok', lastSync: Date.now(), error: null });
  } catch (e) {
    set({ status: 'error', error: errorText(e) });
  } finally {
    syncing = false;
  }
}

async function publishProfile() {
  const s = saves().data;
  const team = teamHeroes(s);
  await backend!.updateProfile({
    level: s.player.level,
    power: teamPower(s),
    arenaRating: s.arena.rating,
    avatar: team[0] ? heroDef(team[0].heroId).art : 'knight',
  });
  await backend!.touch();
  set({ profile: await backend!.myProfile() });
  // Статистика для таблиц лидеров и защитная команда для арены игроков.
  await backend!.submitStats(statsOf(s)).catch(() => undefined);
}

/** Что отправляем серверу: сила команды, уровень, башня, коллекция и защита (текущая команда). */
export function statsOf(s: SaveData) {
  const team = teamHeroes(s);
  return {
    power: teamPower(s),
    level: s.player.level,
    tower: s.tower.floor,
    collection: new Set(s.heroes.map((h) => h.heroId)).size,
    team: team.map((h) => {
      const spec = heroSpec(h, s);
      return {
        defId: spec.defId,
        level: spec.level,
        stars: spec.stars ?? 1,
        awakened: spec.awakened,
        bonus: spec.bonus as Record<string, number> | undefined,
        bonusPct: spec.bonusPct as Record<string, number> | undefined,
      };
    }),
    teamPower: teamPower(s),
  };
}

/** Обновить защиту сейчас (после смены команды). */
export async function submitDefenseNow() {
  if (!backend || !useOnline.getState().userId) return;
  await backend.submitStats(statsOf(saves().data));
}

/** Игрок выбирает, какую копию оставить. */
export async function resolveConflict(keep: 'local' | 'cloud') {
  const st = useOnline.getState();
  if (!backend || !st.userId || !st.conflict) return;
  const p = platform();
  if (keep === 'cloud') {
    await saves().importJson(st.conflict.remote.json);
    await p.storage.set(syncKey(st.userId), String(st.conflict.remote.updatedAt));
    set({ conflict: null });
  } else {
    const local = saves().data;
    await backend.pushSave({
      json: JSON.stringify(local),
      version: SAVE_VERSION,
      updatedAt: local.updatedAt,
      device: p.name,
    });
    await p.storage.set(syncKey(st.userId), String(local.updatedAt));
    set({ conflict: null });
  }
  set({ status: 'ok', lastSync: Date.now() });
}

export async function refreshSocial() {
  if (!backend || !useOnline.getState().userId) return;
  try {
    await backend.touch();
    const [friends, unread] = await Promise.all([backend.friends(), backend.unreadCounts()]);
    set({ friends, unread });
  } catch (e) {
    set({ error: errorText(e) });
  }
}

export async function rename(nickname: string) {
  await backend!.updateProfile({ nickname });
  set({ profile: await backend!.myProfile() });
}

export const findPlayers = (q: string) => backend!.findPlayers(q);

export async function requestFriend(userId: string) {
  await backend!.requestFriend(userId);
  await refreshSocial();
}
export async function acceptFriend(id: string) {
  await backend!.acceptFriend(id);
  await refreshSocial();
}
export async function removeFriend(id: string) {
  await backend!.removeFriend(id);
  await refreshSocial();
}

export async function openChat(userId: string) {
  set({ chatWith: userId, chat: [] });
  useGame.getState().go('chat');
  const chat = await backend!.messages(userId, 80);
  await backend!.markRead(userId);
  const unread = { ...useOnline.getState().unread };
  delete unread[userId];
  set({ chat, unread });
}

export function closeChat() {
  set({ chatWith: null, chat: [] });
}

export async function sendChat(text: string) {
  const to = useOnline.getState().chatWith;
  if (!to) return;
  const m = await backend!.sendMessage(to, text);
  set({ chat: [...useOnline.getState().chat, m] });
}

export function totalUnread(): number {
  const st = useOnline.getState();
  return (
    Object.values(st.unread).reduce((a, b) => a + b, 0) +
    st.friends.filter((f) => f.status === 'incoming').length
  );
}
