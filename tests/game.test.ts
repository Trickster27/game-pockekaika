import { describe, expect, it } from 'vitest';
import { createNewSave, MIGRATIONS, migrate, normalizeSave } from '@/save';
import {
  addHeroXp,
  heroXpToNext,
  regenEnergy,
  spendEnergy,
  nextEnergyIn,
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  applyStageResult,
  isStageUnlocked,
  currentStage,
  teamHeroes,
} from '@/game';

const NOW = 1_700_000_000_000;

describe('сейв v2', () => {
  it('новый сейв содержит стартовую команду из 5 героев', () => {
    const s = createNewSave(NOW);
    expect(s.heroes.length).toBe(5);
    expect(teamHeroes(s).length).toBe(5);
  });
  it('миграция v1 → v2 выдаёт стартовых героев', () => {
    const v1 = { version: 1, player: { name: 'Старый' }, currencies: { gold: 50 } };
    const s = normalizeSave(migrate(v1), NOW);
    expect(s.version).toBe(3);
    expect(s.player.name).toBe('Старый');
    expect(s.heroes.length).toBe(5);
    expect(s.team.length).toBe(5);
    expect(MIGRATIONS[2]).toBeTypeOf('function');
  });
  it('команда очищается от несуществующих героев', () => {
    const raw = { ...createNewSave(NOW), team: ['h1', 'nope', 'h1', 'h2'] };
    expect(normalizeSave(raw as never, NOW).team).toEqual(['h1', 'h2']);
  });
});

describe('опыт героя', () => {
  it('повышает уровень и упирается в потолок звёзд', () => {
    const h = { uid: 'x', heroId: 'rikht', level: 1, xp: 0, stars: 1, awakened: false, obtainedAt: 0 };
    const up = addHeroXp(h, heroXpToNext(1) + heroXpToNext(2));
    expect(up).toEqual({ uid: 'x', from: 1, to: 3 });
    addHeroXp(h, 10_000_000);
    expect(h.level).toBe(10);
    h.stars = 2;
    addHeroXp(h, 1);
    expect(h.level).toBeGreaterThan(10);
  });
});

describe('энергия', () => {
  it('восстанавливается по таймеру до максимума', () => {
    const c = { gold: 0, shards: 0, energy: 10, energyUpdatedAt: NOW };
    regenEnergy(c, NOW + ENERGY_REGEN_MS * 3 + 1000);
    expect(c.energy).toBe(13);
    expect(nextEnergyIn(c, NOW + ENERGY_REGEN_MS * 3 + 1000)).toBe(ENERGY_REGEN_MS - 1000);
    regenEnergy(c, NOW + ENERGY_REGEN_MS * 10_000);
    expect(c.energy).toBe(ENERGY_MAX);
  });
  it('тратится, только если хватает', () => {
    const c = { gold: 0, shards: 0, energy: 5, energyUpdatedAt: NOW };
    expect(spendEnergy(c, 6, NOW)).toBe(false);
    expect(spendEnergy(c, 5, NOW)).toBe(true);
    expect(c.energy).toBe(0);
  });
  it('энергия сверх максимума не сгорает', () => {
    const c = { gold: 0, shards: 0, energy: 150, energyUpdatedAt: NOW };
    regenEnergy(c, NOW + ENERGY_REGEN_MS * 10);
    expect(c.energy).toBe(150);
  });
});

describe('кампания', () => {
  it('этапы открываются по порядку', () => {
    const s = createNewSave(NOW);
    expect(isStageUnlocked(s, '1-1')).toBe(true);
    expect(isStageUnlocked(s, '1-2')).toBe(false);
    applyStageResult(s, '1-1', { winner: 'ally', stars: 2, turns: 10, alliesAlive: 4 });
    expect(isStageUnlocked(s, '1-2')).toBe(true);
    expect(currentStage(s).id).toBe('1-2');
  });
  it('первое прохождение даёт бонус, звёзды не уменьшаются', () => {
    const s = createNewSave(NOW);
    const g0 = s.currencies.gold;
    const r1 = applyStageResult(s, '1-1', { winner: 'ally', stars: 3, turns: 10, alliesAlive: 5 });
    expect(r1.firstClear).toBe(true);
    expect(r1.shards).toBeGreaterThan(0);
    const r2 = applyStageResult(s, '1-1', { winner: 'ally', stars: 1, turns: 10, alliesAlive: 3 });
    expect(r2.firstClear).toBe(false);
    expect(s.campaign.stars['1-1']).toBe(3);
    expect(s.currencies.gold).toBe(g0 + r1.gold + r2.gold);
  });
  it('поражение даёт треть опыта и не открывает этап', () => {
    const s = createNewSave(NOW);
    const r = applyStageResult(s, '1-1', { winner: 'enemy', stars: 0, turns: 30, alliesAlive: 0 });
    expect(r.gold).toBe(0);
    expect(r.heroXp).toBeGreaterThan(0);
    expect(isStageUnlocked(s, '1-2')).toBe(false);
  });
});

import { addHero, spendXpTomes, starUp, starUpCost, awaken, setTeam, AWAKEN_COST } from '@/game';
import { maxLevel } from '@/core';

describe('прокачка героев', () => {
  const fresh = () => {
    const s = createNewSave(NOW);
    s.currencies.gold = 10_000_000;
    return s;
  };

  it('миграция до v3 добавляет материалы и составы', () => {
    const s = normalizeSave(migrate({ version: 2, heroes: [], team: [] }), NOW);
    expect(s.version).toBe(3);
    expect(s.materials.xpTome).toBe(5);
    expect(s.presets.length).toBe(3);
  });

  it('новый герой приходит со звёздами по редкости и встаёт в неполную команду', () => {
    const s = fresh();
    s.team = ['h1'];
    const h = addHero(s, 'ardan', NOW);
    expect(h.stars).toBe(4);
    expect(s.team).toContain(h.uid);
  });

  it('тома опыта повышают уровень до потолка', () => {
    const s = fresh();
    s.materials.xpTome = 100;
    const r = spendXpTomes(s, 'h1', 100);
    expect(typeof r).toBe('object');
    expect(s.heroes[0]!.level).toBe(maxLevel(1));
    expect(s.materials.xpTome).toBeGreaterThan(0);
    expect(spendXpTomes(s, 'h1', 1)).toBe('maxLevel');
  });

  it('звёзды: нужен максимальный уровень и цена', () => {
    const s = fresh();
    expect(starUp(s, 'h1')).toBe('notMaxLevel');
    s.heroes[0]!.level = 10;
    expect(starUp(s, 'h1')).toBe('noDust');
    s.materials.starDust = starUpCost(1).dust;
    expect(starUp(s, 'h1')).toEqual({ stars: 2 });
    expect(s.materials.starDust).toBe(0);
  });

  it('звёзды за героев-копий: корм удаляется из коллекции и команды', () => {
    const s = fresh();
    const target = s.heroes[0]!;
    target.level = 10;
    const fodder = addHero(s, 'rikht', NOW);
    setTeam(s, ['h1', fodder.uid]);
    expect(starUp(s, target.uid, [fodder.uid])).toEqual({ stars: 2 });
    expect(s.heroes.some((h) => h.uid === fodder.uid)).toBe(false);
    expect(s.team).toEqual(['h1']);
  });

  it('нельзя скормить героя с меньшими звёздами', () => {
    const s = fresh();
    const t = addHero(s, 'ardan', NOW);
    t.level = maxLevel(4);
    const weak = ['h1', 'h2', 'h3', 'h4'];
    expect(starUp(s, t.uid, weak)).toBe('badFodder');
  });

  it('пробуждение только на 6 звёздах и 60 уровне', () => {
    const s = fresh();
    const h = s.heroes[0]!;
    expect(awaken(s, h.uid)).toBe('notSixStar');
    h.stars = 6;
    h.level = 60;
    expect(awaken(s, h.uid)).toBe('noStones');
    s.materials.awakenStone = AWAKEN_COST.stones;
    expect(awaken(s, h.uid)).toBe(true);
    expect(h.awakened).toBe(true);
  });
});
