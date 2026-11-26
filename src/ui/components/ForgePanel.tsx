import { useState } from 'react';
import { RARITY_ORDER } from '@/core';
import type { Rarity } from '@/core/types';
import {
  SETS,
  SKY_SETS,
  SLOTS,
  SLOT_MAIN,
  SLOT_NAME,
  STAT_NAME,
  bonusText,
  type SetId,
  type Slot,
} from '@/content/gear';
import { CRAFT_COST, craftItem } from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { RARITY_COLOR } from '../colors';
import { GearIcon } from './GearIcon';
import { IconGold } from './icons';
import { MaterialIcon } from './MaterialIcon';
import { ItemSheet } from './ItemSheet';

const RARITY_INDEX = { common: 0, rare: 1, epic: 2, legendary: 3 } as const;

/** Кузня: выбрать слот, сет и редкость — и выковать предмет. */
export function ForgePanel() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [slot, setSlot] = useState<Slot>('weapon');
  const [set, setSet] = useState<SetId>('fury');
  const [rarity, setRarity] = useState<Rarity>('rare');
  const [made, setMade] = useState<string | null>(null);
  const cost = CRAFT_COST[rarity];
  const setDef = SETS.find((s) => s.id === set)!;
  const canPay = save.currencies.gold >= cost.gold && save.materials.ore >= cost.ore;

  const craft = () => {
    const out: { r: ReturnType<typeof craftItem> } = { r: 'notFound' };
    updateSave((s) => {
      out.r = craftItem(s, slot, set, rarity);
    });
    if (typeof out.r === 'string') {
      showToast(t(`forge.err.${out.r}`));
      platform().haptics.notify('warning');
      return;
    }
    platform().audio.play('crit');
    platform().haptics.impact('heavy');
    showToast(t('forge.done', { name: SLOT_NAME[slot] }));
    setMade(out.r.uid);
  };

  return (
    <section className="forge">
      <p className="screen-sub" style={{ margin: 0 }}>
        {t('forge.hint')}
      </p>
      <p className="forge__have">
        <MaterialIcon id="ore" /> {t('forge.have', { n: formatNumber(save.materials.ore) })}
      </p>
      <b>{t('forge.slot')}</b>
      <div className="forge__slots">
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={slot === s}
            onClick={() => setSlot(s)}
            aria-label={SLOT_NAME[s]}
          >
            <GearIcon slot={s} size={40} />
            {SLOT_NAME[s]}
          </button>
        ))}
      </div>
      <b>{t('forge.set')}</b>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {SETS.filter((s) => !SKY_SETS.includes(s.id)).map((s) => (
          <button key={s.id} type="button" aria-pressed={set === s.id} onClick={() => setSet(s.id)}>
            <i style={{ ['--c' as string]: s.color }} />
            {s.name}
          </button>
        ))}
      </div>
      <p className="set-line" style={{ color: setDef.color, margin: 0 }}>
        2: {bonusText(setDef.two)} · 4: {bonusText(setDef.four)}
      </p>
      <b>{t('forge.rarity')}</b>
      <div className="chips">
        {RARITY_ORDER.map((r) => (
          <button key={r} type="button" aria-pressed={rarity === r} onClick={() => setRarity(r)}>
            <i style={{ ['--c' as string]: RARITY_COLOR[r] }} />
            {t(`labels.rarity.${r}`)}
          </button>
        ))}
      </div>
      <p className="screen-sub" style={{ margin: 0 }}>
        {t('forge.mainStats', { list: [...new Set(SLOT_MAIN[slot].map((m) => STAT_NAME[m]))].join(', ') })} ·{' '}
        {t('forge.subs', { n: RARITY_INDEX[rarity] })}
      </p>
      <button type="button" className="btn btn--gold" disabled={!canPay} onClick={craft}>
        {t('forge.craft')} · <IconGold /> {formatNumber(cost.gold)} · <MaterialIcon id="ore" /> {cost.ore}
      </button>
      {made && <ItemSheet uid={made} onClose={() => setMade(null)} />}
    </section>
  );
}
