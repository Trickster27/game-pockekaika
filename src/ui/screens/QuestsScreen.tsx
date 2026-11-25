import { useState } from 'react';
import {
  DAILY_QUESTS,
  QUEST_CHESTS,
  LOGIN_CYCLE,
  canClaimLogin,
  claimChest,
  claimLogin,
  claimQuest,
  loginReward,
  nextLoginDay,
  questPoints,
  questProgress,
  type ShopReward,
} from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { useNow } from '../hooks';
import { IconEnergy, IconGold, IconShard } from '../components/icons';
import { MaterialIcon } from '../components/MaterialIcon';
import type { MaterialId } from '@/save/schema';
import './screens.css';
import './campaign.css';
import './modes.css';

function RewardMini({ r }: { r: ShopReward }) {
  if (r.shards) return <IconShard />;
  const m = Object.keys(r.materials ?? {})[0] as MaterialId | undefined;
  if (m) return <MaterialIcon id={m} />;
  if (r.energy) return <IconEnergy />;
  return <IconGold />;
}

function rewardText(r: ShopReward, t: (k: string) => string): string {
  const parts: string[] = [];
  if (r.gold) parts.push(`${formatNumber(r.gold)} ${t('rewards.gold').toLowerCase()}`);
  if (r.shards) parts.push(`${r.shards} ◆`);
  if (r.energy) parts.push(`${r.energy} ⚡`);
  for (const [k, v] of Object.entries(r.materials ?? {})) parts.push(`${t(`labels.material.${k}`)} ×${v}`);
  return parts.join(', ');
}

export default function QuestsScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const now = useNow(30_000);
  const [tab, setTab] = useState<'daily' | 'login'>(canClaimLogin(save, now) ? 'login' : 'daily');
  const pts = questPoints(save, now);
  const ok = (msg: string) => {
    platform().audio.play('reward');
    platform().haptics.notify('success');
    showToast(msg);
  };
  const nextDay = nextLoginDay(save);
  const can = canClaimLogin(save, now);
  return (
    <>
      <h2 className="screen-title">{t('quests.title')}</h2>
      <div className="chips" style={{ margin: '8px 0 12px' }}>
        <button type="button" aria-pressed={tab === 'daily'} onClick={() => setTab('daily')}>
          {t('quests.daily')}
        </button>
        <button type="button" aria-pressed={tab === 'login'} onClick={() => setTab('login')}>
          {t('quests.login')}
          {can ? ' •' : ''}
        </button>
      </div>
      {tab === 'daily' ? (
        <>
          <p className="screen-sub" style={{ margin: 0 }}>
            {t('quests.points', { n: pts })}
          </p>
          <div className="pts">
            <div className="track">
              <i style={{ width: `${Math.min(100, pts)}%` }} />
            </div>
            <div className="chests">
              {QUEST_CHESTS.map((c, i) => {
                const got = save.quests.chests.includes(i) && save.quests.day;
                const ready = !got && pts >= c.points;
                return (
                  <button
                    key={i}
                    type="button"
                    className={ready ? 'ready' : undefined}
                    disabled={!ready}
                    onClick={() => {
                      let r: ShopReward | null = null;
                      updateSave((s) => {
                        r = claimChest(s, i, Date.now());
                      });
                      if (r) ok(rewardText(r, t));
                    }}
                  >
                    <svg viewBox="0 0 40 34" aria-hidden="true">
                      <path
                        d="M5 32 L5 16 L35 16 L35 32 Z"
                        fill={got ? '#3a3248' : '#7a5230'}
                        stroke="#0a0710"
                        strokeWidth="2"
                      />
                      <path
                        d="M4 16 Q20 2 36 16 Z"
                        fill={got ? '#4a4258' : '#a8692e'}
                        stroke="#0a0710"
                        strokeWidth="2"
                      />
                      <path d="M5 22 L35 22" stroke="#e8c060" strokeWidth="2.4" />
                    </svg>
                    {got ? t('quests.done') : t('quests.chest', { n: c.points })}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="qlist">
            {DAILY_QUESTS.map((q) => {
              const pr = questProgress(save, q.id, now);
              const claimed = save.quests.day && save.quests.claimed.includes(q.id);
              return (
                <div className="q" key={q.id}>
                  <div>
                    <b>{q.name}</b>
                    <small>
                      +{q.points} · {Math.min(pr, q.goal)}/{q.goal}
                    </small>
                    <div className="bar">
                      <i style={{ width: `${(Math.min(pr, q.goal) / q.goal) * 100}%` }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`btn${pr >= q.goal && !claimed ? ' btn--gold' : ''}`}
                    disabled={!!claimed || pr < q.goal}
                    onClick={() => {
                      let done = false;
                      updateSave((s) => {
                        done = claimQuest(s, q.id, Date.now());
                      });
                      if (done) ok(`+${q.points}`);
                    }}
                  >
                    {claimed ? t('quests.done') : t('quests.claim')}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="screen-sub">{t('quests.cycle', { n: save.login.claimed })}</p>
          <div className="cal">
            {Array.from({ length: LOGIN_CYCLE }, (_, i) => i + 1).map((d) => {
              const r = loginReward(d);
              const cycleStart = save.login.claimed - (save.login.claimed % LOGIN_CYCLE);
              const got = cycleStart + d <= save.login.claimed;
              const cls = [
                d === 28 ? 'big' : d % 7 === 0 ? 'special' : '',
                got ? 'got' : '',
                d === nextDay && can ? 'today' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div key={d} className={cls} title={rewardText(r, t)}>
                  <RewardMini r={r} />
                  {d}
                </div>
              );
            })}
          </div>
          <p className="screen-sub" style={{ margin: '12px 0 6px' }}>
            {t('quests.day', { n: nextDay })}: {rewardText(loginReward(nextDay), t)}
          </p>
          <button
            type="button"
            className="btn btn--gold btn--block"
            disabled={!can}
            onClick={() => {
              let r: ReturnType<typeof claimLogin> = null;
              updateSave((s) => {
                r = claimLogin(s, Date.now());
              });
              if (r) ok(rewardText((r as NonNullable<ReturnType<typeof claimLogin>>).reward, t));
            }}
          >
            {can ? t('quests.claimToday') : t('quests.claimedToday')}
          </button>
        </>
      )}
    </>
  );
}
