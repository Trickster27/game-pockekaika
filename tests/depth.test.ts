import { describe, expect, it } from 'vitest';
import { db, skillDef } from '@/content';
import { Battle, levelSkill } from '@/core/battle';
import {
  FUSIONS,
  canLearn,
  collectionOf,
  fuse,
  heroPower,
  heroSpec,
  learnTalent,
  resetTalents,
  skillLevels,
  talentPoints,
  upgradeSkill,
} from '@/game';
import { createNewSave, type OwnedHero } from '@/save/schema';
import { migrate } from '@/save/migrations';

const NOW = 1_800_000_000_000;
function save() {
  const s = createNewSave(NOW);
  s.currencies.gold = 1_000_000;
  s.materials.skillBook = 100;
  return s;
}
let seq = 900;
const hero = (heroId: string, stars = 3, level = 30): OwnedHero => ({
  uid: `x${seq++}`,
  heroId,
  level,
  xp: 0,
  stars,
  awakened: false,
  obtainedAt: NOW,
});

describe('книги навыков', () => {
  it('+10% силы за уровень, на 4-м перезарядка −1', () => {
    const s = skillDef('sol_flare');
    expect(levelSkill(s, 1)).toBe(s);
    const l3 = levelSkill(s, 3);
    expect(l3.effects[0]!.kind === 'damage' && l3.effects[0]!.mult).toBeCloseTo(1.5 * 1.2);
    expect(l3.cooldown).toBe(s.cooldown);
    expect(levelSkill(s, 4).cooldown).toBe(s.cooldown - 1);
    const heal = levelSkill(skillDef('thal_tide'), 2);
    expect(heal.effects[0]!.kind === 'heal' && heal.effects[0]!.pct).toBeCloseTo(0.25 * 1.1);
  });

  it('улучшение тратит книги и золото, уровень доходит до 4, бой видит уровни', () => {
    const s = save();
    const h = s.heroes[0]!;
    expect(skillLevels(h)).toEqual([1, 1, 1].slice(0, skillLevels(h).length));
    expect(upgradeSkill(s, h.uid, 1)).toBe(2);
    expect(upgradeSkill(s, h.uid, 1)).toBe(3);
    expect(upgradeSkill(s, h.uid, 1)).toBe(4);
    expect(upgradeSkill(s, h.uid, 1)).toBe('max');
    expect(s.materials.skillBook).toBe(100 - 1 - 2 - 3);
    const spec = heroSpec(h, s);
    expect(spec.skillLv?.[1]).toBe(4);
    const b = new Battle(
      { allies: [spec], waves: [[{ defId: 'wraith', kind: 'enemy', level: 1 }]], seed: 1 },
      db,
    );
    const base = skillDef(b.allies[0]!.skills[1]!.id);
    expect(b.allies[0]!.skills[1]!.cooldown).toBe(base.cooldown > 1 ? base.cooldown - 1 : base.cooldown);
    s.materials.skillBook = 0;
    expect(upgradeSkill(s, h.uid, 0)).toBe('noBooks');
  });
});

describe('таланты и коллекция', () => {
  it('очко за 5 уровней, по порядку в ветке, сброс за золото', () => {
    const s = save();
    const h = s.heroes[0]!;
    h.level = 12;
    expect(talentPoints(h)).toEqual({ total: 2, used: 0, free: 2 });
    expect(canLearn(h, 'm2')).toBe('locked');
    expect(learnTalent(s, h.uid, 'm1')).toBe(true);
    expect(learnTalent(s, h.uid, 'm2')).toBe(true);
    expect(learnTalent(s, h.uid, 'g1')).toBe('noPoints');
    const p0 = heroPower(h, s);
    expect(resetTalents(s, h.uid)).toBe(true);
    expect(heroPower(h, s)).toBeLessThan(p0);
    expect(talentPoints(h).free).toBe(2);
  });

  it('бонус коллекции растёт с числом героев фракции и попадает в силу', () => {
    const s = save();
    s.heroes = [hero('ardan'), hero('selesta')];
    const before = heroPower(s.heroes[0]!, s);
    expect(collectionOf(s, 'order').pct).toBe(0);
    s.heroes.push(hero('mirna'));
    expect(collectionOf(s, 'order')).toMatchObject({ have: 3, total: 7, pct: 0.03 });
    expect(heroPower(s.heroes[0]!, s)).toBeGreaterThan(before);
    for (const id of ['valeria', 'rikht', 'tobias']) s.heroes.push(hero(id));
    expect(collectionOf(s, 'order').pct).toBe(0.06);
    s.heroes.push(hero('marina'));
    expect(collectionOf(s, 'order').pct).toBe(0.1);
  });
});

describe('слияние', () => {
  it('нужны все ингредиенты, они исчезают, снаряжение возвращается, герой приходит с 4★', () => {
    const s = save();
    const r = FUSIONS.find((x) => x.result === 'ilia')!;
    s.heroes = r.parts.slice(0, 3).map((p) => hero(p.heroId, p.stars));
    expect(fuse(s, 'ilia', NOW)).toBe('missing');
    const last = hero(r.parts[3]!.heroId, r.parts[3]!.stars);
    s.heroes.push(last);
    s.items.push({
      uid: 'it1',
      slot: 'weapon',
      set: 'fury',
      rarity: 'epic',
      level: 0,
      main: 'atk',
      subs: [],
      heroUid: last.uid,
      locked: false,
    });
    s.team = [last.uid];
    const out = fuse(s, 'ilia', NOW);
    expect(typeof out).toBe('object');
    expect(s.heroes.map((h) => h.heroId)).toEqual(['ilia']);
    expect(s.heroes[0]!.stars).toBe(4);
    expect(s.items[0]!.heroUid).toBeNull();
    expect(s.team).toEqual([]);
    expect(s.currencies.gold).toBe(1_000_000 - r.gold);
  });

  it('копия с недостающими звёздами не подходит', () => {
    const s = save();
    const r = FUSIONS[1]!;
    s.heroes = r.parts.map((p) => hero(p.heroId, p.stars - 1));
    expect(fuse(s, r.result, NOW)).toBe('missing');
  });
});

describe('сейв v14', () => {
  it('книги навыков в подарок', () => {
    expect(
      (migrate({ version: 13, materials: { scroll: 1 } }).materials as Record<string, number>).skillBook,
    ).toBe(2);
  });
});
