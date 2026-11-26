import { useState } from 'react';
import { enemyDef } from '@/content';
import {
  TRIALS,
  TRIAL_ATTEMPTS,
  TRIAL_LEVELS,
  beginTrial,
  finishTrial,
  heroSpec,
  makeSetup,
  teamHeroes,
  trialAttemptsLeft,
  trialEnemyLevel,
  trialReward,
  trialToday,
  trialUnlocked,
  trialWaves,
  type TrialKind,
} from '@/game';
import { formatNumber, tr, useT } from '@/i18n';
import { useGame, type RewardLine } from '@/state/store';
import { rewardLines } from '@/state/clan';
import { unitStillUrl } from '@/assets/art';
import { RewardChips } from '../components/RewardChips';
import { formatDuration, useNow } from '../hooks';
import './screens.css';
import './trial.css';

function startTrial(kind: TrialKind, level: number): boolean {
  const g = useGame.getState();
  const save = g.save!;
  const team = teamHeroes(save);
  if (!team.length) {
    g.showToast(tr('campaign.noTeam'));
    return false;
  }
  const r = beginTrial(save, kind, level, Date.now());
  if (typeof r === 'string') {
    g.showToast(tr(`trial.err.${r}`));
    return false;
  }
  const d = TRIALS.find((x) => x.kind === kind)!;
  g.startBattle({
    title: `${tr(`trial.kind.${kind}`)} · ${tr('dungeons.level', { n: level })}`,
    subtitle: tr('trial.title'),
    scene: d.scene,
    setup: makeSetup(
      team.map((h) => heroSpec(h, save)),
      trialWaves(kind, level),
      r.seed,
    ),
    returnTo: 'trial',
    finish: (res) => {
      let reward: ReturnType<typeof finishTrial> = null;
      useGame.getState().updateSave((s) => {
        reward = finishTrial(s, kind, level, res.winner === 'ally', Date.now());
      });
      const rw = reward as ReturnType<typeof finishTrial>;
      const lines: RewardLine[] = rw
        ? rewardLines(rw)
        : [{ icon: 'star', label: tr('trial.noSpend'), value: '' }];
      return lines;
    },
    retry: () => startTrial(kind, level),
    next: () => startTrial(kind, Math.min(TRIAL_LEVELS, level + 1)),
    nextLabel: tr('battle.next'),
  });
  return true;
}

export default function TrialScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const now = useNow(30_000);
  const today = trialToday(now);
  const [kind, setKind] = useState<TrialKind>(today[0]!);
  const best = save.trial.best[kind] ?? 0;
  const [level, setLevel] = useState(Math.min(TRIAL_LEVELS, best + 1));
  const left = trialAttemptsLeft(save, now);
  const d = TRIALS.find((x) => x.kind === kind)!;
  const midnight = (Math.floor(now / 86_400_000) + 1) * 86_400_000;

  return (
    <>
      <h2 className="screen-title">{t('trial.title')}</h2>
      <p className="screen-sub">{t('trial.hint', { n: TRIAL_ATTEMPTS })}</p>
      <div className="tr-week">
        {TRIALS.map((x) => {
          const open = today.includes(x.kind);
          return (
            <button
              key={x.kind}
              type="button"
              className={`tr-kind${open ? '' : ' is-closed'}`}
              aria-pressed={kind === x.kind}
              disabled={!open}
              style={{ ['--c' as string]: x.color }}
              onClick={() => {
                setKind(x.kind);
                setLevel(Math.min(TRIAL_LEVELS, (save.trial.best[x.kind] ?? 0) + 1));
              }}
            >
              <RewardChips r={trialReward(x.kind, 1)} />
              <b>{t(`trial.kind.${x.kind}`)}</b>
              <small>{open ? t('trial.open') : t(`trial.day.${x.kind}`)}</small>
            </button>
          );
        })}
      </div>

      <section className="card trial-card" style={{ ['--c' as string]: d.color }}>
        <div className="trial-boss">
          <img src={unitStillUrl(enemyDef(d.boss).art)} alt="" />
          <div>
            <b>{enemyDef(d.boss).name}</b>
            <small>{t('dungeons.enemyLevel', { n: trialEnemyLevel(level) })}</small>
            <small>
              {t('trial.attempts', { n: left, max: TRIAL_ATTEMPTS })} ·{' '}
              {t('trial.reset', { time: formatDuration(midnight - now) })}
            </small>
          </div>
        </div>
        <div className="trial-levels">
          {Array.from({ length: TRIAL_LEVELS }, (_, i) => i + 1).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              disabled={!trialUnlocked(save, kind, l)}
              className={l <= best ? 'is-done' : undefined}
              onClick={() => setLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="trial-rw">
          <span>{t('dungeons.drops')}</span>
          <RewardChips r={trialReward(kind, level)} />
        </div>
        <button
          type="button"
          className="btn btn--gold btn--block"
          disabled={left <= 0 || !today.includes(kind)}
          onClick={() => startTrial(kind, level)}
        >
          {left > 0 ? t('dungeons.fight') : t('trial.err.noAttempts')}
        </button>
        <p className="screen-sub" style={{ margin: 0, fontSize: 12 }}>
          {t('trial.lucky')} · {formatNumber(best)}/{TRIAL_LEVELS}
        </p>
      </section>
    </>
  );
}
