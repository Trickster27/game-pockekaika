import {
  CLAN,
  CLAN_COLORS,
  CLAN_EMBLEMS,
  DONATIONS,
  WEEKLY_GOALS,
  bossHp,
  clanLevel,
  clanPerks,
  damageCap,
  dayIndex,
  normalizeTag,
  validateClanName,
  validateClanTag,
  weekIndex,
  type ClanRole,
  type DonationId,
  type JoinMode,
  type WeeklyGoalId,
} from '@/game/clan';
import { OnlineError, type Profile } from './types';
import type {
  BossAttempt,
  BossOutcome,
  ClanBrowse,
  ClanCreateInput,
  ClanInfo,
  ClanMessage,
  ClanPatch,
  ClanState,
  ClanSystemBody,
  ClanToday,
} from './clanTypes';

/**
 * Клановый «сервер» на TypeScript: те же правила, что в SQL-функциях supabase/migrations/0003_clans.sql.
 * Работает в демо-режиме (данные в localStorage) и служит эталоном для тестов.
 * Каждый метод получает id игрока и текущее время — состояние меняется только здесь.
 */
export interface ClanRow {
  id: string;
  name: string;
  tag: string;
  emblem: string;
  color: string;
  description: string;
  joinMode: JoinMode;
  minLevel: number;
  xp: number;
  bossLevel: number;
  bossHp: number;
  bossKills: number;
  createdAt: number;
  /** Демо: до какого дня боты уже «сходили». */
  botDay?: number;
}
interface MemberRow {
  userId: string;
  clanId: string;
  role: ClanRole;
  joinedAt: number;
  contribution: number;
}
interface DailyRow {
  userId: string;
  day: number;
  checkin: boolean;
  donations: DonationId[];
  keys: number;
}
interface AttemptRow {
  id: string;
  userId: string;
  clanId: string;
  day: number;
  level: number;
  seed: number;
  startedAt: number;
  damage: number | null;
}
export interface ClanDB {
  clans: ClanRow[];
  members: MemberRow[];
  requests: { clanId: string; userId: string; at: number }[];
  daily: DailyRow[];
  attempts: AttemptRow[];
  kills: { clanId: string; level: number; at: number; killer: string }[];
  claims: string[];
  week: { clanId: string; week: number; attacks: number; checkins: number; kills: number }[];
  messages: ClanMessage[];
  leftAt: Record<string, number>;
  seq: number;
}

export function emptyClanDB(): ClanDB {
  return {
    clans: [],
    members: [],
    requests: [],
    daily: [],
    attempts: [],
    kills: [],
    claims: [],
    week: [],
    messages: [],
    leftAt: {},
    seq: 1,
  };
}

/** Попытка действительна 30 минут: потом урон не принимается. */
export const ATTEMPT_TTL_MS = 30 * 60_000;
const ROLE_ORDER: Record<ClanRole, number> = { leader: 0, officer: 1, member: 2 };

const err = (code: ConstructorParameters<typeof OnlineError>[0]) => new OnlineError(code);

export class ClanSim {
  constructor(
    readonly db: ClanDB,
    private readonly profiles: (id: string) => Profile | undefined,
    private readonly rnd: () => number = Math.random,
  ) {}

  // ———————————————————— помощники ————————————————————

  private id(prefix: string) {
    return `${prefix}${this.db.seq++}`;
  }
  private memberOf(userId: string) {
    return this.db.members.find((m) => m.userId === userId);
  }
  private need(userId: string) {
    const m = this.memberOf(userId);
    if (!m) throw err('clan_none');
    const c = this.db.clans.find((x) => x.id === m.clanId);
    if (!c) throw err('clan_none');
    return { m, c };
  }
  private count(clanId: string) {
    return this.db.members.filter((m) => m.clanId === clanId).length;
  }
  private daily(userId: string, day: number): DailyRow {
    let d = this.db.daily.find((x) => x.userId === userId && x.day === day);
    if (!d) {
      d = { userId, day, checkin: false, donations: [], keys: 0 };
      this.db.daily.push(d);
    }
    return d;
  }
  private weekRow(clanId: string, week: number) {
    let w = this.db.week.find((x) => x.clanId === clanId && x.week === week);
    if (!w) {
      w = { clanId, week, attacks: 0, checkins: 0, kills: 0 };
      this.db.week.push(w);
    }
    return w;
  }
  private addXp(c: ClanRow, m: MemberRow | undefined, n: number, now: number) {
    const before = clanLevel(c.xp).level;
    c.xp += n;
    if (m) m.contribution += n;
    const after = clanLevel(c.xp).level;
    if (after > before) this.sys(c.id, { k: 'levelUp', a: { level: after } }, now);
  }
  private sys(clanId: string, body: ClanSystemBody, now: number) {
    const msg: ClanMessage = {
      id: this.id('cm'),
      clanId,
      from: null,
      nickname: null,
      body: JSON.stringify(body),
      kind: 'system',
      at: now,
    };
    this.db.messages.push(msg);
    return msg;
  }
  private nick(userId: string) {
    return this.profiles(userId)?.nickname ?? '?';
  }
  private info(c: ClanRow): ClanInfo {
    return {
      id: c.id,
      name: c.name,
      tag: c.tag,
      emblem: c.emblem,
      color: c.color,
      description: c.description,
      joinMode: c.joinMode,
      minLevel: c.minLevel,
      xp: c.xp,
      members: this.count(c.id),
      bossLevel: c.bossLevel,
      bossKills: c.bossKills,
      createdAt: c.createdAt,
    };
  }
  private today(userId: string, clanId: string, day: number): ClanToday {
    const d = this.db.daily.find((x) => x.userId === userId && x.day === day);
    const damage = this.db.attempts
      .filter((a) => a.userId === userId && a.clanId === clanId && a.day === day)
      .reduce((s, a) => s + (a.damage ?? 0), 0);
    return { keys: d?.keys ?? 0, damage, checkin: d?.checkin ?? false, donations: d?.donations ?? [] };
  }
  private cooldownUntil(userId: string): number | null {
    const t = this.db.leftAt[userId];
    return t ? t + CLAN.leaveCooldownH * 3_600_000 : null;
  }
  private enter(userId: string, c: ClanRow, role: ClanRole, now: number) {
    this.db.members.push({ userId, clanId: c.id, role, joinedAt: now, contribution: 0 });
    this.db.requests = this.db.requests.filter((r) => r.userId !== userId);
    if (role !== 'leader') this.sys(c.id, { k: 'join', a: { name: this.nick(userId) } }, now);
  }

  // ———————————————————— чтение ————————————————————

  state(userId: string, now: number): ClanState | null {
    const m = this.memberOf(userId);
    if (!m) return null;
    const c = this.db.clans.find((x) => x.id === m.clanId)!;
    const day = dayIndex(now);
    const week = weekIndex(day);
    const w = this.weekRow(c.id, week);
    const members = this.db.members
      .filter((x) => x.clanId === c.id)
      .map((x) => ({
        profile: this.profiles(x.userId) ?? fallbackProfile(x.userId),
        role: x.role,
        joinedAt: x.joinedAt,
        contribution: x.contribution,
        today: this.today(x.userId, c.id, day),
      }))
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || b.contribution - a.contribution);
    const pendingKills = this.db.kills
      .filter((k) => k.clanId === c.id)
      .filter((k) =>
        this.db.attempts.some(
          (a) => a.clanId === c.id && a.userId === userId && a.level === k.level && (a.damage ?? 0) > 0,
        ),
      )
      .filter((k) => !this.db.claims.includes(`kill:${c.id}:${k.level}:${userId}`))
      .map((k) => k.level)
      .sort((a, b) => a - b);
    return {
      clan: this.info(c),
      me: { role: m.role, joinedAt: m.joinedAt, today: this.today(userId, c.id, day) },
      members,
      boss: { level: c.bossLevel, hp: c.bossHp, hpMax: bossHp(c.bossLevel), kills: c.bossKills, day },
      requests:
        m.role === 'member'
          ? []
          : this.db.requests
              .filter((r) => r.clanId === c.id)
              .map((r) => ({ profile: this.profiles(r.userId) ?? fallbackProfile(r.userId), at: r.at })),
      week: {
        week,
        attacks: w.attacks,
        checkins: w.checkins,
        kills: w.kills,
        claimed: this.db.claims
          .filter((k) => k.startsWith(`week:${c.id}:${week}:`) && k.endsWith(`:${userId}`))
          .map((k) => k.split(':').slice(3, 5).join(':')),
      },
      pendingKills,
      yesterday: this.rankOf(userId, c.id, day - 1, true),
    };
  }

  /** Место по урону среди участников клана за день. */
  private rankOf(userId: string, clanId: string, day: number, unclaimedOnly: boolean) {
    if (unclaimedOnly && this.db.claims.includes(`rank:${day}:${userId}`)) return null;
    const sums = new Map<string, number>();
    for (const a of this.db.attempts)
      if (a.clanId === clanId && a.day === day && (a.damage ?? 0) > 0)
        sums.set(a.userId, (sums.get(a.userId) ?? 0) + a.damage!);
    const mine = sums.get(userId);
    if (!mine) return null;
    const sorted = [...sums.entries()].sort((a, b) => b[1] - a[1]);
    return { rank: sorted.findIndex(([u]) => u === userId) + 1, damage: mine, of: sorted.length };
  }

  browse(userId: string, query: string): ClanBrowse {
    const q = query.trim().toLowerCase();
    const clans = this.db.clans
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q))
      .map((c) => this.info(c))
      .sort(
        (a, b) =>
          Number(a.joinMode === 'closed') - Number(b.joinMode === 'closed') ||
          clanLevel(b.xp).level - clanLevel(a.xp).level ||
          b.members - a.members,
      )
      .slice(0, 30);
    const until = this.cooldownUntil(userId);
    return {
      clans,
      requested: this.db.requests.filter((r) => r.userId === userId).map((r) => r.clanId),
      cooldownUntil: until,
    };
  }

  messages(userId: string, limit = 60): ClanMessage[] {
    const { c } = this.need(userId);
    return this.db.messages.filter((m) => m.clanId === c.id).slice(-limit);
  }

  // ———————————————————— вступление и состав ————————————————————

  create(userId: string, input: ClanCreateInput, now: number): string {
    if (this.memberOf(userId)) throw err('clan_in');
    const until = this.cooldownUntil(userId);
    if (until && now < until) throw err('clan_cooldown');
    const lvl = this.profiles(userId)?.level ?? 1;
    if (lvl < CLAN.createMinLevel) throw err('clan_level');
    const name = input.name.trim();
    const tag = normalizeTag(input.tag);
    if (!validateClanName(name) || !validateClanTag(tag)) throw err('invalid');
    if (input.description.length > CLAN.descMax) throw err('invalid');
    if (!(CLAN_EMBLEMS as readonly string[]).includes(input.emblem)) throw err('invalid');
    if (!(CLAN_COLORS as readonly string[]).includes(input.color)) throw err('invalid');
    if (this.db.clans.some((c) => c.name.toLowerCase() === name.toLowerCase() || c.tag === tag))
      throw err('clan_taken');
    const c: ClanRow = {
      id: this.id('clan'),
      name,
      tag,
      emblem: input.emblem,
      color: input.color,
      description: input.description.trim(),
      joinMode: input.joinMode,
      minLevel: Math.max(1, Math.min(100, Math.floor(input.minLevel))),
      xp: 0,
      bossLevel: 1,
      bossHp: bossHp(1),
      bossKills: 0,
      createdAt: now,
    };
    this.db.clans.push(c);
    this.enter(userId, c, 'leader', now);
    this.sys(c.id, { k: 'created', a: { name: this.nick(userId) } }, now);
    return c.id;
  }

  join(userId: string, clanId: string, now: number): 'joined' | 'requested' {
    if (this.memberOf(userId)) throw err('clan_in');
    const until = this.cooldownUntil(userId);
    if (until && now < until) throw err('clan_cooldown');
    const c = this.db.clans.find((x) => x.id === clanId);
    if (!c) throw err('not_found');
    if ((this.profiles(userId)?.level ?? 1) < c.minLevel) throw err('clan_level');
    if (c.joinMode === 'closed') throw err('clan_closed');
    if (this.count(c.id) >= clanPerks(clanLevel(c.xp).level).memberCap) throw err('clan_full');
    if (c.joinMode === 'open') {
      this.enter(userId, c, 'member', now);
      return 'joined';
    }
    if (this.db.requests.some((r) => r.clanId === clanId && r.userId === userId)) throw err('already');
    this.db.requests.push({ clanId, userId, at: now });
    return 'requested';
  }

  cancelRequest(userId: string, clanId: string) {
    this.db.requests = this.db.requests.filter((r) => !(r.clanId === clanId && r.userId === userId));
  }

  respond(userId: string, target: string, accept: boolean, now: number) {
    const { m, c } = this.need(userId);
    if (m.role === 'member') throw err('clan_rights');
    const req = this.db.requests.find((r) => r.clanId === c.id && r.userId === target);
    if (!req) throw err('not_found');
    this.db.requests = this.db.requests.filter((r) => r !== req);
    if (!accept) return;
    if (this.memberOf(target)) throw err('clan_in');
    if (this.count(c.id) >= clanPerks(clanLevel(c.xp).level).memberCap) throw err('clan_full');
    this.enter(target, c, 'member', now);
  }

  leave(userId: string, now: number) {
    const { m, c } = this.need(userId);
    this.db.members = this.db.members.filter((x) => x !== m);
    this.db.leftAt[userId] = now;
    const rest = this.db.members.filter((x) => x.clanId === c.id);
    if (rest.length === 0) {
      this.db.clans = this.db.clans.filter((x) => x !== c);
      this.db.requests = this.db.requests.filter((r) => r.clanId !== c.id);
      this.db.messages = this.db.messages.filter((x) => x.clanId !== c.id);
      return;
    }
    this.sys(c.id, { k: 'leave', a: { name: this.nick(userId) } }, now);
    if (m.role === 'leader') {
      // Новый глава — старший офицер, иначе самый давний участник.
      const heir = [...rest].sort(
        (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joinedAt - b.joinedAt,
      )[0]!;
      heir.role = 'leader';
      this.sys(c.id, { k: 'leader', a: { name: this.nick(heir.userId) } }, now);
    }
  }

  kick(userId: string, target: string, now: number) {
    const { m, c } = this.need(userId);
    const t = this.db.members.find((x) => x.userId === target && x.clanId === c.id);
    if (!t || t === m) throw err('not_found');
    if (ROLE_ORDER[m.role] >= ROLE_ORDER[t.role]) throw err('clan_rights');
    this.db.members = this.db.members.filter((x) => x !== t);
    this.sys(c.id, { k: 'kick', a: { name: this.nick(target) } }, now);
  }

  setRole(userId: string, target: string, role: 'officer' | 'member', now: number) {
    const { m, c } = this.need(userId);
    if (m.role !== 'leader') throw err('clan_rights');
    const t = this.db.members.find((x) => x.userId === target && x.clanId === c.id);
    if (!t || t === m) throw err('not_found');
    if (t.role === role) return;
    if (
      role === 'officer' &&
      this.db.members.filter((x) => x.clanId === c.id && x.role === 'officer').length >= CLAN.maxOfficers
    )
      throw err('clan_officers');
    t.role = role;
    this.sys(c.id, { k: role === 'officer' ? 'promote' : 'demote', a: { name: this.nick(target) } }, now);
  }

  transfer(userId: string, target: string, now: number) {
    const { m, c } = this.need(userId);
    if (m.role !== 'leader') throw err('clan_rights');
    const t = this.db.members.find((x) => x.userId === target && x.clanId === c.id);
    if (!t || t === m) throw err('not_found');
    t.role = 'leader';
    m.role = 'officer';
    this.sys(c.id, { k: 'leader', a: { name: this.nick(target) } }, now);
  }

  update(userId: string, patch: ClanPatch) {
    const { m, c } = this.need(userId);
    if (m.role === 'member') throw err('clan_rights');
    if (patch.description != null) {
      if (patch.description.length > CLAN.descMax) throw err('invalid');
      c.description = patch.description.trim();
    }
    if (patch.joinMode) c.joinMode = patch.joinMode;
    if (patch.minLevel != null) c.minLevel = Math.max(1, Math.min(100, Math.floor(patch.minLevel)));
    if (patch.emblem) {
      if (!(CLAN_EMBLEMS as readonly string[]).includes(patch.emblem)) throw err('invalid');
      c.emblem = patch.emblem;
    }
    if (patch.color) {
      if (!(CLAN_COLORS as readonly string[]).includes(patch.color)) throw err('invalid');
      c.color = patch.color;
    }
  }

  // ———————————————————— ежедневное ————————————————————

  checkin(userId: string, now: number) {
    const { m, c } = this.need(userId);
    const day = dayIndex(now);
    const d = this.daily(userId, day);
    if (d.checkin) throw err('already');
    d.checkin = true;
    this.weekRow(c.id, weekIndex(day)).checkins += 1;
    this.addXp(c, m, CLAN.xp.checkin, now);
  }

  donate(userId: string, kind: DonationId, now: number) {
    const { m, c } = this.need(userId);
    const def = DONATIONS.find((x) => x.id === kind);
    if (!def) throw err('invalid');
    const d = this.daily(userId, dayIndex(now));
    if (d.donations.includes(kind)) throw err('already');
    d.donations.push(kind);
    this.addXp(c, m, def.xp, now);
  }

  // ———————————————————— босс ————————————————————

  bossBegin(userId: string, now: number): BossAttempt {
    const { c } = this.need(userId);
    const day = dayIndex(now);
    const d = this.daily(userId, day);
    if (d.keys >= CLAN.keysPerDay) throw err('no_keys');
    d.keys += 1;
    const a: AttemptRow = {
      id: this.id('att'),
      userId,
      clanId: c.id,
      day,
      level: c.bossLevel,
      seed: Math.floor(this.rnd() * 0x7fffffff) >>> 0,
      startedAt: now,
      damage: null,
    };
    this.db.attempts.push(a);
    return {
      attemptId: a.id,
      seed: a.seed,
      level: c.bossLevel,
      hp: c.bossHp,
      hpMax: bossHp(c.bossLevel),
      day,
    };
  }

  bossFinish(userId: string, attemptId: string, damage: number, now: number): BossOutcome {
    const a = this.db.attempts.find((x) => x.id === attemptId && x.userId === userId);
    if (!a) throw err('not_found');
    if (a.damage != null) throw err('already');
    if (now - a.startedAt > ATTEMPT_TTL_MS) {
      a.damage = 0;
      throw err('expired');
    }
    const power = this.profiles(userId)?.power ?? 0;
    const dmg = Math.max(0, Math.min(Math.floor(damage), damageCap(power), bossHp(a.level)));
    a.damage = dmg;
    const c = this.db.clans.find((x) => x.id === a.clanId);
    const m = this.memberOf(userId);
    if (!c) return { damage: dmg, level: a.level, killed: false, bossLevel: 0, bossHp: 0 };
    const w = this.weekRow(c.id, weekIndex(a.day));
    w.attacks += 1;
    this.addXp(c, m?.clanId === c.id ? m : undefined, CLAN.xp.attack, now);
    let killed = false;
    // Урон идёт в текущего босса; если его уже добили, в следующего.
    c.bossHp -= dmg;
    if (c.bossHp <= 0) {
      killed = true;
      this.db.kills.push({ clanId: c.id, level: c.bossLevel, at: now, killer: userId });
      this.sys(c.id, { k: 'kill', a: { level: c.bossLevel, name: this.nick(userId) } }, now);
      c.bossKills += 1;
      c.bossLevel += 1;
      c.bossHp = bossHp(c.bossLevel);
      w.kills += 1;
      this.addXp(c, undefined, CLAN.xp.kill, now);
    }
    return { damage: dmg, level: a.level, killed, bossLevel: c.bossLevel, bossHp: c.bossHp };
  }

  claimKill(userId: string, level: number) {
    const { c } = this.need(userId);
    const key = `kill:${c.id}:${level}:${userId}`;
    if (this.db.claims.includes(key)) throw err('already');
    const ok =
      this.db.kills.some((k) => k.clanId === c.id && k.level === level) &&
      this.db.attempts.some(
        (a) => a.clanId === c.id && a.userId === userId && a.level === level && (a.damage ?? 0) > 0,
      );
    if (!ok) throw err('not_found');
    this.db.claims.push(key);
  }

  claimWeekly(userId: string, goal: WeeklyGoalId, step: number, now: number) {
    const { c } = this.need(userId);
    const g = WEEKLY_GOALS.find((x) => x.id === goal);
    const need = g?.steps[step];
    if (!g || need == null) throw err('invalid');
    const week = weekIndex(dayIndex(now));
    const w = this.weekRow(c.id, week);
    if (w[goal] < need) throw err('invalid');
    const key = `week:${c.id}:${week}:${goal}:${step}:${userId}`;
    if (this.db.claims.includes(key)) throw err('already');
    this.db.claims.push(key);
  }

  claimRank(userId: string, now: number) {
    const { c } = this.need(userId);
    const day = dayIndex(now) - 1;
    const r = this.rankOf(userId, c.id, day, true);
    if (!r) return null;
    this.db.claims.push(`rank:${day}:${userId}`);
    return r;
  }

  // ———————————————————— чат ————————————————————

  send(userId: string, body: string, now: number): ClanMessage {
    const { c } = this.need(userId);
    const text = body.trim();
    if (!text || text.length > 500) throw err('invalid');
    const msg: ClanMessage = {
      id: this.id('cm'),
      clanId: c.id,
      from: userId,
      nickname: this.nick(userId),
      body: text,
      kind: 'chat',
      at: now,
    };
    this.db.messages.push(msg);
    if (this.db.messages.length > 2000) this.db.messages.splice(0, this.db.messages.length - 2000);
    return msg;
  }

  // ———————————————————— демо: боты ————————————————————

  /**
   * Боты-соклановцы «играют»: отмечаются и бьют босса два раза в день
   * (утром и вечером по UTC), урон зависит от их силы.
   */
  simulateBots(isBot: (id: string) => boolean, now: number) {
    const today = dayIndex(now);
    const hour = new Date(now).getUTCHours();
    for (const c of this.db.clans) {
      const bots = this.db.members.filter((m) => m.clanId === c.id && isBot(m.userId));
      if (!bots.length) continue;
      const from = Math.max(c.botDay ?? today, today - 2);
      for (let day = from; day <= today; day++) {
        const t = day * 86_400_000 + 12 * 3_600_000;
        for (const b of bots) {
          const d = this.daily(b.userId, day);
          if (!d.checkin) {
            d.checkin = true;
            this.weekRow(c.id, weekIndex(day)).checkins += 1;
            this.addXp(c, b, CLAN.xp.checkin, Math.min(now, t));
          }
          const target = day < today ? CLAN.keysPerDay : (hour >= 9 ? 1 : 0) + (hour >= 19 ? 1 : 0);
          while (d.keys < target) {
            const at = Math.min(now, t);
            const att = this.bossBegin(b.userId, at);
            const p = this.profiles(b.userId)?.power ?? 5000;
            this.bossFinish(b.userId, att.attemptId, Math.round(p * (5 + this.rnd() * 5)), at);
          }
        }
      }
      c.botDay = today;
    }
  }
}

function fallbackProfile(id: string): Profile {
  return {
    id,
    nickname: '?',
    friendCode: '',
    avatar: 'knight',
    level: 1,
    power: 0,
    arenaRating: 1000,
    lastSeen: 0,
  };
}
