import { SETS } from '@/content/gear';
import type { Item } from '@/save/schema';
import { RARITY_COLOR } from '../colors';
import { GearArt, GearGhost } from './ItemArt';

/** Иконка предмета: проработанный силуэт слота, металл по редкости, камень и подсветка цвета сета, рамка редкости. */
export function GearIcon({ item, slot, size = 44 }: { item?: Item; slot?: string; size?: number }) {
  const s = item?.slot ?? slot ?? 'weapon';
  const color = item ? (SETS.find((x) => x.id === item.set)?.color ?? '#ccc') : '#5a5070';
  const border = item ? RARITY_COLOR[item.rarity] : '#3a3147';
  return (
    <span
      className={`gicon${item ? ` r-${item.rarity}` : ' is-empty'}`}
      style={{ width: size, height: size, ['--gc' as string]: color, ['--gb' as string]: border }}
    >
      {item ? <GearArt slot={s} rarity={item.rarity} gem={color} /> : <GearGhost slot={s} />}
      {item && item.level > 0 && <b>+{item.level}</b>}
    </span>
  );
}
