import type { EnemyDef, SkillDef } from '@/core/content';
import { ELEMENTS, type Element } from '@/core/types';

/**
 * Босс клана — Страж Разлома. Один на клан, здоровье общее для всех участников.
 * Каждый день меняет стихию (сердце Разлома окрашивается в её цвет), поэтому
 * под него приходится собирать разные составы.
 */
export const CLAN_BOSS_SKILLS: SkillDef[] = [
  {
    id: 'rift_rend',
    name: 'Раскол',
    desc: 'Тяжёлый удар; может снизить защиту цели.',
    cooldown: 0,
    target: 'enemy',
    fx: 'hammer',
    effects: [
      { kind: 'damage', mult: 2.6 },
      { kind: 'status', status: 'defDown', turns: 2, chance: 0.5 },
    ],
  },
  {
    id: 'rift_wave',
    name: 'Волна Разлома',
    desc: 'Бьёт всех героев.',
    cooldown: 3,
    target: 'none',
    fx: 'shockwave',
    effects: [{ kind: 'damage', to: 'allEnemies', mult: 1.5 }],
  },
  {
    id: 'rift_pull',
    name: 'Притяжение пустоты',
    desc: 'Сбивает шкалу хода всем героям и может замедлить.',
    cooldown: 4,
    target: 'none',
    fx: 'storm',
    effects: [
      { kind: 'damage', to: 'allEnemies', mult: 0.8 },
      { kind: 'turnMeter', to: 'allEnemies', amount: -0.25 },
      { kind: 'status', to: 'allEnemies', status: 'slow', turns: 2, chance: 0.5 },
    ],
  },
  {
    id: 'rift_mend',
    name: 'Застывший Разлом',
    desc: 'Снимает с себя все ослабления и укрепляет защиту.',
    cooldown: 5,
    target: 'none',
    fx: 'buff',
    effects: [
      { kind: 'cleanse', to: 'self' },
      { kind: 'status', to: 'self', status: 'defUp', turns: 2 },
    ],
  },
];

export const CLAN_BOSS_NAME = 'Страж Разлома';

export const CLAN_BOSSES: EnemyDef[] = ELEMENTS.map((element) => ({
  id: clanBossId(element),
  name: CLAN_BOSS_NAME,
  element,
  role: 'attacker',
  art: `rift_${element}`,
  skills: CLAN_BOSS_SKILLS.map((s) => s.id),
  mod: { def: 0.1, spd: -4 },
  boss: true,
}));

export function clanBossId(e: Element): string {
  return `rift_warden_${e}`;
}
