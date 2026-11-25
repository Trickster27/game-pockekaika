/**
 * Провайдер покупок за реальные деньги. Сейчас подключена заглушка: настоящие покупки выключены.
 * Чтобы включить IAP: реализуйте этот интерфейс через плагин (например, RevenueCat или
 * cordova-plugin-purchase) и проверку чеков на сервере, а выдачу награды делайте через grantReward().
 */
export interface StoreProduct {
  productId: string;
  priceText: string;
}

export type PurchaseOutcome =
  | { ok: true; productId: string; transactionId: string }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' };

export interface StoreProvider {
  readonly available: boolean;
  products(ids: string[]): Promise<StoreProduct[]>;
  purchase(productId: string): Promise<PurchaseOutcome>;
  restore(): Promise<string[]>;
}

export class DisabledStoreProvider implements StoreProvider {
  readonly available = false;
  async products() {
    return [];
  }
  async purchase(): Promise<PurchaseOutcome> {
    return { ok: false, reason: 'unavailable' };
  }
  async restore() {
    return [];
  }
}
