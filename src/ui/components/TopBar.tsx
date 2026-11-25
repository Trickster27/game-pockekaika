import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { unitArtUrl } from '@/assets/art';
import { IconBack, IconEnergy, IconGear, IconGold, IconShard } from './icons';

export function TopBar() {
  const t = useT();
  const save = useGame((s) => s.save);
  const screen = useGame((s) => s.screen);
  const go = useGame((s) => s.go);
  if (!save) return null;
  const isSettings = screen === 'settings';
  return (
    <header className="topbar">
      <div className="topbar__row">
        {isSettings ? (
          <>
            <button className="icon-btn" type="button" aria-label={t('nav.back')} onClick={() => go('camp')}>
              <IconBack />
            </button>
            <h1 className="topbar__title">{t('settings.title')}</h1>
          </>
        ) : (
          <>
            <div className="topbar__ava">
              <img src={unitArtUrl('knight')} alt="" />
              <span className="topbar__lvl">{save.player.level}</span>
            </div>
            <div className="topbar__who">
              <b>{save.player.name}</b>
              <span>{t('camp.level', { level: save.player.level })}</span>
            </div>
            <button
              className="icon-btn"
              type="button"
              aria-label={t('nav.settings')}
              onClick={() => go('settings')}
            >
              <IconGear />
            </button>
          </>
        )}
      </div>
      <div className="cur">
        <div className="pill" title={t('currency.gold')}>
          <IconGold />
          <b>{formatNumber(save.currencies.gold)}</b>
        </div>
        <div className="pill" title={t('currency.shards')}>
          <IconShard />
          <b>{formatNumber(save.currencies.shards)}</b>
        </div>
        <div className="pill" title={t('currency.energy')}>
          <IconEnergy />
          <b>{save.currencies.energy}/120</b>
        </div>
      </div>
    </header>
  );
}
