import { affinity } from '@/core/elements';
import { activeFactionBonus, factionCounts } from '@/core/factions';
import { ELEMENTS, FACTIONS, ROLES, type Element, type Faction, type Role } from '@/core/types';
import type { HeroDef } from '@/core/content';
import { HEROES, heroDef, skillDef, ENEMIES } from '@/content';
import { SUMMON_RATES } from './summon';

/** Метки умений героя — по ним видно, что он даёт команде. */
export type Tag =
  | 'aoe'
  | 'heal'
  | 'groupHeal'
  | 'shield'
  | 'cleanse'
  | 'stun'
  | 'poison'
  | 'defDown'
  | 'atkDown'
  | 'slow'
  | 'tmDown'
  | 'atkUp'
  | 'defUp'
  | 'haste'
  | 'tmUp'
  | 'taunt'
  | 'pierce'
  | 'multiHit';

export const TAG_ORDER: readonly Tag[] = [
  'aoe',
  'heal',
  'groupHeal',
  'shield',
  'cleanse',
  'stun',
  'poison',
  'defDown',
  'atkDown',
  'slow',
  'tmDown',
  'atkUp',
  'defUp',
  'haste',
  'tmUp',
  'taunt',
  'pierce',
  'multiHit',
];

const tagCache = new Map<string, Tag[]>();

export function heroTags(h: HeroDef): Tag[] {
  const cached = tagCache.get(h.id);
  if (cached) return cached;
  const t = new Set<Tag>();
  for (const sid of h.skills) {
    for (const e of skillDef(sid).effects) {
      const to = e.to ?? 'target';
      switch (e.kind) {
        case 'damage':
          if (to === 'allEnemies' || to === 'randomEnemies3') t.add('aoe');
          if (e.defIgnore) t.add('pierce');
          if ((e.hits ?? 1) > 1) t.add('multiHit');
          break;
        case 'heal':
          t.add(to === 'allAllies' ? 'groupHeal' : 'heal');
          break;
        case 'shield':
          t.add('shield');
          break;
        case 'cleanse':
          t.add('cleanse');
          break;
        case 'turnMeter':
          t.add(e.amount < 0 ? 'tmDown' : 'tmUp');
          break;
        case 'status':
          t.add(
            e.status === 'atkUp'
              ? 'atkUp'
              : e.status === 'defUp'
                ? 'defUp'
                : e.status === 'haste'
                  ? 'haste'
                  : e.status,
          );
          break;
      }
    }
  }
  if (t.has('groupHeal')) t.add('heal');
  const out = TAG_ORDER.filter((x) => t.has(x));
  tagCache.set(h.id, out);
  return out;
}

/** Против каких стихий герой силён и каких опасается. */
export function elementMatchups(e: Element): { strong: Element[]; weak: Element[] } {
  return {
    strong: ELEMENTS.filter((x) => affinity(e, x) === 'strong'),
    weak: ELEMENTS.filter((x) => affinity(x, e) === 'strong'),
  };
}

/** Шанс получить именно этого героя за один призыв (без учёта гарантий). */
export function summonChance(h: HeroDef): number {
  const same = HEROES.filter((x) => x.rarity === h.rarity).length;
  return SUMMON_RATES[h.rarity] / Math.max(1, same);
}

/** С кем герой хорошо сочетается: своя фракция (бонус) и герои, закрывающие то, чего ему не хватает. */
export function goodPartners(h: HeroDef, limit = 6): { id: string; reason: 'faction' | 'covers' }[] {
  const mine = new Set(heroTags(h));
  const wants: Tag[] = [];
  if (h.role === 'attacker') wants.push('defDown', 'atkUp', 'haste', 'taunt', 'heal');
  if (h.role === 'defender') wants.push('heal', 'aoe', 'defDown');
  if (h.role === 'healer') wants.push('taunt', 'shield', 'aoe');
  if (h.role === 'support') wants.push('aoe', 'pierce', 'taunt', 'heal');
  const out: { id: string; reason: 'faction' | 'covers'; score: number }[] = [];
  for (const o of HEROES) {
    if (o.id === h.id) continue;
    if (o.faction === h.faction) {
      out.push({
        id: o.id,
        reason: 'faction',
        score: 10 + ['common', 'rare', 'epic', 'legendary'].indexOf(o.rarity),
      });
      continue;
    }
    const covers = heroTags(o).filter((t) => wants.includes(t) && !mine.has(t)).length;
    if (covers >= 2 && o.role !== h.role) out.push({ id: o.id, reason: 'covers', score: covers });
  }
  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ id, reason }) => ({ id, reason }));
}

export type Advice =
  | { kind: 'noHeal' }
  | { kind: 'noTank' }
  | { kind: 'noAoe' }
  | { kind: 'noDefDown' }
  | { kind: 'noControl' }
  | { kind: 'factionAlmost'; faction: Faction; need: number }
  | { kind: 'weakElement'; element: Element; count: number }
  | { kind: 'good' };

export interface TeamAnalysis {
  factions: { faction: Faction; count: number; bonus: ReturnType<typeof activeFactionBonus> }[];
  elements: Record<Element, number>;
  roles: Record<Role, number>;
  tags: Tag[];
  missing: Tag[];
  advice: Advice[];
}

/** Разбор состава: бонусы фракций, роли, стихии, покрытие умений и советы. */
export function analyzeTeam(heroIds: string[]): TeamAnalysis {
  const defs = heroIds.map((id) => heroDef(id));
  const counts = factionCounts(defs.map((d) => d.faction));
  const factions = FACTIONS.filter((f) => counts.has(f)).map((f) => ({
    faction: f,
    count: counts.get(f)!,
    bonus: activeFactionBonus(f, counts.get(f)!),
  }));
  const elements = Object.fromEntries(
    ELEMENTS.map((e) => [e, defs.filter((d) => d.element === e).length]),
  ) as Record<Element, number>;
  const roles = Object.fromEntries(ROLES.map((r) => [r, defs.filter((d) => d.role === r).length])) as Record<
    Role,
    number
  >;
  const tagSet = new Set(defs.flatMap((d) => heroTags(d)));
  const tags = TAG_ORDER.filter((t) => tagSet.has(t));
  const KEY: Tag[] = ['heal', 'aoe', 'taunt', 'defDown', 'stun', 'shield', 'atkUp', 'haste'];
  const missing = KEY.filter((t) => !tagSet.has(t));
  const advice: Advice[] = [];
  if (defs.length) {
    if (!tagSet.has('heal')) advice.push({ kind: 'noHeal' });
    if (!tagSet.has('taunt') && roles.defender === 0) advice.push({ kind: 'noTank' });
    if (!tagSet.has('aoe')) advice.push({ kind: 'noAoe' });
    if (!tagSet.has('defDown')) advice.push({ kind: 'noDefDown' });
    if (!tagSet.has('stun') && !tagSet.has('tmDown')) advice.push({ kind: 'noControl' });
    for (const f of factions)
      if (f.count === 2 && defs.length < 5)
        advice.push({ kind: 'factionAlmost', faction: f.faction, need: 1 });
    // Стихия, которой в составе слишком много: уязвимость к одному типу врагов.
    for (const e of ELEMENTS)
      if (elements[e] >= 3) advice.push({ kind: 'weakElement', element: e, count: elements[e] });
    if (advice.length === 0) advice.push({ kind: 'good' });
  }
  return { factions, elements, roles, tags, missing, advice };
}

/** Стихии врагов в игре — чтобы понимать, против кого пригодится герой. */
export function enemyElements(): Record<Element, string[]> {
  const out = Object.fromEntries(ELEMENTS.map((e) => [e, [] as string[]])) as Record<Element, string[]>;
  for (const e of ENEMIES) out[e.element].push(e.name);
  return out;
}
