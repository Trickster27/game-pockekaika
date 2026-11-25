import { useState } from 'react';
import {
  SETS,
  SLOTS,
  SLOT_NAME,
  STAT_NAME,
  formatStat,
  bonusText,
  type GearStat,
  type Slot,
} from '@/content/gear';
import { equip, heroItems, mainValue, setCounts } from '@/game';
import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { heroDef } from '@/content';
import type { OwnedHero } from '@/save/schema';
import { GearIcon } from './GearIcon';
import { ItemSheet } from './ItemSheet';

const RANK = { legendary: 3, epic: 2, rare: 1, common: 0 } as const;

/** 6 слотов снаряжения героя, активные сеты и выбор предмета для слота. */
export function HeroGear({ hero }: { hero: OwnedHero }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const [pickSlot, setPickSlot] = useState<Slot | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const items = heroItems(save, hero.uid);
  const bySlot = new Map(items.map((i) => [i.slot, i]));
  const sets = [...setCounts(items).entries()].filter(([, n]) => n >= 2);
  const candidates = pickSlot
    ? save.items
        .filter((i) => i.slot === pickSlot)
        .sort((a, b) => RANK[b.rarity] - RANK[a.rarity] || b.level - a.level)
    : [];
  return (
    <section className="card">
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('heroes.gear')}</h3>
      <div className="gear6">
        {SLOTS.map((slot) => {
          const it = bySlot.get(slot);
          return (
            <button
              key={slot}
              type="button"
              onClick={() => (it ? setOpenItem(it.uid) : setPickSlot(slot))}
              aria-label={SLOT_NAME[slot]}
            >
              <GearIcon item={it} slot={slot} />
              {SLOT_NAME[slot]}
            </button>
          );
        })}
      </div>
      {sets.map(([id, n]) => {
        const set = SETS.find((s) => s.id === id)!;
        return (
          <p key={id} className="set-line" style={{ color: set.color }}>
            {t('gear.set', { name: set.name })} ({n}): {bonusText(set.two)}
            {n >= 4 ? `; ${bonusText(set.four)}` : ''}
          </p>
        );
      })}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {SLOTS.filter((s) => !bySlot.has(s)).map((s) => (
            <button
              key={s}
              type="button"
              className="btn"
              style={{ minHeight: 34, fontSize: 12 }}
              onClick={() => setPickSlot(s)}
            >
              + {SLOT_NAME[s]}
            </button>
          ))}
          {SLOTS.filter((s) => bySlot.has(s)).map((s) => (
            <button
              key={s}
              type="button"
              className="btn"
              style={{ minHeight: 34, fontSize: 12 }}
              onClick={() => setPickSlot(s)}
            >
              ⇄ {SLOT_NAME[s]}
            </button>
          ))}
        </div>
      )}
      {pickSlot && (
        <div className="sheet-bg" onClick={() => setPickSlot(null)}>
          <div className="sheet2" onClick={(e) => e.stopPropagation()}>
            <h3>{t('gear.pick', { slot: SLOT_NAME[pickSlot] })}</h3>
            {candidates.length === 0 && <p className="screen-sub">{t('gear.none')}</p>}
            {candidates.map((it) => {
              const owner = it.heroUid ? save.heroes.find((h) => h.uid === it.heroUid) : null;
              const set = SETS.find((s) => s.id === it.set);
              return (
                <button
                  key={it.uid}
                  type="button"
                  className="pick-row"
                  style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)' }}
                  onClick={() => {
                    updateSave((s) => {
                      equip(s, it.uid, hero.uid);
                    });
                    platform().audio.play('tap');
                    setPickSlot(null);
                  }}
                >
                  <GearIcon item={it} size={52} />
                  <div>
                    <b>
                      {STAT_NAME[it.main as GearStat]} {formatStat(it.main as GearStat, mainValue(it))}
                    </b>
                    {set?.name} ·{' '}
                    {it.subs
                      .map(
                        (x) => `${STAT_NAME[x.stat as GearStat]} ${formatStat(x.stat as GearStat, x.value)}`,
                      )
                      .join(', ') || '—'}
                    {owner && owner.uid !== hero.uid
                      ? ` · ${t('gear.equippedBy', { name: heroDef(owner.heroId).name })}`
                      : ''}
                  </div>
                  <span className="btn" style={{ minHeight: 34 }}>
                    {it.heroUid === hero.uid ? '✓' : t('gear.equip')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {openItem && <ItemSheet uid={openItem} onClose={() => setOpenItem(null)} />}
    </section>
  );
}
