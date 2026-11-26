import { describe, expect, it } from 'vitest';
import { createNewSave } from '@/save';
import {
  IDLE_CAP_MS,
  pendingIdle,
  claimIdle,
  idleRates,
  summon,
  PITY_LEGENDARY,
  PITY_EPIC,
  SUMMON_COST,
  buyOffer,
  SHOP_OFFERS,
  periodKey,
} from '@/game';
import { heroDef } from '@/content';

const NOW = 1_700_000_000_000;
const H = 3_600_000;

describe('idle-награды', () => {
  it('копятся по времени и упираются в 12 часов', () => {
    const s = createNewSave(NOW);
    const r2 = pendingIdle(s, NOW + 2 * H);
    expect(r2.gold).toBe(Math.floor(idleRates(s).gold * 2));
    const r24 = pendingIdle(s, NOW + 24 * H);
    expect(r24.ms).toBe(IDLE_CAP_MS);
    expect(r24.gold).toBe(Math.floor(idleRates(s).gold * 12));
  });

  it('растут с прогрессом кампании', () => {
    const s = createNewSave(NOW);
    const before = idleRates(s).gold;
    s.campaign.stars['1-1'] = 3;
    s.campaign.stars['1-2'] = 1;
    expect(idleRates(s).gold).toBeGreaterThan(before);
  });

  it('сбор обнуляет копилку и выдаёт опыт команде', () => {
    const s = createNewSave(NOW);
    const g0 = s.currencies.gold;
    const r = claimIdle(s, NOW + 6 * H);
    expect(s.currencies.gold).toBe(g0 + r.gold);
    expect(s.heroes[0]!.level).toBeGreaterThan(1);
    expect(pendingIdle(s, NOW + 6 * H).gold).toBe(0);
  });

  it('время из будущего не даёт награды', () => {
    const s = createNewSave(NOW);
    expect(pendingIdle(s, NOW - 5 * H).gold).toBe(0);
  });
});

describe('призыв', () => {
  const rich = () => {
    const s = createNewSave(NOW);
    s.currencies.shards = 1_000_000;
    return s;
  };

  it('списывает цену и добавляет героев', () => {
    const s = rich();
    const n0 = s.heroes.length;
    const r = summon(s, 10, 'shards', NOW);
    expect(typeof r).toBe('object');
    expect(s.heroes.length).toBe(n0 + 10);
    expect(s.currencies.shards).toBe(1_000_000 - SUMMON_COST.shards10);
  });

  it('без денег — ошибка, сейв не меняется', () => {
    const s = createNewSave(NOW);
    s.currencies.shards = 0;
    s.materials.scroll = 0;
    expect(summon(s, 1, 'shards')).toBe('noShards');
    expect(summon(s, 1, 'scroll')).toBe('noScrolls');
    expect(s.heroes.length).toBe(5);
  });

  it(`легендарный гарантирован не позже ${PITY_LEGENDARY}-го призыва`, () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = rich();
      s.summon.rng = seed;
      let since = 0;
      let maxGap = 0;
      for (let i = 0; i < 300; i++) {
        const r = summon(s, 1, 'shards', NOW);
        if (typeof r === 'string') throw new Error(r);
        since = r.rarities[0] === 'legendary' ? 0 : since + 1;
        maxGap = Math.max(maxGap, since);
      }
      expect(maxGap).toBeLessThan(PITY_LEGENDARY);
    }
  });

  it(`эпический или лучше — хотя бы раз за ${PITY_EPIC}`, () => {
    const s = rich();
    s.summon.rng = 12345;
    let since = 0;
    for (let i = 0; i < 500; i++) {
      const r = summon(s, 1, 'shards', NOW) as Exclude<ReturnType<typeof summon>, string>;
      since = r.rarities[0] === 'epic' || r.rarities[0] === 'legendary' ? 0 : since + 1;
      expect(since).toBeLessThan(PITY_EPIC);
    }
  });

  it('шансы примерно соответствуют заявленным', () => {
    const s = rich();
    s.summon.rng = 777;
    const counts: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < 400; i++) {
      const r = summon(s, 10, 'shards', NOW) as Exclude<ReturnType<typeof summon>, string>;
      for (const x of r.rarities) counts[x] = (counts[x] ?? 0) + 1;
    }
    const total = 4000;
    expect(counts.common! / total).toBeGreaterThan(0.38);
    expect(counts.legendary! / total).toBeGreaterThan(0.03);
    expect(counts.legendary! / total).toBeLessThan(0.08);
  });

  it('один и тот же сейв даёт одинаковый результат (перезагрузка не помогает)', () => {
    const a = rich();
    const b = structuredClone(a);
    const ra = summon(a, 10, 'shards', NOW) as Exclude<ReturnType<typeof summon>, string>;
    const rb = summon(b, 10, 'shards', NOW) as Exclude<ReturnType<typeof summon>, string>;
    expect(ra.heroes.map((h) => h.heroId)).toEqual(rb.heroes.map((h) => h.heroId));
    expect(heroDef(ra.heroes[0]!.heroId)).toBeTruthy();
  });
});

describe('магазин', () => {
  it('покупка списывает цену и выдаёт награду', () => {
    const s = createNewSave(NOW);
    s.currencies.gold = 100_000;
    expect(buyOffer(s, 'tome5', NOW)).toBe(true);
    expect(s.materials.xpTome).toBe(10);
    expect(s.currencies.gold).toBe(100_000 - 6000);
  });

  it('дневной лимит сбрасывается на следующий день', () => {
    const s = createNewSave(NOW);
    s.currencies.shards = 10_000;
    const offer = SHOP_OFFERS.find((o) => o.id === 'energy60')!;
    for (let i = 0; i < offer.limit!.count; i++) expect(buyOffer(s, 'energy60', NOW)).toBe(true);
    expect(buyOffer(s, 'energy60', NOW)).toBe('soldOut');
    expect(buyOffer(s, 'energy60', NOW + 24 * H)).toBe(true);
    expect(s.currencies.energy).toBeGreaterThan(120);
  });

  it('предложения за реальные деньги не покупаются за игровую валюту', () => {
    const s = createNewSave(NOW);
    s.currencies.shards = 1e9;
    expect(buyOffer(s, 'starter', NOW)).toBe('realMoney');
  });

  it('ключи периодов', () => {
    expect(periodKey('day', NOW)).toBe(new Date(NOW).toISOString().slice(0, 10));
    expect(periodKey('week', NOW)).toBe(periodKey('week', NOW + 1000));
  });
});
