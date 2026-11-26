import { Rng, hashSeed } from '@/core/rng';
import { HEROES } from '@/content/heroes';
import { OnlineError, type Profile } from './types';
import {
  PVP,
  eloDelta,
  type DefenseUnit,
  type LeaderKind,
  type LeaderRow,
  type LeaderScope,
  type Leaderboard,
  type PlayerCard,
  type PvpBattle,
  type PvpLogEntry,
  type PvpOpponent,
  type PvpOutcome,
  type PvpState,
  type StatsSubmit,
} from './socialTypes';

/**
 * Лидеры и PvP-арена на TypeScript — те же правила, что в supabase/migrations/0004_social.sql.
 * Работает в демо-режиме (боты) и служит эталоном для тестов.
 */
export interface StatsRow {
  userId: string;
  power: number;
  level: number;
  tower: number;
  collection: number;
  team: DefenseUnit[];
  teamPower: number;
  pvpRating: number;
  /** Защита от накрутки башни: этаж на начало суток и номер суток. */
  towerBase: number;
  towerDay: number;
}
interface BattleRow {
  id: string;
  attacker: string;
  defender: string;
  seed: number;
  startedAt: number;
  won: boolean | null;
  deltaAtt: number;
  deltaDef: number;
  revengeTaken: boolean;
}
export interface SocialDB {
  stats: StatsRow[];
  battles: BattleRow[];
  seq: number;
  /** Демо: до какого дня боты уже «нападали». */
  botDay?: number;
}

export function emptySocialDB(): SocialDB {
  return { stats: [], battles: [], seq: 1 };
}

const DAY = 86_400_000;
const err = (code: ConstructorParameters<typeof OnlineError>[0]) => new OnlineError(code);

/** Проверки правдоподобия (как в SQL): сила не выше лимита, башня не больше +30 этажей за сутки. */
export function sanitizeStats(prev: StatsRow | undefined, s: StatsSubmit, now: number) {
  const day = Math.floor(now / DAY);
  const base = prev && prev.towerDay === day ? prev.towerBase : (prev?.tower ?? 0);
  const tower = Math.max(prev?.tower ?? 0, Math.min(Math.floor(s.tower), base + PVP.towerPerDay));
  const power = Math.max(0, Math.min(Math.floor(s.power), PVP.maxPower));
  const team = s.team.slice(0, 5).map((u) => ({
    ...u,
    level: Math.max(1, Math.min(60, Math.floor(u.level))),
    stars: Math.max(1, Math.min(6, Math.floor(u.stars))),
  }));
  return {
    power,
    level: Math.max(1, Math.min(200, Math.floor(s.level))),
    tower,
    towerBase: base,
    towerDay: day,
    collection: Math.max(0, Math.min(HEROES.length, Math.floor(s.collection))),
    team,
    teamPower: Math.max(0, Math.min(Math.floor(s.teamPower), power)),
  };
}

export class SocialSim {
  constructor(
    readonly db: SocialDB,
    private readonly profiles: (id: string) => Profile | undefined,
    private readonly opts: {
      friendsOf?: (id: string) => string[];
      clanOf?: (id: string) => { id: string; tag: string; name: string } | null;
      bossDamageWeek?: (id: string) => number;
      rnd?: () => number;
    } = {},
  ) {}

  private row(id: string) {
    return this.db.stats.find((s) => s.userId === id);
  }
  private ensure(id: string): StatsRow {
    let r = this.row(id);
    if (!r) {
      r = {
        userId: id,
        power: 0,
        level: 1,
        tower: 0,
        collection: 0,
        team: [],
        teamPower: 0,
        pvpRating: PVP.startRating,
        towerBase: 0,
        towerDay: 0,
      };
      this.db.stats.push(r);
    }
    return r;
  }
  private profile(id: string): Profile {
    return (
      this.profiles(id) ?? {
        id,
        nickname: '?',
        friendCode: '',
        avatar: 'knight',
        level: 1,
        power: 0,
        arenaRating: 1000,
        lastSeen: 0,
      }
    );
  }

  submit(id: string, s: StatsSubmit, now: number) {
    const r = this.ensure(id);
    Object.assign(r, sanitizeStats(r, s, now));
  }

  private value(r: StatsRow, kind: LeaderKind): number {
    switch (kind) {
      case 'power':
        return r.power;
      case 'level':
        return r.level;
      case 'tower':
        return r.tower;
      case 'pvp':
        return r.pvpRating;
      case 'collection':
        return r.collection;
      case 'boss':
        return this.opts.bossDamageWeek?.(r.userId) ?? 0;
    }
  }

  leaderboard(me: string, kind: LeaderKind, scope: LeaderScope): Leaderboard {
    let rows = this.db.stats.filter((r) => r.team.length > 0 || r.userId === me);
    if (scope === 'friends') {
      const f = new Set([me, ...(this.opts.friendsOf?.(me) ?? [])]);
      rows = rows.filter((r) => f.has(r.userId));
    }
    if (scope === 'clan') {
      const c = this.opts.clanOf?.(me);
      rows = c
        ? rows.filter((r) => this.opts.clanOf?.(r.userId)?.id === c.id)
        : rows.filter((r) => r.userId === me);
    }
    const sorted = rows
      .map((r) => ({ r, v: this.value(r, kind) }))
      .sort((a, b) => b.v - a.v || a.r.userId.localeCompare(b.r.userId));
    const out: LeaderRow[] = sorted.map((x, i) => ({
      rank: i + 1,
      profile: this.profile(x.r.userId),
      value: x.v,
      clanTag: this.opts.clanOf?.(x.r.userId)?.tag ?? null,
    }));
    return { rows: out.slice(0, 50), me: out.find((x) => x.profile.id === me) ?? null };
  }

  private attacksToday(id: string, now: number) {
    const day = Math.floor(now / DAY);
    return this.db.battles.filter((b) => b.attacker === id && Math.floor(b.startedAt / DAY) === day).length;
  }

  private opponent(id: string, revenge = false): PvpOpponent {
    const r = this.ensure(id);
    return { profile: this.profile(id), rating: r.pvpRating, power: r.teamPower, team: r.team, revenge };
  }

  /** Три соперника рядом по рейтингу (слабее, равный, сильнее); сдвиг меняется при обновлении. */
  private opponents(me: string, refresh: number): PvpOpponent[] {
    const mine = this.ensure(me);
    const pool = this.db.stats
      .filter((r) => r.userId !== me && r.team.length > 0)
      .sort((a, b) => Math.abs(a.pvpRating - mine.pvpRating) - Math.abs(b.pvpRating - mine.pvpRating));
    const near = pool.slice(0, 8);
    const rng = new Rng(hashSeed(`${me}:${refresh}`));
    return rng
      .shuffle(near)
      .slice(0, 3)
      .sort((a, b) => a.teamPower - b.teamPower)
      .map((r) => this.opponent(r.userId));
  }

  private log(me: string): PvpLogEntry[] {
    return this.db.battles
      .filter((b) => b.won != null && (b.attacker === me || b.defender === me))
      .slice(-20)
      .reverse()
      .map((b) => ({
        id: b.id,
        attacker: this.profile(b.attacker),
        defender: this.profile(b.defender),
        attackerWon: b.won!,
        delta: b.attacker === me ? b.deltaAtt : b.deltaDef,
        at: b.startedAt,
        revenge: b.defender === me && !b.revengeTaken && b.won === true,
      }));
  }

  state(me: string, now: number, refresh = 0): PvpState {
    const r = this.ensure(me);
    const log = this.log(me);
    const revengeIds = new Set(log.filter((l) => l.revenge).map((l) => l.attacker.id));
    const opps = this.opponents(me, refresh).filter((o) => !revengeIds.has(o.profile.id));
    return {
      rating: r.pvpRating,
      attacksLeft: Math.max(0, PVP.dailyAttacks - this.attacksToday(me, now)),
      opponents: [...[...revengeIds].slice(0, 2).map((id) => this.opponent(id, true)), ...opps],
      log,
      defense: r.team,
    };
  }

  begin(me: string, defender: string, now: number): PvpBattle {
    if (me === defender) throw err('self');
    if (this.attacksToday(me, now) >= PVP.dailyAttacks) throw err('no_attacks');
    const d = this.row(defender);
    if (!d || !d.team.length) throw err('not_found');
    this.ensure(me);
    const b: BattleRow = {
      id: `pvp${this.db.seq++}`,
      attacker: me,
      defender,
      seed: Math.floor((this.opts.rnd ?? Math.random)() * 0x7fffffff) >>> 0,
      startedAt: now,
      won: null,
      deltaAtt: 0,
      deltaDef: 0,
      revengeTaken: false,
    };
    this.db.battles.push(b);
    return { battleId: b.id, seed: b.seed, defender: this.opponent(defender) };
  }

  finish(me: string, battleId: string, won: boolean, now: number): PvpOutcome {
    const b = this.db.battles.find((x) => x.id === battleId && x.attacker === me);
    if (!b) throw err('not_found');
    if (b.won != null) throw err('already');
    if (now - b.startedAt > 15 * 60_000) won = false;
    const a = this.ensure(b.attacker);
    const d = this.ensure(b.defender);
    b.won = won;
    b.deltaAtt = eloDelta(a.pvpRating, d.pvpRating, won);
    // Защитник теряет меньше, чем получает нападающий: проигрывать в защите не так обидно.
    b.deltaDef = Math.round(eloDelta(d.pvpRating, a.pvpRating, !won) * 0.6);
    a.pvpRating = Math.max(0, a.pvpRating + b.deltaAtt);
    d.pvpRating = Math.max(0, d.pvpRating + b.deltaDef);
    // Реванш взят: снимаем отметку с последней победы этого игрока над вами.
    const rev = [...this.db.battles]
      .reverse()
      .find((x) => x.attacker === b.defender && x.defender === me && x.won === true && !x.revengeTaken);
    if (rev) rev.revengeTaken = true;
    return { delta: b.deltaAtt, rating: a.pvpRating };
  }

  card(id: string): PlayerCard {
    const r = this.ensure(id);
    const c = this.opts.clanOf?.(id) ?? null;
    return {
      profile: this.profile(id),
      power: r.power,
      level: r.level,
      tower: r.tower,
      pvpRating: r.pvpRating,
      collection: r.collection,
      team: r.team,
      clanTag: c?.tag ?? null,
      clanName: c?.name ?? null,
    };
  }

  // ———————————————————— демо: боты ————————————————————

  /** Боты получают статистику и защиту по своей силе; раз в день кто-то из них нападает на игрока. */
  simulateBots(botIds: string[], me: string | null, now: number) {
    for (const id of botIds) {
      if (this.row(id)?.team.length) continue;
      const p = this.profile(id);
      const rng = new Rng(hashSeed(`bot:${id}`));
      const lvl = Math.max(5, Math.min(60, Math.round(p.level * 1.6)));
      const stars = Math.max(2, Math.min(6, Math.ceil(lvl / 10)));
      const team = rng
        .shuffle(HEROES.filter((h) => !h.pool))
        .slice(0, 5)
        .map((h) => ({ defId: h.id, level: lvl, stars }));
      const r = this.ensure(id);
      Object.assign(r, {
        power: p.power,
        level: p.level,
        tower: Math.round(p.level * 1.8),
        collection: 8 + (p.level % 12),
        team,
        teamPower: p.power,
        pvpRating: 900 + p.level * 18,
      });
    }
    if (!me || !this.row(me)?.team.length) return;
    const today = Math.floor(now / DAY);
    if (this.db.botDay === today) return;
    this.db.botDay = today;
    const rng = new Rng(hashSeed(`raid:${me}:${today}`));
    const bot = rng.pick(botIds);
    const b = this.begin(bot, me, now - 3 * 3_600_000);
    const won = rng.next() < 0.5;
    this.finish(bot, b.battleId, won, now - 3 * 3_600_000);
  }
}
