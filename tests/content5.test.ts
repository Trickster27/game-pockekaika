import { describe, expect, it } from 'vitest';
import { CHAPTERS, DUNGEONS, db, validateContent } from '@/content';
import { simulate } from '@/core/battle';
import {
  RAID,
  RAID_MILESTONES,
  activeParties,
  autoParty,
  beginRaid,
  buyRaidAttempt,
  busyUids,
  checkParty,
  claimExpedition,
  claimRaidMilestone,
  expeditionParties,
  expeditionsReady,
  finishRaid,
  makeSetup,
  raidAttemptsLeft,
  raidSetup,
  raidWeek,
  recallExpedition,
  refreshCost,
  refreshExpeditions,
  rollExpeditions,
  rushExpedition,
  setTeam,
  startExpedition,
  startTraining,
  teamHeroes,
} from '@/game';
import { createNewSave } from '@/save/schema';
import { migrate } from '@/save/migrations';
import { normalizeSave } from '@/save/validate';

const NOW = 1_800_000_000_000;
const H = 3_600_000;
function rich() {
  const s = createNewSave(NOW);
  s.currencies.gold = 1_000_000;
  s.currencies.shards = 10_000;
  // Много героев разных фракций, все 4★.
  const ids = ['solarion', 'thalassa', 'gorran', 'verdis', 'morok', 'ivy', 'grav', 'chirk', 'dorn', 'rikht'];
  s.heroes = ids.map((heroId, i) => ({
    uid: `x${i}`,
    heroId,
    level: 40,
    xp: 0,
    stars: 4,
    awakened: false,
    obtainedAt: NOW,
  }));
  s.team = s.heroes.slice(0, 5).map((h) => h.uid);
  s.camp.level = 8;
  return s;
}

describe('глава 5 и Небесный шпиль', () => {
  it('контент целостен, 5-я глава в небе, босс — Король Бурь', () => {
    expect(validateContent()).toEqual([]);
    const ch = CHAPTERS[4]!;
    expect(ch.scene).toBe('sky');
    expect(ch.stages[9]!.waves.at(-1)!.some((e) => e.id === 'storm_king' && e.boss)).toBe(true);
    expect(DUNGEONS.some((d) => d.id === 'skyspire')).toBe(true);
  });

  it('бой с Королём Бурь проходит до конца', () => {
    const team = ['solarion', 'thalassa', 'gorran', 'verdis', 'morok'].map((id) => ({
      defId: id,
      kind: 'hero' as const,
      level: 70,
      stars: 6,
    }));
    const { result } = simulate(makeSetup(team, CHAPTERS[4]!.stages[9]!.waves, 7), db);
    expect(['ally', 'enemy', 'draw']).toContain(result.winner);
  });
});

describe('экспедиции', () => {
  it('доска на день детерминирована и заполнена', () => {
    const a = rich();
    const b = rich();
    b.saveId = a.saveId;
    rollExpeditions(a, NOW);
    rollExpeditions(b, NOW);
    expect(a.expeditions.board).toHaveLength(6);
    expect(a.expeditions.board).toEqual(b.expeditions.board);
    for (const m of a.expeditions.board) {
      expect(m.needs.length).toBeGreaterThan(0);
      expect(m.hours).toBeGreaterThan(0);
    }
  });

  it('отряды по уровню лагеря', () => {
    const s = rich();
    s.camp.level = 1;
    expect(expeditionParties(s)).toBe(2);
    s.camp.level = 4;
    expect(expeditionParties(s)).toBe(3);
    s.camp.level = 8;
    expect(expeditionParties(s)).toBe(4);
  });

  it('отправка: герои заняты, уходят из команды, награда по возвращении', () => {
    const s = rich();
    rollExpeditions(s, NOW);
    const m = s.expeditions.board.find((x) => autoParty(s, x))!;
    const party = autoParty(s, m)!;
    expect(checkParty(s, m, party).ok).toBe(true);
    expect(startExpedition(s, m.id, party, NOW)).toBe(true);
    for (const u of party) {
      expect(busyUids(s).has(u)).toBe(true);
      expect(s.team).not.toContain(u);
    }
    // Занятых нельзя в команду, на тренировку и в другой отряд.
    setTeam(s, party);
    expect(s.team).toEqual([]);
    expect(startTraining(s, party[0]!, 1, NOW)).toBe('busy');
    const other = s.expeditions.board.find((x) => x !== m)!;
    expect(startExpedition(s, other.id, party.slice(0, other.size), NOW)).not.toBe(true);
    // Рано — награды нет.
    expect(claimExpedition(s, m.id, NOW + 1000)).toBeNull();
    const gold = s.currencies.gold;
    const shards = s.currencies.shards;
    expect(expeditionsReady(s, NOW + m.hours * H)).toBe(1);
    const r = claimExpedition(s, m.id, NOW + m.hours * H)!;
    expect(r).toBeTruthy();
    expect(s.currencies.gold + s.currencies.shards).toBeGreaterThan(gold + shards - 1);
    expect(busyUids(s).size).toBe(0);
    expect(claimExpedition(s, m.id, NOW + m.hours * H)).toBeNull();
  });

  it('условия обязательны; неверный отряд не уходит', () => {
    const s = rich();
    rollExpeditions(s, NOW);
    const m = s.expeditions.board[0]!;
    expect(startExpedition(s, m.id, [], NOW)).toBe('badParty');
    s.heroes.forEach((h) => (h.stars = 1));
    const hard = s.expeditions.board.find((x) => x.minStars > 1);
    if (hard) expect(autoParty(s, hard)).toBeNull();
  });

  it('лимит отрядов, отзыв и ускорение', () => {
    const s = rich();
    s.camp.level = 1;
    rollExpeditions(s, NOW);
    let started = 0;
    for (const m of s.expeditions.board) {
      const p = autoParty(s, m);
      if (!p) continue;
      const r = startExpedition(s, m.id, p, NOW);
      if (started < 2) {
        expect(r).toBe(true);
        started++;
      } else {
        expect(r).toBe('noParty');
        break;
      }
    }
    expect(activeParties(s)).toBe(2);
    const m = s.expeditions.board.find((x) => x.party)!;
    expect(rushExpedition(s, m.id, NOW)).toBe(true);
    expect(claimExpedition(s, m.id, NOW)).toBeTruthy();
    const m2 = s.expeditions.board.find((x) => x.party && !x.done)!;
    expect(recallExpedition(s, m2.id)).toBe(true);
    expect(activeParties(s)).toBe(0);
  });

  it('обновление: первое бесплатно, начатые остаются; смена дня', () => {
    const s = rich();
    rollExpeditions(s, NOW);
    const m = s.expeditions.board.find((x) => autoParty(s, x))!;
    startExpedition(s, m.id, autoParty(s, m)!, NOW);
    expect(refreshCost(s)).toBe(0);
    const shards = s.currencies.shards;
    expect(refreshExpeditions(s, NOW)).toBe(true);
    expect(s.currencies.shards).toBe(shards);
    expect(refreshCost(s)).toBe(20);
    expect(s.expeditions.board).toContain(m);
    expect(s.expeditions.board.filter((x) => !x.done)).toHaveLength(6);
    // Новый день: отряд в пути остаётся, доска новая.
    rollExpeditions(s, NOW + 24 * H);
    expect(s.expeditions.board).toContain(m);
    expect(refreshCost(s)).toBe(0);
    expect(claimExpedition(s, m.id, NOW + 24 * H)).toBeTruthy();
    expect(s.expeditions.board).not.toContain(m);
  });

  it('сейв проходит проверку и не теряет отряд', () => {
    const s = rich();
    rollExpeditions(s, NOW);
    const m = s.expeditions.board.find((x) => autoParty(s, x))!;
    startExpedition(s, m.id, autoParty(s, m)!, NOW);
    const v = normalizeSave(JSON.parse(JSON.stringify(s)), NOW);
    expect(v.expeditions.board.find((x) => x.id === m.id)!.party).toEqual(m.party);
  });
});

describe('рейд: Пожиратель звёзд', () => {
  it('правила недели меняются по неделям', () => {
    const a = raidWeek(NOW);
    const b = raidWeek(NOW + 7 * 24 * H);
    expect(a.week).not.toBe(b.week);
    expect(a.element).not.toBe(b.element);
    expect(a.endsAt).toBeGreaterThan(NOW);
  });

  it('3 попытки в день + одна покупная, урон копится за неделю', () => {
    const s = rich();
    expect(raidAttemptsLeft(s, NOW)).toBe(3);
    for (let i = 0; i < 3; i++) expect(typeof beginRaid(s, NOW)).toBe('object');
    expect(beginRaid(s, NOW)).toBe('noAttempts');
    expect(buyRaidAttempt(s, NOW)).toBe(true);
    expect(buyRaidAttempt(s, NOW)).toBe('limit');
    expect(typeof beginRaid(s, NOW)).toBe('object');
    finishRaid(s, 200_000, NOW);
    finishRaid(s, 150_000, NOW);
    expect(s.raid.damage).toBe(350_000);
    expect(s.raid.best).toBe(200_000);
    expect(claimRaidMilestone(s, 0, NOW)).toBeTruthy();
    expect(claimRaidMilestone(s, 0, NOW)).toBeNull();
    expect(claimRaidMilestone(s, 3, NOW)).toBeNull();
    // Новый день — снова 3 попытки; новая неделя — урон сброшен.
    expect(raidAttemptsLeft(s, NOW + 24 * H)).toBe(3);
    beginRaid(s, NOW + 8 * 24 * H);
    expect(s.raid.damage).toBe(0);
  });

  it('благословлённая фракция получает атаку, босс не умирает за 25 ходов', () => {
    const s = rich();
    const w = raidWeek(NOW);
    const setup = raidSetup(s, NOW, 11);
    expect(setup.bossTurns).toBe(RAID.bossTurns);
    expect(setup.waves[0]![0]!.element).toBe(w.element);
    const team = teamHeroes(s);
    expect(setup.allies).toHaveLength(team.length);
    const { result } = simulate(setup, db);
    expect(result.winner).not.toBe('ally');
    expect(result.damage ?? 0).toBeGreaterThan(0);
    // Пороги наград по возрастанию.
    for (let i = 1; i < RAID_MILESTONES.length; i++)
      expect(RAID_MILESTONES[i]!.damage).toBeGreaterThan(RAID_MILESTONES[i - 1]!.damage);
  });

  it('v16: миграция добавляет экспедиции и рейд', () => {
    const old: Record<string, unknown> = {
      ...(createNewSave(NOW) as unknown as Record<string, unknown>),
      version: 15,
    };
    delete old.expeditions;
    delete old.raid;
    const m = migrate(old) as unknown as ReturnType<typeof createNewSave>;
    expect(m.version).toBe(16);
    expect(m.expeditions.board).toEqual([]);
    expect(m.raid.damage).toBe(0);
  });
});
