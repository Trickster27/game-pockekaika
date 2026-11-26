import { describe, expect, it } from 'vitest';
import {
  claimTraining,
  isTraining,
  planTraining,
  rushCost,
  rushTraining,
  setTeam,
  starUp,
  startTraining,
  teamHeroes,
  trainedXp,
  trainingRate,
  trainingSlots,
  xpToCap,
} from '@/game';
import { createNewSave } from '@/save/schema';
import { migrate } from '@/save/migrations';

const NOW = 1_800_000_000_000;
const H = 3_600_000;
function save() {
  const s = createNewSave(NOW);
  s.currencies.gold = 1_000_000;
  s.currencies.shards = 1_000;
  return s;
}

describe('тренировочный зал', () => {
  it('места открываются с уровнем лагеря', () => {
    const s = save();
    expect(trainingSlots(s)).toBe(1);
    s.camp.level = 3;
    expect(trainingSlots(s)).toBe(2);
    s.camp.level = 10;
    expect(trainingSlots(s)).toBe(5);
  });

  it('скорость и цена: опыт 400+80×ур, лагерь ускоряет бесплатно', () => {
    expect(trainingRate(10, 1)).toEqual({ base: 1800, total: 1800 });
    expect(trainingRate(10, 10).total).toBe(Math.round(1800 * 1.45));
    const s = save();
    const h = s.heroes[0]!;
    h.stars = 4;
    h.level = 10;
    const p = planTraining(s, h, 4);
    expect(p.xp).toBe(7200);
    expect(p.gold).toBe(Math.ceil(7200 * 0.35));
    expect(p.capped).toBe(false);
    s.camp.level = 10;
    const p10 = planTraining(s, h, 4);
    expect(p10.xp).toBeGreaterThan(p.xp);
    expect(p10.gold).toBe(p.gold);
  });

  it('у потолка уровня тренировка короче и дешевле, на потолке — нельзя', () => {
    const s = save();
    const h = s.heroes[0]!;
    h.stars = 1;
    h.level = 9;
    const p = planTraining(s, h, 12);
    expect(p.capped).toBe(true);
    expect(p.xp).toBe(xpToCap(h));
    expect(p.toLevel).toBe(10);
    expect(p.realMs).toBeLessThan(12 * H);
    h.level = 10;
    h.xp = 0;
    expect(startTraining(s, h.uid, 1, NOW)).toBe('atCap');
  });

  it('герой уходит из команды и не участвует в боях; в команду его не поставить', () => {
    const s = save();
    const h = s.heroes[0]!;
    h.stars = 4;
    expect(s.team).toContain(h.uid);
    const gold = s.currencies.gold;
    const slot = startTraining(s, h.uid, 4, NOW);
    expect(typeof slot).toBe('object');
    expect(s.currencies.gold).toBeLessThan(gold);
    expect(isTraining(s, h.uid)).toBe(true);
    expect(s.team).not.toContain(h.uid);
    setTeam(s, [...s.team, h.uid]);
    expect(s.team).not.toContain(h.uid);
    s.team.push(h.uid); // даже если попал в команду в обход — в бой не идёт
    expect(teamHeroes(s).some((x) => x.uid === h.uid)).toBe(false);
    expect(startTraining(s, h.uid, 1, NOW)).toBe('busy');
    expect(startTraining(s, s.heroes[1]!.uid, 1, NOW)).toBe('noSlot');
  });

  it('тренирующегося нельзя пустить на повышение звёзд другого героя', () => {
    const s = save();
    const a = s.heroes[0]!,
      b = s.heroes[1]!;
    a.stars = 1;
    a.level = 10;
    b.stars = 2;
    b.level = 1;
    startTraining(s, b.uid, 1, NOW);
    expect(starUp(s, a.uid, [b.uid])).toBe('badFodder');
  });

  it('опыт копится по времени; досрочный выход — опыт за прошедшее, золото не возвращается', () => {
    const s = save();
    const h = s.heroes[0]!;
    h.stars = 6;
    h.level = 20;
    startTraining(s, h.uid, 4, NOW);
    const slot = s.training.slots[0]!;
    expect(trainedXp(slot, NOW + H)).toBe(slot.xpPerHour);
    const gold = s.currencies.gold;
    const r = claimTraining(s, h.uid, NOW + H);
    expect(r).toMatchObject({ xp: slot.xpPerHour, early: true });
    expect(s.currencies.gold).toBe(gold);
    expect(s.training.slots).toHaveLength(0);
    expect(h.level * 1e6 + h.xp).toBeGreaterThan(20 * 1e6);
  });

  it('ускорение за осколки: 1 осколок за 4 минуты', () => {
    const s = save();
    const h = s.heroes[0]!;
    h.stars = 6;
    startTraining(s, h.uid, 1, NOW);
    const slot = s.training.slots[0]!;
    expect(rushCost(slot, NOW)).toBe(15);
    const shards = s.currencies.shards;
    expect(rushTraining(s, h.uid, NOW)).toBe(true);
    expect(s.currencies.shards).toBe(shards - 15);
    const full = trainedXp({ ...slot, startAt: 0, endAt: H }, H);
    const got = claimTraining(s, h.uid, NOW)!;
    expect(got.early).toBe(false);
    expect(got.xp).toBe(full);
  });

  it('v13: пустой зал', () => {
    expect(migrate({ version: 12 }).training).toEqual({ slots: [] });
  });
});
