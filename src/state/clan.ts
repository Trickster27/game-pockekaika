import type { MaterialId } from '@/save/schema';
import { create } from 'zustand';
import type {
  BossAttempt,
  ClanBrowse,
  ClanCreateInput,
  ClanMessage,
  ClanPatch,
  ClanState,
  ClanSystemBody,
} from '@/online';
import {
  CHEST_TIERS,
  CLAN,
  DONATIONS,
  bossElement,
  bossSpec,
  chestReward,
  chestTier,
  clanLevel,
  clanPerks,
  grantClanReward,
  heroSpec,
  killReward,
  rankReward,
  teamHeroes,
  weeklyReward,
  type ClanReward,
  type DonationId,
  type WeeklyGoalId,
} from '@/game';
import type { BattleResult } from '@/core/battle';
import type { Item } from '@/save/schema';
import { formatNumber, tr } from '@/i18n';
import { SETS, SLOT_NAME, type Slot } from '@/content';
import { platform } from './services';
import { useGame, type RewardLine } from './store';
import { errorText, onClanMessage, onlineBackend, useOnline } from './online';

/**
 * Состояние клана на клиенте. Источник правды — сервер (или демо-сервер):
 * после каждого действия состояние перечитывается целиком.
 */
interface ClanStore {
  loading: boolean;
  /** Состояние загружено хотя бы раз для текущего аккаунта. */
  loaded: boolean;
  state: ClanState | null;
  browse: ClanBrowse | null;
  messages: ClanMessage[];
  unread: number;
  chatOpen: boolean;
  busy: string | null;
  popup: { title: string; lines: RewardLine[] } | null;
}

export const useClan = create<ClanStore>(() => ({
  loading: false,
  loaded: false,
  state: null,
  browse: null,
  messages: [],
  unread: 0,
  chatOpen: false,
  busy: null,
  popup: null,
}));
const set = useClan.setState;

// ———————————————————— несохранённые попытки ————————————————————

const PENDING_KEY = 'kaelmor:clan-pending';
interface PendingFinish {
  attemptId: string;
  damage: number;
  level: number;
}
function readPending(): PendingFinish[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]') as PendingFinish[];
  } catch {
    return [];
  }
}
function writePending(list: PendingFinish[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* хранилище недоступно */
  }
}

// ———————————————————— сообщения ————————————————————

let unsub: (() => void) | null = null;
function listen() {
  unsub ??= onClanMessage((m) => {
    const st = useClan.getState();
    if (!st.state || m.clanId !== st.state.clan.id) {
      // Сообщение могло прийти в момент вступления — перечитаем клан.
      void refreshClan();
      return;
    }
    if (st.messages.some((x) => x.id === m.id)) return;
    const mine = m.from === useOnline.getState().userId;
    set({
      messages: [...st.messages, m].slice(-200),
      unread: st.chatOpen || mine ? st.unread : st.unread + 1,
    });
    if (m.kind === 'system') void refreshClan();
  });
}

export function systemText(m: ClanMessage): string {
  try {
    const b = JSON.parse(m.body) as ClanSystemBody;
    return tr(`clan.sys.${b.k}`, b.a);
  } catch {
    return m.body;
  }
}

// ———————————————————— загрузка ————————————————————

export async function refreshClan(): Promise<void> {
  const be = onlineBackend();
  if (!be || !useOnline.getState().userId) {
    set({ state: null, browse: null, loaded: true });
    return;
  }
  listen();
  set({ loading: true });
  try {
    await flushPending();
    const state = await be.myClan();
    const prev = useClan.getState().state;
    set({ state, loaded: true });
    if (state) {
      if (prev?.clan.id !== state.clan.id) await refreshMessages();
    } else {
      set({ browse: await be.browseClans(''), messages: [], unread: 0 });
    }
  } catch (e) {
    useGame.getState().showToast(errorText(e));
  } finally {
    set({ loading: false });
  }
}

export async function refreshMessages() {
  const be = onlineBackend();
  if (!be || !useClan.getState().state) return;
  try {
    set({ messages: await be.clanMessages(100) });
  } catch {
    /* не критично */
  }
}

export async function searchClans(q: string) {
  const be = onlineBackend();
  if (!be) return;
  try {
    set({ browse: await be.browseClans(q) });
  } catch (e) {
    useGame.getState().showToast(errorText(e));
  }
}

export function setChatOpen(open: boolean) {
  set({ chatOpen: open, ...(open ? { unread: 0 } : {}) });
}

// ———————————————————— действия ————————————————————

/** Обёртка: блокирует кнопку, показывает ошибку, перечитывает клан. */
async function act<T>(key: string, fn: () => Promise<T>, refresh = true): Promise<T | undefined> {
  if (useClan.getState().busy) return undefined;
  set({ busy: key });
  try {
    const r = await fn();
    if (refresh) await refreshClan();
    return r;
  } catch (e) {
    useGame.getState().showToast(errorText(e));
    platform().haptics.notify('warning');
    if (refresh) await refreshClan();
    return undefined;
  } finally {
    set({ busy: null });
  }
}

function be() {
  const b = onlineBackend();
  if (!b) throw new Error(tr('online.err.auth'));
  return b;
}

function clanLvl(): number {
  const s = useClan.getState().state;
  return s ? clanLevel(s.clan.xp).level : 1;
}

/** Превращает награду в строки для окна наград. */
export function rewardLines(r: ClanReward, item?: Item): RewardLine[] {
  const lines: RewardLine[] = [];
  if (r.coins) lines.push({ icon: 'coin', label: tr('clan.coins'), value: `+${formatNumber(r.coins)}` });
  if (r.gold) lines.push({ icon: 'gold', label: tr('rewards.gold'), value: `+${formatNumber(r.gold)}` });
  if (r.shards) lines.push({ icon: 'shards', label: tr('rewards.shards'), value: `+${r.shards}` });
  if (r.energy) lines.push({ icon: 'energy', label: tr('currency.energy'), value: `+${r.energy}` });
  for (const [m, n] of Object.entries(r.materials ?? {}))
    if (n)
      lines.push({ icon: 'star', mat: m as MaterialId, label: tr(`labels.material.${m}`), value: `×${n}` });
  if (item)
    lines.push({
      icon: 'item',
      label: `${SLOT_NAME[item.slot as Slot]} · ${SETS.find((x) => x.id === item.set)?.name ?? ''}`,
      value: tr(`labels.rarity.${item.rarity}`),
    });
  return lines;
}

function give(title: string, r: ClanReward) {
  let out: { item?: Item } = {};
  useGame.getState().updateSave((s) => {
    out = grantClanReward(s, r);
  });
  set({ popup: { title, lines: rewardLines(r, out.item) } });
  platform().audio.play('reward');
  platform().haptics.notify('success');
}

export function closePopup() {
  set({ popup: null });
}

export async function createClanAction(input: ClanCreateInput): Promise<boolean> {
  const g = useGame.getState();
  const save = g.save!;
  if (save.player.level < CLAN.createMinLevel) {
    g.showToast(tr('online.err.clan_level'));
    return false;
  }
  if (save.currencies.gold < CLAN.createCost) {
    g.showToast(tr('clan.noGold', { n: formatNumber(CLAN.createCost) }));
    return false;
  }
  const id = await act('create', () => be().createClan(input));
  if (!id) return false;
  g.updateSave((s) => {
    s.currencies.gold -= CLAN.createCost;
  });
  return true;
}

export async function joinClanAction(clanId: string) {
  const r = await act('join:' + clanId, () => be().joinClan(clanId));
  if (r === 'requested') {
    useGame.getState().showToast(tr('clan.requested'));
    await searchClans('');
  }
}

export async function cancelRequestAction(clanId: string) {
  await act('cancel:' + clanId, () => be().cancelClanRequest(clanId));
  await searchClans('');
}

export async function leaveClanAction() {
  await act('leave', () => be().leaveClan());
}

export const respondAction = (userId: string, accept: boolean) =>
  act('respond:' + userId, () => be().respondClanRequest(userId, accept));
export const kickAction = (userId: string) => act('kick:' + userId, () => be().kickClanMember(userId));
export const setRoleAction = (userId: string, role: 'officer' | 'member') =>
  act('role:' + userId, () => be().setClanRole(userId, role));
export const transferAction = (userId: string) =>
  act('transfer:' + userId, () => be().transferClanLeader(userId));
export const updateClanAction = (patch: ClanPatch) => act('update', () => be().updateClan(patch));

export async function checkinAction() {
  const ok = await act('checkin', async () => {
    await be().clanCheckin();
    return true;
  });
  if (!ok) return;
  const k = 1 + clanPerks(clanLvl()).rewardBonus;
  give(tr('clan.checkinDone'), {
    gold: Math.round(CLAN.checkinReward.gold * k),
    coins: Math.round(CLAN.checkinReward.coins * k),
  });
}

export async function donateAction(kind: DonationId) {
  const g = useGame.getState();
  const def = DONATIONS.find((d) => d.id === kind)!;
  const save = g.save!;
  const cost = def.cost as { gold?: number; shards?: number };
  if ((cost.gold ?? 0) > save.currencies.gold || (cost.shards ?? 0) > save.currencies.shards) {
    g.showToast(tr('clan.notEnough'));
    return;
  }
  const ok = await act('donate:' + kind, async () => {
    await be().clanDonate(kind);
    return true;
  });
  if (!ok) return;
  g.updateSave((s) => {
    s.currencies.gold -= cost.gold ?? 0;
    s.currencies.shards -= cost.shards ?? 0;
  });
  give(tr('clan.donateDone', { xp: def.xp }), { coins: def.coins });
}

export async function claimKillAction(level: number) {
  const lvl = clanLvl();
  const ok = await act('kill:' + level, async () => {
    await be().claimClanKill(level);
    return true;
  });
  if (ok) give(tr('clan.killReward', { n: level }), killReward(level, lvl));
}

export async function claimWeeklyAction(goal: WeeklyGoalId, step: number) {
  const ok = await act(`week:${goal}:${step}`, async () => {
    await be().claimClanWeekly(goal, step);
    return true;
  });
  if (ok) give(tr('clan.weeklyReward'), weeklyReward(step));
}

export async function claimRankAction() {
  const r = await act('rank', () => be().claimClanRank());
  if (r) give(tr('clan.rankReward', { rank: r.rank, of: r.of }), rankReward(r.rank));
}

export async function sendClanMessageAction(body: string) {
  const text = body.trim();
  if (!text) return;
  try {
    const m = await be().sendClanMessage(text);
    const st = useClan.getState();
    if (!st.messages.some((x) => x.id === m.id)) set({ messages: [...st.messages, m] });
  } catch (e) {
    useGame.getState().showToast(errorText(e));
  }
}

// ———————————————————— босс ————————————————————

/** Отправляет попытки, которые не дошли до сервера (обрыв связи после боя). */
async function flushPending() {
  const list = readPending();
  if (!list.length) return;
  const rest: PendingFinish[] = [];
  for (const p of list) {
    try {
      const out = await be().bossFinish(p.attemptId, p.damage);
      const tier = chestTier(out.damage, out.level);
      give(tr('clan.lateChest'), chestReward(tier, out.level, clanLvl()));
    } catch (e) {
      // Попытка уже засчитана или просрочена — забываем; при сетевой ошибке пробуем позже.
      const code = (e as { code?: string }).code;
      if (code === 'network') rest.push(p);
    }
  }
  writePending(rest);
}

/** Запуск боя со Стражем Разлома: сервер списывает ключ и выдаёт seed. */
export async function startClanBoss(): Promise<boolean> {
  const g = useGame.getState();
  const save = g.save!;
  const team = teamHeroes(save);
  if (team.length === 0) {
    g.showToast(tr('campaign.noTeam'));
    return false;
  }
  const att: BossAttempt | undefined = await act('boss', () => be().bossBegin(), false);
  if (!att) return false;
  const element = bossElement(att.day);
  const lvl = clanLvl();
  g.startBattle({
    title: tr('clan.bossTitle', { n: att.level }),
    subtitle: tr(`labels.element.${element}`),
    scene: 'cathedral',
    setup: {
      allies: team.map((h) => heroSpec(h, save)),
      waves: [[bossSpec(att.level, element, att.hp)]],
      seed: att.seed,
      bossTurns: CLAN.bossTurns,
    },
    returnTo: 'clan',
    mode: 'boss',
    resultTitle: (r: BattleResult) =>
      r.winner === 'ally'
        ? tr('clan.bossKilled')
        : r.surrendered
          ? tr('clan.bossLeft')
          : r.winner === 'draw'
            ? tr('clan.bossTime')
            : tr('clan.bossFallen'),
    finish: async (r: BattleResult) => {
      const damage = r.damage ?? 0;
      let out;
      try {
        out = await be().bossFinish(att.attemptId, damage);
      } catch (e) {
        if ((e as { code?: string }).code === 'network')
          writePending([...readPending(), { attemptId: att.attemptId, damage, level: att.level }]);
        return [{ icon: 'star', label: errorText(e), value: '' }];
      }
      const tier = chestTier(out.damage, out.level);
      const reward = chestReward(tier, out.level, lvl);
      let item: Item | undefined;
      useGame.getState().updateSave((s) => {
        item = grantClanReward(s, reward).item;
      });
      const lines: RewardLine[] = [
        { icon: 'star', label: tr('clan.damage'), value: formatNumber(out.damage) },
        {
          icon: 'item',
          label: tr('clan.chest'),
          value: tier >= 0 ? tr(`clan.chests.${CHEST_TIERS[tier]!.id}`) : '—',
        },
        ...rewardLines(reward, item),
      ];
      if (out.damage < damage)
        lines.push({ icon: 'star', label: tr('clan.capped'), value: formatNumber(damage) });
      if (out.killed) lines.unshift({ icon: 'level', label: tr('clan.killedBy'), value: `${out.level}` });
      void refreshClan();
      return lines;
    },
  });
  return true;
}
