import {
  createNewSave,
  DEFAULT_SETTINGS,
  MATERIAL_IDS,
  MAX_TEAM,
  type Item,
  type OwnedHero,
  type SaveData,
  type TeamPreset,
} from './schema';
import type { RawSave } from './migrations';

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const str = (v: unknown, d: string) => (typeof v === 'string' && v.length > 0 ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

export class SaveFormatError extends Error {}

const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

function normalizeItems(v: unknown, heroUids: Set<string>): Item[] {
  if (!Array.isArray(v)) return [];
  const out: Item[] = [];
  const seen = new Set<string>();
  const slotTaken = new Set<string>();
  for (const it of v) {
    if (
      !isObj(it) ||
      typeof it.uid !== 'string' ||
      seen.has(it.uid) ||
      typeof it.slot !== 'string' ||
      typeof it.main !== 'string'
    )
      continue;
    seen.add(it.uid);
    let heroUid = typeof it.heroUid === 'string' && heroUids.has(it.heroUid) ? it.heroUid : null;
    // Один предмет на слот героя.
    if (heroUid && slotTaken.has(`${heroUid}:${it.slot}`)) heroUid = null;
    if (heroUid) slotTaken.add(`${heroUid}:${it.slot}`);
    out.push({
      uid: it.uid,
      slot: it.slot,
      set: str(it.set, 'fury'),
      rarity: (RARITIES as readonly unknown[]).includes(it.rarity) ? (it.rarity as Item['rarity']) : 'common',
      level: Math.round(num(it.level, 0, 0, 15)),
      main: it.main,
      subs: Array.isArray(it.subs)
        ? it.subs
            .filter((x): x is Record<string, unknown> => isObj(x) && typeof x.stat === 'string')
            .slice(0, 4)
            .map((x) => ({
              stat: x.stat as string,
              value: num(x.value, 0, 0),
              rolls: Math.round(num(x.rolls, 1, 1, 6)),
            }))
        : [],
      heroUid,
    });
  }
  return out;
}

function normalizeHeroes(v: unknown, now: number): OwnedHero[] | null {
  if (!Array.isArray(v)) return null;
  const out: OwnedHero[] = [];
  const seen = new Set<string>();
  for (const h of v) {
    if (!isObj(h) || typeof h.uid !== 'string' || typeof h.heroId !== 'string' || seen.has(h.uid)) continue;
    seen.add(h.uid);
    out.push({
      uid: h.uid,
      heroId: h.heroId,
      level: Math.round(num(h.level, 1, 1, 60)),
      xp: Math.floor(num(h.xp, 0, 0)),
      stars: Math.round(num(h.stars, 1, 1, 6)),
      awakened: bool(h.awakened, false),
      obtainedAt: num(h.obtainedAt, now, 0),
    });
  }
  return out;
}

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
  const heroes = normalizeHeroes(raw.heroes, now);
  const heroUids = new Set((heroes ?? base.heroes).map((h) => h.uid));
  const team = Array.isArray(raw.team)
    ? [...new Set(raw.team.filter((u): u is string => typeof u === 'string' && heroUids.has(u)))].slice(
        0,
        MAX_TEAM,
      )
    : null;
  const camp = isObj(raw.campaign) && isObj(raw.campaign.stars) ? raw.campaign.stars : {};
  const campStars: Record<string, number> = {};
  for (const [k, v] of Object.entries(camp))
    if (typeof v === 'number' && v >= 1 && v <= 3) campStars[k] = Math.round(v);
  const st = isObj(raw.stats) ? raw.stats : {};
  const matRaw = isObj(raw.materials) ? raw.materials : {};
  const materials = { ...base.materials };
  for (const id of MATERIAL_IDS) materials[id] = Math.floor(num(matRaw[id], base.materials[id], 0));
  const presets: TeamPreset[] = Array.isArray(raw.presets)
    ? raw.presets.slice(0, 5).map((p, i) => ({
        name: str(isObj(p) ? p.name : undefined, `Состав ${i + 1}`).slice(0, 20),
        uids:
          isObj(p) && Array.isArray(p.uids)
            ? p.uids.filter((u): u is string => typeof u === 'string' && heroUids.has(u)).slice(0, MAX_TEAM)
            : [],
      }))
    : base.presets;
  const locale =
    s.locale === 'en' || s.locale === 'uk' || s.locale === 'ru' ? s.locale : DEFAULT_SETTINGS.locale;
  const idleRaw = isObj(raw.idle) ? raw.idle : {};
  const sm = isObj(raw.summon) ? raw.summon : {};
  const shopRaw = isObj(raw.shop) && isObj(raw.shop.bought) ? raw.shop.bought : {};
  const bought: SaveData['shop']['bought'] = {};
  for (const [k, v] of Object.entries(shopRaw))
    if (isObj(v) && typeof v.period === 'string')
      bought[k] = { period: v.period, count: Math.floor(num(v.count, 0, 0)) };
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
    heroes: heroes ?? base.heroes,
    team: team ?? base.team,
    campaign: { stars: campStars },
    materials,
    presets,
    idle: { lastClaimAt: Math.min(now, num(idleRaw.lastClaimAt, now, 0)) },
    summon: {
      rng: Math.floor(num(sm.rng, base.summon.rng, 0)) >>> 0,
      sinceLegendary: Math.floor(num(sm.sinceLegendary, 0, 0)),
      sinceEpic: Math.floor(num(sm.sinceEpic, 0, 0)),
      total: Math.floor(num(sm.total, 0, 0)),
    },
    shop: { bought },
    items: normalizeItems(raw.items, heroUids),
    gearRng: Math.floor(num(raw.gearRng, base.gearRng, 0)) >>> 0,
    dungeons: Object.fromEntries(
      Object.entries(isObj(raw.dungeons) ? raw.dungeons : {})
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => [k, Math.round(num(v, 0, 0, 10))]),
    ),
    seq: Math.max(Math.round(num(raw.seq, base.seq, 1)), (heroes?.length ?? 0) + 1),
    stats: {
      battlesWon: Math.floor(num(st.battlesWon, 0, 0)),
      battlesLost: Math.floor(num(st.battlesLost, 0, 0)),
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
