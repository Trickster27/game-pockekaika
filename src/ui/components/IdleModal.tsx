import { claimIdle, idleRates, pendingIdle } from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { formatDuration, useNow } from '../hooks';
import { IconGold } from './icons';
import { RewardIcon } from './RewardIcon';
import { MaterialIcon } from './MaterialIcon';

/** Экран «С возвращением»: показывает накопленную добычу лагеря и забирает её. */
export function IdleModal() {
  const t = useT();
  const open = useGame((s) => s.idleOpen);
  const save = useGame((s) => s.save);
  const setOpen = useGame((s) => s.setIdleOpen);
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const now = useNow(1000);
  if (!open || !save) return null;
  const r = pendingIdle(save, now);
  const away = now - save.lastSeenAt;
  const collect = () => {
    updateSave((s) => {
      claimIdle(s, Date.now());
    });
    platform().audio.play('reward');
    platform().haptics.notify('success');
    showToast(t('idle.collected'));
    setOpen(false);
  };
  const cells: [React.ReactNode, string, string][] = [
    [<IconGold key="g" />, `+${formatNumber(r.gold)}`, t('rewards.gold')],
    [<RewardIcon key="x" icon="xp" />, `+${formatNumber(r.heroXp)}`, t('idle.heroXp')],
  ];
  if (r.xpTome)
    cells.push([<MaterialIcon key="t" id="xpTome" />, `×${r.xpTome}`, t('labels.material.xpTome')]);
  if (r.starDust)
    cells.push([<MaterialIcon key="d" id="starDust" />, `×${r.starDust}`, t('labels.material.starDust')]);
  if (r.awakenStone)
    cells.push([
      <MaterialIcon key="s" id="awakenStone" />,
      `×${r.awakenStone}`,
      t('labels.material.awakenStone'),
    ]);
  const rates = idleRates(save);
  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <div className="res idle-card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 24 }}>{t('idle.title')}</h2>
        <p>{t('idle.away', { time: formatDuration(Math.max(away, r.ms)) })}</p>
        <svg className="idle-chest" viewBox="0 0 120 100" aria-hidden="true">
          <circle cx="60" cy="56" r="44" fill="#f0c860" opacity=".18" />
          <g stroke="#0a0710" strokeWidth="3" strokeLinejoin="round">
            <path d="M22 90 L22 52 L98 52 L98 90 Z" fill="#7a5230" />
            <path d="M22 90 L22 52 L60 52 L60 90 Z" fill="#8a6038" />
            <path d="M20 52 Q60 10 100 52 Z" fill="#a8692e" />
            <path d="M22 66 L98 66 M54 52 L54 90 M66 52 L66 90" stroke="#e8c060" strokeWidth="5" />
            <rect x="53" y="60" width="14" height="14" fill="#e8c060" />
          </g>
        </svg>
        <div className="idle-grid">
          {cells.map(([ic, v, l]) => (
            <div className="idle-cell" key={l}>
              {ic}
              <b>{v}</b>
              <small>{l}</small>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12 }}>
          {t('idle.rates', { gold: formatNumber(rates.gold), xp: formatNumber(rates.heroXp) })}
        </p>
        <button type="button" className="btn btn--gold" disabled={r.gold <= 0} onClick={collect}>
          {r.gold > 0 ? t('idle.collect') : t('idle.nothing')}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          {t('idle.close')}
        </button>
      </div>
    </div>
  );
}
