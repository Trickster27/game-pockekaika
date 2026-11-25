/**
 * Формат сохранения. При любом изменении структуры:
 * 1) увеличьте SAVE_VERSION;
 * 2) добавьте шаг в migrations.ts, который переводит версию N-1 в N;
 * 3) добавьте тест на этот шаг.
 */
export const SAVE_VERSION = 1;

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
  };
}
