import { describe, expect, it } from 'vitest';
import { simulate, type UnitSpec } from '@/core/battle';
import { db, stageById } from '@/content';
import { makeSetup } from '@/game';

const team: UnitSpec[] = ['rikht', 'ivy', 'grav', 'chirk', 'dorn'].map((id) => ({
  defId: id,
  kind: 'hero',
  level: 20,
  stars: 3,
}));

describe('статистика боя', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`сходится с событиями боя (seed ${seed})`, () => {
      const stage = stageById('1-5')!;
      const { result, log } = simulate(makeSetup(team, stage.waves, seed), db);
      const rep = result.report!;
      const allies = rep.filter((r) => r.side === 'ally');
      const foes = rep.filter((r) => r.side === 'enemy');
      // Урон одной стороны = полученный урон другой.
      const sum = (l: typeof rep, k: 'dealt' | 'taken' | 'healed') => l.reduce((a, r) => a + r[k], 0);
      expect(sum(allies, 'dealt')).toBe(sum(foes, 'taken'));
      expect(sum(foes, 'dealt')).toBe(sum(allies, 'taken'));
      // Здоровье, снятое у врагов, входит в урон отряда (плюс поглощённое щитами).
      expect(sum(allies, 'dealt')).toBeGreaterThanOrEqual(result.damage!);
      // Добивания союзников = число павших врагов.
      const deadFoes = log.filter((e) => e.t === 'death' && e.uid.startsWith('e')).length;
      expect(allies.reduce((a, r) => a + r.kills, 0)).toBe(deadFoes);
      // Крит не больше урона.
      for (const r of rep) expect(r.maxCrit).toBeLessThanOrEqual(r.dealt);
      // Лечение = сумма событий лечения от союзников (лекари в отряде есть).
      const heals = log
        .filter((e) => e.t === 'heal' && e.uid.startsWith('a'))
        .reduce((a, e) => a + (e.t === 'heal' ? e.amount : 0), 0);
      expect(sum(allies, 'healed')).toBe(heals);
      expect(foes.length).toBeGreaterThan(0);
      expect(result.winner === 'ally' ? foes.every((f) => !f.alive) : true).toBe(true);
    });
  }
});
