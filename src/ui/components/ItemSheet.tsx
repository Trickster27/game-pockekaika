import { heroDef } from '@/content';
import {
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
