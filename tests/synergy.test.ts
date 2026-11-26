import { describe, expect, it } from 'vitest';
import { HEROES } from '@/content';
import { RARITY_ORDER } from '@/core';
import { analyzeTeam, elementMatchups, goodPartners, heroTags, SUMMON_RATES, heroChance } from '@/game';

describe('synergy', () => {
  it('у каждого героя есть хотя бы одна метка', () => {
    for (const h of HEROES) expect(heroTags(h).length, h.id).toBeGreaterThan(0);
  });

  it('лекари получают метку лечения', () => {
    for (const h of HEROES.filter((x) => x.role === 'healer')) expect(heroTags(h), h.id).toContain('heal');
  });

  it('шансы призыва по редкости в сумме дают шанс редкости', () => {
    for (const r of RARITY_ORDER) {
      const sum = HEROES.filter((h) => h.rarity === r && !h.pool).reduce(
        (a, h) => a + heroChance(h, 'basic'),
        0,
      );
      expect(sum).toBeCloseTo(SUMMON_RATES[r], 6);
    }
  });

  it('стихии: огонь бьёт терн и боится волны', () => {
    const m = elementMatchups('fire');
    expect(m.strong).toContain('thorn');
    expect(m.weak).toContain('tide');
    expect(elementMatchups('light').strong).toContain('dark');
  });

  it('напарники: своя фракция идёт первой, себя нет', () => {
    const h = HEROES[0]!;
    const p = goodPartners(h);
    expect(p.length).toBeGreaterThan(0);
    expect(p.some((x) => x.id === h.id)).toBe(false);
    expect(p[0]!.reason).toBe('faction');
  });

  it('разбор команды: бонус фракции на 3 героях и советы', () => {
    const order = HEROES.filter((h) => h.faction === 'order')
      .slice(0, 3)
      .map((h) => h.id);
    const a = analyzeTeam(order);
    const f = a.factions.find((x) => x.faction === 'order')!;
    expect(f.count).toBe(3);
    expect(f.bonus).not.toBeNull();
    expect(a.advice.length).toBeGreaterThan(0);

    const two = analyzeTeam(order.slice(0, 2));
    expect(two.advice).toContainEqual({ kind: 'factionAlmost', faction: 'order', need: 1 });

    const dps = HEROES.filter((h) => h.role === 'attacker' && !heroTags(h).includes('heal')).slice(0, 2);
    expect(analyzeTeam(dps.map((h) => h.id)).advice).toContainEqual({ kind: 'noHeal' });
    expect(analyzeTeam([]).advice).toEqual([]);
  });
});
