import SQL from '../supabase/migrations/0004_social.sql?raw';
import { describe, expect, it } from 'vitest';
import { PVP, eloDelta, OnlineError, type Profile } from '@/online';
import { SocialSim, emptySocialDB, sanitizeStats } from '@/online/socialSim';
import { DemoOnlineBackend } from '@/online/demo';

const NOW = 1_800_000_000_000;
const prof = (id: string): Profile => ({
  id,
  nickname: id,
  friendCode: '',
  avatar: 'knight',
  level: 10,
  power: 1000,
  arenaRating: 1000,
  lastSeen: 0,
});
const team = [{ defId: 'rikht', level: 10, stars: 2 }];
const sub = (o: Partial<Parameters<SocialSim['submit']>[1]> = {}) => ({
  power: 5000,
  level: 10,
  tower: 5,
  collection: 6,
  team,
  teamPower: 5000,
  ...o,
});
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as OnlineError).code;
  }
  return 'ok';
};

describe('проверки правдоподобия', () => {
  it('сила, башня за сутки, уровни и звёзды команды', () => {
    const r = sanitizeStats(
      undefined,
      sub({ power: 1e9, tower: 500, team: [{ defId: 'x', level: 99, stars: 9 }] }),
      NOW,
    );
    expect(r.power).toBe(PVP.maxPower);
    expect(r.tower).toBe(PVP.towerPerDay);
    expect(r.team[0]).toMatchObject({ level: 60, stars: 6 });
    const prev = { ...r, userId: 'a', pvpRating: 1000 };
    expect(sanitizeStats(prev, sub({ tower: 200 }), NOW + 1000).tower).toBe(PVP.towerPerDay);
    expect(sanitizeStats(prev, sub({ tower: 200 }), NOW + 86_400_000).tower).toBe(2 * PVP.towerPerDay);
    expect(sanitizeStats(prev, sub({ tower: 1 }), NOW).tower).toBe(PVP.towerPerDay);
  });

  it('числа совпадают с SQL', () => {
    expect(SQL).toContain(`least(p_power, ${PVP.maxPower})`);
    expect(SQL).toContain(`base + ${PVP.towerPerDay}`);
    expect(SQL).toContain(`greatest(0, ${PVP.dailyAttacks} - used)`);
    expect(SQL).toContain(`>= ${PVP.dailyAttacks} then`);
    expect(SQL).toContain(`select public._jsround(${PVP.k} *`);
    expect(SQL).toContain('* 0.6)');
    expect(SQL).toContain("interval '15 minutes'");
    expect(eloDelta(1000, 1000, true)).toBe(16);
    expect(eloDelta(1000, 1200, true)).toBe(24);
    expect(eloDelta(1200, 1000, false)).toBe(-24);
  });
});

describe('SocialSim', () => {
  function world() {
    const friends: Record<string, string[]> = { a: ['b'], b: ['a'] };
    const clans: Record<string, { id: string; tag: string; name: string }> = {
      a: { id: 'k', tag: 'К', name: 'Клан' },
      c: { id: 'k', tag: 'К', name: 'Клан' },
    };
    const s = new SocialSim(emptySocialDB(), prof, {
      friendsOf: (id) => friends[id] ?? [],
      clanOf: (id) => clans[id] ?? null,
      rnd: () => 0.42,
    });
    s.submit('a', sub({ power: 5000 }), NOW);
    s.submit('b', sub({ power: 9000 }), NOW);
    s.submit('c', sub({ power: 7000 }), NOW);
    s.submit('d', sub({ power: 1000 }), NOW);
    return s;
  }

  it('лидеры: все, друзья, клан; моё место', () => {
    const s = world();
    expect(s.leaderboard('a', 'power', 'all').rows.map((r) => r.profile.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(s.leaderboard('a', 'power', 'all').me!.rank).toBe(3);
    expect(s.leaderboard('a', 'power', 'friends').rows.map((r) => r.profile.id)).toEqual(['b', 'a']);
    expect(s.leaderboard('a', 'power', 'clan').rows.map((r) => r.profile.id)).toEqual(['c', 'a']);
    expect(s.leaderboard('a', 'power', 'all').rows[1]!.clanTag).toBe('К');
  });

  it('PvP: лимит, нельзя на себя, Эло у обоих, реванш', () => {
    const s = world();
    expect(code(() => s.begin('a', 'a', NOW))).toBe('self');
    const b = s.begin('d', 'a', NOW);
    expect(s.finish('d', b.battleId, true, NOW)).toEqual({ delta: 16, rating: 1016 });
    expect(code(() => s.finish('d', b.battleId, true, NOW))).toBe('already');
    expect(s.card('a').pvpRating).toBe(1000 + Math.round(eloDelta(1000, 1000, false) * 0.6));
    const st = s.state('a', NOW);
    expect(st.log[0]).toMatchObject({ attackerWon: true, revenge: true });
    expect(st.opponents[0]).toMatchObject({ revenge: true });
    expect(st.opponents[0]!.profile.id).toBe('d');
    const rv = s.begin('a', 'd', NOW);
    s.finish('a', rv.battleId, true, NOW);
    expect(s.state('a', NOW).opponents.some((o) => o.revenge)).toBe(false);
    for (let i = 0; i < PVP.dailyAttacks - 1; i++) s.finish('a', s.begin('a', 'b', NOW).battleId, false, NOW);
    expect(code(() => s.begin('a', 'b', NOW))).toBe('no_attacks');
    expect(s.state('a', NOW).attacksLeft).toBe(0);
    expect(s.state('a', NOW + 86_400_000).attacksLeft).toBe(PVP.dailyAttacks);
  });

  it('бой старше 15 минут — поражение', () => {
    const s = world();
    const b = s.begin('a', 'b', NOW);
    expect(s.finish('a', b.battleId, true, NOW + 16 * 60_000).delta).toBeLessThan(0);
  });
});

describe('демо-сервер: лидеры и PvP', () => {
  it('боты с защитой, рейтинг, бой и журнал', async () => {
    const store = new Map<string, string>();
    const kv = {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => void store.set(k, v),
    };
    const be = new DemoOnlineBackend(kv, { botDelayMs: 0, now: () => NOW });
    await be.signUp('p@p.pp', 'secret1', 'Игрок');
    await be.submitStats(sub({ power: 8000 }));
    const lb = await be.leaderboard('power', 'all');
    expect(lb.rows.length).toBeGreaterThan(5);
    expect(lb.me).not.toBeNull();
    const st = await be.pvpState();
    expect(st.opponents.length).toBeGreaterThan(0);
    expect(st.log.length).toBe(1); // бот напал сегодня
    const opp = st.opponents.find((o) => !o.revenge)!;
    const b = await be.pvpBegin(opp.profile.id);
    expect(b.defender.team.length).toBe(5);
    const out = await be.pvpFinish(b.battleId, true);
    expect(out.delta).toBeGreaterThan(0);
    const card = await be.playerCard(opp.profile.id);
    expect(card.team.length).toBe(5);
    expect((await be.pvpRefresh()).attacksLeft).toBe(PVP.dailyAttacks - 1);
  });
});
