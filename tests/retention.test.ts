import { describe, expect, it } from 'vitest';
import {
  SEASON_DAYS,
  TRIAL_ATTEMPTS,
  arenaSeason,
  beginTrial,
  claimAllMail,
  claimMail,
  comebackGift,
  finishTrial,
  rollSeason,
  sendMail,
  systemMail,
  trialAttemptsLeft,
  trialToday,
  trialUnlocked,
  trialWaves,
  unreadMail,
} from '@/game';
import { createNewSave } from '@/save/schema';
import { CHAPTERS, enemyDef } from '@/content';

const DAY = 86_400_000;
// 2027-01-04 — понедельник (UTC)
const MON = Date.UTC(2027, 0, 4, 12);

describe('почта', () => {
  it('системное письмо один раз; подарок забирается один раз', () => {
    const s = createNewSave(MON);
    systemMail(s, MON, MON);
    systemMail(s, MON, MON);
    expect(s.mail.items).toHaveLength(1);
    expect(unreadMail(s)).toBe(1);
    const shards = s.currencies.shards;
    expect(claimMail(s, s.mail.items[0]!.id, MON)).toBeTruthy();
    expect(claimMail(s, s.mail.items[0]!.id, MON)).toBeNull();
    expect(s.currencies.shards).toBe(shards + 200);
    expect(unreadMail(s)).toBe(0);
  });

  it('подарок за возвращение после 3+ дней, растёт до 14 дней', () => {
    const s = createNewSave(MON);
    systemMail(s, MON - 2 * DAY, MON);
    expect(s.mail.items.some((m) => m.title === 'mail.comeback.title')).toBe(false);
    systemMail(s, MON - 5 * DAY, MON);
    expect(s.mail.items.find((m) => m.title === 'mail.comeback.title')?.params?.n).toBe(5);
    expect(comebackGift(30).gold).toBe(comebackGift(14).gold);
    expect(comebackGift(5).gold).toBeLessThan(comebackGift(14).gold!);
  });

  it('ящик не растёт бесконечно, «забрать всё»', () => {
    const s = createNewSave(MON);
    for (let i = 0; i < 80; i++) sendMail(s, { title: 'x', body: 'y', reward: { gold: 1 } }, MON);
    expect(s.mail.items.length).toBeLessThanOrEqual(60);
    expect(claimAllMail(s, MON).length).toBeGreaterThan(0);
    expect(s.mail.items.every((m) => m.claimed)).toBe(true);
  });
});

describe('испытание дня', () => {
  it('по дням недели своё испытание, в воскресенье — все', () => {
    expect(trialToday(MON)).toEqual(['tomes']);
    expect(trialToday(MON + DAY)).toEqual(['dust']);
    expect(trialToday(MON + 6 * DAY)).toHaveLength(6);
  });

  it('3 победы в день, поражение не тратит попытку, уровни по порядку', () => {
    const s = createNewSave(MON);
    expect(beginTrial(s, 'dust', 1, MON)).toBe('closed');
    expect(trialUnlocked(s, 'tomes', 2)).toBe(false);
    expect(typeof beginTrial(s, 'tomes', 1, MON)).toBe('object');
    expect(finishTrial(s, 'tomes', 1, false, MON)).toBeNull();
    expect(trialAttemptsLeft(s, MON)).toBe(TRIAL_ATTEMPTS);
    const tomes = s.materials.xpTome;
    for (let i = 0; i < 3; i++) finishTrial(s, 'tomes', 1 + i, true, MON);
    expect(s.materials.xpTome).toBeGreaterThan(tomes);
    expect(trialUnlocked(s, 'tomes', 4)).toBe(true);
    expect(beginTrial(s, 'tomes', 4, MON)).toBe('noAttempts');
    expect(trialAttemptsLeft(s, MON + DAY)).toBe(TRIAL_ATTEMPTS);
  });

  it('враги испытаний существуют', () => {
    for (const k of ['tomes', 'dust', 'ore', 'books', 'stones', 'gold'] as const)
      for (const w of trialWaves(k, 10)) for (const e of w) expect(enemyDef(e.id)).toBeTruthy();
    expect(CHAPTERS.length).toBeGreaterThan(0);
  });
});

describe('сезоны арены', () => {
  it('в конце сезона — письмо с наградой по лучшей лиге и мягкий сброс', () => {
    const s = createNewSave(MON);
    rollSeason(s, MON);
    s.arena.rating = 1800;
    s.arena.seasonBest = 1850;
    s.arena.wins = 10;
    const next = (arenaSeason(MON) + 1) * SEASON_DAYS * DAY + 1000;
    rollSeason(s, next);
    const mail = s.mail.items.find((m) => m.title === 'mail.season.title');
    expect(mail?.params?.league).toBe('platinum');
    expect(s.arena.rating).toBe(1400);
    rollSeason(s, next + DAY);
    expect(s.mail.items.filter((m) => m.title === 'mail.season.title')).toHaveLength(1);
  });
});
