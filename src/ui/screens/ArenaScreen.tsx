import { useMemo, useState } from 'react';
import { ArenaPvp } from '../components/ArenaPvp';
import { heroDef } from '@/content';
import {
  ARENA_DAILY_BATTLES,
  arenaOpponents,
  battlesLeft,
  canClaimLeague,
  claimLeague,
  LEAGUES,
  leagueOf,
  leagueTier,
  refreshOpponents,
} from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { startArena } from '@/state/actions';
import { platform } from '@/state/services';
import { HeroTile } from '../components/HeroTile';
import { useNow } from '../hooks';
import './screens.css';
import './heroes.css';
import './modes.css';
import './codex.css';

export default function ArenaScreen() {
  const t = useT();
  const [tab, setTab] = useState<'ai' | 'players'>('players');
  return (
    <>
      <div className="cx-tabs arena-tabs" role="tablist">
        {(['players', 'ai'] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}>
            {t(`pvp.tab.${x}`)}
          </button>
        ))}
      </div>
      {tab === 'ai' ? <ArenaAi /> : <ArenaPvp />}
    </>
  );
}

function ArenaAi() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const now = useNow(30_000);
  const league = leagueOf(save.arena.rating);
  const opps = useMemo(() => arenaOpponents(save), [save]);
  const left = battlesLeft(save, now);
  const canClaim = canClaimLeague(save, now);
  return (
    <>
      <section className="arena-head" style={{ ['--lc' as string]: league.color }}>
        <svg className="league-badge" viewBox="0 0 70 80" aria-hidden="true">
          <path
            d="M35 4 L64 16 L60 52 Q50 70 35 77 Q20 70 10 52 L6 16 Z"
            fill={league.color}
            stroke="#0a0710"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M35 4 L6 16 L10 52 Q20 70 35 77 Z" fill="#ffffff" opacity=".18" />
          <path d="M22 28 L48 54 M48 28 L22 54" stroke="#0a0710" strokeWidth="5" />
          <path d="M22 28 L48 54 M48 28 L22 54" stroke="#e6ebf3" strokeWidth="2.5" />
        </svg>
        <div>
          <b>
            {league.name} {leagueTier(save.arena.rating)}
          </b>
          <span>
            {t('arena.rating')}: <strong>{save.arena.rating}</strong>
          </span>
          <span>{t('arena.record', { w: save.arena.wins, l: save.arena.losses })}</span>
          <span>{t('arena.tickets', { n: left, max: ARENA_DAILY_BATTLES })}</span>
        </div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '10px 0' }}>
        <button
          type="button"
          className="btn btn--gold"
          disabled={!canClaim}
          onClick={() => {
            let n = 0;
            updateSave((s) => {
              n = claimLeague(s, Date.now());
            });
            if (n) {
              platform().audio.play('reward');
              showToast(`+${n} ◆`);
            }
          }}
        >
          {canClaim ? t('arena.claim', { n: league.dailyShards }) : t('arena.claimed')}
        </button>
        <button type="button" className="btn" onClick={() => updateSave((s) => refreshOpponents(s))}>
          {t('arena.refresh')}
        </button>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {opps.map((o) => (
          <section className="opp" key={o.id}>
            <div className="opp__top">
              <b>{o.name}</b>
              <span>
                {leagueOf(o.rating).name} · {o.rating} · {t('arena.power', { n: formatNumber(o.power) })}
              </span>
            </div>
            <div className="opp__team">
              {o.team.map((u, i) => (
                <HeroTile
                  key={i}
                  def={heroDef(u.defId)}
                  owned={{
                    uid: `x${i}`,
                    heroId: u.defId,
                    level: u.level,
                    xp: 0,
                    stars: u.stars ?? 1,
                    awakened: false,
                    obtainedAt: 0,
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn btn--gold"
              disabled={left <= 0}
              onClick={() => {
                platform().haptics.impact('medium');
                startArena(o);
              }}
            >
              {left > 0 ? t('arena.fight') : t('arena.noTickets')}
            </button>
          </section>
        ))}
      </div>
      <section className="card" style={{ marginTop: 12 }}>
        <b>{t('arena.leagues')}</b>
        {LEAGUES.map((l) => (
          <p
            key={l.id}
            style={{ margin: '4px 0 0', fontSize: 13, color: l.id === league.id ? l.color : 'var(--muted)' }}
          >
            {l.name}: {l.min}+ · {l.dailyShards} ◆ / день
          </p>
        ))}
      </section>
    </>
  );
}
