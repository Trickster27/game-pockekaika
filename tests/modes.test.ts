import { describe, expect, it } from 'vitest';
import { createNewSave } from '@/save';
import {
  towerWaves,
  towerReward,
  applyTowerResult,
  arenaOpponents,
  ratingDelta,
  leagueOf,
  leagueTier,
  startArenaBattle,
  applyArenaResult,
  battlesLeft,
  ARENA_DAILY_BATTLES,
  claimLeague,
  canClaimLeague,
  trackQuest,
  claimQuest,
  claimChest,
  questPoints,
  questsReady,
  claimLogin,
  canClaimLogin,
  nextLoginDay,
  loginReward,
} from '@/game';
import { simulate } from '@/core';
import { db } from '@/content';

const NOW = Date.UTC(2026, 10, 25, 12);
const DAY = 86_400_000;
const WIN = { winner: 'ally' as const, stars: 3 as const, turns: 10, alliesAlive: 5 };
const LOSE = { winner: 'enemy' as const, stars: 0 as const, turns: 10, alliesAlive: 0 };

describe('башня', () => {
  it('этаж детерминирован, каждый 5-й — с боссом', () => {
    expect(towerWaves(7)).toEqual(towerWaves(7));
    expect(
      towerWaves(5)
        .at(-1)!
        .some((e) => e.boss),
    ).toBe(true);
    expect(
      towerWaves(6)
        .flat()
        .some((e) => e.boss),
    ).toBe(false);
    expect(towerWaves(40)[0]![0]!.level).toBeGreaterThan(towerWaves(4)[0]![0]!.level);
  });
  it('крупная награда каждые 10 этажей', () => {
    expect(towerReward(9).shards).toBeUndefined();
    expect(towerReward(10).shards).toBeGreaterThan(0);
    expect(towerReward(20).materials?.awakenStone).toBeGreaterThan(0);
  });
  it('награда только за следующий этаж', () => {
    const s = createNewSave(NOW);
    expect(applyTowerResult(s, 2, WIN, NOW)).toBeNull();
    expect(applyTowerResult(s, 1, WIN, NOW)).not.toBeNull();
    expect(s.tower.floor).toBe(1);
    expect(applyTowerResult(s, 2, LOSE, NOW)).toBeNull();
    expect(s.tower.floor).toBe(1);
  });
});

describe('арена', () => {
  it('три соперника вокруг силы игрока, стабильные до обновления', () => {
    const s = createNewSave(NOW);
    const a = arenaOpponents(s);
    expect(a.length).toBe(3);
    expect(a[0]!.power).toBeLessThan(a[2]!.power);
    expect(arenaOpponents(s).map((o) => o.name)).toEqual(a.map((o) => o.name));
    for (const o of a) expect(o.team.length).toBe(5);
  });
  it('с соперником можно провести бой', () => {
    const s = createNewSave(NOW);
    const o = arenaOpponents(s)[0]!;
    const r = simulate(
      {
        allies: s.heroes.map((h) => ({ defId: h.heroId, kind: 'hero' as const, level: h.level })),
        waves: [o.team],
        seed: 1,
      },
      db,
    );
    expect(['ally', 'enemy', 'draw']).toContain(r.result.winner);
  });
  it('рейтинг по Эло', () => {
    expect(ratingDelta(1000, 1000, true)).toBe(16);
    expect(ratingDelta(1000, 1000, false)).toBe(-16);
    expect(ratingDelta(1000, 1400, true)).toBeGreaterThan(ratingDelta(1000, 1000, true));
    expect(ratingDelta(1400, 1000, true)).toBe(5);
  });
  it('лиги и подуровни', () => {
    expect(leagueOf(1000).id).toBe('bronze');
    expect(leagueOf(1450).id).toBe('gold');
    expect(leagueOf(2500).id).toBe('legend');
    expect(leagueTier(0)).toBe('III');
    expect(leagueTier(1090)).toBe('I');
  });
  it('5 боёв в день, лимит сбрасывается', () => {
    const s = createNewSave(NOW);
    for (let i = 0; i < ARENA_DAILY_BATTLES; i++) expect(startArenaBattle(s, NOW)).toBe(true);
    expect(startArenaBattle(s, NOW)).toBe('noTickets');
    expect(battlesLeft(s, NOW + DAY)).toBe(ARENA_DAILY_BATTLES);
    expect(startArenaBattle(s, NOW + DAY)).toBe(true);
  });
  it('победа поднимает рейтинг и меняет соперников', () => {
    const s = createNewSave(NOW);
    const o = arenaOpponents(s)[1]!;
    const r = applyArenaResult(s, o, WIN);
    expect(r.delta).toBeGreaterThan(0);
    expect(s.arena.rating).toBe(1000 + r.delta);
    expect(arenaOpponents(s)[1]!.id).not.toBe(o.id);
  });
  it('награда лиги раз в день', () => {
    const s = createNewSave(NOW);
    expect(claimLeague(s, NOW)).toBe(30);
    expect(canClaimLeague(s, NOW)).toBe(false);
    expect(claimLeague(s, NOW)).toBe(0);
    expect(canClaimLeague(s, NOW + DAY)).toBe(true);
  });
});

describe('задания', () => {
  it('прогресс, получение и сундуки по очкам', () => {
    const s = createNewSave(NOW);
    expect(claimQuest(s, 'campaign', NOW)).toBe(false);
    trackQuest(s, 'campaign', 2, NOW);
    expect(claimQuest(s, 'campaign', NOW)).toBe(false);
    trackQuest(s, 'campaign', 5, NOW);
    expect(s.quests.progress.campaign).toBe(3);
    expect(claimQuest(s, 'campaign', NOW)).toBe(true);
    expect(claimQuest(s, 'campaign', NOW)).toBe(false);
    trackQuest(s, 'login', 1, NOW);
    claimQuest(s, 'login', NOW);
    expect(questPoints(s, NOW)).toBe(30);
    expect(claimChest(s, 0, NOW)).not.toBeNull();
    expect(claimChest(s, 0, NOW)).toBeNull();
    expect(claimChest(s, 1, NOW)).toBeNull();
  });
  it('сбрасываются на следующий день', () => {
    const s = createNewSave(NOW);
    trackQuest(s, 'login', 1, NOW);
    expect(questsReady(s, NOW)).toBe(1);
    expect(questsReady(s, NOW + DAY)).toBe(0);
  });
});

describe('награды за вход', () => {
  it('раз в день, номер дня растёт', () => {
    const s = createNewSave(NOW);
    expect(canClaimLogin(s, NOW)).toBe(true);
    const r = claimLogin(s, NOW)!;
    expect(r.day).toBe(1);
    expect(claimLogin(s, NOW)).toBeNull();
    expect(claimLogin(s, NOW + DAY)!.day).toBe(2);
    expect(nextLoginDay(s)).toBe(3);
  });
  it('особые дни и главная награда на 28-й день', () => {
    expect(loginReward(7).materials?.scroll).toBe(2);
    expect(loginReward(28).shards).toBe(500);
  });
});
