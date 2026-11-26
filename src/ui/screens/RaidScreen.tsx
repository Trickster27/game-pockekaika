import { heroDef } from '@/content';
import {
  RAID,
  RAID_MILESTONES,
  buyRaidAttempt,
  canBuyRaidAttempt,
  claimRaidMilestone,
  raidAttemptsLeft,
  raidBossLevel,
  raidWeek,
  teamHeroes,
  teamPower,
} from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { startRaid } from '@/state/raid';
import { platform } from '@/state/services';
import { unitArtUrl } from '@/assets/art';
import { RewardChips } from '../components/RewardChips';
import { IconShard } from '../components/icons';
import { ELEMENT_COLOR, FACTION_COLOR } from '../colors';
import { formatDuration, useNow } from '../hooks';
import './screens.css';
import './expeditions.css';

export default function RaidScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const go = useGame((s) => s.go);
  const now = useNow(1000);
  const w = raidWeek(now);
  const thisWeek = save.raid.week === w.week;
  const damage = thisWeek ? save.raid.damage : 0;
  const best = thisWeek ? save.raid.best : 0;
  const claimed = thisWeek ? save.raid.claimed : [];
  const left = raidAttemptsLeft(save, now);
  const team = teamHeroes(save);
  const blessedInTeam = team.filter((h) => heroDef(h.heroId).faction === w.blessed).length;
  const maxDmg = RAID_MILESTONES.at(-1)!.damage;

  const buy = () => {
    let r: ReturnType<typeof buyRaidAttempt> = 'limit';
    updateSave((s) => {
      r = buyRaidAttempt(s, Date.now());
    });
    if (r !== true) showToast(t(`raid.err.${r}`));
  };
  const claim = (i: number) => {
    let r: ReturnType<typeof claimRaidMilestone> = null;
    updateSave((s) => {
      r = claimRaidMilestone(s, i, Date.now());
    });
    if (r) {
      platform().audio.play('reward');
      platform().haptics.notify('success');
      showToast(t('raid.claimed'));
    }
  };

  return (
    <>
      <section className="rd-hero" style={{ ['--ec' as string]: ELEMENT_COLOR[w.element] }}>
        <img src={unitArtUrl('star_devourer')} alt="" />
        <div>
          <h2 className="screen-title">{t('raid.title')}</h2>
          <small>
            {t('raid.level', { n: raidBossLevel(save) })} ·{' '}
            {t('raid.ends', { time: formatDuration(w.endsAt - now) })}
          </small>
        </div>
      </section>
      <p className="screen-sub">{t('raid.hint', { turns: RAID.bossTurns })}</p>

      <div className="rd-rules">
        <div style={{ ['--c' as string]: ELEMENT_COLOR[w.element] }}>
          <span>{t('raid.element')}</span>
          <b>{t(`labels.element.${w.element}`)}</b>
        </div>
        <div style={{ ['--c' as string]: FACTION_COLOR[w.blessed] }}>
          <span>{t('raid.blessed')}</span>
          <b>{t(`labels.factionShort.${w.blessed}`)}</b>
          <small>{t('raid.blessedHint', { p: Math.round(RAID.blessing * 100), n: blessedInTeam })}</small>
        </div>
        <div style={{ ['--c' as string]: '#ff5d7a' }}>
          <span>{t('raid.mutation')}</span>
          <b>{w.mutation.name}</b>
          <small>{w.mutation.desc}</small>
        </div>
      </div>

      <section className="card rd-score">
        <div>
          <span>{t('raid.weekDamage')}</span>
          <b>{formatNumber(damage)}</b>
        </div>
        <div>
          <span>{t('raid.best')}</span>
          <b>{formatNumber(best)}</b>
        </div>
        <div>
          <span>{t('raid.attempts')}</span>
          <b>
            {left}/{RAID.attemptsPerDay}
          </b>
        </div>
      </section>

      <div className="rd-actions">
        <button type="button" className="btn" onClick={() => go('team')}>
          {t('raid.team')}
          <small>⚔ {formatNumber(teamPower(save))}</small>
        </button>
        {left > 0 ? (
          <button type="button" className="btn btn--gold" onClick={() => startRaid()}>
            {t('raid.fight')}
          </button>
        ) : canBuyRaidAttempt(save, now) ? (
          <button type="button" className="btn btn--gold" onClick={buy}>
            {t('raid.buy')}{' '}
            <small>
              <IconShard /> {RAID.extraCost}
            </small>
          </button>
        ) : (
          <button type="button" className="btn" disabled>
            {t('raid.noAttempts')}
          </button>
        )}
      </div>

      <h3 className="rd-h">{t('raid.milestones')}</h3>
      <div className="rd-track">
        <i style={{ width: `${Math.min(1, damage / maxDmg) * 100}%` }} />
      </div>
      <div className="rd-ms">
        {RAID_MILESTONES.map((m, i) => {
          const got = claimed.includes(i);
          const can = damage >= m.damage && !got;
          return (
            <div key={i} className={`rd-m${got ? ' is-got' : can ? ' is-can' : ''}`}>
              <b>{formatNumber(m.damage)}</b>
              <RewardChips r={m.reward} />
              {got ? (
                <span className="rd-got">✓</span>
              ) : (
                <button type="button" className="btn btn--gold" disabled={!can} onClick={() => claim(i)}>
                  {t('raid.claim')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
