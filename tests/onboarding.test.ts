import { describe, expect, it } from 'vitest';
import { createNewSave } from '@/save/schema';
import { migrate } from '@/save/migrations';
import { advanceTutorial, computeBadges, finishTutorial, restartTutorial, TUTORIAL_REWARD } from '@/game';

const NOW = 1_800_000_000_000;

describe('красные точки', () => {
  it('новый игрок: есть свитки и томы, команда полная', () => {
    const s = createNewSave(NOW);
    const b = computeBadges(s, NOW);
    expect(b.summon).toBe(true);
    expect(b.heroes).toBe(true);
    expect(b.team).toBe(false);
    expect(b.arena).toBe(true);
  });

  it('точки гаснут, когда делать нечего', () => {
    const s = createNewSave(NOW);
    s.materials.scroll = 0;
    s.materials.xpTome = 0;
    s.team = s.team.slice(0, 3);
    const b = computeBadges(s, NOW);
    expect(b.summon).toBe(false);
    expect(b.heroes).toBe(false);
    expect(b.team).toBe(true);
  });

  it('звёзды: на потолке уровня и хватает пыли и золота', () => {
    const s = createNewSave(NOW);
    s.materials.xpTome = 0;
    const h = s.heroes[0]!;
    h.level = 10;
    expect(computeBadges(s, NOW).heroes).toBe(false);
    s.materials.starDust = 100;
    s.currencies.gold = 100_000;
    expect(computeBadges(s, NOW).heroes).toBe(true);
  });

  it('пустой слот при свободном предмете', () => {
    const s = createNewSave(NOW);
    s.materials.xpTome = 0;
    s.items.push({
      uid: 'i1',
      slot: 'boots',
      set: 'swift',
      rarity: 'rare',
      level: 0,
      main: 'spd',
      subs: [],
      heroUid: null,
      locked: false,
    });
    expect(computeBadges(s, NOW).heroes).toBe(true);
  });
});

describe('обучение', () => {
  it('шаги только вперёд, награда один раз', () => {
    const s = createNewSave(NOW);
    expect(s.tutorial).toEqual({ step: 0, done: false });
    advanceTutorial(s, 3);
    advanceTutorial(s, 2);
    expect(s.tutorial.step).toBe(3);
    const shards = s.currencies.shards;
    finishTutorial(s, true, NOW);
    expect(s.currencies.shards).toBe(shards + TUTORIAL_REWARD.shards!);
    restartTutorial(s);
    expect(s.tutorial.done).toBe(false);
    finishTutorial(s, true, NOW);
    expect(s.currencies.shards).toBe(shards + TUTORIAL_REWARD.shards!);
  });

  it('пропуск без награды', () => {
    const s = createNewSave(NOW);
    const shards = s.currencies.shards;
    finishTutorial(s, false, NOW);
    expect(s.tutorial.done).toBe(true);
    expect(s.currencies.shards).toBe(shards);
  });

  it('v10: игравшим обучение не показывается', () => {
    expect(
      (migrate({ version: 9, stats: { battlesWon: 3, battlesLost: 0 } }).tutorial as { done: boolean }).done,
    ).toBe(true);
    expect(
      (migrate({ version: 9, stats: { battlesWon: 0, battlesLost: 0 } }).tutorial as { done: boolean }).done,
    ).toBe(false);
  });
});
