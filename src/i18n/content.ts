import {
  ALL_STAGES,
  CHAPTERS,
  CLAN_BOSSES,
  CLAN_BOSS_SKILLS,
  ENEMIES,
  HEROES,
  SCROLLS,
  SKILLS,
} from '@/content';
import { DUNGEONS } from '@/content/dungeons';
import { SETS, SLOT_NAME, STAT_NAME } from '@/content/gear';
import { DAILY_QUESTS, LEAGUES, RAID_MUTATIONS, SHOP_OFFERS } from '@/game';
import en from '@/content/en.json';
import type { LocaleId } from './index';

/**
 * Перевод контента (имена героев, навыки, враги, главы, сеты, товары…).
 * Контент описан в TS прямо по-русски, поэтому язык меняется подменой полей в самих объектах:
 * при первой смене запоминаем русские строки, потом ставим перевод или возвращаем оригинал.
 * Ключи словаря: «группа.id.поле» (для словарей слотов и характеристик поле — «-»).
 */
type Obj = Record<string, unknown> & { id: string | number };
const GROUPS: Record<string, readonly Obj[]> = {
  hero: HEROES as unknown as Obj[],
  enemy: [...ENEMIES, ...CLAN_BOSSES] as unknown as Obj[],
  skill: [...SKILLS, ...CLAN_BOSS_SKILLS] as unknown as Obj[],
  chapter: CHAPTERS as unknown as Obj[],
  stage: ALL_STAGES as unknown as Obj[],
  dungeon: DUNGEONS as unknown as Obj[],
  set: SETS as unknown as Obj[],
  scroll: SCROLLS as unknown as Obj[],
  league: LEAGUES as unknown as Obj[],
  quest: DAILY_QUESTS as unknown as Obj[],
  shop: SHOP_OFFERS as unknown as Obj[],
  mutation: RAID_MUTATIONS as unknown as Obj[],
};
const RECORDS: Record<string, Record<string, string>> = { slot: SLOT_NAME, stat: STAT_NAME };
const DICTS: Partial<Record<LocaleId, Record<string, string>>> = { en };

let original: Map<string, string> | null = null;
let current: LocaleId = 'ru';

function each(fn: (key: string, get: () => string, set: (v: string) => void) => void) {
  for (const [g, list] of Object.entries(GROUPS))
    for (const o of list)
      for (const f of ['name', 'title', 'lore', 'desc'])
        if (typeof o[f] === 'string')
          fn(
            `${g}.${o.id}.${f}`,
            () => o[f] as string,
            (v) => {
              o[f] = v;
            },
          );
  for (const [g, rec] of Object.entries(RECORDS))
    for (const k of Object.keys(rec))
      fn(
        `${g}.${k}.-`,
        () => rec[k]!,
        (v) => {
          rec[k] = v;
        },
      );
}

export function applyContentLocale(locale: LocaleId) {
  if (locale === current) return;
  if (!original) {
    original = new Map();
    each((key, get) => original!.set(key, get()));
  }
  const dict = DICTS[locale];
  each((key, _get, set) => set(dict?.[key] ?? original!.get(key)!));
  current = locale;
}
