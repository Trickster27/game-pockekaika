import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { RewardIcon } from './RewardIcon';
import { IconEnergy } from './icons';
import './summary.css';

/** Сводка наград: зачистка или серия боёв. */
export function SummaryModal() {
  const t = useT();
  const summary = useGame((s) => s.summary);
  const show = useGame((s) => s.showSummary);
  if (!summary) return null;
  return (
    <div className="sheet-bg sum-bg" onClick={() => show(null)}>
      <div className="sheet2" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18 }}>{summary.title}</h3>
        {summary.note && <p className="sum-note">{summary.note}</p>}
        <div className="sum-list">
          {summary.lines.map((l, i) => (
            <div className="sum-line" key={i}>
              <RewardIcon icon={l.icon} />
              <span>{l.label}</span>
              <b>{l.value}</b>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn--gold" onClick={() => show(null)}>
          {t('summary.ok')}
        </button>
      </div>
    </div>
  );
}

/** Быстрый бой для пройденных боёв: энергия тратится, награда приходит сразу. */
export function SweepButtons({
  onSweep,
  hint,
  cost,
}: {
  onSweep: (n: number) => void;
  hint: string;
  cost: number;
}) {
  const t = useT();
  const energy = useGame((s) => s.save?.currencies.energy ?? 0);
  const max = Math.min(30, Math.floor(energy / Math.max(1, cost)));
  return (
    <div className="sweep">
      <div className="sweep__head">
        <b>⚡ {t('sweep.btn')}</b>
        <small>{hint}</small>
      </div>
      <div className="sweep__btns">
        <button type="button" className="btn btn--gold" disabled={max < 1} onClick={() => onSweep(1)}>
          ×1 · <IconEnergy /> {cost}
        </button>
        {[5, 10].map((n) => (
          <button key={n} type="button" className="btn" disabled={max < 1} onClick={() => onSweep(n)}>
            ×{n}
          </button>
        ))}
        <button type="button" className="btn" disabled={max < 2} onClick={() => onSweep(max)}>
          {t('sweep.max', { n: max })}
        </button>
      </div>
    </div>
  );
}
