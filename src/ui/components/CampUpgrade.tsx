import { createPortal } from 'react-dom';
import { useState } from 'react';
import {
  CAMP_LEVELS,
  CAMP_MAX_LEVEL,
  baseIdleRates,
  campLevel,
  canUpgradeCamp,
  energyPerDay,
  nextCampLevel,
  upgradeCamp,
  type CampLevel,
} from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { IconEnergy, IconGold, IconShard } from './icons';
import { RewardIcon } from './RewardIcon';
import './camp-upgrade.css';

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const pct = (m: number) => `+${Math.round((m - 1) * 100)}%`;

/** Прокачка лагеря: бонусы текущего и следующего уровня, требования, таблица всех уровней. */
export function CampUpgrade({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [all, setAll] = useState(false);
  const cur = campLevel(save);
  const next = nextCampLevel(save);
  const base = baseIdleRates(save);
  const can = canUpgradeCamp(save);

  const upgrade = () => {
    let res: ReturnType<typeof upgradeCamp> = 'max';
    updateSave((s) => {
      res = upgradeCamp(s);
    });
    const r = res as ReturnType<typeof upgradeCamp>;
    if (typeof r === 'string') {
      showToast(t(`campUp.err.${r}`));
      platform().haptics.notify('warning');
      return;
    }
    showToast(t('campUp.done', { n: r.level }));
    platform().audio.play('victory');
    platform().haptics.notify('success');
  };

  const row = (label: string, icon: React.ReactNode, a: string, b?: string) => (
    <div className="cu-row">
      <span className="cu-ic">{icon}</span>
      <span>{label}</span>
      <b>{a}</b>
      {b && (
        <>
          <i>→</i>
          <b className="cu-next">{b}</b>
        </>
      )}
    </div>
  );
  const need = (ok: boolean, icon: React.ReactNode, text: string) => (
    <div className={`cu-need${ok ? ' is-ok' : ''}`}>
      {icon}
      <span>{text}</span>
      <em>{ok ? '✓' : '✗'}</em>
    </div>
  );

  return createPortal(
    <div className="sheet-bg cu-bg" onClick={onClose}>
      <div className="sheet2 cu" onClick={(e) => e.stopPropagation()}>
        <div className="cu-head">
          <h3>{t('campUp.title', { n: cur.level })}</h3>
          <div className="cu-steps" aria-label={t('campUp.title', { n: cur.level })}>
            {CAMP_LEVELS.map((l) => (
              <i key={l.level} className={l.level <= cur.level ? 'on' : ''} />
            ))}
          </div>
        </div>

        <div className="cu-card">
          {row(
            t('campUp.gold'),
            <IconGold />,
            `×${cur.goldMult.toFixed(2)}`,
            next ? `×${next.goldMult.toFixed(2)}` : undefined,
          )}
          {row(
            t('campUp.xp'),
            <RewardIcon icon="xp" />,
            `×${cur.xpMult.toFixed(2)}`,
            next ? `×${next.xpMult.toFixed(2)}` : undefined,
          )}
          {row(
            t('campUp.energy'),
            <IconEnergy />,
            t('campUp.per', { t: mmss(cur.regenSec) }),
            next ? t('campUp.per', { t: mmss(next.regenSec) }) : undefined,
          )}
          <p className="cu-sub">
            {t('campUp.hourly', {
              gold: formatNumber(Math.round(base.gold * cur.goldMult)),
              xp: formatNumber(Math.round(base.heroXp * cur.xpMult)),
            })}
            {next &&
              ' ' +
                t('campUp.hourlyNext', {
                  gold: formatNumber(Math.round(base.gold * next.goldMult)),
                  xp: formatNumber(Math.round(base.heroXp * next.xpMult)),
                })}
          </p>
          <p className="cu-sub">
            {t('campUp.perDay', { n: energyPerDay(cur.regenSec) })}
            {next && ` → ${energyPerDay(next.regenSec)}`}
          </p>
        </div>

        {next ? (
          <>
            <h4 className="cu-h">{t('campUp.need', { n: next.level })}</h4>
            {need(
              save.player.level >= next.req.playerLevel,
              <RewardIcon icon="level" />,
              t('campUp.needLevel', { n: next.req.playerLevel, have: save.player.level }),
            )}
            {need(
              save.currencies.gold >= next.req.gold,
              <IconGold />,
              t('campUp.needGold', {
                n: formatNumber(next.req.gold),
                have: formatNumber(save.currencies.gold),
              }),
            )}
            {next.req.shards > 0 &&
              need(
                save.currencies.shards >= next.req.shards,
                <IconShard />,
                t('campUp.needShards', { n: next.req.shards, have: formatNumber(save.currencies.shards) }),
              )}
            <button type="button" className="btn btn--gold" disabled={can !== true} onClick={upgrade}>
              {can === true ? t('campUp.go', { n: next.level }) : t(`campUp.err.${can}`)}
            </button>
          </>
        ) : (
          <p className="cu-max">{t('campUp.max', { n: CAMP_MAX_LEVEL })}</p>
        )}

        <button type="button" className="cu-all" onClick={() => setAll((v) => !v)}>
          {t('campUp.all')} {all ? '▴' : '▾'}
        </button>
        {all && <LevelsTable cur={cur} />}
      </div>
    </div>,
    document.querySelector('.app') ?? document.body,
  );
}

function LevelsTable({ cur }: { cur: CampLevel }) {
  const t = useT();
  return (
    <table className="cu-table">
      <thead>
        <tr>
          <th>{t('campUp.colLevel')}</th>
          <th>{t('campUp.colReq')}</th>
          <th>{t('campUp.colGold')}</th>
          <th>{t('campUp.colXp')}</th>
          <th>{t('campUp.colEnergy')}</th>
        </tr>
      </thead>
      <tbody>
        {CAMP_LEVELS.map((l) => (
          <tr
            key={l.level}
            className={l.level === cur.level ? 'is-cur' : l.level < cur.level ? 'is-done' : ''}
          >
            <td>{l.level}</td>
            <td>
              {l.level === 1
                ? '—'
                : `${t('campUp.lvShort', { n: l.req.playerLevel })} · ${formatNumber(l.req.gold)}${l.req.shards ? ` · ${l.req.shards}💎` : ''}`}
            </td>
            <td>{pct(l.goldMult)}</td>
            <td>{pct(l.xpMult)}</td>
            <td>{mmss(l.regenSec)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
