import { useState } from 'react';
import { MATERIAL_IDS } from '@/save/schema';
import { SLOTS, SLOT_NAME, type Slot } from '@/content/gear';
import { INVENTORY_LIMIT } from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { MaterialIcon } from '../components/MaterialIcon';
import { GearIcon } from '../components/GearIcon';
import { ItemSheet } from '../components/ItemSheet';
import { ForgePanel } from '../components/ForgePanel';
import './screens.css';
import './summon.css';
import './heroes.css';

const RANK = { legendary: 3, epic: 2, rare: 1, common: 0 } as const;

export default function BagScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const [tab, setTab] = useState<'gear' | 'mats' | 'forge'>('gear');
  const [slot, setSlot] = useState<Slot | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const items = save.items
    .filter((i) => slot === 'all' || i.slot === slot)
    .sort((a, b) => RANK[b.rarity] - RANK[a.rarity] || b.level - a.level);
  return (
    <>
      <h2 className="screen-title">{t('nav.bag')}</h2>
      <div className="chips" style={{ margin: '8px 0 12px' }}>
        <button type="button" aria-pressed={tab === 'gear'} onClick={() => setTab('gear')}>
          {t('bag.gear')} ({t('bag.count', { n: save.items.length, max: INVENTORY_LIMIT })})
        </button>
        <button type="button" aria-pressed={tab === 'forge'} onClick={() => setTab('forge')}>
          {t('bag.forge')}
        </button>
        <button type="button" aria-pressed={tab === 'mats'} onClick={() => setTab('mats')}>
          {t('bag.materials')}
        </button>
      </div>
      {tab === 'forge' ? (
        <ForgePanel />
      ) : tab === 'mats' ? (
        <div className="mats">
          {MATERIAL_IDS.map((id) => (
            <div className="mat" key={id}>
              <MaterialIcon id={id} />
              <div>
                <b>{formatNumber(save.materials[id])}</b>
                <span>{t(`labels.material.${id}`)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="chips" style={{ marginBottom: 12 }}>
            <button type="button" aria-pressed={slot === 'all'} onClick={() => setSlot('all')}>
              {t('bag.all')}
            </button>
            {SLOTS.map((s) => (
              <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}>
                {SLOT_NAME[s]}
              </button>
            ))}
          </div>
          {items.length === 0 && <p className="screen-sub">{t('bag.empty')}</p>}
          <div className="glist">
            {items.map((it) => (
              <button
                key={it.uid}
                type="button"
                onClick={() => setOpen(it.uid)}
                aria-label={SLOT_NAME[it.slot as Slot]}
              >
                {it.heroUid && <span className="eq" />}
                <GearIcon item={it} />
              </button>
            ))}
          </div>
        </>
      )}
      {open && <ItemSheet uid={open} onClose={() => setOpen(null)} />}
    </>
  );
}
