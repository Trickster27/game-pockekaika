import type { MaterialId, SaveData } from '@/save/schema';
import { regenEnergy } from './energy';

/**
 * Магазин. Сейчас всё покупается за внутриигровую валюту.
 * Предложения с price.kind === 'real' — место под настоящие покупки: их обработает
 * отдельный провайдер (Google Play Billing / App Store через RevenueCat или Capacitor-плагин),
 * а игровая часть (выдача награды) останется той же — grantReward().
 */
export interface ShopReward {
  gold?: number;
  shards?: number;
  energy?: number;
  materials?: Partial<Record<MaterialId, number>>;
}

export type ShopPrice =
  | { kind: 'gold'; amount: number }
  | { kind: 'shards'; amount: number }
  | { kind: 'real'; productId: string; display: string };

export interface ShopOffer {
  id: string;
  name: string;
  desc: string;
  icon: 'energy' | 'scroll' | 'tome' | 'dust' | 'stone' | 'gold' | 'pack';
  price: ShopPrice;
  reward: ShopReward;
  /** Лимит покупок за период. */
  limit?: { per: 'day' | 'week'; count: number };
}

export const SHOP_OFFERS: ShopOffer[] = [
  {
    id: 'energy60',
    name: 'Флакон бодрости',
    desc: '+60 энергии',
    icon: 'energy',
    price: { kind: 'shards', amount: 50 },
    reward: { energy: 60 },
    limit: { per: 'day', count: 3 },
  },
  {
    id: 'scroll1',
    name: 'Свиток призыва',
    desc: 'Один призыв героя',
    icon: 'scroll',
    price: { kind: 'shards', amount: 90 },
    reward: { materials: { scroll: 1 } },
    limit: { per: 'day', count: 5 },
  },
  {
    id: 'tome5',
    name: 'Тома опыта ×5',
    desc: `По ${1500} опыта герою`,
    icon: 'tome',
    price: { kind: 'gold', amount: 6000 },
    reward: { materials: { xpTome: 5 } },
    limit: { per: 'day', count: 4 },
  },
  {
    id: 'dust10',
    name: 'Звёздная пыль ×10',
    desc: 'Для повышения звёзд',
    icon: 'dust',
    price: { kind: 'gold', amount: 12000 },
    reward: { materials: { starDust: 10 } },
    limit: { per: 'day', count: 3 },
  },
  {
    id: 'stone5',
    name: 'Камни пробуждения ×5',
    desc: 'Для пробуждения героев',
    icon: 'stone',
    price: { kind: 'shards', amount: 220 },
    reward: { materials: { awakenStone: 5 } },
    limit: { per: 'week', count: 2 },
  },
  {
    id: 'gold20k',
    name: 'Мешок золота',
    desc: '+20 000 золота',
    icon: 'gold',
    price: { kind: 'shards', amount: 120 },
    reward: { gold: 20000 },
    limit: { per: 'day', count: 2 },
  },
  {
    id: 'starter',
    name: 'Набор Хранителя',
    desc: '1 000 осколков, 10 свитков, 20 томов',
    icon: 'pack',
    price: { kind: 'real', productId: 'kaelmor.starter_pack', display: 'скоро' },
    reward: { shards: 1000, materials: { scroll: 10, xpTome: 20 } },
  },
];

/** Ключ периода по UTC: день или ISO-неделя. */
export function periodKey(per: 'day' | 'week', now: number): string {
  const d = new Date(now);
  if (per === 'day') return d.toISOString().slice(0, 10);
  const day = Math.floor(now / 86_400_000);
  return `w${Math.floor((day + 3) / 7)}`;
}

export function boughtCount(save: SaveData, offer: ShopOffer, now: number): number {
  if (!offer.limit) return 0;
  const rec = save.shop.bought[offer.id];
  return rec && rec.period === periodKey(offer.limit.per, now) ? rec.count : 0;
}

export function grantReward(save: SaveData, r: ShopReward, now: number) {
  if (r.gold) save.currencies.gold += r.gold;
  if (r.shards) save.currencies.shards += r.shards;
  if (r.energy) {
    regenEnergy(save.currencies, now);
    save.currencies.energy += r.energy;
  }
  for (const [k, v] of Object.entries(r.materials ?? {}) as [MaterialId, number][]) save.materials[k] += v;
}

export type BuyError = 'soldOut' | 'noGold' | 'noShards' | 'realMoney';

/** Покупка за внутриигровую валюту. Предложения за реальные деньги проходят через StoreProvider. */
export function buyOffer(save: SaveData, offerId: string, now = Date.now()): true | BuyError {
  const offer = SHOP_OFFERS.find((o) => o.id === offerId);
  if (!offer) return 'soldOut';
  if (offer.price.kind === 'real') return 'realMoney';
  if (offer.limit && boughtCount(save, offer, now) >= offer.limit.count) return 'soldOut';
  if (offer.price.kind === 'gold') {
    if (save.currencies.gold < offer.price.amount) return 'noGold';
    save.currencies.gold -= offer.price.amount;
  } else {
    if (save.currencies.shards < offer.price.amount) return 'noShards';
    save.currencies.shards -= offer.price.amount;
  }
  grantReward(save, offer.reward, now);
  if (offer.limit)
    save.shop.bought[offer.id] = {
      period: periodKey(offer.limit.per, now),
      count: boughtCount(save, offer, now) + 1,
    };
  return true;
}
