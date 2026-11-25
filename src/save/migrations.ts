import { SAVE_VERSION } from './schema';

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
