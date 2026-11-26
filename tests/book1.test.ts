import { describe, expect, it } from 'vitest';
import { CHAPTERS, HEROES, SKINS, db, enemyDef, heroDef, validateContent } from '@/content';
import { simulate } from '@/core/battle';
import { makeSetup, setHeroSkin, heroSpec } from '@/game';
import { createNewSave } from '@/save/schema';

describe('Книга I: героини, глава 6, облики', () => {
  it('контент целостен, новые героини и босс главы 6 на месте', () => {
    expect(validateContent()).toEqual([]);
    for (const id of ['lilith', 'elvira', 'taira', 'marina', 'aerin'])
      expect(heroDef(id).skills).toHaveLength(3);
    const ch = CHAPTERS[5]!;
    expect(ch.scene).toBe('rift');
    expect(ch.stages[9]!.waves.at(-1)!.some((e) => e.id === 'void_herald' && e.boss)).toBe(true);
    expect(enemyDef('void_mirror').thorns).toBeGreaterThan(0.3);
  });

  it('шипы возвращают часть урона атакующему и не отражаются по кругу', () => {
    const { log } = simulate(
      {
        allies: [{ defId: 'elvira', kind: 'hero', level: 30, stars: 3 }],
        waves: [[{ defId: 'void_mirror', kind: 'enemy', level: 30 }]],
        seed: 5,
      },
      db,
    );
    const events = log as { t: string; uid?: string; reflect?: boolean }[];
    const hits = events.filter((e) => e.t === 'damage' && !e.reflect && e.uid?.startsWith('e'));
    const back = events.filter((e) => e.t === 'damage' && e.reflect);
    expect(hits.length).toBeGreaterThan(0);
    expect(back.length).toBeGreaterThan(0);
    // Отражённый урон не отражается снова: за каждым отражением не следует новое отражение от героя.
    expect(back.every((e) => e.uid?.startsWith('a'))).toBe(true);
  });

  it('бой с Глашатаем проходит до конца', () => {
    const team = ['solarion', 'thalassa', 'gorran', 'verdis', 'lilith'].map((id) => ({
      defId: id,
      kind: 'hero' as const,
      level: 60,
      stars: 6,
    }));
    const { result } = simulate(makeSetup(team, CHAPTERS[5]!.stages[9]!.waves, 3), db);
    expect(['ally', 'enemy', 'draw']).toContain(result.winner);
  });

  it('облики открываются звёздами и попадают в бой', () => {
    const s = createNewSave(1_800_000_000_000);
    const h = s.heroes[0]!;
    h.stars = 3;
    expect(setHeroSkin(s, h.uid, 'dusk')).toBe('locked');
    h.stars = 4;
    expect(setHeroSkin(s, h.uid, 'dusk')).toBe(true);
    expect(heroSpec(h, s).skin).toBe('dusk');
    expect(setHeroSkin(s, h.uid, 'gilded')).toBe('locked');
    expect(setHeroSkin(s, h.uid)).toBe(true);
    expect(h.skin).toBeUndefined();
    expect(SKINS.length).toBe(2);
    expect(HEROES.length).toBe(45);
  });
});
