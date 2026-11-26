import { describe, expect, it } from 'vitest';
import {
  CAMP_LEVELS,
  baseIdleRates,
  canUpgradeCamp,
  campLevel,
  energyRegenMs,
  idleRates,
  nextEnergyIn,
  pendingIdle,
  regenEnergy,
  spendEnergy,
  upgradeCamp,
  energyPerDay,
} from '@/game';
import { createNewSave } from '@/save/schema';
import { migrate } from '@/save/migrations';

const NOW = 1_800_000_000_000;

describe('уровни лагеря', () => {
  it('10 уровней, всё растёт монотонно', () => {
    expect(CAMP_LEVELS).toHaveLength(10);
    for (let i = 1; i < CAMP_LEVELS.length; i++) {
      const a = CAMP_LEVELS[i - 1]!,
        b = CAMP_LEVELS[i]!;
      expect(b.req.playerLevel).toBeGreaterThan(a.req.playerLevel);
      expect(b.req.gold).toBeGreaterThan(a.req.gold);
      expect(b.req.shards).toBeGreaterThanOrEqual(a.req.shards);
      expect(b.goldMult).toBeGreaterThan(a.goldMult);
      expect(b.xpMult).toBeGreaterThan(a.xpMult);
      expect(b.regenSec).toBeLessThan(a.regenSec);
      // Каждое улучшение даёт заметную, но не огромную прибавку.
      expect(b.goldMult / a.goldMult).toBeGreaterThan(1.05);
      expect(b.goldMult / a.goldMult).toBeLessThan(1.15);
    }
    expect(energyPerDay(CAMP_LEVELS[0]!.regenSec)).toBe(360);
    expect(energyPerDay(CAMP_LEVELS[9]!.regenSec)).toBe(576);
  });

  it('улучшение: требования, оплата, ошибки', () => {
    const s = createNewSave(NOW);
    expect(campLevel(s).level).toBe(1);
    expect(canUpgradeCamp(s)).toBe('level');
    s.player.level = 3;
    s.currencies.gold = 4_000;
    expect(canUpgradeCamp(s)).toBe('gold');
    s.currencies.gold = 20_000;
    const r = upgradeCamp(s, NOW);
    expect(typeof r).toBe('object');
    expect(campLevel(s).level).toBe(2);
    expect(s.currencies.gold).toBe(15_000);
    s.player.level = 6;
    s.currencies.shards = 10;
    expect(canUpgradeCamp(s)).toBe('shards');
    s.player.level = 99;
    s.currencies.gold = 10_000_000;
    s.currencies.shards = 10_000;
    while (canUpgradeCamp(s) === true) upgradeCamp(s, NOW);
    expect(campLevel(s).level).toBe(10);
    expect(canUpgradeCamp(s)).toBe('max');
  });

  it('добыча лагеря растёт с уровнем: золото, опыт и томы', () => {
    const s = createNewSave(NOW);
    const b = baseIdleRates(s);
    s.camp.level = 10;
    const r = idleRates(s);
    expect(r.gold).toBeCloseTo(b.gold * 2.3);
    expect(r.heroXp).toBeCloseTo(b.heroXp * 2);
    expect(r.xpTome).toBeCloseTo(b.xpTome * 2);
    expect(r.starDust).toBeCloseTo(b.starDust);
    s.idle.lastClaimAt = NOW - 3_600_000;
    expect(pendingIdle(s, NOW).gold).toBe(Math.floor(b.gold * 2.3));
  });

  it('энергия восстанавливается быстрее, накопленное при улучшении не теряется', () => {
    const s = createNewSave(NOW);
    s.currencies.energy = 0;
    s.currencies.energyUpdatedAt = NOW;
    // Лагерь 1: за 20 минут — 5 энергии.
    const c1 = { ...s.currencies };
    regenEnergy(c1, NOW + 20 * 60_000, energyRegenMs(s));
    expect(c1.energy).toBe(5);
    // Лагерь 10: за 20 минут — 8 энергии.
    s.camp.level = 10;
    const c10 = { ...s.currencies };
    regenEnergy(c10, NOW + 20 * 60_000, energyRegenMs(s));
    expect(c10.energy).toBe(8);
    expect(nextEnergyIn(c10, NOW + 20 * 60_000, energyRegenMs(s))).toBeLessThanOrEqual(150_000);
    // Улучшение досчитывает энергию по старой скорости.
    const u = createNewSave(NOW);
    u.currencies.energy = 0;
    u.currencies.energyUpdatedAt = NOW;
    u.player.level = 3;
    u.currencies.gold = 10_000;
    upgradeCamp(u, NOW + 12 * 60_000);
    expect(u.currencies.energy).toBe(3);
    expect(spendEnergy(u.currencies, 3, NOW + 12 * 60_000, energyRegenMs(u))).toBe(true);
  });

  it('v12: лагерь 1 уровня', () => {
    expect(migrate({ version: 11 }).camp).toEqual({ level: 1 });
  });
});
