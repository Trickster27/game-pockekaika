import type { Faction, HeroRarity } from '@/core/types';
import type { HeroDef } from '@/core/content';
import type { MaterialId } from '@/save/schema';

/**
 * Свитки призыва. У каждого свой пул героев, шансы редкости и гарантия.
 * Сумрачные герои выпадают только из свитка Сумрака, мифические — только из золотого.
 */
export type ScrollId = 'basic' | 'ancient' | 'faction' | 'void' | 'gold';

export interface ScrollDef {
  id: ScrollId;
  material: MaterialId;
  name: string;
  desc: string;
  color: string;
  /** Шансы редкости (в сумме 1). */
  rates: Partial<Record<HeroRarity, number>>;
  /** Кто может выпасть (faction — выбранная фракция для фракционного свитка). */
  pool: (h: HeroDef, faction?: Faction) => boolean;
  /** Гарантия лучшей редкости не позже этого призыва. */
  pity: { rarity: HeroRarity; at: number };
  /** Эпический или лучше хотя бы раз за столько призывов. */
  epicEvery?: number;
  /** Нужно выбрать фракцию перед призывом. */
  chooseFaction?: boolean;
}

const base = (h: HeroDef) => !h.pool;
const atLeastRare = (h: HeroDef) => h.rarity !== 'common';

export const SCROLLS: ScrollDef[] = [
  {
    id: 'basic',
    material: 'scroll',
    name: 'Свиток призыва',
    desc: 'Любой герой из обычного пула. Призыв за осколки работает так же.',
    color: '#a37cff',
    rates: { common: 0.5, rare: 0.32, epic: 0.14, legendary: 0.04 },
    pool: base,
    pity: { rarity: 'legendary', at: 60 },
    epicEvery: 10,
  },
  {
    id: 'ancient',
    material: 'ancientScroll',
    name: 'Древний свиток',
    desc: 'Только редкие и лучше: обычных героев не бывает.',
    color: '#5fa8ff',
    rates: { rare: 0.88, epic: 0.1, legendary: 0.02 },
    pool: (h) => base(h) && atLeastRare(h),
    pity: { rarity: 'legendary', at: 80 },
    epicEvery: 10,
  },
  {
    id: 'faction',
    material: 'factionScroll',
    name: 'Свиток фракции',
    desc: 'Вы выбираете фракцию — выпадают только её герои, от редких.',
    color: '#5fb070',
    rates: { rare: 0.7, epic: 0.25, legendary: 0.05 },
    pool: (h, f) => base(h) && atLeastRare(h) && h.faction === f,
    pity: { rarity: 'legendary', at: 30 },
    chooseFaction: true,
  },
  {
    id: 'void',
    material: 'voidScroll',
    name: 'Свиток Сумрака',
    desc: 'Герои Света и Тьмы. Только здесь — сумрачные герои: Нокта, Аурэль, Ирэн и Морок.',
    color: '#c79cff',
    rates: { rare: 0.62, epic: 0.28, legendary: 0.1 },
    pool: (h) =>
      (base(h) && atLeastRare(h) && (h.element === 'light' || h.element === 'dark')) || h.pool === 'void',
    pity: { rarity: 'legendary', at: 20 },
  },
  {
    id: 'gold',
    material: 'goldScroll',
    name: 'Золотой свиток',
    desc: 'Самый редкий. Эпические, легендарные и мифические герои — они приходят с 1★, но качаются сразу до 60 уровня и сильнее легендарных.',
    color: '#f0c860',
    rates: { epic: 0.5, legendary: 0.38, mythic: 0.12 },
    pool: (h) => (base(h) && (h.rarity === 'epic' || h.rarity === 'legendary')) || h.pool === 'gold',
    pity: { rarity: 'mythic', at: 12 },
  },
];

export function scrollDef(id: ScrollId): ScrollDef {
  return SCROLLS.find((s) => s.id === id)!;
}
