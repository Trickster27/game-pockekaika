import type { Element } from './types';

/**
 * Цикл стихий: Пламя > Терн > Камень > Прилив > Пламя.
 * Свет и Тьма сильны друг против друга и нейтральны ко всем остальным.
 */
const BEATS: Record<Element, Element[]> = {
  fire: ['thorn'],
  thorn: ['stone'],
  stone: ['tide'],
  tide: ['fire'],
  light: ['dark'],
  dark: ['light'],
};

export type Affinity = 'strong' | 'weak' | 'neutral';

export function affinity(attacker: Element, defender: Element): Affinity {
  if (BEATS[attacker].includes(defender)) return 'strong';
  if (BEATS[defender].includes(attacker)) return 'weak';
  return 'neutral';
}

export const AFFINITY = {
  /** Множитель урона. */
  damage: { strong: 1.3, weak: 0.8, neutral: 1 },
  /** Добавка к шансу наложить дебафф. */
  debuff: { strong: 0.1, weak: -0.1, neutral: 0 },
  /** Добавка к шансу крита. */
  crit: { strong: 0.05, weak: -0.05, neutral: 0 },
} as const;
