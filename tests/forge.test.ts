import { describe, expect, it } from 'vitest';
import { createNewSave, migrate, normalizeSave } from '@/save';
import {
  craftItem,
  CRAFT_COST,
  salvageItem,
  salvageValue,
  rollGearDrop,
  applyStageResult,
  applyTowerResult,
  INVENTORY_LIMIT,
  upgradeItem,
} from '@/game';

const NOW = 1_700_000_000_000;
const WIN = { winner: 'ally' as const, stars: 3 as const, turns: 10, alliesAlive: 5 };
const rich = () => {
  const s = createNewSave(NOW);
  s.currencies.gold = 10_000_000;
  s.materials.ore = 10_000;
  return s;
};

describe('Кузня', () => {
  it('создаёт предмет нужного слота, сета и редкости за золото и руду', () => {
    const s = rich();
    const it = craftItem(s, 'boots', 'swift', 'epic');
    expect(typeof it).toBe('object');
    if (typeof it === 'string') return;
    expect(it.slot).toBe('boots');
    expect(it.set).toBe('swift');
    expect(it.rarity).toBe('epic');
    expect(it.subs.length).toBe(2);
    expect(s.currencies.gold).toBe(10_000_000 - CRAFT_COST.epic.gold);
    expect(s.materials.ore).toBe(10_000 - CRAFT_COST.epic.ore);
  });
  it('без ресурсов — ошибка, ничего не тратится', () => {
    const s = createNewSave(NOW);
    s.currencies.gold = 100_000;
    s.materials.ore = 0;
    expect(craftItem(s, 'weapon', 'fury', 'common')).toBe('noOre');
    s.currencies.gold = 0;
    s.materials.ore = 999;
    expect(craftItem(s, 'weapon', 'fury', 'common')).toBe('noGold');
    expect(s.items.length).toBe(0);
  });
  it('разбор возвращает руду, улучшенный предмет даёт больше', () => {
    const s = rich();
    const a = craftItem(s, 'weapon', 'fury', 'rare') as Exclude<ReturnType<typeof craftItem>, string>;
    const b = craftItem(s, 'weapon', 'fury', 'rare') as Exclude<ReturnType<typeof craftItem>, string>;
    for (let i = 0; i < 6; i++) upgradeItem(s, b.uid);
    expect(salvageValue(b)).toBeGreaterThan(salvageValue(a));
    const ore0 = s.materials.ore;
    const got = salvageItem(s, a.uid) as number;
    expect(s.materials.ore).toBe(ore0 + got);
    expect(s.items.some((i) => i.uid === a.uid)).toBe(false);
  });
  it('полная сумка не принимает новые предметы', () => {
    const s = rich();
    for (let i = 0; i < INVENTORY_LIMIT; i++) craftItem(s, 'helmet', 'life', 'common');
    expect(craftItem(s, 'helmet', 'life', 'common')).toBe('full');
    expect(rollGearDrop(s, { common: 1, rare: 0, epic: 0, legendary: 0 }, 1)).toBeNull();
  });
});

describe('трофеи', () => {
  it('босс главы всегда даёт предмет, плюс руда', () => {
    const s = createNewSave(NOW);
    const ore0 = s.materials.ore;
    const r = applyStageResult(s, '1-10', WIN);
    expect(r.items.length).toBe(1);
    expect(r.ore).toBeGreaterThan(0);
    expect(s.materials.ore).toBe(ore0 + r.ore);
  });
  it('каждый 5-й этаж башни даёт предмет', () => {
    const s = createNewSave(NOW);
    s.tower.floor = 4;
    expect(applyTowerResult(s, 5, WIN, NOW)?.item).toBeTruthy();
    expect(applyTowerResult(s, 6, WIN, NOW)?.item).toBeUndefined();
  });
  it('выпадение детерминировано состоянием в сейве', () => {
    const a = createNewSave(NOW);
    const b = structuredClone(a);
    const x = rollGearDrop(a, { common: 1, rare: 1, epic: 1, legendary: 1 }, 1)!;
    const y = rollGearDrop(b, { common: 1, rare: 1, epic: 1, legendary: 1 }, 1)!;
    expect({ ...x, uid: '' }).toEqual({ ...y, uid: '' });
  });
  it('миграция до v7 добавляет руду', () => {
    const s = normalizeSave(migrate({ version: 6, materials: { xpTome: 1 } }), NOW);
    expect(s.version).toBe(16);
    expect(s.materials.ore).toBe(20);
  });
});

import { compareHeroes, addHero, equip, generateItem } from '@/game';
import { Rng } from '@/core';

describe('сравнение героев', () => {
  it('показывает разницу характеристик и учитывает снаряжение', () => {
    const s = rich();
    const a = s.heroes[0]!;
    const b = addHero(s, 'ardan', NOW);
    const c1 = compareHeroes(s, a, b);
    expect(c1.rows.length).toBe(8);
    const hp = c1.rows.find((r) => r.key === 'hp')!;
    expect(hp.diff).toBe(hp.b - hp.a);
    expect(c1.powerB).toBeGreaterThan(c1.powerA);
    const it = generateItem(s, new Rng(1), { slot: 'weapon', set: 'fury', rarity: 'legendary' });
    s.items.push(it);
    equip(s, it.uid, a.uid);
    const c2 = compareHeroes(s, a, b);
    expect(c2.rows.find((r) => r.key === 'atk')!.a).toBeGreaterThan(c1.rows.find((r) => r.key === 'atk')!.a);
  });
  it('одинаковые герои — разницы нет', () => {
    const s = rich();
    const c = compareHeroes(s, s.heroes[0]!, s.heroes[0]!);
    expect(c.rows.every((r) => r.better === 'equal')).toBe(true);
  });
});
