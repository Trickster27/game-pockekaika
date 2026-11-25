import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
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
  if (e?.code === '23505') throw new OnlineError('already', e.message);
  if (e?.code === '42501') throw new OnlineError('not_friends', e.message);
  throw new OnlineError('network', e?.message ?? 'Ошибка сервера');
}

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
    const { data: taken } = await this.sb
      .from('profiles')
      .select('id')
      .ilike('nickname', nickname.trim())
      .maybeSingle();
    if (taken) throw new OnlineError('nickname_taken');
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
          .subscribe();
      })
      .catch(() => undefined);
    return () => {
      closed = true;
      if (ch) void this.sb.removeChannel(ch);
    };
  }
}
