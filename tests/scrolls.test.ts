import { describe, expect, it } from 'vitest';
import { CHAPTERS, HEROES, SCROLLS, db, heroDef, validateContent } from '@/content';
import { FACTIONS, HERO_RARITY_ORDER } from '@/core/types';
import { baseStats, power, statsAt } from '@/core/stats';
import { simulate } from '@/core/battle';
import { addHeroXp, capOf, heroChance, makeSetup, scrollPool, summon } from '@/game';
import { createNewSave } from '@/save/schema';
import { migrate } from '@/save/migrations';

const NOW = 1_800_000_000_000;
function rich() {
  const s = createNewSave(NOW);
  for (const m of ['scroll', 'ancientScroll', 'factionScroll', 'voidScroll', 'goldScroll'] as const)
    s.materials[m] = 1000;
  return s;
}

describe('свитки призыва', () => {
  it('контент целостен, шансы в сумме 1, пулы не пустые', () => {
    expect(validateContent()).toEqual([]);
    for (const s of SCROLLS) {
      const sum = Object.values(s.rates).reduce((a, b) => a + (b ?? 0), 0);
      expect(sum, s.id).toBeCloseTo(1, 9);
      if (s.chooseFaction)
        for (const f of FACTIONS) expect(scrollPool(s.id, f).length, `${s.id}/${f}`).toBeGreaterThan(2);
      else expect(scrollPool(s.id).length, s.id).toBeGreaterThan(3);
    }
  });

  it('сумрачные — только из свитка Сумрака, мифические — только из золотого', () => {
    for (const h of HEROES.filter((x) => x.pool === 'void'))
      for (const s of SCROLLS) expect(heroChance(h, s.id) > 0, `${h.id}/${s.id}`).toBe(s.id === 'void');
    for (const h of HEROES.filter((x) => x.pool === 'gold'))
      for (const s of SCROLLS) expect(heroChance(h, s.id) > 0, `${h.id}/${s.id}`).toBe(s.id === 'gold');
    expect(scrollPool('ancient').some((h) => h.rarity === 'common')).toBe(false);
    expect(scrollPool('void').every((h) => h.element === 'light' || h.element === 'dark')).toBe(true);
  });

  it('шансы героев по редкости складываются в шанс редкости', () => {
    for (const s of SCROLLS) {
      const pool = scrollPool(s.id, s.chooseFaction ? 'order' : undefined);
      for (const r of HERO_RARITY_ORDER) {
        const list = pool.filter((h) => h.rarity === r);
        if (!list.length) continue;
        const sum = list.reduce((a, h) => a + heroChance(h, s.id, s.chooseFaction ? 'order' : undefined), 0);
        expect(sum, `${s.id}/${r}`).toBeCloseTo(s.rates[r] ?? 0, 9);
      }
    }
  });

  it('тратит свои свитки; фракционный требует выбора и даёт героев фракции', () => {
    const s = rich();
    expect(summon(s, 1, 'faction', NOW)).toBe('noFaction');
    const r = summon(s, 10, 'faction', NOW, { faction: 'grove' });
    expect(typeof r).toBe('object');
    if (typeof r === 'object')
      expect(r.heroes.every((h) => heroDef(h.heroId).faction === 'grove')).toBe(true);
    expect(s.materials.factionScroll).toBe(990);
    s.materials.goldScroll = 0;
    expect(summon(s, 1, 'gold', NOW)).toBe('noScrolls');
  });

  it('гарантии: мифический не позже 12-го золотого, легендарка в Сумраке не позже 20-го', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = rich();
      s.summon.rng = seed;
      let got = false;
      for (let i = 0; i < 12; i++) {
        const r = summon(s, 1, 'gold', NOW);
        if (typeof r === 'object' && r.rarities[0] === 'mythic') got = true;
      }
      expect(got, `seed ${seed}`).toBe(true);
      let leg = false;
      for (let i = 0; i < 20; i++) {
        const r = summon(s, 1, 'void', NOW);
        if (typeof r === 'object' && r.rarities[0] === 'legendary') leg = true;
      }
      expect(leg, `seed ${seed}`).toBe(true);
    }
  });

  it('золотой свиток примерно держит шансы', () => {
    const s = rich();
    s.summon.rng = 4242;
    const c: Record<string, number> = {};
    for (let i = 0; i < 100; i++) {
      const r = summon(s, 10, 'gold', NOW);
      if (typeof r === 'object') for (const x of r.rarities) c[x] = (c[x] ?? 0) + 1;
    }
    expect(c.common ?? 0).toBe(0);
    expect(c.rare ?? 0).toBe(0);
    expect((c.mythic ?? 0) / 1000).toBeGreaterThan(0.1);
    expect((c.legendary ?? 0) / 1000).toBeGreaterThan(0.3);
  });
});

describe('мифические герои', () => {
  it('приходят с 1★ и качаются сразу до 60', () => {
    const s = rich();
    s.summon.pity.gold = 11;
    const r = summon(s, 1, 'gold', NOW);
    if (typeof r !== 'object') throw new Error('нет призыва');
    const h = r.heroes[0]!;
    expect(heroDef(h.heroId).rarity).toBe('mythic');
    expect(h.stars).toBe(1);
    expect(capOf(h)).toBe(60);
    addHeroXp(h, 10_000_000);
    expect(h.level).toBe(60);
  });

  it('сильнее легендарных: и при равных звёздах, и 1★ против 4★ на их потолке', () => {
    for (const m of HEROES.filter((h) => h.rarity === 'mythic')) {
      const leg =
        HEROES.find((h) => h.rarity === 'legendary' && h.role === m.role) ??
        HEROES.find((h) => h.rarity === 'legendary')!;
      const pm = (lv: number, st: number) => power(statsAt(baseStats(m.role, m.rarity, m.mod), lv, st));
      const pl = (lv: number, st: number) => power(statsAt(baseStats(leg.role, leg.rarity, leg.mod), lv, st));
      expect(pm(60, 6), m.id).toBeGreaterThan(pl(60, 6));
      expect(pm(60, 1), m.id).toBeGreaterThan(pl(40, 4));
    }
  });
});

describe('глава 4 и сейв', () => {
  it('глава 4 на новых врагах, босс — Королева Затмения, бой проходит', () => {
    const ch = CHAPTERS[3]!;
    expect(ch.scene).toBe('dusk');
    expect(ch.stages[9]!.waves.at(-1)!.some((e) => e.id === 'eclipse_queen' && e.boss)).toBe(true);
    const team = ['solarion', 'thalassa', 'gorran', 'verdis', 'morok'].map((id) => ({
      defId: id,
      kind: 'hero' as const,
      level: 60,
      stars: 6,
    }));
    const { result } = simulate(makeSetup(team, ch.stages[9]!.waves, 3), db);
    expect(['ally', 'enemy', 'draw']).toContain(result.winner);
    expect(result.report!.some((r) => r.name === 'Королева Затмения')).toBe(true);
  });

  it('v11: новые свитки и гарантии по свиткам', () => {
    const raw = migrate({ version: 10, materials: { scroll: 2 }, summon: { total: 5 } });
    expect(raw.materials).toMatchObject({ scroll: 2, ancientScroll: 1, goldScroll: 0 });
    expect(raw.summon).toMatchObject({ total: 5, pity: {}, epicPity: {} });
  });
});
