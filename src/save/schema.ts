/**
 * Формат сохранения. При любом изменении структуры:
 * 1) увеличьте SAVE_VERSION;
 * 2) добавьте шаг в migrations.ts, который переводит версию N-1 в N;
 * 3) добавьте тест на этот шаг.
 */
export const SAVE_VERSION = 10;

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

/** Материалы прокачки. */
export type MaterialId = 'xpTome' | 'starDust' | 'awakenStone' | 'scroll' | 'ore';
export const MATERIAL_IDS: readonly MaterialId[] = ['xpTome', 'starDust', 'awakenStone', 'scroll', 'ore'];

export interface TeamPreset {
  name: string;
  uids: string[];
}

export interface SummonState {
  /** Состояние RNG призыва: перезагрузка не меняет результат следующего призыва. */
  rng: number;
  /** Призывов подряд без легендарного героя. */
  sinceLegendary: number;
  /** Призывов подряд без эпического или легендарного героя. */
  sinceEpic: number;
  total: number;
}

export interface ShopState {
  /** Покупки: id предложения → { период, количество }. */
  bought: Record<string, { period: string; count: number }>;
}

/** Предмет снаряжения. Типы слотов/сетов/характеристик — строки, описанные в content/gear. */
export interface Item {
  uid: string;
  slot: string;
  set: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  level: number;
  main: string;
  /** Доп. характеристики; reforged — эту перековали (перековать можно одну на предмет). */
  subs: { stat: string; value: number; rolls: number; reforged?: boolean }[];
  heroUid: string | null;
  /** Под замком: нельзя продать или разобрать (в том числе массово). */
  locked: boolean;
}

export interface ArenaState {
  rating: number;
  wins: number;
  losses: number;
  /** Бои за день (лимит билетов). */
  day: string;
  battlesToday: number;
  leagueClaimedDay: string;
  /** Номер обновления списка соперников. */
  refresh: number;
}

export interface QuestState {
  day: string;
  progress: Record<string, number>;
  claimed: string[];
  chests: number[];
}

export interface LoginState {
  /** День, за который награда уже получена. */
  lastClaimDay: string;
  /** Сколько дней всего получено (номер следующей награды = claimed % 28). */
  claimed: number;
}

export interface ClanSaveState {
  coins: number;
  bought: Record<string, { period: string; count: number }>;
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
  materials: Record<MaterialId, number>;
  /** Сохранённые составы команды. */
  presets: TeamPreset[];
  idle: { lastClaimAt: number };
  summon: SummonState;
  shop: ShopState;
  items: Item[];
  /** Состояние RNG выпадения и улучшения снаряжения. */
  gearRng: number;
  /** Подземелья: максимальный пройденный уровень. */
  dungeons: Record<string, number>;
  /** Башня: максимальный пройденный этаж. */
  tower: { floor: number };
  arena: ArenaState;
  quests: QuestState;
  login: LoginState;
  /** Клан: монеты клана и покупки в клановом магазине (сам клан живёт на сервере). */
  clan: ClanSaveState;
  /** Обучение: текущий шаг; done — пройдено или пропущено. */
  tutorial: { step: number; done: boolean; rewarded?: boolean };
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
    materials: { xpTome: 5, starDust: 0, awakenStone: 0, scroll: 3, ore: 20 },
    clan: { coins: 0, bought: {} },
    tutorial: { step: 0, done: false },
    presets: defaultPresets(),
    idle: { lastClaimAt: now },
    summon: newSummonState(now),
    shop: { bought: {} },
    items: [],
    gearRng: (now ^ 0x51ed270b) >>> 0,
    dungeons: {},
    tower: { floor: 0 },
    arena: newArena(),
    quests: { day: '', progress: {}, claimed: [], chests: [] },
    login: { lastClaimDay: '', claimed: 0 },
    stats: { battlesWon: 0, battlesLost: 0 },
  };
}

export function defaultPresets(): TeamPreset[] {
  return [
    { name: 'Состав 1', uids: [] },
    { name: 'Состав 2', uids: [] },
    { name: 'Состав 3', uids: [] },
  ];
}

export function newSummonState(seed: number): SummonState {
  return { rng: (seed ^ 0x9e3779b9) >>> 0, sinceLegendary: 0, sinceEpic: 0, total: 0 };
}

export function newArena(): ArenaState {
  return { rating: 1000, wins: 0, losses: 0, day: '', battlesToday: 0, leagueClaimedDay: '', refresh: 0 };
}
