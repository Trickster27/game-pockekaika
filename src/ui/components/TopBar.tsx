import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { unitStillUrl } from '@/assets/art';
import { IconBack, IconEnergy, IconGear, IconGold, IconShard } from './icons';
import { ENERGY_MAX, energyRegenMs, nextEnergyIn, playerXpToNext, regenEnergy, teamHeroes } from '@/game';
import { heroDef } from '@/content';
import { formatDuration, useNow } from '../hooks';
import { useOnline } from '@/state/online';

export function TopBar() {
  const t = useT();
  const save = useGame((s) => s.save);
  const screen = useGame((s) => s.screen);
  const go = useGame((s) => s.go);
  const now = useNow(1000);
  const online = useOnline();
  const social =
    Object.values(online.unread).reduce((a, b) => a + b, 0) +
    online.friends.filter((f) => f.status === 'incoming').length;
  if (!save) return null;
  const energy = { ...save.currencies };
  const regen = energyRegenMs(save);
  regenEnergy(energy, now, regen);
  const nextIn = nextEnergyIn(energy, now, regen);
  const titled: Record<string, string> = {
    settings: 'settings.title',
    campaign: 'nav.campaign',
    dungeons: 'dungeons.title',
    shop: 'shop.title',
    codex: 'codex.title',
    clan: 'clan.title',
    training: 'training.title',
    expeditions: 'exp.title',
    raid: 'raid.title',
    leaders: 'social.leaders',
    fusion: 'fusion.title',
    events: 'events.title',
  };
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
            <button
              type="button"
              className="topbar__ava"
              aria-label={t('online.account')}
              onClick={() => go('account')}
            >
              <img
                src={unitStillUrl(teamHeroes(save)[0] ? heroDef(teamHeroes(save)[0]!.heroId).art : 'knight')}
                alt=""
              />
              <span className="topbar__lvl">{save.player.level}</span>
            </button>
            <div className="topbar__who">
              <b>{online.profile?.nickname ?? save.player.name}</b>
              <span className="topbar__xp" title={`${save.player.xp}/${playerXpToNext(save.player.level)}`}>
                <i
                  style={{
                    width: `${Math.min(100, (save.player.xp / playerXpToNext(save.player.level)) * 100)}%`,
                  }}
                />
              </span>
            </div>
            <button
              className="icon-btn"
              type="button"
              aria-label={t('social.leaders')}
              onClick={() => go('leaders')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
                <path
                  d="M7 4 L17 4 L17 9 Q17 14 12 15 Q7 14 7 9 Z"
                  fill="#f0c860"
                  stroke="#0a0710"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M7 6 L4 6 Q4 10 7.5 11 M17 6 L20 6 Q20 10 16.5 11"
                  fill="none"
                  stroke="#f0c860"
                  strokeWidth="1.6"
                />
                <path
                  d="M10 15 L14 15 L14.5 18 L9.5 18 Z M8 18 L16 18 L16 21 L8 21 Z"
                  fill="#c98a45"
                  stroke="#0a0710"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              className="icon-btn"
              type="button"
              aria-label={t('online.friends')}
              onClick={() => go('friends')}
              style={{ position: 'relative' }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M2.5 20 Q2.5 13 9 13 Q15.5 13 15.5 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M16 4.5 A3.2 3.2 0 0 1 16 11 M18 13.5 Q21.5 14.5 21.5 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              {social > 0 && (
                <span className="unread" style={{ position: 'absolute', top: -4, right: -4 }}>
                  {social}
                </span>
              )}
            </button>
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
          <button
            type="button"
            className="pill__plus"
            aria-label={t('shop.title')}
            onClick={() => go('shop')}
          >
            +
          </button>
        </div>
        <div className="pill" title={t('currency.energy')}>
          <IconEnergy />
          <button
            type="button"
            className="pill__plus"
            aria-label={t('shop.title')}
            onClick={() => go('shop')}
          >
            +
          </button>
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
