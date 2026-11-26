import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DonationId, JoinMode, ClanRole, WeeklyGoalId } from '@/game/clan';
import type {
  BossAttempt,
  BossOutcome,
  ClanBrowse,
  ClanCreateInput,
  ClanInfo,
  ClanMessage,
  ClanPatch,
  ClanState,
  ClanToday,
} from './clanTypes';
import type {
  DefenseUnit,
  LeaderKind,
  LeaderScope,
  Leaderboard,
  PlayerCard,
  PvpBattle,
  PvpOpponent,
  PvpOutcome,
  PvpState,
  StatsSubmit,
} from './socialTypes';
import {
  SERVER_ERROR_CODES,
  type OnlineErrorCode,
  OnlineError,
  MAX_MESSAGE,
  validateNickname,
  type CloudSave,
  type Friend,
  type Message,
  type OnlineBackend,
  type OnlineEvent,
  type Profile,
} from './types';

interface ProfileRow {
  id: string;
  nickname: string;
  friend_code: string;
  avatar: string;
  level: number;
  power: number;
  arena_rating: number;
  last_seen: string;
}
interface MessageRow {
  id: number;
  sender: string;
  recipient: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  nickname: r.nickname,
  friendCode: r.friend_code,
  avatar: r.avatar,
  level: r.level,
  power: r.power,
  arenaRating: r.arena_rating,
  lastSeen: Date.parse(r.last_seen),
});
const toMessage = (r: MessageRow): Message => ({
  id: String(r.id),
  from: r.sender,
  to: r.recipient,
  body: r.body,
  at: Date.parse(r.created_at),
  readAt: r.read_at ? Date.parse(r.read_at) : null,
});

function fail(e: { code?: string; message?: string } | null): never {
  // Клановые функции сообщают причину кодом в тексте исключения (raise exception 'clan_full').
  const known = SERVER_ERROR_CODES.find((c) => e?.message === c);
  if (known) throw new OnlineError(known as OnlineErrorCode, e?.message);
  if (e?.code === '23505') throw new OnlineError('already', e.message);
  if (e?.code === '42501') throw new OnlineError('not_friends', e.message);
  throw new OnlineError('network', e?.message ?? 'Ошибка сервера');
}

// ———————————————————— кланы: разбор ответов ————————————————————

interface ClanJson {
  id: string;
  name: string;
  tag: string;
  emblem: string;
  color: string;
  description: string;
  join_mode: JoinMode;
  min_level: number;
  xp: number;
  members: number;
  boss_level: number;
  boss_kills: number;
  created_at: string;
}
interface TodayJson {
  keys: number;
  damage: number;
  checkin: boolean;
  donations: DonationId[];
}
interface ClanMsgJson {
  id: number;
  clan_id: string;
  sender: string | null;
  nickname: string | null;
  body: string;
  kind: 'chat' | 'system';
  created_at: string;
}
const toClan = (c: ClanJson): ClanInfo => ({
  id: c.id,
  name: c.name,
  tag: c.tag,
  emblem: c.emblem,
  color: c.color,
  description: c.description,
  joinMode: c.join_mode,
  minLevel: c.min_level,
  xp: c.xp,
  members: Number(c.members),
  bossLevel: c.boss_level,
  bossKills: c.boss_kills,
  createdAt: Date.parse(c.created_at),
});
const toToday = (t: TodayJson): ClanToday => ({
  keys: t.keys,
  damage: Number(t.damage),
  checkin: t.checkin,
  donations: t.donations ?? [],
});
const toClanMsg = (m: ClanMsgJson): ClanMessage => ({
  id: String(m.id),
  clanId: m.clan_id,
  from: m.sender,
  nickname: m.nickname,
  body: m.body,
  kind: m.kind,
  at: Date.parse(m.created_at),
});

/** Бэкенд на Supabase: Auth (почта+пароль), Postgres с RLS (supabase/migrations), Realtime для чата. */
export class SupabaseOnlineBackend implements OnlineBackend {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  }

  private async uid(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new OnlineError('auth', 'Нужно войти в аккаунт');
    return id;
  }

  async currentUserId() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  /** Профиль создаётся при первом входе (после подтверждения почты сессии при регистрации может не быть). */
  private async ensureProfile(nickname?: string) {
    const id = await this.uid();
    const { data } = await this.sb.from('profiles').select('id').eq('id', id).maybeSingle();
    if (data) return;
    const { data: u } = await this.sb.auth.getUser();
    const nick =
      nickname ??
      (u.user?.user_metadata?.nickname as string | undefined) ??
      `Хранитель${Math.floor(Math.random() * 9000 + 1000)}`;
    const { error } = await this.sb.from('profiles').insert({ id, nickname: nick });
    if (error?.code === '23505') {
      const { error: e2 } = await this.sb
        .from('profiles')
        .insert({ id, nickname: `${nick.slice(0, 15)}${Math.floor(Math.random() * 9000 + 1000)}` });
      if (e2) fail(e2);
    } else if (error) fail(error);
  }

  async signUp(email: string, password: string, nickname: string) {
    if (!validateNickname(nickname)) throw new OnlineError('invalid', 'Ник: 2–20 символов');
    // До входа чтение профилей может быть запрещено: тогда занятость ника проверит уникальный индекс.
    const { data: taken, error: takenErr } = await this.sb
      .from('profiles')
      .select('id')
      .ilike('nickname', nickname.trim())
      .maybeSingle();
    if (!takenErr && taken) throw new OnlineError('nickname_taken');
    const { data, error } = await this.sb.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { nickname: nickname.trim() } },
    });
    if (error)
      throw new OnlineError(error.message.includes('registered') ? 'already' : 'invalid', error.message);
    if (!data.session)
      throw new OnlineError('confirm_email', 'Подтвердите почту по ссылке из письма и войдите');
    await this.ensureProfile(nickname.trim());
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new OnlineError('auth', error.message);
    await this.ensureProfile();
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async myProfile() {
    const id = await this.uid();
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', id).single();
    if (error || !data) fail(error);
    return toProfile(data as ProfileRow);
  }

  async updateProfile(p: Partial<Pick<Profile, 'nickname' | 'avatar' | 'level' | 'power' | 'arenaRating'>>) {
    const id = await this.uid();
    if (p.nickname !== undefined && !validateNickname(p.nickname)) throw new OnlineError('invalid');
    const row: Record<string, unknown> = {};
    if (p.nickname !== undefined) row.nickname = p.nickname.trim();
    if (p.avatar !== undefined) row.avatar = p.avatar;
    if (p.level !== undefined) row.level = p.level;
    if (p.power !== undefined) row.power = p.power;
    if (p.arenaRating !== undefined) row.arena_rating = p.arenaRating;
    const { error } = await this.sb.from('profiles').update(row).eq('id', id);
    if (error?.code === '23505') throw new OnlineError('nickname_taken');
    if (error) fail(error);
  }

  async touch() {
    const id = await this.uid();
    await this.sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', id);
  }

  async pullSave(): Promise<CloudSave | null> {
    const id = await this.uid();
    const { data, error } = await this.sb
      .from('saves')
      .select('data, version, updated_at, device')
      .eq('user_id', id)
      .maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    return {
      json: JSON.stringify(data.data),
      version: data.version,
      updatedAt: Date.parse(data.updated_at),
      device: data.device ?? undefined,
    };
  }

  async pushSave(s: CloudSave) {
    const id = await this.uid();
    const { error } = await this.sb.from('saves').upsert({
      user_id: id,
      data: JSON.parse(s.json),
      version: s.version,
      updated_at: new Date(s.updatedAt).toISOString(),
      device: s.device ?? null,
    });
    if (error) fail(error);
  }

  async friends(): Promise<Friend[]> {
    const me = await this.uid();
    const { data, error } = await this.sb
      .from('friendships')
      .select('id, requester, addressee, status')
      .or(`requester.eq.${me},addressee.eq.${me}`);
    if (error) fail(error);
    const rows = (data ?? []) as { id: number; requester: string; addressee: string; status: string }[];
    const others = rows.map((r) => (r.requester === me ? r.addressee : r.requester));
    if (!others.length) return [];
    const { data: profs, error: e2 } = await this.sb.from('profiles').select('*').in('id', others);
    if (e2) fail(e2);
    const map = new Map((profs as ProfileRow[]).map((p) => [p.id, toProfile(p)]));
    return rows
      .map((r) => {
        const other = r.requester === me ? r.addressee : r.requester;
        const status = r.status === 'accepted' ? 'accepted' : r.requester === me ? 'outgoing' : 'incoming';
        return { friendshipId: String(r.id), status, profile: map.get(other)! } as Friend;
      })
      .filter((f) => !!f.profile);
  }

  async findPlayers(query: string) {
    const me = await this.uid();
    const q = query.trim();
    if (q.length < 2) return [];
    const isCode = /^[A-Za-z0-9]{6}$/.test(q);
    const req = this.sb.from('profiles').select('*').neq('id', me).limit(10);
    const { data, error } = isCode
      ? await req.or(`friend_code.eq.${q.toUpperCase()},nickname.ilike.${q}%`)
      : await req.ilike('nickname', `${q.replace(/[%_]/g, '')}%`);
    if (error) fail(error);
    return (data as ProfileRow[]).map(toProfile);
  }

  async requestFriend(userId: string) {
    const me = await this.uid();
    const { error } = await this.sb.from('friendships').insert({ requester: me, addressee: userId });
    if (error) fail(error);
  }

  async acceptFriend(friendshipId: string) {
    const { error } = await this.sb
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', Number(friendshipId));
    if (error) fail(error);
  }

  async removeFriend(friendshipId: string) {
    const { error } = await this.sb.from('friendships').delete().eq('id', Number(friendshipId));
    if (error) fail(error);
  }

  async messages(withUser: string, limit = 50) {
    const me = await this.uid();
    const { data, error } = await this.sb
      .from('messages')
      .select('*')
      .or(`and(sender.eq.${me},recipient.eq.${withUser}),and(sender.eq.${withUser},recipient.eq.${me})`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) fail(error);
    return (data as MessageRow[]).map(toMessage).reverse();
  }

  async sendMessage(to: string, body: string) {
    const me = await this.uid();
    const text = body.trim().slice(0, MAX_MESSAGE);
    if (!text) throw new OnlineError('invalid');
    const { data, error } = await this.sb
      .from('messages')
      .insert({ sender: me, recipient: to, body: text })
      .select('*')
      .single();
    if (error) fail(error);
    return toMessage(data as MessageRow);
  }

  async markRead(withUser: string) {
    const me = await this.uid();
    await this.sb
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient', me)
      .eq('sender', withUser)
      .is('read_at', null);
  }

  async unreadCounts() {
    const me = await this.uid();
    const { data, error } = await this.sb
      .from('messages')
      .select('sender')
      .eq('recipient', me)
      .is('read_at', null)
      .limit(1000);
    if (error) fail(error);
    const out: Record<string, number> = {};
    for (const r of data as { sender: string }[]) out[r.sender] = (out[r.sender] ?? 0) + 1;
    return out;
  }

  // ———————————————————— кланы ————————————————————

  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    await this.uid();
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) fail(error);
    return data as T;
  }

  async myClan(): Promise<ClanState | null> {
    type J = {
      clan: ClanJson;
      me: { role: ClanRole; joined_at: string; today: TodayJson };
      members: {
        profile: ProfileRow;
        role: ClanRole;
        joined_at: string;
        contribution: number;
        today: TodayJson;
      }[];
      boss: { level: number; hp: number; hp_max: number; kills: number; day: number };
      requests: { profile: ProfileRow; at: string }[];
      week: { week: number; attacks: number; checkins: number; kills: number; claimed: string[] };
      pending_kills: number[];
      yesterday: { rank: number; damage: number; of: number } | null;
    };
    const j = await this.rpc<J | null>('clan_state');
    if (!j) return null;
    const order: Record<ClanRole, number> = { leader: 0, officer: 1, member: 2 };
    return {
      clan: toClan(j.clan),
      me: { role: j.me.role, joinedAt: Date.parse(j.me.joined_at), today: toToday(j.me.today) },
      members: j.members
        .map((m) => ({
          profile: toProfile(m.profile),
          role: m.role,
          joinedAt: Date.parse(m.joined_at),
          contribution: m.contribution,
          today: toToday(m.today),
        }))
        .sort((a, b) => order[a.role] - order[b.role] || b.contribution - a.contribution),
      boss: {
        level: j.boss.level,
        hp: Number(j.boss.hp),
        hpMax: Number(j.boss.hp_max),
        kills: j.boss.kills,
        day: j.boss.day,
      },
      requests: j.requests.map((r) => ({ profile: toProfile(r.profile), at: Date.parse(r.at) })),
      week: j.week,
      pendingKills: j.pending_kills,
      yesterday: j.yesterday
        ? { ...j.yesterday, damage: Number(j.yesterday.damage), of: Number(j.yesterday.of) }
        : null,
    };
  }

  async browseClans(query: string): Promise<ClanBrowse> {
    const j = await this.rpc<{ clans: ClanJson[]; requested: string[]; cooldown_until: string | null }>(
      'search_clans',
      { p_query: query.trim().replace(/[%_]/g, '') },
    );
    return {
      clans: j.clans.map(toClan),
      requested: j.requested,
      cooldownUntil: j.cooldown_until ? Date.parse(j.cooldown_until) : null,
    };
  }

  async createClan(i: ClanCreateInput) {
    return this.rpc<string>('create_clan', {
      p_name: i.name,
      p_tag: i.tag,
      p_emblem: i.emblem,
      p_color: i.color,
      p_description: i.description,
      p_join_mode: i.joinMode,
      p_min_level: i.minLevel,
    });
  }
  async joinClan(clanId: string) {
    return this.rpc<'joined' | 'requested'>('join_clan', { p_clan: clanId });
  }
  async cancelClanRequest(clanId: string) {
    await this.rpc('cancel_clan_request', { p_clan: clanId });
  }
  async leaveClan() {
    await this.rpc('leave_clan');
  }
  async respondClanRequest(userId: string, accept: boolean) {
    await this.rpc('respond_clan_request', { p_user: userId, p_accept: accept });
  }
  async kickClanMember(userId: string) {
    await this.rpc('kick_clan_member', { p_user: userId });
  }
  async setClanRole(userId: string, role: 'officer' | 'member') {
    await this.rpc('set_clan_role', { p_user: userId, p_role: role });
  }
  async transferClanLeader(userId: string) {
    await this.rpc('transfer_clan_leader', { p_user: userId });
  }
  async updateClan(p: ClanPatch) {
    await this.rpc('update_clan', {
      p_description: p.description ?? null,
      p_join_mode: p.joinMode ?? null,
      p_min_level: p.minLevel ?? null,
      p_emblem: p.emblem ?? null,
      p_color: p.color ?? null,
    });
  }
  async clanCheckin() {
    await this.rpc('clan_checkin');
  }
  async clanDonate(kind: DonationId) {
    await this.rpc('clan_donate', { p_kind: kind });
  }
  async bossBegin(): Promise<BossAttempt> {
    const j = await this.rpc<{
      attempt_id: number;
      seed: number;
      level: number;
      hp: number;
      hp_max: number;
      day: number;
    }>('boss_begin');
    return {
      attemptId: String(j.attempt_id),
      seed: Number(j.seed) >>> 0,
      level: j.level,
      hp: Number(j.hp),
      hpMax: Number(j.hp_max),
      day: j.day,
    };
  }
  async bossFinish(attemptId: string, damage: number): Promise<BossOutcome> {
    const j = await this.rpc<{
      damage: number;
      level: number;
      killed: boolean;
      boss_level: number;
      boss_hp: number;
    }>('boss_finish', { p_attempt: Number(attemptId), p_damage: Math.max(0, Math.floor(damage)) });
    return {
      damage: Number(j.damage),
      level: j.level,
      killed: j.killed,
      bossLevel: j.boss_level,
      bossHp: Number(j.boss_hp),
    };
  }
  async claimClanKill(level: number) {
    await this.rpc('claim_clan_kill', { p_level: level });
  }
  async claimClanWeekly(goal: WeeklyGoalId, step: number) {
    await this.rpc('claim_clan_weekly', { p_goal: goal, p_step: step });
  }
  async claimClanRank() {
    const j = await this.rpc<{ rank: number; damage: number; of: number } | null>('claim_clan_rank');
    return j ? { rank: Number(j.rank), damage: Number(j.damage), of: Number(j.of) } : null;
  }
  async clanMessages(limit = 60) {
    const j = await this.rpc<ClanMsgJson[]>('clan_messages_list', { p_limit: limit });
    return j.map(toClanMsg);
  }
  async sendClanMessage(body: string) {
    const j = await this.rpc<ClanMsgJson>('send_clan_message', { p_body: body.slice(0, MAX_MESSAGE) });
    return toClanMsg(j);
  }

  // ———————————————————— лидеры и PvP ————————————————————

  async submitStats(s: StatsSubmit) {
    await this.rpc('submit_stats', {
      p_power: Math.floor(s.power),
      p_level: Math.floor(s.level),
      p_tower: Math.floor(s.tower),
      p_collection: Math.floor(s.collection),
      p_team: s.team,
      p_team_power: Math.floor(s.teamPower),
    });
  }

  async leaderboard(kind: LeaderKind, scope: LeaderScope): Promise<Leaderboard> {
    type Row = { rank: number; profile: ProfileRow; value: number; clan_tag: string | null };
    const j = await this.rpc<{ rows: Row[]; me: Row | null }>('leaderboard', {
      p_kind: kind,
      p_scope: scope,
    });
    const map = (r: Row) => ({
      rank: Number(r.rank),
      profile: toProfile(r.profile),
      value: Number(r.value),
      clanTag: r.clan_tag,
    });
    return { rows: j.rows.map(map), me: j.me ? map(j.me) : null };
  }

  private toOpp(o: {
    profile: ProfileRow;
    rating: number;
    power: number;
    team: DefenseUnit[];
    revenge?: boolean;
  }): PvpOpponent {
    return {
      profile: toProfile(o.profile),
      rating: o.rating,
      power: o.power,
      team: o.team,
      revenge: !!o.revenge,
    };
  }

  private toPvpState(j: {
    rating: number;
    attacks_left: number;
    defense: DefenseUnit[];
    opponents: {
      profile: ProfileRow;
      rating: number;
      power: number;
      team: DefenseUnit[];
      revenge?: boolean;
    }[];
    log: {
      id: number;
      attacker: ProfileRow;
      defender: ProfileRow;
      attacker_won: boolean;
      delta: number;
      at: string;
      revenge: boolean;
    }[];
  }): PvpState {
    return {
      rating: j.rating,
      attacksLeft: j.attacks_left,
      defense: j.defense,
      opponents: j.opponents.map((o) => this.toOpp(o)),
      log: j.log.map((l) => ({
        id: String(l.id),
        attacker: toProfile(l.attacker),
        defender: toProfile(l.defender),
        attackerWon: l.attacker_won,
        delta: l.delta,
        at: Date.parse(l.at),
        revenge: l.revenge,
      })),
    };
  }

  async pvpState() {
    return this.toPvpState(await this.rpc('pvp_state'));
  }
  async pvpRefresh() {
    return this.toPvpState(await this.rpc('pvp_refresh'));
  }
  async pvpBegin(defenderId: string): Promise<PvpBattle> {
    const j = await this.rpc<{
      battle_id: number;
      seed: number;
      defender: Parameters<SupabaseOnlineBackend['toOpp']>[0];
    }>('pvp_begin', { p_defender: defenderId });
    return { battleId: String(j.battle_id), seed: Number(j.seed) >>> 0, defender: this.toOpp(j.defender) };
  }
  async pvpFinish(battleId: string, attackerWon: boolean): Promise<PvpOutcome> {
    return this.rpc<PvpOutcome>('pvp_finish', { p_battle: Number(battleId), p_won: attackerWon });
  }
  async playerCard(userId: string): Promise<PlayerCard> {
    const j = await this.rpc<{
      profile: ProfileRow;
      power: number;
      level: number;
      tower: number;
      pvp_rating: number;
      collection: number;
      team: DefenseUnit[];
      clan_tag: string | null;
      clan_name: string | null;
    }>('player_card', { p_user: userId });
    return {
      profile: toProfile(j.profile),
      power: j.power,
      level: j.level,
      tower: j.tower,
      pvpRating: j.pvp_rating,
      collection: j.collection,
      team: j.team,
      clanTag: j.clan_tag,
      clanName: j.clan_name,
    };
  }

  subscribe(cb: (e: OnlineEvent) => void) {
    let ch: ReturnType<SupabaseClient['channel']> | null = null;
    let closed = false;
    void this.uid()
      .then((me) => {
        if (closed) return;
        ch = this.sb
          .channel(`kaelmor-${me}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient=eq.${me}` },
            (p) => cb({ type: 'message', message: toMessage(p.new as MessageRow) }),
          )
          .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () =>
            cb({ type: 'friends' }),
          )
          // RLS пропускает только сообщения своего клана.
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clan_messages' }, (p) => {
            const row = p.new as Omit<ClanMsgJson, 'nickname'>;
            const nick = row.sender
              ? this.sb.from('profiles').select('nickname').eq('id', row.sender).maybeSingle()
              : Promise.resolve({ data: null });
            void nick.then(({ data }) =>
              cb({
                type: 'clanMessage',
                message: toClanMsg({
                  ...row,
                  nickname: (data as { nickname: string } | null)?.nickname ?? null,
                }),
              }),
            );
          })
          .subscribe();
      })
      .catch(() => undefined);
    return () => {
      closed = true;
      if (ch) void this.sb.removeChannel(ch);
    };
  }
}
