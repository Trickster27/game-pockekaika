import { createNewSave, DEFAULT_SETTINGS, type SaveData } from './schema';
import type { RawSave } from './migrations';

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const str = (v: unknown, d: string) => (typeof v === 'string' && v.length > 0 ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

export class SaveFormatError extends Error {}

/**
 * Превращает уже смигрированные сырые данные в SaveData.
 * Битые или отсутствующие поля заменяются значениями по умолчанию, поэтому повреждённый сейв не роняет игру.
 */
export function normalizeSave(raw: RawSave, now: number = Date.now()): SaveData {
  if (!isObj(raw)) throw new SaveFormatError('Сейв должен быть объектом');
  const base = createNewSave(now);
  const p = isObj(raw.player) ? raw.player : {};
  const c = isObj(raw.currencies) ? raw.currencies : {};
  const s = isObj(raw.settings) ? raw.settings : {};
  const speed = num(s.battleSpeed, DEFAULT_SETTINGS.battleSpeed, 1, 3);
  const locale =
    s.locale === 'en' || s.locale === 'uk' || s.locale === 'ru' ? s.locale : DEFAULT_SETTINGS.locale;
  return {
    version: num(raw.version, base.version),
    saveId: str(raw.saveId, base.saveId),
    createdAt: num(raw.createdAt, now, 0),
    updatedAt: num(raw.updatedAt, now, 0),
    lastSeenAt: num(raw.lastSeenAt, now, 0),
    player: {
      name: str(p.name, base.player.name).slice(0, 24),
      level: Math.round(num(p.level, 1, 1, 999)),
      xp: num(p.xp, 0, 0),
    },
    currencies: {
      gold: Math.floor(num(c.gold, base.currencies.gold, 0)),
      shards: Math.floor(num(c.shards, base.currencies.shards, 0)),
      energy: Math.floor(num(c.energy, base.currencies.energy, 0)),
      energyUpdatedAt: num(c.energyUpdatedAt, now, 0),
    },
    settings: {
      sound: bool(s.sound, DEFAULT_SETTINGS.sound),
      volume: num(s.volume, DEFAULT_SETTINGS.volume, 0, 1),
      haptics: bool(s.haptics, DEFAULT_SETTINGS.haptics),
      battleSpeed: Math.round(speed) as 1 | 2 | 3,
      autoBattle: bool(s.autoBattle, DEFAULT_SETTINGS.autoBattle),
      notifications: bool(s.notifications, DEFAULT_SETTINGS.notifications),
      locale,
    },
  };
}
