import type { RewardLine } from './store';

/** Разбирает «+1 234», «×3», «+15» в число; иначе null. */
function parse(v: string): { n: number; prefix: string } | null {
  const m = /^([+×]?)\s*([\d\s\u00a0\u202f]+)$/.exec(v.trim());
  if (!m) return null;
  const n = Number(m[2]!.replace(/[\s\u00a0\u202f]/g, ''));
  return Number.isFinite(n) ? { n, prefix: m[1] ?? '' } : null;
}

const fmt = (n: number) => n.toLocaleString('ru-RU');

/**
 * Сводка наград за несколько боёв: числа по одной строке складываются,
 * нечисловые (предметы, «повышение уровня») считаются штуками.
 */
export function mergeRewardLines(runs: RewardLine[][]): RewardLine[] {
  const out = new Map<
    string,
    { line: RewardLine; sum: number; prefix: string; count: number; numeric: boolean; last: string }
  >();
  for (const lines of runs)
    for (const l of lines) {
      const p = parse(l.value);
      const key = p ? `${l.icon}|${l.label}` : `${l.icon}|${l.label}|${l.value}`;
      const cur = out.get(key);
      if (cur) {
        cur.sum += p?.n ?? 0;
        cur.count += 1;
        cur.last = l.value;
      } else
        out.set(key, {
          line: l,
          sum: p?.n ?? 0,
          prefix: p?.prefix ?? '',
          count: 1,
          numeric: !!p,
          last: l.value,
        });
    }
  return [...out.values()].map(({ line, sum, prefix, count, numeric, last }) => ({
    ...line,
    // «+N» и «×N» складываются; число без знака (уровень игрока) — берётся последнее.
    value: numeric
      ? prefix
        ? `${prefix}${fmt(sum)}`
        : last
      : count > 1
        ? `${line.value} ×${count}`
        : line.value,
  }));
}
