import type { Currencies } from '@/save/schema';

export const ENERGY_MAX = 120;
/** Одна единица энергии раз в 4 минуты (лагерь 1 уровня; выше — быстрее, см. camp.ts). */
export const ENERGY_REGEN_MS = 4 * 60 * 1000;

/**
 * Пересчитывает энергию на момент now. Восстановление идёт только до максимума;
 * то, что выше максимума (награды), не сгорает.
 */
export function regenEnergy(c: Currencies, now: number, regenMs = ENERGY_REGEN_MS): void {
  if (c.energy >= ENERGY_MAX) {
    c.energyUpdatedAt = now;
    return;
  }
  const elapsed = Math.max(0, now - c.energyUpdatedAt);
  const gained = Math.floor(elapsed / regenMs);
  if (gained <= 0) return;
  c.energy = Math.min(ENERGY_MAX, c.energy + gained);
  c.energyUpdatedAt = c.energy >= ENERGY_MAX ? now : c.energyUpdatedAt + gained * regenMs;
}

/** Через сколько мс придёт следующая единица (0, если энергия полная). */
export function nextEnergyIn(c: Currencies, now: number, regenMs = ENERGY_REGEN_MS): number {
  if (c.energy >= ENERGY_MAX) return 0;
  return Math.max(0, regenMs - ((now - c.energyUpdatedAt) % regenMs));
}

export function spendEnergy(c: Currencies, amount: number, now: number, regenMs = ENERGY_REGEN_MS): boolean {
  regenEnergy(c, now, regenMs);
  if (c.energy < amount) return false;
  const wasFull = c.energy >= ENERGY_MAX;
  c.energy -= amount;
  if (wasFull && c.energy < ENERGY_MAX) c.energyUpdatedAt = now;
  return true;
}
