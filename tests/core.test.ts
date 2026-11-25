import { describe, expect, it } from 'vitest';
import {
  Rng,
  hashSeed,
  affinity,
  rollDamage,
  debuffChance,
  defenseReduction,
  activeFactionBonus,
  applyBonus,
  baseStats,
  statsAt,
  maxLevel,
} from '@/core';

describe('Rng', () => {
  it('детерминирован: один seed — одна последовательность', () => {
    const a = new Rng(42),
      b = new Rng(42);
    const xs = Array.from({ length: 50 }, () => a.next());
    const ys = Array.from({ length: 50 }, () => b.next());
    expect(xs).toEqual(ys);
    expect(new Set(xs).size).toBe(50);
  });

  it('можно продолжить с сохранённого состояния', () => {
    const a = new Rng(7);
    a.next();
    a.next();
    const b = Rng.fromState(a.state);
    expect(b.next()).toBe(a.next());
  });

  it('int в границах и примерно равномерен', () => {
    const r = new Rng(1);
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[r.int(0, 5)]!++;
    for (const c of counts) expect(c).toBeGreaterThan(850);
  });

  it('hashSeed стабилен', () => {
    expect(hashSeed('stage:1-1')).toBe(hashSeed('stage:1-1'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('стихии', () => {
  it('цикл Пламя > Терн > Камень > Прилив > Пламя', () => {
    expect(affinity('fire', 'thorn')).toBe('strong');
    expect(affinity('thorn', 'stone')).toBe('strong');
    expect(affinity('stone', 'tide')).toBe('strong');
    expect(affinity('tide', 'fire')).toBe('strong');
    expect(affinity('thorn', 'fire')).toBe('weak');
    expect(affinity('fire', 'stone')).toBe('neutral');
  });
  it('Свет и Тьма сильны друг против друга и нейтральны к остальным', () => {
    expect(affinity('light', 'dark')).toBe('strong');
    expect(affinity('dark', 'light')).toBe('strong');
    expect(affinity('light', 'fire')).toBe('neutral');
    expect(affinity('tide', 'dark')).toBe('neutral');
  });
});

describe('формулы', () => {
  const base = {
    power: 1000,
    multiplier: 1,
    def: 0,
    critRate: 0,
    critDmg: 0.5,
    affinity: 'neutral' as const,
  };

  it('защита снижает урон по def/(def+600)', () => {
    expect(defenseReduction(0)).toBe(0);
    expect(defenseReduction(600)).toBeCloseTo(0.5);
    const r = new Rng(3);
    const d = rollDamage({ ...base, def: 600 }, r).amount;
    expect(d).toBeGreaterThanOrEqual(475);
    expect(d).toBeLessThanOrEqual(525);
  });

  it('крит умножает урон на 1 + крит. урон', () => {
    const r = new Rng(5);
    const res = rollDamage({ ...base, critRate: 1, critDmg: 1 }, r);
    expect(res.crit).toBe(true);
    expect(res.amount).toBeGreaterThanOrEqual(1900);
  });

  it('преимущество стихии: ×1.3, слабость: ×0.8', () => {
    const strong = rollDamage({ ...base, affinity: 'strong', critRate: -1 }, new Rng(9)).amount;
    const weak = rollDamage({ ...base, affinity: 'weak', critRate: 0 }, new Rng(9)).amount;
    expect(strong / weak).toBeCloseTo(1.3 / 0.8, 1);
  });

  it('игнор защиты работает', () => {
    const full = rollDamage({ ...base, def: 600, defIgnore: 1 }, new Rng(1)).amount;
    expect(full).toBeGreaterThan(940);
  });

  it('шанс дебаффа зависит от меткости, сопротивления и стихии', () => {
    expect(debuffChance(1, 100, 100, 'neutral')).toBe(1);
    expect(debuffChance(1, 0, 200, 'neutral')).toBeCloseTo(0.5);
    expect(debuffChance(0.5, 0, 0, 'strong')).toBeCloseTo(0.6);
    expect(debuffChance(0.1, 0, 400, 'weak')).toBe(0.05);
  });
});

describe('рост и фракции', () => {
  it('уровни и звёзды растят основные характеристики', () => {
    const b = baseStats('attacker', 'common');
    const l10 = statsAt(b, 10, 1);
    const l10s3 = statsAt(b, 10, 3);
    expect(l10.atk).toBeGreaterThan(b.atk);
    expect(l10s3.atk).toBeGreaterThan(l10.atk);
    expect(statsAt(b, 60, 6, true).spd).toBe(b.spd + 5 + 6);
    expect(maxLevel(1)).toBe(10);
    expect(maxLevel(6)).toBe(60);
  });

  it('редкость повышает базу', () => {
    expect(baseStats('defender', 'legendary').hp).toBeGreaterThan(baseStats('defender', 'common').hp);
  });

  it('бонус фракции включается с 3 героев', () => {
    expect(activeFactionBonus('order', 2)).toBeNull();
    expect(activeFactionBonus('order', 3)).toEqual({ def: 0.15 });
    const s = applyBonus(baseStats('defender', 'common'), activeFactionBonus('order', 5));
    expect(s.def).toBe(Math.round(baseStats('defender', 'common').def * 1.3));
  });
});
