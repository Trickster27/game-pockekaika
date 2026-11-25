import { useState } from 'react';
import { MATERIAL_IDS } from '@/save/schema';
import { SETS, SLOTS, SLOT_NAME, type SetId, type Slot } from '@/content/gear';
import { INVENTORY_LIMIT, itemScore, massSalvage, massSalvagePreview, type MassFilter } from '@/game';
import { RARITY_ORDER, type Rarity } from '@/core/types';
import { RARITY_COLOR } from '../colors';
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
  const [set, setSet] = useState<SetId | 'all'>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState<'score' | 'level' | 'rarity'>('rarity');
  const [mass, setMass] = useState(false);
  const items = save.items
    .filter(
      (i) =>
        (slot === 'all' || i.slot === slot) &&
        (set === 'all' || i.set === set) &&
        (rarity === 'all' || i.rarity === rarity) &&
        (!freeOnly || !i.heroUid),
    )
    .sort((a, b) =>
      sort === 'score'
        ? itemScore(b) - itemScore(a)
        : sort === 'level'
          ? b.level - a.level || RANK[b.rarity] - RANK[a.rarity]
          : RANK[b.rarity] - RANK[a.rarity] || b.level - a.level,
    );
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
          <div className="chips" style={{ marginBottom: 8 }}>
            <button type="button" aria-pressed={set === 'all'} onClick={() => setSet('all')}>
              {t('gear.allSets')}
            </button>
            {SETS.map((x) => (
              <button key={x.id} type="button" aria-pressed={set === x.id} onClick={() => setSet(x.id)}>
                <i style={{ ['--c' as string]: x.color }} />
                {x.name}
              </button>
            ))}
          </div>
          <div className="chips" style={{ marginBottom: 8 }}>
            {(['all', ...RARITY_ORDER] as const).map((r) => (
              <button key={r} type="button" aria-pressed={rarity === r} onClick={() => setRarity(r)}>
                {r !== 'all' && <i style={{ ['--c' as string]: RARITY_COLOR[r] }} />}
                {r === 'all' ? t('bag.all') : t(`labels.rarity.${r}`)}
              </button>
            ))}
            <button type="button" aria-pressed={freeOnly} onClick={() => setFreeOnly((v) => !v)}>
              {t('gear.free')}
            </button>
          </div>
          <div className="chips" style={{ marginBottom: 12 }}>
            {(['rarity', 'level', 'score'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>
                {t(`gear.sort${k[0]!.toUpperCase()}${k.slice(1)}`)}
              </button>
            ))}
            <button type="button" onClick={() => setMass(true)}>
              ♻ {t('gear.mass')}
            </button>
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
                {it.locked && <span className="lk">🔒</span>}
                <GearIcon item={it} />
                {sort === 'score' && <span className="sc">{itemScore(it)}</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {open && <ItemSheet uid={open} onClose={() => setOpen(null)} />}
      {mass && <MassSalvage onClose={() => setMass(false)} />}
    </>
  );
}

function MassSalvage({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [f, setF] = useState<MassFilter>({ maxRarity: 'rare', maxLevel: 0, keepScore: 0 });
  const prev = massSalvagePreview(save, f);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet2" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18 }}>{t('gear.mass')}</h3>
        <small className="screen-sub" style={{ margin: 0 }}>
          {t('gear.massHint')}
        </small>
        <span className="screen-sub" style={{ margin: 0 }}>
          {t('gear.massRarity')}
        </span>
        <div className="chips">
          {RARITY_ORDER.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={f.maxRarity === r}
              onClick={() => setF({ ...f, maxRarity: r })}
            >
              <i style={{ ['--c' as string]: RARITY_COLOR[r] }} />
              {t(`labels.rarity.${r}`)}
            </button>
          ))}
        </div>
        <label className="screen-sub" style={{ margin: 0, display: 'grid', gap: 4 }}>
          {t('gear.massLevel', { n: f.maxLevel })}
          <input
            type="range"
            min={0}
            max={15}
            value={f.maxLevel}
            onChange={(e) => setF({ ...f, maxLevel: Number(e.target.value) })}
          />
        </label>
        <label className="screen-sub" style={{ margin: 0, display: 'grid', gap: 4 }}>
          {f.keepScore > 0 ? t('gear.massScore', { n: f.keepScore }) : t('gear.massKeepOff')}
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={f.keepScore}
            onChange={(e) => setF({ ...f, keepScore: Number(e.target.value) })}
          />
        </label>
        <button
          type="button"
          className="btn btn--gold"
          disabled={prev.items.length === 0}
          onClick={() => {
            let r = { count: 0, ore: 0 };
            updateSave((s) => {
              r = massSalvage(s, f);
            });
            showToast(t('gear.massDone', { n: r.count, ore: r.ore }));
            onClose();
          }}
        >
          {prev.items.length
            ? t('gear.massGo', { n: prev.items.length, ore: formatNumber(prev.ore) })
            : t('gear.massNone')}
        </button>
      </div>
    </div>
  );
}
