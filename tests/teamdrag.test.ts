import { describe, expect, it } from 'vitest';
import { moveTeamSlot, placeInTeam } from '@/game';
import { createNewSave } from '@/save/schema';
import type { SaveData } from '@/save/schema';

const NOW = 1_800_000_000_000;
function withHeroes(n: number, team: number): SaveData {
  const s = createNewSave(NOW);
  s.heroes = Array.from({ length: n }, (_, i) => ({
    uid: `h${i}`,
    heroId: 'rikht',
    level: 1,
    xp: 0,
    stars: 3,
    awakened: false,
    obtainedAt: NOW,
  }));
  s.team = s.heroes.slice(0, team).map((h) => h.uid);
  return s;
}

describe('перестановка отряда перетаскиванием', () => {
  it('обмен двух ячеек', () => {
    const s = withHeroes(5, 5);
    moveTeamSlot(s, 0, 3);
    expect(s.team).toEqual(['h3', 'h1', 'h2', 'h0', 'h4']);
  });

  it('перенос на свободную ячейку ставит героя последним', () => {
    const s = withHeroes(5, 3);
    moveTeamSlot(s, 0, 4);
    expect(s.team).toEqual(['h1', 'h2', 'h0']);
  });

  it('неверные индексы ничего не меняют', () => {
    const s = withHeroes(5, 3);
    moveTeamSlot(s, 5, 0);
    moveTeamSlot(s, 1, 1);
    expect(s.team).toEqual(['h0', 'h1', 'h2']);
  });

  it('герой из запаса: замена занятой ячейки и добавление в свободную', () => {
    const s = withHeroes(7, 4);
    expect(placeInTeam(s, 'h5', 1)).toBe(true);
    expect(s.team).toEqual(['h0', 'h5', 'h2', 'h3']);
    expect(placeInTeam(s, 'h6', 4)).toBe(true);
    expect(s.team).toEqual(['h0', 'h5', 'h2', 'h3', 'h6']);
  });

  it('герой уже в отряде — обмен местами, а не дубликат', () => {
    const s = withHeroes(5, 5);
    expect(placeInTeam(s, 'h4', 0)).toBe(true);
    expect(s.team).toEqual(['h4', 'h1', 'h2', 'h3', 'h0']);
  });

  it('занятого героя и чужой uid поставить нельзя', () => {
    const s = withHeroes(6, 2);
    s.training.slots = [{ heroUid: 'h5' } as never];
    expect(placeInTeam(s, 'h5', 0)).toBe('busy');
    expect(placeInTeam(s, 'nope', 0)).toBe('missing');
    expect(s.team).toEqual(['h0', 'h1']);
  });
});
