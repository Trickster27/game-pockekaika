import { useState } from 'react';
import {
  PASS_LEVELS,
  PASS_PREMIUM_SHARDS,
  PASS_REWARDS,
  PASS_XP_PER_LEVEL,
  achievementState,
  buyPremium,
  claimAchievement,
  claimEventMilestone,
  claimPass,
  currentSeason,
  eventState,
  passLevel,
  type ShopReward,
} from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { formatDuration, useNow } from '../hooks';
import { IconGold, IconShard, IconEnergy } from '../components/icons';
import { MaterialIcon } from '../components/MaterialIcon';
import type { MaterialId } from '@/save/schema';
import './screens.css';
import './codex.css';
import './events.css';

type Tab = 'event' | 'pass' | 'achievements';

/** Короткая запись награды иконками. */
function Reward({ r }: { r: ShopReward }) {
  return (
    <span className="ev-rw">
      {r.gold ? (
        <i>
          <IconGold /> {formatNumber(r.gold)}
        </i>
      ) : null}
      {r.shards ? (
        <i>
          <IconShard /> {r.shards}
        </i>
      ) : null}
      {r.energy ? (
        <i>
          <IconEnergy /> {r.energy}
        </i>
      ) : null}
      {Object.entries(r.materials ?? {}).map(([m, n]) => (
        <i key={m}>
          <MaterialIcon id={m as MaterialId} /> {n}
        </i>
      ))}
    </span>
  );
}

export default function EventsScreen() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('event');
  return (
    <>
      <h2 className="screen-title">{t('events.title')}</h2>
      <div className="cx-tabs ev-tabs" role="tablist">
        {(['event', 'pass', 'achievements'] as Tab[]).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}>
            {t(`events.tab.${x}`)}
          </button>
        ))}
      </div>
      {tab === 'event' && <EventTab />}
      {tab === 'pass' && <PassTab />}
      {tab === 'achievements' && <AchTab />}
    </>
  );
}

function useClaim() {
  const t = useT();
  const showToast = useGame((s) => s.showToast);
  return (ok: boolean) => {
    if (ok) {
      showToast(t('events.claimed'));
      platform().audio.play('reward');
      platform().haptics.notify('success');
    }
  };
}

function EventTab() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const done = useClaim();
  const now = useNow(30_000);
  const ev = eventState(save, now);
  const max = ev.def.milestones[ev.def.milestones.length - 1]!.points;
  return (
    <>
      <section className={`card ev-hero k-${ev.def.kind}`}>
        <b>{t(`events.kind.${ev.def.kind}.name`)}</b>
        <p>{t(`events.kind.${ev.def.kind}.desc`)}</p>
        <small>{t('events.ends', { time: formatDuration(ev.endsAt - now) })}</small>
        <div className="pbar ev-bar">
          <i style={{ width: `${Math.min(100, (ev.points / max) * 100)}%` }} />
        </div>
        <span className="ev-pts">{t('events.points', { n: ev.points })}</span>
      </section>
      <div className="ev-steps">
        {ev.def.milestones.map((m, i) => {
          const claimed = ev.claimed.includes(i);
          const ready = ev.points >= m.points && !claimed;
          return (
            <div key={i} className={`ev-step${ready ? ' is-ready' : ''}${claimed ? ' is-done' : ''}`}>
              <b>{m.points}</b>
              <Reward r={m.reward} />
              <button
                type="button"
                className="btn btn--gold"
                disabled={!ready}
                onClick={() => {
                  let r: ShopReward | null = null;
                  updateSave((s) => {
                    r = claimEventMilestone(s, i);
                  });
                  done(!!r);
                }}
              >
                {claimed ? '✓' : ready ? t('clan.claim') : '🔒'}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PassTab() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const done = useClaim();
  const now = useNow(60_000);
  const { level, into } = passLevel(save, now);
  const season = currentSeason(now);
  const claim = (l: number, track: 'free' | 'premium') => {
    let r: ReturnType<typeof claimPass> = 'level';
    updateSave((s) => {
      r = claimPass(s, l, track);
    });
    const res = r as ReturnType<typeof claimPass>;
    if (typeof res === 'string') showToast(t(`events.passErr.${res}`));
    else done(true);
  };
  return (
    <>
      <section className="card ev-pass">
        <div>
          <b>{t('events.passLevel', { n: level, max: PASS_LEVELS })}</b>
          <small>{t('events.seasonEnds', { time: formatDuration(season.endsAt - now) })}</small>
        </div>
        <div className="pbar ev-bar">
          <i style={{ width: `${level >= PASS_LEVELS ? 100 : (into / PASS_XP_PER_LEVEL) * 100}%` }} />
        </div>
        <small className="cx-muted">{t('events.passHow', { xp: PASS_XP_PER_LEVEL })}</small>
        {!save.pass.premium ? (
          <button
            type="button"
            className="btn btn--gold"
            onClick={() => {
              let r: ReturnType<typeof buyPremium> = 'already';
              updateSave((s) => {
                r = buyPremium(s);
              });
              const res = r as ReturnType<typeof buyPremium>;
              if (res !== true) showToast(t(`events.passErr.${res}`));
              else done(true);
            }}
          >
            ★ {t('events.premium', { n: formatNumber(PASS_PREMIUM_SHARDS) })}
          </button>
        ) : (
          <p className="ev-prem">★ {t('events.premiumOn')}</p>
        )}
      </section>
      <div className="ev-track">
        <div className="ev-track__head">
          <span />
          <b>{t('events.free')}</b>
          <b className="ev-gold">{t('events.premiumTrack')}</b>
        </div>
        {PASS_REWARDS.map((p) => {
          const open = level >= p.level;
          const fc = save.pass.free.includes(p.level);
          const pc = save.pass.prem.includes(p.level);
          return (
            <div key={p.level} className={`ev-row${open ? ' is-open' : ''}`}>
              <span className="ev-lv">{p.level}</span>
              <button
                type="button"
                className={`ev-cell${open && !fc ? ' is-ready' : ''}`}
                disabled={!open || fc}
                onClick={() => claim(p.level, 'free')}
              >
                <Reward r={p.free} />
                {fc && <em>✓</em>}
              </button>
              <button
                type="button"
                className={`ev-cell prem${open && !pc && save.pass.premium ? ' is-ready' : ''}`}
                disabled={!open || pc || !save.pass.premium}
                onClick={() => claim(p.level, 'premium')}
              >
                <Reward r={p.premium} />
                {pc ? <em>✓</em> : !save.pass.premium && <em>🔒</em>}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AchTab() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const done = useClaim();
  const list = achievementState(save);
  return (
    <div className="ev-ach">
      {list.map((a) => {
        const next = a.steps.findIndex((s) => !s.claimed);
        const cur = next < 0 ? a.steps.length - 1 : next;
        const step = a.steps[cur]!;
        const all = next < 0;
        return (
          <section
            key={a.def.id}
            className={`card ev-a${step.done && !step.claimed ? ' is-ready' : ''}${all ? ' is-done' : ''}`}
          >
            <div className="ev-a__top">
              <b>{t(`events.ach.${a.def.id}`)}</b>
              <span>
                {a.steps.map((s, i) => (
                  <i key={i} className={s.claimed ? 'on' : s.done ? 'ready' : ''} />
                ))}
              </span>
            </div>
            <div className="pbar">
              <i style={{ width: `${Math.min(100, (a.value / step.need) * 100)}%` }} />
            </div>
            <div className="ev-a__bot">
              <small>
                {formatNumber(Math.min(a.value, step.need))} / {formatNumber(step.need)}
              </small>
              <Reward r={a.def.reward(cur)} />
              <button
                type="button"
                className="btn btn--gold"
                disabled={!step.done || step.claimed}
                onClick={() => {
                  let r: ShopReward | null = null;
                  updateSave((s) => {
                    r = claimAchievement(s, a.def.id, cur);
                  });
                  done(!!r);
                }}
              >
                {all ? '✓' : step.done ? t('clan.claim') : '🔒'}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
