import { SETS } from '@/content/gear';
import type { Item } from '@/save/schema';
import { RARITY_COLOR } from '../colors';

const PATHS: Record<string, string> = {
  weapon: 'M6 18 L16 8 L18 3 L13 5 L3 15 Z M3 15 L9 21 M5 13 L11 19',
  helmet: 'M4 15 Q4 4 12 4 Q20 4 20 15 L17 18 L7 18 Z M7 12 L17 12',
  armor: 'M5 6 L9 4 Q12 6 15 4 L19 6 L18 20 L6 20 Z M12 8 L12 18',
  gloves: 'M7 21 L7 11 L8 5 L10 5 L10 10 L11 4 L13 4 L13 10 L14 5 L16 5 L16 11 L18 9 L19 11 L16 17 L16 21 Z',
  boots: 'M8 3 L14 3 L14 14 L20 16 L20 21 L6 21 L6 14 Z',
  amulet: 'M6 3 Q12 10 18 3 M12 10 L12 12 M12 12 L7 17 L12 22 L17 17 Z',
};

/** Иконка предмета: силуэт слота в цвете сета, рамка по редкости. */
export function GearIcon({ item, slot, size = 44 }: { item?: Item; slot?: string; size?: number }) {
  const s = item?.slot ?? slot ?? 'weapon';
  const color = item ? (SETS.find((x) => x.id === item.set)?.color ?? '#ccc') : '#5a5070';
  const border = item ? RARITY_COLOR[item.rarity] : '#3a3147';
  return (
    <span
      className="gicon"
      style={{ width: size, height: size, ['--gc' as string]: color, ['--gb' as string]: border }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={PATHS[s]}
          fill={item ? color : 'none'}
          fillOpacity={item ? 0.85 : 0}
          stroke={item ? '#0a0710' : '#5a5070'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {item && item.level > 0 && <b>+{item.level}</b>}
    </span>
  );
}
