import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { unitArtUrl } from '@/assets/art';
import { IconBack, IconEnergy, IconGear, IconGold, IconShard } from './icons';
import { ENERGY_MAX, nextEnergyIn, regenEnergy } from '@/game';
import { formatDuration, useNow } from '../hooks';

export function TopBar() {
  const t = useT();
  const save = useGame((s) => s.save);
  const screen = useGame((s) => s.screen);
  const go = useGame((s) => s.go);
  const now = useNow(1000);
  if (!save) return null;
  const energy = { ...save.currencies };
  regenEnergy(energy, now);
  const nextIn = nextEnergyIn(energy, now);
  const titled: Record<string, string> = { settings: 'settings.title', campaign: 'nav.campaign' };
  const titleKey = titled[screen];
  return (
    <header className="topbar">
      <div className="topbar__row">
        {titleKey ? (
          <>
            <button className="icon-btn" type="button" aria-label={t('nav.back')} onClick={() => go('camp')}>
              <IconBack />
            </button>
            <h1 className="topbar__title">{t(titleKey)}</h1>
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
          <b>
            {energy.energy}/{ENERGY_MAX}
            {nextIn > 0 && (
              <small className="pill__sub">
                {t('currency.energyNext', { time: formatDuration(nextIn) })}
              </small>
            )}
          </b>
        </div>
      </div>
    </header>
  );
}
