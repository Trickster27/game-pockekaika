import { useCallback, useEffect, useState } from 'react';
import { heroDef } from '@/content';
import { leagueOf, leagueTier } from '@/game';
import { PVP, type PvpState } from '@/online';
import { formatNumber, useT } from '@/i18n';
import { errorText, onlineBackend, submitDefenseNow, useOnline } from '@/state/online';
import { useGame } from '@/state/store';
import { startPvp } from '@/state/actions';
import { platform } from '@/state/services';
import { unitArtUrl } from '@/assets/art';
import { RARITY_COLOR } from '../colors';
import { PlayerCardSheet } from './PlayerCardSheet';
import './social.css';

/** Арена против живых игроков: их защита под управлением ИИ, рейтинг Эло считает сервер. */
export function ArenaPvp() {
  const t = useT();
  const userId = useOnline((s) => s.userId);
  const go = useGame((s) => s.go);
  const showToast = useGame((s) => s.showToast);
  const [st, setSt] = useState<PvpState | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      const be = onlineBackend();
      if (!be) return;
      try {
        await submitDefenseNow().catch(() => undefined);
        setSt(refresh ? await be.pvpRefresh() : await be.pvpState());
      } catch (e) {
        showToast(errorText(e));
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (!userId) return;
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [userId, load]);

  if (!userId)
    return (
      <section className="card">
        <p>{t('pvp.needLogin')}</p>
        <button type="button" className="btn btn--gold" onClick={() => go('account')}>
          {t('clan.toAccount')}
        </button>
      </section>
    );
  if (!st) return <p className="screen-sub">{t('social.loading')}</p>;
  const lg = leagueOf(st.rating);

  return (
    <>
      <section className="card pvp-head" style={{ ['--lc' as string]: lg.color }}>
        <div>
          <small className="cx-muted">{t('pvp.rating')}</small>
          <b style={{ color: lg.color }}>
            {st.rating} · {lg.name} {leagueTier(st.rating)}
          </b>
        </div>
        <div style={{ textAlign: 'right' }}>
          <small className="cx-muted">{t('pvp.attacks')}</small>
          <b>
            {st.attacksLeft}/{PVP.dailyAttacks}
          </b>
        </div>
      </section>
      <p className="screen-sub">
        {t('pvp.hint', { gold: formatNumber(PVP.winReward.gold), shards: PVP.winReward.shards })}
      </p>
      <div className="acts" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await submitDefenseNow().catch((e) => showToast(errorText(e)));
            showToast(t('pvp.defenseSaved'));
            void load();
          }}
        >
          🛡 {t('pvp.saveDefense')}
        </button>
        <button type="button" className="btn" onClick={() => void load(true)}>
          ↻ {t('pvp.refresh')}
        </button>
      </div>

      {st.opponents.length === 0 && <p className="screen-sub">{t('pvp.noOpponents')}</p>}
      {st.opponents.map((o) => (
        <section className={`opp${o.revenge ? ' pvp-rev' : ''}`} key={o.profile.id}>
          <div className="opp__top">
            <button type="button" className="pvp-name" onClick={() => setCard(o.profile.id)}>
              <b>{o.profile.nickname}</b>
              <small>
                {o.revenge ? `⚔ ${t('pvp.revenge')} · ` : ''}
                {t('pvp.oppRating', { r: o.rating })} · {t('heroes.power', { n: formatNumber(o.power) })}
              </small>
            </button>
            <button
              type="button"
              className="btn btn--gold"
              disabled={st.attacksLeft <= 0 || busy}
              onClick={async () => {
                setBusy(true);
                platform().haptics.impact('medium');
                await startPvp(o.profile.id, () => void load());
                setBusy(false);
              }}
            >
              {t('pvp.attack')}
            </button>
          </div>
          <div className="pvp-team">
            {o.team.map((u, i) => {
              const d = heroDef(u.defId);
              return (
                <img
                  key={i}
                  src={unitArtUrl(d.art)}
                  alt={d.name}
                  title={`${d.name} · ${u.level}`}
                  style={{ borderColor: RARITY_COLOR[d.rarity] }}
                />
              );
            })}
          </div>
        </section>
      ))}

      <section className="card" style={{ marginTop: 12 }}>
        <h3 className="cx-h">{t('pvp.log')}</h3>
        {st.log.length === 0 && <p className="screen-sub">{t('pvp.logEmpty')}</p>}
        <div className="pvp-log">
          {st.log.map((l) => {
            const mineAttack = l.attacker.id === userId;
            const other = mineAttack ? l.defender : l.attacker;
            const iWon = mineAttack ? l.attackerWon : !l.attackerWon;
            return (
              <div key={l.id} className="pvp-log__row">
                <span>
                  {mineAttack
                    ? t('pvp.youAttacked', { name: other.nickname })
                    : t('pvp.attackedYou', { name: other.nickname })}{' '}
                  · {iWon ? t('pvp.win') : t('pvp.lose')}
                </span>
                <em className={l.delta >= 0 ? 'up' : 'down'}>
                  {l.delta > 0 ? '+' : ''}
                  {l.delta}
                </em>
              </div>
            );
          })}
        </div>
      </section>
      {card && <PlayerCardSheet userId={card} onClose={() => setCard(null)} />}
    </>
  );
}
