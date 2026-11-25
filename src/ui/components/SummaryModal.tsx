import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { RewardIcon } from './RewardIcon';
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

/** Кнопки «Зачистка ×1/×5/×10». */
export function SweepButtons({ onSweep, hint }: { onSweep: (n: number) => void; hint: string }) {
  const t = useT();
  return (
    <div className="sweep">
      <span title={hint}>⚡ {t('sweep.btn')}</span>
      {[1, 5, 10].map((n) => (
        <button key={n} type="button" className="chip" onClick={() => onSweep(n)}>
          ×{n}
        </button>
      ))}
    </div>
  );
}
