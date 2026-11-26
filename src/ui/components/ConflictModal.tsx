import { formatNumber, useT, intlLocale } from '@/i18n';
import { resolveConflict, useOnline, type SaveSummary } from '@/state/online';

function Card({ title, s }: { title: string; s: SaveSummary }) {
  const t = useT();
  return (
    <div>
      <b>{title}</b>
      {t('online.summary', { level: s.level, stars: s.stars, heroes: s.heroes, gold: formatNumber(s.gold) })}
      <br />
      {new Date(s.updatedAt).toLocaleString(intlLocale())}
    </div>
  );
}

/** Выбор при конфликте: прогресс менялся и на устройстве, и в облаке. */
export function ConflictModal() {
  const t = useT();
  const c = useOnline((s) => s.conflict);
  if (!c) return null;
  return (
    <div className="overlay">
      <div className="res">
        <h2 style={{ fontSize: 22 }}>{t('online.conflictTitle')}</h2>
        <p>{t('online.conflictText')}</p>
        <div className="cf-grid">
          <Card title={t('online.local')} s={c.local} />
          <Card title={t('online.cloud')} s={c.cloud} />
        </div>
        <div className="btns">
          <button type="button" className="btn" onClick={() => void resolveConflict('local')}>
            {t('online.keepLocal')}
          </button>
          <button type="button" className="btn btn--gold" onClick={() => void resolveConflict('cloud')}>
            {t('online.keepCloud')}
          </button>
        </div>
      </div>
    </div>
  );
}
