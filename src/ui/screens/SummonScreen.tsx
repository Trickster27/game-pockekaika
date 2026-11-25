import { useState } from 'react';
import {
  trackQuest,
  PITY_EPIC,
  PITY_LEGENDARY,
  SUMMON_COST,
  SUMMON_RATES,
  summon,
  type SummonPay,
} from '@/game';
import { RARITY_ORDER } from '@/core';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import type { OwnedHero } from '@/save/schema';
import { SummonReveal } from '../components/SummonReveal';
import { RARITY_COLOR } from '../colors';
import { IconShard } from '../components/icons';
import { MaterialIcon } from '../components/MaterialIcon';
import './screens.css';
import './heroes.css';
import './summon.css';

export default function SummonScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [result, setResult] = useState<{ heroes: OwnedHero[]; newIds: Set<string>; leg: boolean } | null>(
    null,
  );
  const [last, setLast] = useState<{ count: 1 | 10; pay: SummonPay } | null>(null);
  const p = platform();

  const doSummon = (count: 1 | 10, pay: SummonPay) => {
    if (result) return;
    const ownedBefore = new Set(save.heroes.map((h) => h.heroId));
    let res: ReturnType<typeof summon> = 'noShards';
    updateSave((s) => {
      res = summon(s, count, pay, Date.now());
      if (typeof res !== 'string') trackQuest(s, 'summon', count);
    });
    if (typeof res === 'string') {
      showToast(t(`summon.${res}`));
      p.haptics.notify('warning');
      return;
    }
    const r = res as Exclude<ReturnType<typeof summon>, string>;
    setLast({ count, pay });
    setResult({
      heroes: r.heroes,
      newIds: new Set(r.heroes.map((h) => h.heroId).filter((id) => !ownedBefore.has(id))),
      leg: r.rarities.includes('legendary'),
    });
  };

  const legLeft = PITY_LEGENDARY - save.summon.sinceLegendary;
  const epicLeft = PITY_EPIC - save.summon.sinceEpic;

  return (
    <>
      <h2 className="screen-title">{t('summon.title')}</h2>
      <p className="screen-sub">{t('summon.subtitle')}</p>
      <section className="altar">
        <svg className="crystal" viewBox="0 0 100 120" aria-hidden="true">
          <g stroke="#0a0710" strokeWidth="3" strokeLinejoin="round">
            <path d="M50 4 L20 50 L50 116 L80 50 Z" fill="#a37cff" />
            <path d="M50 4 L20 50 L50 50 Z" fill="#d6b8ff" />
            <path d="M50 116 L80 50 L50 50 Z" fill="#6a3ac6" />
            <path d="M50 4 L80 50 L50 50 Z" fill="#b48cff" />
          </g>
        </svg>
        <div className="pity">
          <span>{t('summon.pityLeg', { n: legLeft })}</span>
          <div className="bar">
            <i style={{ width: `${(save.summon.sinceLegendary / PITY_LEGENDARY) * 100}%` }} />
          </div>
          <span>{t('summon.pityEpic', { n: epicLeft })}</span>
        </div>
      </section>
      <div className="sum-btns">
        <button type="button" className="btn" onClick={() => doSummon(1, 'shards')}>
          {t('summon.one')}
          <small>
            <IconShard /> {SUMMON_COST.shards}
          </small>
        </button>
        <button type="button" className="btn btn--gold" onClick={() => doSummon(10, 'shards')}>
          {t('summon.ten')}
          <small>
            <IconShard /> {SUMMON_COST.shards10}
          </small>
        </button>
        <button
          type="button"
          className="btn"
          disabled={save.materials.scroll < 1}
          data-tut="summon-scroll"
          onClick={() => doSummon(1, 'scroll')}
        >
          {t('summon.scroll1')}
          <small>
            <MaterialIcon id="scroll" /> {t('summon.scrolls', { n: save.materials.scroll })}
          </small>
        </button>
        <button
          type="button"
          className="btn"
          disabled={save.materials.scroll < 10}
          onClick={() => doSummon(10, 'scroll')}
        >
          {t('summon.scroll10')}
          <small>
            <MaterialIcon id="scroll" /> 10
          </small>
        </button>
      </div>
      <section className="card">
        <b style={{ display: 'block', marginBottom: 8 }}>{t('summon.rates')}</b>
        <div className="rates">
          {RARITY_ORDER.map((r) => (
            <div key={r} style={{ ['--rc' as string]: RARITY_COLOR[r] }}>
              <b>{Math.round(SUMMON_RATES[r] * 100)}%</b>
              {t(`labels.rarity.${r}`)}
            </div>
          ))}
        </div>
        <p className="screen-sub" style={{ margin: '8px 0 0' }}>
          {t('summon.total', { n: formatNumber(save.summon.total) })} ·{' '}
          {t('summon.shards', { n: formatNumber(save.currencies.shards) })}
        </p>
      </section>

      {result && (
        <SummonReveal
          heroes={result.heroes}
          newIds={result.newIds}
          onClose={() => setResult(null)}
          onAgain={() => {
            setResult(null);
            if (last) doSummon(last.count, last.pay);
          }}
        />
      )}
    </>
  );
}
