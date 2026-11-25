import { useState } from 'react';
import { heroDef } from '@/content';
import { STAT_NAME, formatStat, type GearStat } from '@/content/gear';
import {
  REFORGE_MIN_LEVEL,
  canReforge,
  reforgeCost,
  reforgeSub,
  toggleLock,
  salvageItem,
  salvageValue,
  trackQuest,
  MAX_ITEM_LEVEL,
  sellItem,
  sellPrice,
  unequip,
  upgradeCost,
  upgradeItem,
} from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { IconGold } from './icons';
import { ItemDetails } from './ItemDetails';

/** Нижняя панель предмета: улучшение, снятие, продажа. */
export function ItemSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const item = save.items.find((i) => i.uid === uid);
  if (!item) return null;
  const owner = item.heroUid ? save.heroes.find((h) => h.uid === item.heroUid) : null;
  const p = platform();

  const upgrade = () => {
    const subsBefore = item.subs.length;
    const rollsBefore = item.subs.reduce((a, s) => a + s.rolls, 0);
    const out: { r: ReturnType<typeof upgradeItem> } = { r: 'notFound' };
    updateSave((s) => {
      out.r = upgradeItem(s, uid);
      if (typeof out.r !== 'string') trackQuest(s, 'upgrade');
    });
    if (typeof out.r === 'string') {
      showToast(t(`gear.err.${out.r}`));
      p.haptics.notify('warning');
      return;
    }
    p.audio.play('hit');
    p.haptics.impact('medium');
    if (out.r.subs.length > subsBefore) showToast(t('gear.newSub'));
    else if (out.r.subs.reduce((a, s) => a + s.rolls, 0) > rollsBefore) showToast(t('gear.boosted'));
  };

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet2" onClick={(e) => e.stopPropagation()}>
        <ItemDetails item={item} />
        {owner && (
          <p className="screen-sub" style={{ margin: 0 }}>
            {t('gear.equippedBy', { name: heroDef(owner.heroId).name })}
          </p>
        )}
        <button
          type="button"
          className={`btn${item.locked ? ' is-on' : ''}`}
          onClick={() => {
            let v: boolean | null = null;
            updateSave((s) => {
              v = toggleLock(s, uid);
            });
            showToast(v ? t('gear.lockedOn') : t('gear.lockedOff'));
            p.haptics.impact('light');
          }}
        >
          {item.locked ? `🔓 ${t('gear.unlock')}` : `🔒 ${t('gear.lock')}`}
        </button>
        {canReforge(item) && <Reforge uid={uid} />}
        <button
          type="button"
          className="btn btn--gold"
          disabled={item.level >= MAX_ITEM_LEVEL}
          onClick={upgrade}
        >
          {item.level >= MAX_ITEM_LEVEL ? t('gear.maxed') : t('gear.upgradeTo', { n: item.level + 1 })}
          {item.level < MAX_ITEM_LEVEL && (
            <>
              {' · '}
              <IconGold /> {formatNumber(upgradeCost(item))}
            </>
          )}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: owner ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8 }}>
          {owner && (
            <button type="button" className="btn" onClick={() => updateSave((s) => unequip(s, uid))}>
              {t('gear.unequip')}
            </button>
          )}
          <button
            type="button"
            className="btn"
            disabled={item.locked}
            onClick={() => {
              const ore = salvageValue(item);
              updateSave((s) => {
                salvageItem(s, uid);
              });
              showToast(t('gear.salvaged', { n: ore }));
              onClose();
            }}
          >
            {t('gear.salvage', { n: salvageValue(item) })}
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={item.locked}
            onClick={() => {
              const price = sellPrice(item);
              updateSave((s) => {
                sellItem(s, uid);
              });
              showToast(t('gear.sold', { n: formatNumber(price) }));
              onClose();
            }}
          >
            {t('gear.sell', { n: formatNumber(sellPrice(item)) })}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Перековка одной доп. характеристики (с +12, одна на предмет). */
function Reforge({ uid }: { uid: string }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const item = save.items.find((i) => i.uid === uid)!;
  const cost = reforgeCost(item);
  const run = (idx: number) => {
    let r: ReturnType<typeof reforgeSub> = 'notFound';
    updateSave((s) => {
      r = reforgeSub(s, uid, idx);
    });
    const res = r as ReturnType<typeof reforgeSub>;
    if (typeof res === 'string') {
      showToast(t(`gear.err.${res}`));
      platform().haptics.notify('warning');
      return;
    }
    setOpen(false);
    const sub = res.subs[idx]!;
    showToast(t('gear.reforged', { stat: STAT_NAME[sub.stat as GearStat] }));
    platform().audio.play('reward');
    platform().haptics.notify('success');
  };
  return (
    <div className="reforge">
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>
        ⚒ {t('gear.reforge')}
      </button>
      {open && (
        <>
          <small>{t('gear.reforgeHint', { n: REFORGE_MIN_LEVEL })}</small>
          <small>{t('gear.reforgePick')}</small>
          <div className="reforge__subs">
            {item.subs.map((s, i) => (
              <button
                key={s.stat}
                type="button"
                className="chip"
                disabled={save.currencies.gold < cost.gold || save.materials.ore < cost.ore}
                onClick={() => run(i)}
              >
                {STAT_NAME[s.stat as GearStat]} {formatStat(s.stat as GearStat, s.value)}
              </button>
            ))}
          </div>
          <small>{t('gear.reforgeBtn', { gold: formatNumber(cost.gold), ore: cost.ore })}</small>
        </>
      )}
    </div>
  );
}
