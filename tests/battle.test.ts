import { describe, expect, it } from 'vitest';
import { Battle, simulate, type BattleSetup, type ContentDb, type UnitSpec } from '@/core';
import type { SkillDef, HeroDef, EnemyDef } from '@/core/content';
import {
  db as gameDb,
  validateContent,
  HEROES,
  CHAPTERS,
  STARTER_HEROES,
  stageById,
  type StageDef,
} from '@/content';

/** Небольшая тестовая база, чтобы проверять механику изолированно. */
function testDb(extra: { heroes?: HeroDef[]; enemies?: EnemyDef[]; skills?: SkillDef[] }): ContentDb {
  const skills: SkillDef[] = [
    {
      id: 'hit',
      name: 'hit',
      desc: '',
      cooldown: 0,
      target: 'enemy',
      effects: [{ kind: 'damage', mult: 1 }],
    },
    ...(extra.skills ?? []),
  ];
  const h = new Map((extra.heroes ?? []).map((x) => [x.id, x]));
  const e = new Map((extra.enemies ?? []).map((x) => [x.id, x]));
  const s = new Map(skills.map((x) => [x.id, x]));
  return { hero: (id) => h.get(id), enemy: (id) => e.get(id), skill: (id) => s.get(id) };
}
const hero = (id: string, o: Partial<HeroDef> = {}): HeroDef => ({
  id,
  name: id,
  title: '',
  faction: 'order',
  element: 'fire',
  rarity: 'common',
  role: 'attacker',
  art: id,
  skills: ['hit', 'hit'],
  ...o,
});
const foe = (id: string, o: Partial<EnemyDef> = {}): EnemyDef => ({
  id,
  name: id,
  element: 'fire',
  role: 'attacker',
  art: id,
  skills: ['hit', 'hit'],
  ...o,
});
const H = (defId: string, level = 1): UnitSpec => ({ defId, kind: 'hero', level });
const E = (defId: string, level = 1): UnitSpec => ({ defId, kind: 'enemy', level });

describe('шкала хода', () => {
  it('быстрый боец ходит чаще медленного', () => {
    const d = testDb({
      heroes: [hero('fast', { mod: { spd: 100, hp: 50 } })],
      enemies: [foe('slow', { mod: { hp: 50 } })],
    });
    const b = new Battle({ allies: [H('fast')], waves: [[E('slow')]], seed: 1 }, d);
    const turns: string[] = [];
    for (let i = 0; i < 9; i++) {
      const u = b.nextActor()!;
      turns.push(u.side);
      b.act(u.uid, 0, b.aliveOf(u.side === 'ally' ? 'enemy' : 'ally')[0]!.uid);
    }
    const allyTurns = turns.filter((t) => t === 'ally').length;
    expect(allyTurns).toBeGreaterThanOrEqual(5);
  });
});

describe('эффекты', () => {
  const skills: SkillDef[] = [
    {
      id: 'stun',
      name: '',
      desc: '',
      cooldown: 3,
      target: 'enemy',
      effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 1 }],
    },
    {
      id: 'poison',
      name: '',
      desc: '',
      cooldown: 0,
      target: 'enemy',
      effects: [{ kind: 'status', status: 'poison', turns: 2, chance: 1 }],
    },
    {
      id: 'taunt',
      name: '',
      desc: '',
      cooldown: 3,
      target: 'none',
      effects: [{ kind: 'status', to: 'self', status: 'taunt', turns: 2 }],
    },
    {
      id: 'shield',
      name: '',
      desc: '',
      cooldown: 3,
      target: 'none',
      effects: [{ kind: 'shield', to: 'self', pct: 10, turns: 3 }],
    },
  ];

  it('оглушённый пропускает ход', () => {
    const d = testDb({
      skills,
      heroes: [hero('a', { skills: ['hit', 'stun'], mod: { spd: 200, acc: 1000 } })],
      enemies: [foe('b', { mod: { hp: 20 } })],
    });
    const b = new Battle({ allies: [H('a')], waves: [[E('b')]], seed: 2 }, d);
    const a = b.nextActor()!;
    b.act(a.uid, 1, b.enemies[0]!.uid);
    expect(b.enemies[0]!.statuses.some((s) => s.id === 'stun')).toBe(true);
    // Пока враг оглушён, его ход пропускается и событие stunned попадает в лог.
    for (let i = 0; i < 4; i++) {
      const u = b.nextActor();
      if (!u) break;
      b.act(u.uid, 0, b.aliveOf(u.side === 'ally' ? 'enemy' : 'ally')[0]!.uid);
    }
    expect(b.log.some((e) => e.t === 'stunned')).toBe(true);
  });

  it('яд бьёт в начале хода носителя на 5% макс. HP', () => {
    const d = testDb({
      skills,
      heroes: [hero('a', { skills: ['poison', 'hit'], mod: { spd: 200, acc: 1000 } })],
      enemies: [foe('b', { mod: { hp: 20 } })],
    });
    const b = new Battle({ allies: [H('a')], waves: [[E('b')]], seed: 3 }, d);
    const a = b.nextActor()!;
    b.act(a.uid, 0, b.enemies[0]!.uid);
    const enemy = b.enemies[0]!;
    while (b.nextActor()?.side !== 'enemy') {
      /* ждём хода врага */
      const cur = b.log.at(-1);
      if (cur?.t === 'turn') b.act(cur.uid, 0, enemy.uid);
    }
    const tick = b.log.find((e) => e.t === 'poison');
    expect(tick && tick.t === 'poison' && tick.amount).toBe(Math.round(enemy.stats.hp * 0.05));
  });

  it('провокация заставляет бить в провокатора', () => {
    const d = testDb({
      skills,
      heroes: [hero('tank', { skills: ['hit', 'taunt'], mod: { spd: 300 } }), hero('dps')],
      enemies: [foe('b')],
    });
    const b = new Battle({ allies: [H('tank'), H('dps')], waves: [[E('b')]], seed: 4 }, d);
    const t = b.nextActor()!;
    expect(t.defId).toBe('tank');
    b.act(t.uid, 1);
    const enemy = b.enemies[0]!;
    const targets = b.validTargets(enemy, enemy.skills[0]!);
    expect(targets.map((x) => x.defId)).toEqual(['tank']);
  });

  it('щит поглощает урон раньше HP', () => {
    const d = testDb({
      skills,
      heroes: [hero('a', { skills: ['hit', 'shield'], mod: { spd: 10 } })],
      enemies: [foe('b')],
    });
    const b = new Battle({ allies: [H('a')], waves: [[E('b')]], seed: 5 }, d);
    const a = b.nextActor()!;
    b.act(a.uid, 1);
    const hpBefore = a.hp;
    const e = b.nextActor()!;
    expect(e.side).toBe('enemy');
    b.act(e.uid, 0, a.uid);
    const dmg = b.log.filter((x) => x.t === 'damage').at(-1)!;
    expect(dmg.t === 'damage' && dmg.absorbed).toBe(dmg.t === 'damage' ? dmg.amount : -1);
    expect(a.hp).toBe(hpBefore);
  });

  it('навык на перезарядке нельзя использовать', () => {
    const d = testDb({
      skills,
      heroes: [hero('a', { skills: ['hit', 'taunt'], mod: { spd: 300 } })],
      enemies: [foe('b', { mod: { hp: 50 } })],
    });
    const b = new Battle({ allies: [H('a')], waves: [[E('b')]], seed: 6 }, d);
    const a = b.nextActor()!;
    b.act(a.uid, 1);
    expect(b.isReady(a, 1)).toBe(false);
    const again = b.nextActor()!;
    expect(again.uid).toBe(a.uid);
    expect(() => b.act(a.uid, 1)).toThrow(/перезарядке/);
  });
});

describe('бой целиком', () => {
  const team = (lvl: number, ids: readonly string[] = STARTER_HEROES) => ids.map((id) => H(id, lvl));
  const stageSetup = (stage: StageDef, allies: UnitSpec[], seed = 1): BattleSetup => ({
    allies,
    seed,
    waves: stage.waves.map((w) =>
      w.map((x) => ({ defId: x.id, kind: 'enemy' as const, level: x.level, boss: x.boss })),
    ),
  });

  it('один seed даёт одинаковый бой (повтор)', () => {
    const s = stageSetup(stageById('1-3')!, team(3), 99);
    const a = simulate(s, gameDb);
    const b = simulate(s, gameDb);
    expect(a.log).toEqual(b.log);
    expect(a.result).toEqual(b.result);
  });

  it('волны идут по очереди и бой заканчивается', () => {
    const { log, result } = simulate(stageSetup(stageById('1-5')!, team(10), 3), gameDb);
    expect(log.filter((e) => e.t === 'wave').length).toBe(2);
    expect(log.at(-1)?.t).toBe('end');
    expect(result.winner).toBe('ally');
  });

  it('звёзды: 3 без потерь', () => {
    const { result } = simulate(stageSetup(stageById('1-1')!, team(10), 5), gameDb);
    expect(result.stars).toBe(3);
  });

  it('баланс: стартовая команда 1 уровня проходит 1-1', () => {
    let wins = 0;
    for (let seed = 1; seed <= 20; seed++)
      if (simulate(stageSetup(stageById('1-1')!, team(1), seed), gameDb).result.winner === 'ally') wins++;
    expect(wins).toBeGreaterThanOrEqual(18);
  });

  it('баланс: босс 1-10 не проходится командой 1 уровня, но проходится прокачанной', () => {
    const stage = stageById('1-10')!;
    let weak = 0,
      strong = 0;
    for (let seed = 1; seed <= 10; seed++) {
      if (simulate(stageSetup(stage, team(1), seed), gameDb).result.winner === 'ally') weak++;
      if (
        simulate(
          stageSetup(
            stage,
            ['ardan', 'liel', 'mortis', 'kharras', 'brum'].map((id) => ({ ...H(id, 14), stars: 2 })),
            seed,
          ),
          gameDb,
        ).result.winner === 'ally'
      )
        strong++;
    }
    expect(weak).toBe(0);
    expect(strong).toBeGreaterThanOrEqual(8);
  });

  it('бонус фракции применяется к команде из 3+ героев одной фракции', () => {
    const allies = ['ardan', 'selesta', 'mirna'].map((id) => H(id, 5));
    const withBonus = new Battle({ allies, waves: [[E('wraith')]], seed: 1 }, gameDb);
    const without = new Battle({ allies, waves: [[E('wraith')]], seed: 1, factionBonus: false }, gameDb);
    expect(withBonus.allies[0]!.stats.def).toBeGreaterThan(without.allies[0]!.stats.def);
  });
});

describe('контент', () => {
  it('без ошибок ссылок', () => {
    expect(validateContent()).toEqual([]);
  });
  it('38 героев: 30 обычного пула (по 6 на фракцию), 4 сумрачных и 4 мифических', () => {
    expect(HEROES.length).toBe(38);
    const base = HEROES.filter((h) => !h.pool);
    expect(base.length).toBe(30);
    for (const f of ['order', 'grove', 'ash', 'abyss', 'forge'])
      expect(base.filter((h) => h.faction === f).length).toBe(6);
    expect(
      HEROES.filter((h) => h.pool === 'void').every((h) => h.element === 'light' || h.element === 'dark'),
    ).toBe(true);
    expect(HEROES.filter((h) => h.pool === 'gold').every((h) => h.rarity === 'mythic')).toBe(true);
    for (const r of ['common', 'rare', 'epic', 'legendary', 'mythic'])
      expect(HEROES.some((h) => h.rarity === r)).toBe(true);
    for (const r of ['attacker', 'defender', 'support', 'healer'])
      expect(HEROES.some((h) => h.role === r)).toBe(true);
  });
  it('4 главы по 10 этапов, босс в конце каждой', () => {
    expect(CHAPTERS.length).toBe(4);
    for (const c of CHAPTERS) {
      expect(c.stages.length).toBe(10);
      expect(c.stages[9]!.boss).toBe(true);
      expect(c.stages[9]!.waves.at(-1)!.some((e) => e.boss)).toBe(true);
    }
  });
});

describe('прогноз очереди', () => {
  it('совпадает с реальным порядком ходов', () => {
    const b = new Battle(
      {
        allies: ['ardan', 'liel', 'mortis'].map((id) => ({
          defId: id,
          kind: 'hero' as const,
          level: 20,
          stars: 3,
        })),
        waves: [
          [
            { defId: 'wraith', kind: 'enemy', level: 1 },
            { defId: 'hound', kind: 'enemy', level: 1 },
          ],
        ],
        seed: 1,
      },
      gameDb,
    );
    const predicted = b.previewOrder(4);
    const actual: string[] = [];
    for (let i = 0; i < 4; i++) {
      const u = b.nextActor()!;
      actual.push(u.uid);
      // Ходим базовым навыком по самому живучему врагу, чтобы никто не умер и не было баффов скорости.
      b.act(u.uid, 0, b.aliveOf(u.side === 'ally' ? 'enemy' : 'ally').sort((x, y) => y.hp - x.hp)[0]!.uid);
      if (b.result) break;
    }
    expect(actual.slice(0, 2)).toEqual(predicted.slice(0, 2));
  });
});
