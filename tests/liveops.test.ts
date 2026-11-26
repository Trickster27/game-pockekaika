import { describe, expect, it } from 'vitest';
import { HEROES, heroDef } from '@/content';
import {
  EVENTS,
  EVENT_DAYS,
  PASS_DAYS,
  PASS_XP_PER_LEVEL,
  RATE_UP_SHARE,
  achievementState,
  addPassXp,
  buyPremium,
  claimAchievement,
  claimEventMilestone,
  claimPass,
  claimQuest,
  currentEvent,
  eventState,
  featuredHero,
  heroChance,
  passLevel,
  summon,
  summonEventPoints,
  trackQuest,
} from '@/game';
import { createNewSave } from '@/save/schema';
import { migrate } from '@/save/migrations';

const DAY = 86_400_000;
// Найдём день, когда идёт нужное событие.
const dayFor = (kind: string) => {
  for (let d = 20_000; d < 20_100; d++)
    if (currentEvent(d * DAY + 1000).def.kind === kind) return d * DAY + 1000;
  throw new Error('нет дня');
};

describe('события', () => {
  it('меняются каждые 3 дня по кругу', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < EVENTS.length; i++) kinds.add(currentEvent(i * EVENT_DAYS * DAY).def.kind);
    expect(kinds.size).toBe(EVENTS.length);
    expect(currentEvent(0).key).toBe(currentEvent(EVENT_DAYS * DAY - 1).key);
  });

  it('очки за действия, ступени, сброс с новым событием', () => {
    const now = dayFor('campaign');
    const s = createNewSave(now);
    trackQuest(s, 'campaign', 5, now);
    trackQuest(s, 'dungeon', 2, now);
    trackQuest(s, 'summon', 3, now); // не это событие
    expect(eventState(s, now).points).toBe(5 * 2 + 2 * 3);
    expect(claimEventMilestone(s, 0, now)).toBeNull();
    trackQuest(s, 'campaign', 2, now);
    expect(claimEventMilestone(s, 0, now)).not.toBeNull();
    expect(claimEventMilestone(s, 0, now)).toBeNull();
    const later = now + EVENT_DAYS * DAY;
    expect(eventState(s, later).points).toBe(0);
  });

  it('турнир призыва: ценные свитки дают больше очков', () => {
    const now = dayFor('summon');
    const s = createNewSave(now);
    trackQuest(s, 'summon', 1, now);
    summonEventPoints(s, 'gold', 1, now);
    expect(eventState(s, now).points).toBe(10);
  });
});

describe('сезонный пропуск', () => {
  it('опыт от заданий и входа, уровни, премиум, новый сезон', () => {
    const now = 20_000 * DAY + 1000;
    const s = createNewSave(now);
    trackQuest(s, 'login', 1, now);
    expect(claimQuest(s, 'login', now)).toBe(true);
    expect(passLevel(s, now).xp).toBeGreaterThan(0);
    addPassXp(s, 3 * PASS_XP_PER_LEVEL, now);
    const lv = passLevel(s, now).level;
    expect(lv).toBeGreaterThanOrEqual(3);
    expect(claimPass(s, lv + 1, 'free', now)).toBe('level');
    expect(typeof claimPass(s, 1, 'free', now)).toBe('object');
    expect(claimPass(s, 1, 'free', now)).toBe('claimed');
    expect(claimPass(s, 1, 'premium', now)).toBe('premium');
    s.currencies.shards = 0;
    expect(buyPremium(s, now)).toBe('noShards');
    s.currencies.shards = 5000;
    expect(buyPremium(s, now)).toBe(true);
    expect(typeof claimPass(s, 1, 'premium', now)).toBe('object');
    expect(passLevel(s, now + PASS_DAYS * DAY).level).toBe(0);
    expect(s.pass.premium).toBe(false);
  });
});

describe('повышенный шанс', () => {
  it('герой недели забирает половину шанса своей редкости, сумма не меняется', () => {
    const now = 20_000 * DAY;
    const f = featuredHero('gold', now)!;
    expect(heroDef(f).rarity).toBe('mythic');
    const mythics = HEROES.filter((h) => h.pool === 'gold');
    const sum = mythics.reduce((a, h) => a + heroChance(h, 'gold', undefined, now), 0);
    expect(sum).toBeCloseTo(0.12, 9);
    const fc = heroChance(heroDef(f), 'gold', undefined, now);
    expect(fc).toBeCloseTo(0.12 * (RATE_UP_SHARE + RATE_UP_SHARE / mythics.length), 9);
    expect(featuredHero('gold', now + 7 * DAY)).not.toBe(f);
    expect(featuredHero('basic', now)).toBeNull();
  });

  it('на деле герой недели выпадает чаще остальных мифических', () => {
    const now = 20_000 * DAY;
    const f = featuredHero('gold', now)!;
    const s = createNewSave(now);
    s.materials.goldScroll = 5000;
    const c: Record<string, number> = {};
    for (let i = 0; i < 300; i++) {
      const r = summon(s, 10, 'gold', now);
      if (typeof r === 'object')
        for (const h of r.heroes)
          if (heroDef(h.heroId).rarity === 'mythic') c[h.heroId] = (c[h.heroId] ?? 0) + 1;
    }
    const others = Object.entries(c)
      .filter(([k]) => k !== f)
      .map(([, v]) => v);
    expect(c[f]!).toBeGreaterThan(Math.max(...others) * 2);
  });
});

describe('достижения и сейв', () => {
  it('прогресс из сейва, награда за ступень один раз', () => {
    const s = createNewSave(1);
    s.stats.battlesWon = 12;
    const st = achievementState(s).find((a) => a.def.id === 'wins')!;
    expect(st.steps[0]).toMatchObject({ done: true, claimed: false });
    const shards = s.currencies.shards;
    expect(claimAchievement(s, 'wins', 0)).not.toBeNull();
    expect(s.currencies.shards).toBeGreaterThan(shards);
    expect(claimAchievement(s, 'wins', 0)).toBeNull();
    expect(claimAchievement(s, 'wins', 1)).toBeNull();
  });

  it('v15', () => {
    const raw = migrate({ version: 14 });
    expect(raw).toMatchObject({ achievements: [], events: { key: '' }, pass: { season: -1 } });
  });
});
