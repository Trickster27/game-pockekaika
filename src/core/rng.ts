/**
 * Детерминированный генератор (mulberry32). Один и тот же seed даёт одну и ту же
 * последовательность — на этом держатся тесты и повторы боёв.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Текущее внутреннее состояние: можно сохранить и продолжить с того же места. */
  get state(): number {
    return this.s;
  }

  static fromState(state: number): Rng {
    const r = new Rng(0);
    r.s = state >>> 0;
    return r;
  }

  /** Число в [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Целое в [min, max] включительно. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: пустой массив');
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /** Выбор по весам. */
  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
    let roll = this.next() * total;
    for (const i of items) {
      roll -= Math.max(0, i.weight);
      if (roll < 0) return i.item;
    }
    return items[items.length - 1]!.item;
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }
}

/** Seed из строки (например, id этапа + день), чтобы генерация была стабильной. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
