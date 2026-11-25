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

/**
 * Демо-«сервер» внутри браузера: позволяет потрогать аккаунт, друзей и чат без настоящего бэкенда.
 * Данные лежат в localStorage этого устройства. Три бота-Хранителя отвечают на сообщения.
 * Как только в .env указаны ключи Supabase, игра переключается на настоящий сервер.
 */
interface KV {
  get(k: string): string | null;
  set(k: string, v: string): void;
}

interface Account {
  id: string;
  email: string;
  pass: string;
}
interface FriendRow {
  id: string;
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
}
interface DB {
  accounts: Account[];
  profiles: Profile[];
  saves: Record<string, CloudSave>;
  friendships: FriendRow[];
  messages: Message[];
  session: string | null;
  seq: number;
}

const KEY = 'kaelmor:demo-online';
const BOTS: Profile[] = [
  {
    id: 'bot-agata',
    nickname: 'Агата',
    friendCode: 'AGATA7',
    avatar: 'selesta',
    level: 14,
    power: 9400,
    arenaRating: 1180,
    lastSeen: 0,
  },
  {
    id: 'bot-tikhon',
    nickname: 'Тихон',
    friendCode: 'TIXN42',
    avatar: 'dwarf',
    level: 9,
    power: 6100,
    arenaRating: 1040,
    lastSeen: 0,
  },
  {
    id: 'bot-zlata',
    nickname: 'Злата',
    friendCode: 'ZLATA3',
    avatar: 'elf',
    level: 21,
    power: 15800,
    arenaRating: 1460,
    lastSeen: 0,
  },
];
const REPLIES = [
  'Привет, Хранитель! Как поход?',
  'Я застряла на боссе главы. Советуешь кого взять?',
  'Лови совет: против Колосса бери Свет, Тьма ему нипочём.',
  'Ага, видела твой рейтинг на арене. Неплохо!',
  'Пойду фармить Склеп, мне нужен сет Быстроты.',
  'Удачи в башне!',
];

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const browserKV: KV = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

export class DemoOnlineBackend implements OnlineBackend {
  readonly kind = 'demo' as const;
  private listeners = new Set<(e: OnlineEvent) => void>();

  constructor(
    private readonly kv: KV = browserKV,
    private readonly opts: { botDelayMs?: number; now?: () => number } = {},
  ) {}

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  private load(): DB {
    const raw = this.kv.get(KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as DB;
      } catch {
        /* начнём заново */
      }
    }
    return {
      accounts: [],
      profiles: BOTS.map((b) => ({ ...b })),
      saves: {},
      friendships: [],
      messages: [],
      session: null,
      seq: 1,
    };
  }
  private save(db: DB) {
    this.kv.set(KEY, JSON.stringify(db));
  }
  private me(db: DB): string {
    if (!db.session) throw new OnlineError('auth', 'Нужно войти в аккаунт');
    return db.session;
  }
  private emit(e: OnlineEvent) {
    for (const l of this.listeners) l(e);
  }

  async currentUserId() {
    return this.load().session;
  }

  async signUp(email: string, password: string, nickname: string) {
    const db = this.load();
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e) || password.length < 6)
      throw new OnlineError('invalid', 'Почта или пароль не подходят');
    if (!validateNickname(nickname)) throw new OnlineError('invalid', 'Ник: 2–20 символов');
    if (db.accounts.some((a) => a.email === e))
      throw new OnlineError('already', 'Такая почта уже зарегистрирована');
    if (db.profiles.some((p) => p.nickname.toLowerCase() === nickname.trim().toLowerCase()))
      throw new OnlineError('nickname_taken');
    const id = `u${db.seq++}`;
    db.accounts.push({ id, email: e, pass: hash(password) });
    db.profiles.push({
      id,
      nickname: nickname.trim(),
      friendCode: `K${(db.seq * 7919).toString(36).toUpperCase().padStart(5, '0').slice(-5)}`,
      avatar: 'knight',
      level: 1,
      power: 0,
      arenaRating: 1000,
      lastSeen: this.now(),
    });
    // Для живости: Агата сразу в друзьях, Тихон прислал заявку.
    db.friendships.push({ id: `f${db.seq++}`, requester: 'bot-agata', addressee: id, status: 'accepted' });
    db.friendships.push({ id: `f${db.seq++}`, requester: 'bot-tikhon', addressee: id, status: 'pending' });
    db.messages.push({
      id: `m${db.seq++}`,
      from: 'bot-agata',
      to: id,
      body: 'Добро пожаловать в Каэлмор! Пиши, если нужен совет.',
      at: this.now(),
      readAt: null,
    });
    db.session = id;
    this.save(db);
  }

  async signIn(email: string, password: string) {
    const db = this.load();
    const a = db.accounts.find((x) => x.email === email.trim().toLowerCase());
    if (!a || a.pass !== hash(password)) throw new OnlineError('auth', 'Неверная почта или пароль');
    db.session = a.id;
    this.save(db);
  }

  async signOut() {
    const db = this.load();
    db.session = null;
    this.save(db);
  }

  async myProfile() {
    const db = this.load();
    const p = db.profiles.find((x) => x.id === this.me(db));
    if (!p) throw new OnlineError('not_found');
    return p;
  }

  async updateProfile(
    patch: Partial<Pick<Profile, 'nickname' | 'avatar' | 'level' | 'power' | 'arenaRating'>>,
  ) {
    const db = this.load();
    const me = this.me(db);
    if (patch.nickname !== undefined) {
      if (!validateNickname(patch.nickname)) throw new OnlineError('invalid');
      if (
        db.profiles.some(
          (p) => p.id !== me && p.nickname.toLowerCase() === patch.nickname!.trim().toLowerCase(),
        )
      )
        throw new OnlineError('nickname_taken');
      patch = { ...patch, nickname: patch.nickname.trim() };
    }
    const p = db.profiles.find((x) => x.id === me)!;
    Object.assign(p, patch);
    this.save(db);
  }

  async touch() {
    const db = this.load();
    const p = db.profiles.find((x) => x.id === db.session);
    if (p) p.lastSeen = this.now();
    // Боты «в сети» каждый в своё время.
    for (const b of db.profiles.filter((x) => x.id.startsWith('bot-')))
      b.lastSeen = b.id === 'bot-tikhon' ? this.now() - 3 * 3600_000 : this.now();
    this.save(db);
  }

  async pullSave() {
    const db = this.load();
    return db.saves[this.me(db)] ?? null;
  }

  async pushSave(s: CloudSave) {
    const db = this.load();
    db.saves[this.me(db)] = s;
    this.save(db);
  }

  async friends(): Promise<Friend[]> {
    const db = this.load();
    const me = this.me(db);
    return db.friendships
      .filter((f) => f.requester === me || f.addressee === me)
      .map((f) => {
        const other = f.requester === me ? f.addressee : f.requester;
        const status = f.status === 'accepted' ? 'accepted' : f.requester === me ? 'outgoing' : 'incoming';
        return { friendshipId: f.id, status, profile: db.profiles.find((p) => p.id === other)! } as Friend;
      })
      .filter((f) => !!f.profile);
  }

  async findPlayers(query: string) {
    const db = this.load();
    const me = this.me(db);
    const q = query.trim();
    if (q.length < 2) return [];
    return db.profiles
      .filter(
        (p) =>
          p.id !== me &&
          (p.friendCode === q.toUpperCase() || p.nickname.toLowerCase().startsWith(q.toLowerCase())),
      )
      .slice(0, 10);
  }

  async requestFriend(userId: string) {
    const db = this.load();
    const me = this.me(db);
    if (userId === me || !db.profiles.some((p) => p.id === userId)) throw new OnlineError('not_found');
    if (
      db.friendships.some(
        (f) =>
          (f.requester === me && f.addressee === userId) || (f.requester === userId && f.addressee === me),
      )
    )
      throw new OnlineError('already');
    db.friendships.push({ id: `f${db.seq++}`, requester: me, addressee: userId, status: 'pending' });
    this.save(db);
    // Боты принимают заявку через пару секунд.
    if (userId.startsWith('bot-')) {
      setTimeout(() => {
        const d = this.load();
        const f = d.friendships.find((x) => x.requester === me && x.addressee === userId);
        if (f) f.status = 'accepted';
        this.save(d);
        this.emit({ type: 'friends' });
      }, this.opts.botDelayMs ?? 2000);
    }
  }

  async acceptFriend(friendshipId: string) {
    const db = this.load();
    const me = this.me(db);
    const f = db.friendships.find((x) => x.id === friendshipId && x.addressee === me);
    if (!f) throw new OnlineError('not_found');
    f.status = 'accepted';
    this.save(db);
  }

  async removeFriend(friendshipId: string) {
    const db = this.load();
    const me = this.me(db);
    db.friendships = db.friendships.filter(
      (f) => !(f.id === friendshipId && (f.requester === me || f.addressee === me)),
    );
    this.save(db);
  }

  private friendsWith(db: DB, a: string, b: string) {
    return db.friendships.some(
      (f) =>
        f.status === 'accepted' &&
        ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)),
    );
  }

  async messages(withUser: string, limit = 50) {
    const db = this.load();
    const me = this.me(db);
    return db.messages
      .filter((m) => (m.from === me && m.to === withUser) || (m.from === withUser && m.to === me))
      .slice(-limit);
  }

  async sendMessage(to: string, body: string) {
    const db = this.load();
    const me = this.me(db);
    const text = body.trim().slice(0, MAX_MESSAGE);
    if (!text) throw new OnlineError('invalid');
    if (!this.friendsWith(db, me, to)) throw new OnlineError('not_friends');
    const m: Message = { id: `m${db.seq++}`, from: me, to, body: text, at: this.now(), readAt: null };
    db.messages.push(m);
    this.save(db);
    if (to.startsWith('bot-')) {
      setTimeout(() => {
        const d = this.load();
        const n = d.messages.filter((x) => x.from === to).length;
        const reply: Message = {
          id: `m${d.seq++}`,
          from: to,
          to: me,
          body: REPLIES[n % REPLIES.length]!,
          at: this.now(),
          readAt: null,
        };
        d.messages.push(reply);
        this.save(d);
        this.emit({ type: 'message', message: reply });
      }, this.opts.botDelayMs ?? 1500);
    }
    return m;
  }

  async markRead(withUser: string) {
    const db = this.load();
    const me = this.me(db);
    for (const m of db.messages) if (m.to === me && m.from === withUser && !m.readAt) m.readAt = this.now();
    this.save(db);
  }

  async unreadCounts() {
    const db = this.load();
    const me = this.me(db);
    const out: Record<string, number> = {};
    for (const m of db.messages) if (m.to === me && !m.readAt) out[m.from] = (out[m.from] ?? 0) + 1;
    return out;
  }

  subscribe(cb: (e: OnlineEvent) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
