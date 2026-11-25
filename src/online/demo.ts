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
import type { ClanCreateInput, ClanMessage, ClanPatch } from './clanTypes';
import { ClanSim, emptyClanDB, type ClanDB } from './clanSim';
import { bossHp, type DonationId, type WeeklyGoalId } from '@/game/clan';

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
  clans?: ClanDB;
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
/** Боты, которые живут только в кланах. */
const CLAN_BOTS: [string, string, string, number, number][] = [
  ['bot-ratmir', 'Ратмир', 'knight', 17, 11200],
  ['bot-ulyana', 'Ульяна', 'veila', 12, 8100],
  ['bot-efim', 'Ефим', 'grimsa', 8, 5200],
  ['bot-vera', 'Вера', 'saira', 23, 16400],
  ['bot-gleb', 'Глеб', 'azgar', 15, 9900],
  ['bot-demid', 'Демид', 'torvald', 30, 22800],
  ['bot-rostislav', 'Ростислав', 'ragna', 27, 19700],
];
const CLAN_REPLIES = [
  'Отметьтесь сегодня, до нового уровня клана чуть-чуть!',
  'Стража сегодня лучше бить героями, которые сильны против его стихии.',
  'Ключи потратил, урон неплохой 💪',
  'Кто знает, как пережить ярость к 25-му ходу?',
  'Добьём сегодня — завтра будет уровень выше.',
  'Не забудьте забрать недельные награды!',
];

function seedClans(now: number): ClanDB {
  const c = emptyClanDB();
  const day = Math.floor(now / 86_400_000);
  const mk = (
    id: string,
    name: string,
    tag: string,
    emblem: string,
    color: string,
    description: string,
    joinMode: 'open' | 'request' | 'closed',
    minLevel: number,
    xp: number,
    bossLevel: number,
    members: [string, 'leader' | 'officer' | 'member'][],
  ) => {
    c.clans.push({
      id,
      name,
      tag,
      emblem,
      color,
      description,
      joinMode,
      minLevel,
      xp,
      bossLevel,
      bossHp: Math.round(bossHp(bossLevel) * 0.62),
      bossKills: bossLevel - 1,
      createdAt: now - 20 * 86_400_000,
      botDay: day,
    });
    members.forEach(([userId, role], i) =>
      c.members.push({
        userId,
        clanId: id,
        role,
        joinedAt: now - (19 - i) * 86_400_000,
        contribution: 400 - i * 40,
      }),
    );
  };
  mk(
    'clan-dawn',
    'Рассветный Дозор',
    'ДОЗР',
    'sun',
    '#d9a94a',
    'Дружный клан: каждый день бьём Стража и помогаем новичкам.',
    'open',
    1,
    1250,
    4,
    [
      ['bot-agata', 'leader'],
      ['bot-zlata', 'officer'],
      ['bot-ratmir', 'member'],
      ['bot-ulyana', 'member'],
      ['bot-efim', 'member'],
    ],
  );
  mk(
    'clan-crows',
    'Пепельные Вороны',
    'ПВ',
    'skull',
    '#5fbfb2',
    'Берём активных. Две атаки на Стража в день обязательны.',
    'request',
    5,
    3100,
    7,
    [
      ['bot-tikhon', 'leader'],
      ['bot-vera', 'officer'],
      ['bot-gleb', 'member'],
    ],
  );
  mk('clan-north', 'Кузня Севера', 'КУЗН', 'anvil', '#c98a45', 'Только для своих.', 'closed', 20, 7600, 12, [
    ['bot-demid', 'leader'],
    ['bot-rostislav', 'officer'],
  ]);
  return c;
}

const REPLIES = [
  'Привет, Хранитель! Как поход?',
  'Я застряла на боссе главы. Советуешь кого взять?',
  'Лови совет: против Колосса бери Свет, Тьма ему нипочём.',
  'Ага, видела твой рейтинг на арене. Неплохо!',
  'Пойду фармить Склеп, мне нужен сет Быстроты.',
  'Удачи в башне!',
];

function clanBotProfiles(): Profile[] {
  return CLAN_BOTS.map(([id, nickname, avatar, level, power]) => ({
    id,
    nickname,
    friendCode: id.slice(4, 10).toUpperCase().padEnd(6, '7'),
    avatar,
    level,
    power,
    arenaRating: 1000 + level * 20,
    lastSeen: 0,
  }));
}

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
      profiles: [...BOTS.map((b) => ({ ...b })), ...clanBotProfiles()],
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

  // ———————————————————— кланы ————————————————————

  /** Открывает клановую часть базы, даёт ботам «сыграть» и сохраняет изменения. */
  private clan<T>(fn: (sim: ClanSim, me: string, db: DB) => T, opts: { auth?: boolean } = {}): T {
    const db = this.load();
    const me = opts.auth === false ? (db.session ?? '') : this.me(db);
    for (const p of clanBotProfiles()) if (!db.profiles.some((x) => x.id === p.id)) db.profiles.push(p);
    db.clans ??= seedClans(this.now());
    const before = db.clans.messages.length;
    const sim = new ClanSim(db.clans, (id) => db.profiles.find((x) => x.id === id));
    sim.simulateBots((id) => id.startsWith('bot-'), this.now());
    const out = fn(sim, me, db);
    const fresh = db.clans.messages.slice(before);
    this.save(db);
    for (const m of fresh) this.emit({ type: 'clanMessage', message: m });
    return out;
  }

  async myClan() {
    return this.clan((sim, me) => sim.state(me, this.now()));
  }
  async browseClans(query: string) {
    return this.clan((sim, me) => sim.browse(me, query));
  }
  async createClan(input: ClanCreateInput) {
    return this.clan((sim, me) => sim.create(me, input, this.now()));
  }
  async joinClan(clanId: string) {
    const r = this.clan((sim, me) => sim.join(me, clanId, this.now()));
    // Глава клана-бота принимает заявку через пару секунд.
    if (r === 'requested')
      setTimeout(
        () => {
          try {
            this.clan((sim, me) => {
              const leader = sim.db.members.find((m) => m.clanId === clanId && m.role === 'leader');
              if (leader?.userId.startsWith('bot-')) sim.respond(leader.userId, me, true, this.now());
            });
          } catch {
            /* заявку уже отменили */
          }
        },
        (this.opts.botDelayMs ?? 1500) * 2,
      );
    return r;
  }
  async cancelClanRequest(clanId: string) {
    this.clan((sim, me) => sim.cancelRequest(me, clanId));
  }
  async leaveClan() {
    this.clan((sim, me) => sim.leave(me, this.now()));
  }
  async respondClanRequest(userId: string, accept: boolean) {
    this.clan((sim, me) => sim.respond(me, userId, accept, this.now()));
  }
  async kickClanMember(userId: string) {
    this.clan((sim, me) => sim.kick(me, userId, this.now()));
  }
  async setClanRole(userId: string, role: 'officer' | 'member') {
    this.clan((sim, me) => sim.setRole(me, userId, role, this.now()));
  }
  async transferClanLeader(userId: string) {
    this.clan((sim, me) => sim.transfer(me, userId, this.now()));
  }
  async updateClan(patch: ClanPatch) {
    this.clan((sim, me) => sim.update(me, patch));
  }
  async clanCheckin() {
    this.clan((sim, me) => sim.checkin(me, this.now()));
  }
  async clanDonate(kind: DonationId) {
    this.clan((sim, me) => sim.donate(me, kind, this.now()));
  }
  async bossBegin() {
    return this.clan((sim, me) => sim.bossBegin(me, this.now()));
  }
  async bossFinish(attemptId: string, damage: number) {
    return this.clan((sim, me) => sim.bossFinish(me, attemptId, damage, this.now()));
  }
  async claimClanKill(level: number) {
    this.clan((sim, me) => sim.claimKill(me, level));
  }
  async claimClanWeekly(goal: WeeklyGoalId, step: number) {
    this.clan((sim, me) => sim.claimWeekly(me, goal, step, this.now()));
  }
  async claimClanRank() {
    return this.clan((sim, me) => sim.claimRank(me, this.now()));
  }
  async clanMessages(limit = 60) {
    return this.clan((sim, me) => sim.messages(me, limit));
  }
  async sendClanMessage(body: string): Promise<ClanMessage> {
    const msg = this.clan((sim, me) => sim.send(me, body.slice(0, MAX_MESSAGE), this.now()));
    // Кто-нибудь из ботов клана отзывается.
    setTimeout(() => {
      try {
        this.clan((sim, me) => {
          const st = sim.state(me, this.now());
          const bots = st?.members.filter((m) => m.profile.id.startsWith('bot-')) ?? [];
          if (!bots.length) return;
          const n = sim.db.messages.filter((m) => m.kind === 'chat').length;
          const bot = bots[n % bots.length]!;
          sim.send(bot.profile.id, CLAN_REPLIES[n % CLAN_REPLIES.length]!, this.now());
        });
      } catch {
        /* игрок уже вышел из клана */
      }
    }, this.opts.botDelayMs ?? 1500);
    return msg;
  }

  subscribe(cb: (e: OnlineEvent) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
