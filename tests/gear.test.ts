import { describe, expect, it } from 'vitest';
import { createNewSave } from '@/save';
import { Rng, simulate } from '@/core';
import { db } from '@/content';
import {
  generateItem,
  upgradeItem,
  upgradeCost,
  equip,
  heroItems,
  gearBonus,
  mainValue,
  sellItem,
  applyDungeonResult,
  isDungeonLevelUnlocked,
  heroSpec,
  heroStats,
  MAX_ITEM_LEVEL,
} from '@/game';
import { dungeonWaves, dungeonDef } from '@/content';

const NOW = 1_700_000_000_000;
const rich = () => {
  const s = createNewSave(NOW);
  s.currencies.gold = 10_000_000;
  return s;
};

describe('снаряжение', () => {
  it('число доп. характеристик зависит от редкости', () => {
    const s = rich();
    const rng = new Rng(1);
    expect(generateItem(s, rng, { set: 'fury', rarity: 'common' }).subs.length).toBe(0);
    expect(generateItem(s, rng, { set: 'fury', rarity: 'legendary' }).subs.length).toBe(3);
  });

  it('основная характеристика соответствует слоту и растёт с улучшением', () => {
    const s = rich();
    const it = generateItem(s, new Rng(2), { slot: 'weapon', set: 'fury', rarity: 'epic' });
    expect(it.main).toBe('atk');
    s.items.push(it);
    const v0 = mainValue(it);
    upgradeItem(s, it.uid);
    expect(mainValue(it)).toBeGreaterThan(v0);
  });

  it('улучшение до +15, на +3/+6/+9/+12 растут доп. характеристики', () => {
    const s = rich();
    const it = generateItem(s, new Rng(3), { slot: 'gloves', set: 'life', rarity: 'common' });
    s.items.push(it);
    for (let i = 0; i < MAX_ITEM_LEVEL; i++) expect(typeof upgradeItem(s, it.uid)).toBe('object');
    expect(it.level).toBe(15);
    expect(it.subs.length).toBe(4);
    expect(upgradeItem(s, it.uid)).toBe('maxLevel');
    const leg = generateItem(s, new Rng(4), { slot: 'boots', set: 'swift', rarity: 'legendary' });
    s.items.push(leg);
    for (let i = 0; i < 15; i++) upgradeItem(s, leg.uid);
    expect(leg.subs.reduce((a, x) => a + x.rolls, 0)).toBe(3 + 4);
  });

  it('улучшение стоит золота', () => {
    const s = createNewSave(NOW);
    s.currencies.gold = 0;
    const it = generateItem(s, new Rng(5), { set: 'fury', rarity: 'rare' });
    s.items.push(it);
    expect(upgradeItem(s, it.uid)).toBe('noGold');
    s.currencies.gold = upgradeCost(it);
    expect(typeof upgradeItem(s, it.uid)).toBe('object');
    expect(s.currencies.gold).toBe(0);
  });

  it('в слоте героя может быть только один предмет', () => {
    const s = rich();
    const a = generateItem(s, new Rng(6), { slot: 'weapon', set: 'fury', rarity: 'rare' });
    const b = generateItem(s, new Rng(7), { slot: 'weapon', set: 'fury', rarity: 'rare' });
    s.items.push(a, b);
    equip(s, a.uid, 'h1');
    equip(s, b.uid, 'h1');
    expect(heroItems(s, 'h1').map((i) => i.uid)).toEqual([b.uid]);
  });

  it('бонусы сетов за 2 и 4 предмета', () => {
    const s = rich();
    const slots = ['weapon', 'helmet', 'armor', 'gloves'] as const;
    const items = slots.map((slot, i) =>
      generateItem(s, new Rng(10 + i), { slot, set: 'fury', rarity: 'common' }),
    );
    const two = gearBonus(items.slice(0, 2));
    const four = gearBonus(items);
    expect(two.pct.atk).toBeGreaterThanOrEqual(0.15);
    expect(four.flat.critDmg).toBeGreaterThanOrEqual(0.3);
  });

  it('снаряжение усиливает героя в бою и в характеристиках', () => {
    const s = rich();
    const it = generateItem(s, new Rng(20), { slot: 'weapon', set: 'fury', rarity: 'legendary' });
    s.items.push(it);
    const before = heroStats(s.heroes[0]!, s).atk;
    equip(s, it.uid, 'h1');
    expect(heroStats(s.heroes[0]!, s).atk).toBeGreaterThan(before);
    expect(heroSpec(s.heroes[0]!, s).bonus?.atk).toBeGreaterThan(0);
  });

  it('продажа даёт золото и снимает предмет', () => {
    const s = rich();
    const it = generateItem(s, new Rng(30), { set: 'fury', rarity: 'rare' });
    s.items.push(it);
    equip(s, it.uid, 'h1');
    const g = s.currencies.gold;
    const price = sellItem(s, it.uid) as number;
    expect(s.currencies.gold).toBe(g + price);
    expect(heroItems(s, 'h1').length).toBe(0);
  });
});

describe('подземелья', () => {
  it('уровни открываются по очереди', () => {
    const s = rich();
    expect(isDungeonLevelUnlocked(s, 'crypt', 1)).toBe(true);
    expect(isDungeonLevelUnlocked(s, 'crypt', 2)).toBe(false);
    applyDungeonResult(s, 'crypt', 1, { winner: 'ally', stars: 3, turns: 10, alliesAlive: 5 });
    expect(isDungeonLevelUnlocked(s, 'crypt', 2)).toBe(true);
  });

  it('склеп даёт снаряжение, пещера — материалы', () => {
    const s = rich();
    const a = applyDungeonResult(s, 'crypt', 5, { winner: 'ally', stars: 3, turns: 10, alliesAlive: 5 });
    expect(a.items.length).toBeGreaterThan(0);
    const b = applyDungeonResult(s, 'starcave', 5, { winner: 'ally', stars: 3, turns: 10, alliesAlive: 5 });
    expect(b.materials.starDust).toBeGreaterThan(0);
  });

  it('поражение ничего не даёт', () => {
    const s = rich();
    const r = applyDungeonResult(s, 'crypt', 1, { winner: 'enemy', stars: 0, turns: 10, alliesAlive: 0 });
    expect(r.items.length).toBe(0);
    expect(s.dungeons.crypt).toBeUndefined();
  });

  it('уровень 1 проходится прокачанной стартовой командой', () => {
    const allies = ['rikht', 'ivy', 'grav', 'chirk', 'dorn'].map((id) => ({
      defId: id,
      kind: 'hero' as const,
      level: 12,
      stars: 2,
    }));
    const waves = dungeonWaves(dungeonDef('crypt'), 1).map((w) =>
      w.map((e) => ({ defId: e.id, kind: 'enemy' as const, level: e.level, boss: e.boss })),
    );
    let wins = 0;
    for (let seed = 1; seed <= 10; seed++)
      if (simulate({ allies, waves, seed }, db).result.winner === 'ally') wins++;
    expect(wins).toBeGreaterThanOrEqual(7);
  });
});
