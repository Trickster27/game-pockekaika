import { afterEach, describe, expect, it } from 'vitest';
import ru from '@/i18n/ru.json';
import en from '@/i18n/en.json';
import contentEn from '@/content/en.json';
import { translate } from '@/i18n';
import { applyContentLocale } from '@/i18n/content';
import { HEROES, SKILLS, heroDef, skillDef } from '@/content';
import { SLOT_NAME } from '@/content/gear';

type Tree = { [k: string]: string | Tree };
function flat(t: Tree, p = '', out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(t)) {
    const key = p ? `${p}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else flat(v, key, out);
  }
  return out;
}
const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const CYR = /[А-Яа-яЁё]/;

describe('английский язык', () => {
  afterEach(() => applyContentLocale('ru'));

  it('интерфейс: все ключи переведены, параметры совпадают, кириллицы нет', () => {
    const r = flat(ru as Tree);
    const e = flat(en as Tree);
    expect(Object.keys(e).sort()).toEqual(Object.keys(r).sort());
    for (const k of Object.keys(r)) {
      expect(params(e[k]!), k).toEqual(params(r[k]!));
      expect(CYR.test(e[k]!), k).toBe(false);
    }
  });

  it('контент: перевод для каждого героя и навыка, без кириллицы', () => {
    const d = contentEn as Record<string, string>;
    for (const h of HEROES)
      for (const f of ['name', 'title', 'lore']) expect(d[`hero.${h.id}.${f}`]).toBeTruthy();
    for (const s of SKILLS) for (const f of ['name', 'desc']) expect(d[`skill.${s.id}.${f}`]).toBeTruthy();
    for (const v of Object.values(d)) expect(CYR.test(v), v).toBe(false);
  });

  it('смена языка подменяет контент и возвращает русский', () => {
    const name = heroDef('ardan').name;
    const skill = skillDef('knight_strike').name;
    const slot = SLOT_NAME.weapon;
    applyContentLocale('en');
    expect(heroDef('ardan').name).toBe('Ardan');
    expect(skillDef('knight_strike').name).toBe('Dawn Strike');
    expect(SLOT_NAME.weapon).toBe('Weapon');
    expect(translate('en', 'nav.camp')).toBe('Camp');
    applyContentLocale('ru');
    expect(heroDef('ardan').name).toBe(name);
    expect(skillDef('knight_strike').name).toBe(skill);
    expect(SLOT_NAME.weapon).toBe(slot);
  });
});
