import { SETS, SLOT_NAME, STAT_NAME, formatStat, bonusText, type GearStat } from '@/content/gear';
import { mainValue } from '@/game';
import { useT } from '@/i18n';
import type { Item } from '@/save/schema';
import { RARITY_COLOR } from '../colors';
import { GearIcon } from './GearIcon';

/** Подробности предмета: основная и дополнительные характеристики, бонусы сета. */
export function ItemDetails({ item }: { item: Item }) {
  const t = useT();
  const set = SETS.find((s) => s.id === item.set);
  return (
    <div className="idet">
      <div className="idet__head">
        <GearIcon item={item} size={56} />
        <div>
          <b style={{ color: RARITY_COLOR[item.rarity] }}>
            {SLOT_NAME[item.slot as keyof typeof SLOT_NAME]} {item.level > 0 ? `+${item.level}` : ''}
          </b>
          <span>
            {t(`labels.rarity.${item.rarity}`)} · {set ? t('gear.set', { name: set.name }) : ''}
          </span>
        </div>
      </div>
      <div className="idet__main">
        <span>{STAT_NAME[item.main as GearStat]}</span>
        <b>{formatStat(item.main as GearStat, mainValue(item))}</b>
      </div>
      {item.subs.map((s) => (
        <div className="idet__sub" key={s.stat}>
          <span>
            {STAT_NAME[s.stat as GearStat]}
            {s.rolls > 1 ? ` (${s.rolls})` : ''}
          </span>
          <b>{formatStat(s.stat as GearStat, s.value)}</b>
        </div>
      ))}
      {set && (
        <p className="idet__set" style={{ color: set.color }}>
          {t('gear.set2', { b: bonusText(set.two) })}
          <br />
          {t('gear.set4', { b: bonusText(set.four) })}
        </p>
      )}
    </div>
  );
}
