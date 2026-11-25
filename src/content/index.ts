import type { ContentDb, EnemyDef, HeroDef, SkillDef } from '@/core/content';
import { HEROES, STARTER_HEROES } from './heroes';
import { ENEMIES } from './enemies';
import { SKILLS } from './skills';

export { HEROES, STARTER_HEROES, ENEMIES, SKILLS };
export * from './campaign';

const heroMap = new Map(HEROES.map((h) => [h.id, h]));
const enemyMap = new Map(ENEMIES.map((e) => [e.id, e]));
const skillMap = new Map(SKILLS.map((s) => [s.id, s]));

/** База контента для движка. */
export const db: ContentDb = {
  hero: (id) => heroMap.get(id),
  enemy: (id) => enemyMap.get(id),
  skill: (id) => skillMap.get(id),
};

export function heroDef(id: string): HeroDef {
  const h = heroMap.get(id);
  if (!h) throw new Error(`Нет героя ${id}`);
  return h;
}
export function enemyDef(id: string): EnemyDef {
  const e = enemyMap.get(id);
  if (!e) throw new Error(`Нет врага ${id}`);
  return e;
}
export function skillDef(id: string): SkillDef {
  const s = skillMap.get(id);
  if (!s) throw new Error(`Нет навыка ${id}`);
  return s;
}

/** Проверка целостности контента: ссылки, дубли, количество навыков. Используется в тестах. */
export function validateContent(): string[] {
  const errors: string[] = [];
  const dup = (arr: { id: string }[], what: string) => {
    const seen = new Set<string>();
    for (const x of arr) {
      if (seen.has(x.id)) errors.push(`Дубль ${what}: ${x.id}`);
      seen.add(x.id);
    }
  };
  dup(HEROES, 'героя');
  dup(ENEMIES, 'врага');
  dup(SKILLS, 'навыка');
  for (const h of [...HEROES, ...ENEMIES]) {
    if (h.skills.length < 2 || h.skills.length > 3) errors.push(`${h.id}: навыков должно быть 2–3`);
    for (const s of h.skills) if (!skillMap.has(s)) errors.push(`${h.id}: нет навыка ${s}`);
    const first = skillMap.get(h.skills[0] ?? '');
    if (first && first.cooldown !== 0) errors.push(`${h.id}: первый навык должен быть без перезарядки`);
  }
  for (const id of STARTER_HEROES) if (!heroMap.has(id)) errors.push(`Стартовый герой не найден: ${id}`);
  return errors;
}
