import { describe, expect, it } from 'vitest';
import { HEROES, passiveOf } from '@/content';
import { LEADER_AURA, leaderAura, teamSpecs, heroSpec, teamHeroes } from '@/game';
import { createNewSave } from '@/save/schema';
import { heroDef } from '@/content';

describe('passives', () => {
  it('every hero has a passive with both languages', () => {
    for (const h of HEROES) {
      const p = passiveOf(h.id, h.art);
      expect(p, h.id).toBeTruthy();
      expect(p!.name.ru && p!.name.en && p!.desc.ru && p!.desc.en).toBeTruthy();
      expect(h.passive?.kind).toBe(p!.kind);
    }
  });
});

describe('leader aura', () => {
  it('first team hero gives an aura to the whole team', () => {
    const save = createNewSave(1);
    const team = teamHeroes(save);
    expect(team.length).toBeGreaterThan(0);
    const aura = leaderAura(save)!;
    const role = heroDef(team[0]!.heroId).role;
    expect(aura.stat).toBe(LEADER_AURA[role].stat);
    const specs = teamSpecs(save);
    specs.forEach((s, i) => {
      const base = heroSpec(team[i]!, save);
      expect((s.bonusPct?.[aura.stat] ?? 0) - (base.bonusPct?.[aura.stat] ?? 0)).toBeCloseTo(aura.pct);
    });
  });
  it('no team — no aura', () => {
    const save = createNewSave(1);
    save.team = [];
    expect(leaderAura(save)).toBeNull();
    expect(teamSpecs(save)).toEqual([]);
  });
});
