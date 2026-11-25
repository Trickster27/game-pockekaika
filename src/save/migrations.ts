import { SAVE_VERSION, starterHeroes, defaultPresets, newSummonState, newArena } from './schema';

/** Сырые данные сейва неизвестной версии. */
export type RawSave = Record<string, unknown> & { version?: unknown };

/** Шаг миграции: принимает сейв версии N-1 и возвращает версию N. */
export type Migration = (save: RawSave) => RawSave;

/**
 * Реестр миграций: ключ — версия, В КОТОРУЮ переводит шаг.
 * Пример для будущей версии 2:
 *   2: (s) => ({ ...s, version: 2, heroes: [] }),
 */
export const MIGRATIONS: Record<number, Migration> = {
  // Версия 0 — сейвы без поля version (прототипы). Приводим к схеме 1.
  1: (s) => ({ ...s, version: 1 }),
  // v2: коллекция героев, команда и прогресс кампании. Старым сейвам выдаём стартовую команду.
  2: (s) => {
    const now = typeof s.updatedAt === 'number' ? s.updatedAt : Date.now();
    const heroes = starterHeroes(now);
    return {
      ...s,
      version: 2,
      heroes,
      team: heroes.map((h) => h.uid),
      campaign: { stars: {} },
      seq: heroes.length + 1,
      stats: { battlesWon: 0, battlesLost: 0 },
    };
  },
  // v3: материалы прокачки и сохранённые составы.
  3: (s) => ({
    ...s,
    version: 3,
    materials: { xpTome: 5, starDust: 0, awakenStone: 0 },
    presets: defaultPresets(),
  }),
  // v4: idle-награды, призыв, магазин, свитки призыва.
  4: (s) => {
    const now = typeof s.updatedAt === 'number' ? s.updatedAt : Date.now();
    const materials = { ...(s.materials as Record<string, number>), scroll: 3 };
    return {
      ...s,
      version: 4,
      materials,
      idle: { lastClaimAt: now },
      summon: newSummonState(now),
      shop: { bought: {} },
    };
  },
  // v5: снаряжение и подземелья.
  5: (s) => ({
    ...s,
    version: 5,
    items: [],
    gearRng: ((typeof s.updatedAt === 'number' ? s.updatedAt : 1) ^ 0x51ed270b) >>> 0,
    dungeons: {},
  }),
  // v6: башня, арена, задания, награды за вход.
  6: (s) => ({
    ...s,
    version: 6,
    tower: { floor: 0 },
    arena: newArena(),
    quests: { day: '', progress: {}, claimed: [], chests: [] },
    login: { lastClaimDay: '', claimed: 0 },
  }),
};

export class SaveVersionError extends Error {}

export function readVersion(raw: RawSave): number {
  const v = raw.version;
  if (v === undefined) return 0;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0)
    throw new SaveVersionError(`Некорректная версия сейва: ${String(v)}`);
  return v;
}

/** Последовательно применяет миграции, пока сейв не дойдёт до target. */
export function migrate(
  raw: RawSave,
  target: number = SAVE_VERSION,
  migrations: Record<number, Migration> = MIGRATIONS,
): RawSave {
  let cur = readVersion(raw);
  if (cur > target) {
    throw new SaveVersionError(`Сейв из более новой версии игры (${cur} > ${target}). Обновите игру.`);
  }
  let data = raw;
  while (cur < target) {
    const step = migrations[cur + 1];
    if (!step) throw new SaveVersionError(`Нет миграции ${cur} → ${cur + 1}`);
    data = step(data);
    cur += 1;
    if (readVersion(data) !== cur) data = { ...data, version: cur };
  }
  return data;
}
