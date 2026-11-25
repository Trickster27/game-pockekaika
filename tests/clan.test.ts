import SQL from '../supabase/migrations/0003_clans.sql?raw';
import { describe, expect, it } from 'vitest';
import { Battle, simulate, type UnitSpec } from '@/core/battle';
import { db } from '@/content';
import {
  CHEST_TIERS,
  CLAN,
  CLAN_COLORS,
  CLAN_EMBLEMS,
  CLAN_LEVEL_XP,
  CLAN_SHOP,
  DONATIONS,
  WEEKLY_GOALS,
  bossElement,
  bossHp,
  bossSpec,
  buyClanOffer,
  chestReward,
  chestTier,
  clanLevel,
  clanPerks,
  dayIndex,
  grantClanReward,
  killReward,
  weekIndex,
} from '@/game';
import { createNewSave } from '@/save/schema';
import { migrate } from '@/save/migrations';
import { ATTEMPT_TTL_MS, ClanSim, emptyClanDB } from '@/online/clanSim';
import { DemoOnlineBackend } from '@/online/demo';
import { OnlineError, type Profile } from '@/online';

const DAY = 86_400_000;
const T0 = 20_000 * DAY + 10 * 3_600_000; // 10:00 UTC

function profiles(): Map<string, Profile> {
  const m = new Map<string, Profile>();
  const add = (id: string, level: number, power = 10_000) =>
    m.set(id, {
      id,
      nickname: id,
      friendCode: id,
      avatar: 'knight',
      level,
      power,
      arenaRating: 1000,
      lastSeen: 0,
    });
  add('a', 10);
  add('b', 8);
  add('c', 3);
  add('d', 12);
  add('e', 20);
  add('f', 20);
  return m;
}
function sim(rnd = () => 0.5) {
  const ps = profiles();
  return { s: new ClanSim(emptyClanDB(), (id) => ps.get(id), rnd), ps };
}
const input = (o: Partial<Parameters<ClanSim['create']>[1]> = {}) => ({
  name: 'Рассвет',
  tag: 'РСВ',
  emblem: 'sun',
  color: '#d9a94a',
  description: 'тест',
  joinMode: 'open' as const,
  minLevel: 1,
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

describe('правила клана', () => {
  it('уровни и бонусы', () => {
    expect(clanLevel(0).level).toBe(1);
    expect(clanLevel(299).level).toBe(1);
    expect(clanLevel(300).level).toBe(2);
    expect(clanLevel(21000)).toEqual({ level: 10, cur: 21000, next: null });
    expect(clanPerks(1).memberCap).toBe(15);
    expect(clanPerks(10).memberCap).toBe(30);
    expect(clanPerks(4).rewardBonus).toBeCloseTo(0.09);
  });

  it('здоровье босса совпадает с точной формулой сервера', () => {
    for (let L = 1; L <= 80; L++) {
      // 300000 × 5^(L−1) / 4^(L−1), округление половины вверх — как round() у numeric в Postgres.
      const num = 300_000n * 5n ** BigInt(L - 1);
      const den = 4n ** BigInt(L - 1);
      const exact = (2n * num + den) / (2n * den);
      expect(BigInt(bossHp(L)), `L=${L}`).toBe(exact);
    }
  });

  it('стихия дня идёт по кругу, неделя с понедельника', () => {
    const els = new Set(Array.from({ length: 6 }, (_, i) => bossElement(i)));
    expect(els.size).toBe(6);
    expect(bossElement(6)).toBe(bossElement(0));
    // 1970-01-05 — понедельник: неделя меняется именно в этот день.
    expect(weekIndex(4)).toBe(weekIndex(3) + 1);
    expect(weekIndex(10)).toBe(weekIndex(4));
  });

  it('сундуки по доле урона', () => {
    const hp = bossHp(3);
    expect(chestTier(0, 3)).toBe(-1);
    expect(chestTier(1, 3)).toBe(0);
    expect(chestTier(Math.ceil(hp * 0.05), 3)).toBe(2);
    expect(chestTier(hp, 3)).toBe(CHEST_TIERS.length - 1);
    const lo = chestReward(0, 1, 1);
    const hi = chestReward(5, 10, 10);
    expect(hi.gold!).toBeGreaterThan(lo.gold!);
    expect(hi.coins!).toBeGreaterThan(lo.coins!);
    expect(killReward(6, 1).materials).toEqual({ scroll: 1 });
  });

  it('числа совпадают с SQL', () => {
    expect(SQL).toContain(`array[${CLAN_LEVEL_XP.join(', ')}]`);
    expect(SQL).toContain(
      `array[${Array.from({ length: 10 }, (_, i) => clanPerks(i + 1).memberCap).join(', ')}]`,
    );
    expect(SQL).toContain('round(300000 * power(1.25, greatest(0, lvl - 1)))');
    expect(bossHp(2)).toBe(375_000);
    for (const g of WEEKLY_GOALS) expect(SQL).toContain(`when '${g.id}' then (array[${g.steps.join(', ')}])`);
    expect(SQL).toContain(`'(${CLAN_EMBLEMS.map((e) => `'${e}'`).join(',')})'`.slice(1, -1));
    expect(SQL).toContain(`(${CLAN_COLORS.map((c) => `'${c}'`).join(',')})`);
    expect(SQL).toContain(`if d.keys >= ${CLAN.keysPerDay} then`);
    expect(SQL).toContain(
      `greatest(${CLAN.damageCap.floor}, coalesce(pw, 0)::bigint * ${CLAN.damageCap.powerMult})`,
    );
    expect(SQL).toContain(`interval '${CLAN.leaveCooldownH} hours'`);
    expect(SQL).toContain(`_clan_add_xp(m.clan_id, m.user_id, ${CLAN.xp.checkin})`);
    expect(SQL).toContain(`then auth.uid() else null end, ${CLAN.xp.attack})`);
    expect(SQL).toContain(`_clan_add_xp(c.id, null, ${CLAN.xp.kill})`);
    const [g, sh] = DONATIONS;
    expect(SQL).toContain(`case p_kind when '${g.id}' then ${g.xp} else ${sh.xp} end`);
    expect(SQL).toContain(`>= ${CLAN.maxOfficers} then`);
    expect(SQL).toContain(`coalesce(lvl, 1) < ${CLAN.createMinLevel}`);
  });
});

describe('ClanSim: состав', () => {
  it('создание: уровень, уникальность, проверки', () => {
    const { s } = sim();
    expect(code(() => s.create('c', input(), T0))).toBe('clan_level');
    expect(code(() => s.create('a', input({ tag: 'X' }), T0))).toBe('invalid');
    expect(code(() => s.create('a', input({ emblem: 'nope' }), T0))).toBe('invalid');
    const id = s.create('a', input(), T0);
    expect(s.state('a', T0)!.me.role).toBe('leader');
    expect(code(() => s.create('a', input({ name: 'Другой', tag: 'ДР' }), T0))).toBe('clan_in');
    expect(code(() => s.create('d', input({ name: 'рассвет', tag: 'ДР' }), T0))).toBe('clan_taken');
    expect(code(() => s.create('d', input({ name: 'Другой', tag: 'рсв' }), T0))).toBe('clan_taken');
    expect(s.state('a', T0)!.clan.id).toBe(id);
  });

  it('вступление: открытый, по заявке, закрытый, минимальный уровень', () => {
    const { s } = sim();
    const open = s.create('a', input(), T0);
    expect(s.join('b', open, T0)).toBe('joined');
    const req = s.create('d', input({ name: 'Заявки', tag: 'ЗВК', joinMode: 'request', minLevel: 5 }), T0);
    expect(code(() => s.join('c', req, T0))).toBe('clan_level');
    expect(s.join('e', req, T0)).toBe('requested');
    expect(code(() => s.join('e', req, T0))).toBe('already');
    expect(s.state('d', T0)!.requests.map((r) => r.profile.id)).toEqual(['e']);
    expect(code(() => s.respond('b', 'e', true, T0))).toBe('clan_rights');
    s.respond('d', 'e', true, T0);
    expect(s.state('e', T0)!.clan.id).toBe(req);
    const closed = s.create('f', input({ name: 'Закрыт', tag: 'ЗКР', joinMode: 'closed' }), T0);
    expect(code(() => s.join('c', closed, T0))).toBe('clan_closed');
  });

  it('лимит участников по уровню клана', () => {
    const ps = profiles();
    for (let i = 0; i < 20; i++)
      ps.set(`x${i}`, {
        id: `x${i}`,
        nickname: `x${i}`,
        friendCode: '',
        avatar: 'knight',
        level: 10,
        power: 1,
        arenaRating: 0,
        lastSeen: 0,
      });
    const s = new ClanSim(emptyClanDB(), (id) => ps.get(id));
    const id = s.create('a', input(), T0);
    for (let i = 0; i < 14; i++) s.join(`x${i}`, id, T0);
    expect(code(() => s.join('x14', id, T0))).toBe('clan_full');
    s.db.clans[0]!.xp = CLAN_LEVEL_XP[1]!;
    expect(s.join('x14', id, T0)).toBe('joined');
  });

  it('выход главы передаёт клан офицеру, последний — распускает; пауза 4 часа', () => {
    const { s } = sim();
    const id = s.create('a', input(), T0);
    s.join('b', id, T0 + 1);
    s.join('d', id, T0 + 2);
    s.setRole('a', 'd', 'officer', T0);
    s.leave('a', T0);
    expect(s.state('d', T0)!.me.role).toBe('leader');
    expect(code(() => s.join('a', id, T0 + 3_600_000))).toBe('clan_cooldown');
    expect(s.join('a', id, T0 + 4 * 3_600_000 + 1)).toBe('joined');
    s.leave('b', T0);
    s.leave('a', T0 + 5 * 3_600_000);
    s.leave('d', T0);
    expect(s.db.clans).toHaveLength(0);
  });

  it('права: исключение, офицеры, передача главы, настройки', () => {
    const { s } = sim();
    const id = s.create('a', input(), T0);
    for (const u of ['b', 'd', 'e', 'f']) s.join(u, id, T0);
    expect(code(() => s.kick('b', 'd', T0))).toBe('clan_rights');
    s.setRole('a', 'b', 'officer', T0);
    s.setRole('a', 'd', 'officer', T0);
    s.setRole('a', 'e', 'officer', T0);
    expect(code(() => s.setRole('a', 'f', 'officer', T0))).toBe('clan_officers');
    expect(code(() => s.kick('b', 'd', T0))).toBe('clan_rights');
    s.setRole('a', 'e', 'member', T0);
    s.kick('b', 'e', T0);
    expect(s.state('a', T0)!.members).toHaveLength(4);
    expect(code(() => s.update('f', { description: 'x' }))).toBe('clan_rights');
    s.update('b', { description: 'Новое', joinMode: 'request', minLevel: 300 });
    expect(s.state('a', T0)!.clan).toMatchObject({
      description: 'Новое',
      joinMode: 'request',
      minLevel: 100,
    });
    s.transfer('a', 'f', T0);
    expect(s.state('f', T0)!.me.role).toBe('leader');
    expect(s.state('a', T0)!.me.role).toBe('officer');
    const kinds = s
      .messages('a')
      .filter((m) => m.kind === 'system')
      .map((m) => JSON.parse(m.body).k);
    expect(kinds).toEqual(expect.arrayContaining(['created', 'join', 'promote', 'demote', 'kick', 'leader']));
  });
});

describe('ClanSim: ежедневное и босс', () => {
  it('отметка и пожертвования раз в день, опыт клана растёт', () => {
    const { s } = sim();
    s.create('a', input(), T0);
    s.checkin('a', T0);
    expect(code(() => s.checkin('a', T0 + 1000))).toBe('already');
    s.donate('a', 'gold', T0);
    s.donate('a', 'shards', T0);
    expect(code(() => s.donate('a', 'gold', T0))).toBe('already');
    const st = s.state('a', T0)!;
    expect(st.clan.xp).toBe(CLAN.xp.checkin + 25 + 60);
    expect(st.me.today).toMatchObject({ checkin: true, donations: ['gold', 'shards'] });
    expect(st.week.checkins).toBe(1);
    s.checkin('a', T0 + DAY);
    expect(s.state('a', T0 + DAY)!.week.checkins).toBe(2);
  });

  it('два ключа в день, лимит урона, убийство и новый уровень', () => {
    const { s } = sim();
    const id = s.create('a', input(), T0);
    s.join('b', id, T0);
    const a1 = s.bossBegin('a', T0);
    expect(a1).toMatchObject({ level: 1, hp: bossHp(1), hpMax: bossHp(1) });
    const r1 = s.bossFinish('a', a1.attemptId, 10_000_000, T0);
    // Сила 10 000 → лимит 600 000, но не больше здоровья босса.
    expect(r1.damage).toBe(bossHp(1));
    expect(r1).toMatchObject({ killed: true, level: 1, bossLevel: 2, bossHp: bossHp(2) });
    expect(code(() => s.bossFinish('a', a1.attemptId, 5, T0))).toBe('already');
    s.bossBegin('a', T0);
    expect(code(() => s.bossBegin('a', T0))).toBe('no_keys');
    expect(s.bossBegin('a', T0 + DAY).level).toBe(2);
    const st = s.state('a', T0)!;
    expect(st.boss.kills).toBe(1);
    expect(st.week).toMatchObject({ attacks: 1, kills: 1 });
    expect(st.pendingKills).toEqual([1]);
    expect(s.state('b', T0)!.pendingKills).toEqual([]);
    s.claimKill('a', 1);
    expect(code(() => s.claimKill('a', 1))).toBe('already');
    expect(code(() => s.claimKill('b', 1))).toBe('not_found');
  });

  it('урон ограничен силой; просроченная попытка не засчитывается', () => {
    const { s, ps } = sim();
    s.create('a', input(), T0);
    ps.get('a')!.power = 1000;
    const a = s.bossBegin('a', T0);
    expect(s.bossFinish('a', a.attemptId, 999_999, T0).damage).toBe(CLAN.damageCap.floor);
    const b = s.bossBegin('a', T0);
    expect(code(() => s.bossFinish('a', b.attemptId, 10, T0 + ATTEMPT_TTL_MS + 1))).toBe('expired');
    expect(s.state('a', T0)!.me.today.damage).toBe(CLAN.damageCap.floor);
  });

  it('недельные цели и место за вчера', () => {
    const { s } = sim();
    const id = s.create('a', input(), T0);
    s.join('b', id, T0);
    expect(code(() => s.claimWeekly('a', 'attacks', 0, T0))).toBe('invalid');
    s.db.week[0] ??= { clanId: id, week: weekIndex(dayIndex(T0)), attacks: 0, checkins: 0, kills: 0 };
    s.db.week.find((w) => w.clanId === id)!.attacks = 50;
    s.claimWeekly('a', 'attacks', 0, T0);
    s.claimWeekly('a', 'attacks', 1, T0);
    expect(code(() => s.claimWeekly('a', 'attacks', 2, T0))).toBe('invalid');
    expect(code(() => s.claimWeekly('a', 'attacks', 0, T0))).toBe('already');
    expect(s.state('a', T0)!.week.claimed).toEqual(['attacks:0', 'attacks:1']);

    const x = s.bossBegin('a', T0);
    s.bossFinish('a', x.attemptId, 20_000, T0);
    const y = s.bossBegin('b', T0);
    s.bossFinish('b', y.attemptId, 50_000, T0);
    const next = T0 + DAY;
    expect(s.state('a', next)!.yesterday).toEqual({ rank: 2, damage: 20_000, of: 2 });
    expect(s.claimRank('b', next)).toEqual({ rank: 1, damage: 50_000, of: 2 });
    expect(s.claimRank('b', next)).toBeNull();
    expect(s.state('b', next)!.yesterday).toBeNull();
  });

  it('боты отмечаются и бьют босса', () => {
    const ps = profiles();
    ps.set('bot-1', { ...ps.get('e')!, id: 'bot-1' });
    const s = new ClanSim(
      emptyClanDB(),
      (id) => ps.get(id),
      () => 0.5,
    );
    const id = s.create('a', input(), T0);
    s.join('bot-1', id, T0);
    s.simulateBots((u) => u.startsWith('bot-'), T0); // 10:00 — одна атака
    let bot = s.state('a', T0)!.members.find((m) => m.profile.id === 'bot-1')!;
    expect(bot.today).toMatchObject({ checkin: true, keys: 1 });
    s.simulateBots((u) => u.startsWith('bot-'), T0 + 10 * 3_600_000); // 20:00 — вторая
    bot = s.state('a', T0 + 10 * 3_600_000)!.members.find((m) => m.profile.id === 'bot-1')!;
    expect(bot.today.keys).toBe(2);
    expect(bot.today.damage).toBeGreaterThan(0);
  });
});

describe('клан в сейве и магазине', () => {
  it('миграция v8 добавляет клановые монеты', () => {
    const raw = migrate({ version: 7, player: { name: 'A', level: 3, xp: 0 } });
    expect(raw.clan).toEqual({ coins: 0, bought: {} });
  });

  it('награда, магазин: уровень, лимит, монеты', () => {
    const s = createNewSave(T0);
    const items = s.items.length;
    grantClanReward(
      s,
      { coins: 1000, gold: 5, gear: { chance: 1, weights: { common: 0, rare: 0, epic: 1, legendary: 0 } } },
      T0,
    );
    expect(s.clan.coins).toBe(1000);
    expect(s.items.length).toBe(items + 1);
    expect(buyClanOffer(s, 'legItem', 1, T0)).toBe('level');
    const tomes = s.materials.xpTome;
    for (let i = 0; i < 5; i++) expect(buyClanOffer(s, 'tomes', 1, T0)).toEqual({});
    expect(buyClanOffer(s, 'tomes', 1, T0)).toBe('soldOut');
    expect(s.materials.xpTome).toBe(tomes + 25);
    expect(buyClanOffer(s, 'tomes', 1, T0 + 7 * DAY)).toEqual({});
    s.clan.coins = 10;
    expect(buyClanOffer(s, 'ore', 1, T0 + 7 * DAY)).toBe('noCoins');
    s.clan.coins = 5000;
    const r = buyClanOffer(s, 'epicItem', 4, T0);
    expect(typeof r === 'object' && r.item?.rarity).toBe('epic');
    expect(CLAN_SHOP.every((o) => o.price > 0 && o.limit > 0)).toBe(true);
  });
});

describe('бой с боссом клана', () => {
  const team = (lv: number): UnitSpec[] =>
    ['rikht', 'ivy', 'grav', 'chirk', 'dorn'].map((id) => ({ defId: id, kind: 'hero', level: lv, stars: 3 }));

  it('бой на время: лимит ходов, урон равен снятому здоровью', () => {
    const boss = bossSpec(1, 'fire', bossHp(1));
    const { result, battle } = simulate(
      { allies: team(30), waves: [[boss]], seed: 7, bossTurns: CLAN.bossTurns },
      db,
    );
    const b = battle.enemies[0]!;
    expect(result.damage).toBe(bossHp(1) - b.hp);
    expect(Object.values(result.damageBy!).reduce((a, x) => a + x, 0)).toBe(result.damage);
    if (result.winner === 'draw') expect(result.bossTurns).toBe(CLAN.bossTurns);
    expect(b.stats.atk).toBeGreaterThan(0);
    expect(b.enrageStacks).toBe(result.bossTurns);
  });

  it('добить босса — победа', () => {
    const { result } = simulate(
      { allies: team(30), waves: [[bossSpec(1, 'fire', 500)]], seed: 1, bossTurns: 30 },
      db,
    );
    expect(result.winner).toBe('ally');
    expect(result.damage).toBe(500);
  });

  it('иммунитет к оглушению и сбиву шкалы, яд ограничен атакой', () => {
    const b = new Battle(
      { allies: team(30), waves: [[bossSpec(1, 'dark', bossHp(1))]], seed: 3, bossTurns: 30 },
      db,
    );
    b.run();
    expect(b.log.some((e) => e.t === 'stunned' && e.uid.startsWith('e'))).toBe(false);
    for (const e of b.log)
      if (e.t === 'poison' && e.uid.startsWith('e')) expect(e.amount).toBeLessThan(bossHp(1) * 0.01);
  });

  it('сдаться: бой заканчивается, урон сохраняется', () => {
    const b = new Battle(
      { allies: team(30), waves: [[bossSpec(1, 'fire', bossHp(1))]], seed: 5, bossTurns: 30 },
      db,
    );
    for (let i = 0; i < 6; i++) {
      const u = b.nextActor();
      if (!u) break;
      b.act(u.uid, 0, b.validTargets(u, u.skills[0]!)[0]?.uid);
    }
    b.surrender();
    expect(b.result).toMatchObject({ winner: 'enemy', surrendered: true });
    expect(b.result!.damage).toBe(b.damage);
  });
});

describe('демо-сервер: кланы', () => {
  it('новый игрок видит кланы ботов, вступает и бьёт босса', async () => {
    const store = new Map<string, string>();
    const kv = {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => void store.set(k, v),
    };
    const be = new DemoOnlineBackend(kv, { botDelayMs: 0, now: () => T0 });
    await be.signUp('t@t.tt', 'secret1', 'Тестер');
    expect(await be.myClan()).toBeNull();
    const list = await be.browseClans('');
    expect(list.clans.length).toBe(3);
    const open = list.clans.find((c) => c.joinMode === 'open')!;
    expect(await be.joinClan(open.id)).toBe('joined');
    const st = (await be.myClan())!;
    expect(st.members.length).toBeGreaterThan(3);
    const att = await be.bossBegin();
    const out = await be.bossFinish(att.attemptId, 1234);
    expect(out.damage).toBe(1234);
    const msgs = await be.clanMessages();
    expect(msgs.some((m) => m.kind === 'system')).toBe(true);
    const err = await be
      .bossBegin()
      .then(() => be.bossBegin())
      .catch((e: OnlineError) => e.code);
    expect(err).toBe('no_keys');
  });
});
