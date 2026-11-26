import { useState } from 'react';
import type { UnitReport } from '@/core/battle';
import { formatNumber, useT } from '@/i18n';
import { unitStillUrl } from '@/assets/art';
import { ELEMENT_COLOR } from '../colors';
import './battlestats.css';

type Metric = 'dealt' | 'healed' | 'taken';

/**
 * Статистика боя: кто сколько нанёс, вылечил и принял на себя,
 * звания боя (лучший по урону, лекарь, стойкий, самый сильный крит) и враги отдельно.
 */
export function BattleStats({ report }: { report: UnitReport[] }) {
  const t = useT();
  const [metric, setMetric] = useState<Metric>('dealt');
  const [foes, setFoes] = useState(false);
  const list = report.filter((r) => (foes ? r.side === 'enemy' : r.side === 'ally'));
  const sorted = [...list].sort((a, b) => b[metric] - a[metric] || b.dealt - a.dealt);
  const max = Math.max(1, ...list.map((r) => r[metric]));
  const total = list.reduce((a, r) => a + r[metric], 0);

  const allies = report.filter((r) => r.side === 'ally');
  const top = (k: keyof UnitReport) =>
    allies.reduce<UnitReport | null>((b, r) => ((r[k] as number) > ((b?.[k] as number) ?? 0) ? r : b), null);
  const mvp = top('dealt');
  const healer = top('healed');
  const tank = top('taken');
  const crit = top('maxCrit');
  const titles: { key: string; who: UnitReport | null; value: number }[] = [
    { key: 'mvp', who: mvp, value: mvp?.dealt ?? 0 },
    { key: 'crit', who: crit, value: crit?.maxCrit ?? 0 },
    { key: 'healer', who: healer, value: healer?.healed ?? 0 },
    { key: 'tank', who: tank, value: tank?.taken ?? 0 },
  ].filter((x) => x.who && x.value > 0);

  return (
    <div className="bst">
      {!foes && titles.length > 0 && (
        <div className="bst-titles">
          {titles.map((x) => (
            <div key={x.key} className={`bst-title k-${x.key}`}>
              <img src={unitStillUrl(x.who!.art)} alt="" />
              <span>
                <small>{t(`stats.title.${x.key}`)}</small>
                <b>{x.who!.name}</b>
              </span>
              <em>{formatNumber(x.value)}</em>
            </div>
          ))}
        </div>
      )}
      <div className="bst-tabs">
        {(['dealt', 'healed', 'taken'] as Metric[]).map((m) => (
          <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}>
            {t(`stats.${m}`)}
          </button>
        ))}
        <button type="button" className="bst-side" aria-pressed={foes} onClick={() => setFoes((v) => !v)}>
          {foes ? t('stats.enemies') : t('stats.allies')}
        </button>
      </div>
      {total === 0 && <p className="bst-empty">{t(`stats.none.${metric}`)}</p>}
      <div className="bst-rows">
        {sorted.map((r) => (
          <div key={r.uid} className={`bst-row${r.alive ? '' : ' is-dead'}`}>
            <img src={unitStillUrl(r.art)} alt="" style={{ borderColor: ELEMENT_COLOR[r.element] }} />
            <div className="bst-main">
              <div className="bst-line">
                <b>{r.name}</b>
                <span>
                  {formatNumber(r[metric])}
                  {total > 0 && <small> · {Math.round((r[metric] / total) * 100)}%</small>}
                </span>
              </div>
              <i className={`bst-bar m-${metric}`}>
                <i style={{ width: `${(r[metric] / max) * 100}%` }} />
              </i>
              <small className="bst-extra">
                {r.crits > 0 && <span>{t('stats.crits', { n: r.crits, max: formatNumber(r.maxCrit) })}</span>}
                {r.kills > 0 && <span>{t('stats.kills', { n: r.kills })}</span>}
                {r.shielded > 0 && <span>{t('stats.shield', { n: formatNumber(r.shielded) })}</span>}
                {r.debuffs > 0 && <span>{t('stats.debuffs', { n: r.debuffs })}</span>}
                {!r.alive && <span>{t('stats.fallen')}</span>}
              </small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
