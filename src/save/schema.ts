/**
 * Формат сохранения. При любом изменении структуры:
 * 1) увеличьте SAVE_VERSION;
 * 2) добавьте шаг в migrations.ts, который переводит версию N-1 в N;
 * 3) добавьте тест на этот шаг.
 */
export const SAVE_VERSION = 2;

export type BattleSpeed = 1 | 2 | 3;
export type Locale = 'ru' | 'en' | 'uk';

export interface Settings {
  sound: boolean;
  volume: number;
  haptics: boolean;
  battleSpeed: BattleSpeed;
  autoBattle: boolean;
  notifications: boolean;
  locale: Locale;
}

export interface Currencies {
  gold: number;
  /** Осколки зари — премиальная внутриигровая валюта (без реальных платежей). */
  shards: number;
  energy: number;
  /** Когда энергия последний раз пересчитывалась (unix ms). */
  energyUpdatedAt: number;
}

export interface PlayerProfile {
  name: string;
  level: number;
  xp: number;
}

/** Герой в коллекции игрока. */
export interface OwnedHero {
  uid: string;
  heroId: string;
  level: number;
  xp: number;
  stars: number;
  awakened: boolean;
  obtainedAt: number;
}

export interface CampaignProgress {
  /** Лучшие звёзды по этапам: { '1-3': 2 }. */
  stars: Record<string, number>;
}

export interface SaveData {
  version: number;
  /** Случайный id сейва: пригодится облачной синхронизации. */
  saveId: string;
  createdAt: number;
  updatedAt: number;
  /** Последний момент, когда игрок был в игре: от него считаются idle-награды. */
  lastSeenAt: number;
  player: PlayerProfile;
  currencies: Currencies;
  settings: Settings;
  heroes: OwnedHero[];
  /** uid героев в боевой команде (до 5). */
  team: string[];
  campaign: CampaignProgress;
  /** Счётчик для uid новых героев и предметов. */
  seq: number;
  stats: { battlesWon: number; battlesLost: number };
}

export const MAX_TEAM = 5;

export const STARTER_HERO_IDS = ['rikht', 'ivy', 'grav', 'chirk', 'dorn'] as const;

export function starterHeroes(now: number): OwnedHero[] {
  return STARTER_HERO_IDS.map((heroId, i) => ({
    uid: `h${i + 1}`,
    heroId,
    level: 1,
    xp: 0,
    stars: 1,
    awakened: false,
    obtainedAt: now,
  }));
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.7,
  haptics: true,
  battleSpeed: 1,
  autoBattle: false,
  notifications: true,
  locale: 'ru',
};

function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createNewSave(now: number = Date.now()): SaveData {
  return {
    version: SAVE_VERSION,
    saveId: randomId(),
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
    player: { name: 'Хранитель', level: 1, xp: 0 },
    currencies: { gold: 1000, shards: 300, energy: 60, energyUpdatedAt: now },
    settings: { ...DEFAULT_SETTINGS },
    heroes: starterHeroes(now),
    team: STARTER_HERO_IDS.map((_, i) => `h${i + 1}`),
    campaign: { stars: {} },
    seq: STARTER_HERO_IDS.length + 1,
    stats: { battlesWon: 0, battlesLost: 0 },
  };
}
