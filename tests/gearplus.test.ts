import { describe, expect, it } from 'vitest';
import { createNewSave, type Item, type SaveData } from '@/save/schema';
import { migrate } from '@/save/migrations';
import {
  autoEquip,
  bestGearFor,
  equip,
  itemScore,
  massSalvage,
  massSalvagePreview,
  reforgeCost,
  reforgeSub,
  salvageItem,
  sellItem,
  subQuality,
  toggleLock,
} from '@/game';
import { SUB_ROLL } from '@/content/gear';
import { mergeRewardLines } from '@/state/rewards';

let seq = 1;
function item(o: Partial<Item> = {}): Item {
  return {
    uid: `t${seq++}`,
    slot: 'weapon',
    set: 'fury',
    rarity: 'epic',
    level: 0,
    main: 'atk',
    subs: [],
    heroUid: null,
    locked: false,
    ...o,
  };
}
function save(items: Item[]): SaveData {
  const s = createNewSave(1_700_000_000_000);
  s.items = items;
  s.currencies.gold = 1_000_000;
  s.materials.ore = 10_000;
  return s;
}

describe('оценка и качество', () => {
  it('качество 0..1 и оценка растёт со срабатываниями', () => {
    const [lo, hi] = SUB_ROLL.atkPct;
    expect(subQuality({ stat: 'atkPct', value: hi, rolls: 1 })).toBeCloseTo(1);
    expect(subQuality({ stat: 'atkPct', value: lo, rolls: 1 })).toBeCloseTo(0);
    expect(subQuality({ stat: 'atkPct', value: (lo + hi) * 2, rolls: 4 })).toBeCloseTo(0.5);
    const a = item({ subs: [{ stat: 'atkPct', value: hi, rolls: 1 }] });
    const b = item({ subs: [{ stat: 'atkPct', value: hi * 3, rolls: 3 }] });
    const flat = item({ subs: [{ stat: 'atk', value: SUB_ROLL.atk[1], rolls: 1 }] });
    expect(itemScore(b)).toBeGreaterThan(itemScore(a));
    expect(itemScore(flat)).toBeLessThan(itemScore(a));
  });
});

describe('замок и массовый разбор', () => {
  it('предмет под замком нельзя продать или разобрать', () => {
    const it1 = item();
    const s = save([it1]);
    expect(toggleLock(s, it1.uid)).toBe(true);
    expect(sellItem(s, it1.uid)).toBe('locked');
    expect(salvageItem(s, it1.uid)).toBe('locked');
    expect(toggleLock(s, it1.uid)).toBe(false);
    expect(typeof sellItem(s, it1.uid)).toBe('number');
  });

  it('массовый разбор не трогает надетые, под замком и лучше фильтра', () => {
    const common = item({ rarity: 'common' });
    const rareUp = item({ rarity: 'rare', level: 6 });
    const locked = item({ rarity: 'common', locked: true });
    const worn = item({ rarity: 'common', heroUid: 'h1' });
    const epic = item({ rarity: 'epic' });
    const good = item({ rarity: 'rare', subs: [{ stat: 'spd', value: 12, rolls: 3 }] });
    const s = save([common, rareUp, locked, worn, epic, good]);
    const f = { maxRarity: 'rare' as const, maxLevel: 3, keepScore: 20 };
    expect(massSalvagePreview(s, f).items.map((i) => i.uid)).toEqual([common.uid]);
    const ore = s.materials.ore;
    const r = massSalvage(s, f);
    expect(r.count).toBe(1);
    expect(s.materials.ore).toBe(ore + r.ore);
    expect(s.items).toHaveLength(5);
  });
});

describe('перековка', () => {
  it('с +12, одна на предмет, число срабатываний сохраняется', () => {
    const it1 = item({
      level: 11,
      subs: [
        { stat: 'atkPct', value: 0.09, rolls: 3 },
        { stat: 'hp', value: 100, rolls: 1 },
      ],
    });
    const s = save([it1]);
    expect(reforgeSub(s, it1.uid, 0)).toBe('level');
    it1.level = 12;
    const gold = s.currencies.gold;
    const cost = reforgeCost(it1);
    const r = reforgeSub(s, it1.uid, 0);
    expect(typeof r).toBe('object');
    const sub = it1.subs[0]!;
    expect(sub.reforged).toBe(true);
    expect(sub.rolls).toBe(3);
    expect(['atk', 'atkPct', 'hp']).not.toContain(sub.stat);
    const [lo, hi] = SUB_ROLL[sub.stat as keyof typeof SUB_ROLL];
    expect(sub.value).toBeGreaterThanOrEqual(lo * 3);
    expect(sub.value).toBeLessThanOrEqual(hi * 3);
    expect(s.currencies.gold).toBe(gold - cost.gold);
    expect(reforgeSub(s, it1.uid, 1)).toBe('already');
  });
});

describe('подбор снаряжения', () => {
  it('берёт ценное под роль, не снимает с других героев, собирает сет', () => {
    const s = save([]);
    const attacker = s.heroes.find((h) => h.heroId === 'chirk') ?? s.heroes[0]!;
    const other = s.heroes.find((h) => h.uid !== attacker.uid)!;
    const strong = (slot: string, set = 'fury') =>
      item({
        slot,
        set,
        main: slot === 'weapon' ? 'atk' : slot === 'helmet' ? 'hp' : slot === 'armor' ? 'def' : 'atkPct',
        subs: [{ stat: 'critRate', value: 0.12, rolls: 3 }],
      });
    const weak = (slot: string) =>
      item({ slot, set: 'life', rarity: 'common', main: slot === 'weapon' ? 'atk' : 'hp' });
    const onOther = strong('gloves', 'fury');
    onOther.heroUid = other.uid;
    s.items = [
      strong('weapon'),
      strong('helmet'),
      strong('armor'),
      weak('gloves'),
      strong('boots', 'swift'),
      weak('weapon'),
      onOther,
    ];
    const best = bestGearFor(s, attacker.uid);
    expect(best.get('weapon')!.rarity).toBe('epic');
    expect([...best.values()].some((i) => i.uid === onOther.uid)).toBe(false);
    const n = autoEquip(s, attacker.uid);
    expect(n).toBe(best.size);
    expect(s.items.filter((i) => i.heroUid === attacker.uid)).toHaveLength(best.size);
    expect(onOther.heroUid).toBe(other.uid);
    // Повторный подбор ничего не меняет.
    expect(autoEquip(s, attacker.uid)).toBe(0);
    equip(s, onOther.uid, other.uid);
  });
});

describe('сводка наград и миграция', () => {
  it('числа складываются, предметы считаются', () => {
    const merged = mergeRewardLines([
      [
        { icon: 'gold', label: 'Золото', value: '+1 200' },
        { icon: 'item', label: 'Оружие · Ярость', value: 'Эпический' },
        { icon: 'star', label: 'Руда', value: '×3' },
        { icon: 'star', label: 'Уровень игрока', value: '5' },
      ],
      [
        { icon: 'gold', label: 'Золото', value: '+800' },
        { icon: 'item', label: 'Оружие · Ярость', value: 'Эпический' },
        { icon: 'star', label: 'Руда', value: '×2' },
        { icon: 'star', label: 'Уровень игрока', value: '6' },
      ],
    ]);
    const get = (l: string) => merged.find((x) => x.label === l)!.value;
    expect(get('Золото').replace(/\s/g, '')).toBe('+2000');
    expect(get('Руда')).toBe('×5');
    expect(get('Уровень игрока')).toBe('6');
    expect(get('Оружие · Ярость')).toBe('Эпический ×2');
  });

  it('v9: у предметов появляется замок', () => {
    const raw = migrate({ version: 8, items: [{ uid: 'a', slot: 'weapon', main: 'atk' }] });
    expect((raw.items as Item[])[0]!.locked).toBe(false);
  });
});
