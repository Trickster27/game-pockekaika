import { useState, type ReactNode } from 'react';
import { useT } from '@/i18n';

/**
 * Фильтры в одну строку: главный фильтр всегда виден, остальное — в раскрывающейся панели
 * с числом активных фильтров на кнопке. Так список не уезжает вниз из-за трёх-четырёх рядов кнопок.
 */
export function FilterBar(props: {
  primary: ReactNode;
  active: number;
  children: ReactNode;
  onReset?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="fbar">
      <div className="fbar__row">
        <div className="chips fbar__primary">{props.primary}</div>
        <button
          type="button"
          className={`fbar__btn${open ? ' is-open' : ''}${props.active ? ' is-active' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 6 L20 6 M7 12 L17 12 M10 18 L14 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
          {props.active > 0 && <b>{props.active}</b>}
        </button>
      </div>
      {open && (
        <div className="fbar__panel">
          {props.children}
          {props.onReset && props.active > 0 && (
            <button type="button" className="btn fbar__reset" onClick={props.onReset}>
              {t('ui.resetFilters')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Подпись группы внутри панели фильтров. */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fgroup">
      <small>{label}</small>
      <div className="chips chips--wrap">{children}</div>
    </div>
  );
}
