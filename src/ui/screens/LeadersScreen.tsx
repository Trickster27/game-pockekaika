import { useEffect, useState } from 'react';
import type { LeaderKind, LeaderScope, Leaderboard, LeaderRow } from '@/online';
import { formatNumber, useT } from '@/i18n';
import { errorText, onlineBackend, submitDefenseNow, useOnline } from '@/state/online';
import { useGame } from '@/state/store';
import { unitStillUrl } from '@/assets/art';
import { PlayerCardSheet } from '../components/PlayerCardSheet';
import '../components/social.css';
import './screens.css';

const KINDS: LeaderKind[] = ['power', 'pvp', 'tower', 'boss', 'level', 'collection'];
const SCOPES: LeaderScope[] = ['all', 'friends', 'clan'];

export default function LeadersScreen() {
  const t = useT();
  const userId = useOnline((s) => s.userId);
  const go = useGame((s) => s.go);
  const [kind, setKind] = useState<LeaderKind>('power');
  const [scope, setScope] = useState<LeaderScope>('all');
  const [data, setData] = useState<Leaderboard | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    // Перед просмотром отправляем свежую статистику, чтобы видеть себя на актуальном месте.
    void submitDefenseNow()
      .catch(() => undefined)
      .then(() => onlineBackend()?.leaderboard(kind, scope))
      .then((d) => alive && d && setData(d))
      .catch((e) => useGame.getState().showToast(errorText(e)));
    return () => {
      alive = false;
    };
  }, [userId, kind, scope]);

  if (!userId)
    return (
      <section className="card">
        <p>{t('social.needLogin')}</p>
        <button type="button" className="btn btn--gold" onClick={() => go('account')}>
          {t('clan.toAccount')}
        </button>
      </section>
    );

  const row = (r: LeaderRow, mine = false) => (
    <button
      key={`${r.profile.id}-${mine}`}
      type="button"
      className={`lb-row${r.profile.id === userId ? ' is-me' : ''}`}
      onClick={() => setOpen(r.profile.id)}
    >
      <span className={`lb-rank r${Math.min(r.rank, 4)}`}>{r.rank}</span>
      <img src={unitStillUrl(r.profile.avatar)} alt="" />
      <span className="lb-name">
        {r.profile.nickname}
        {r.clanTag && <small> [{r.clanTag}]</small>}
      </span>
      <b>{formatNumber(r.value)}</b>
    </button>
  );

  return (
    <>
      <h2 className="screen-title">{t('social.leaders')}</h2>
      <div className="chips lb-kinds">
        {KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {t(`social.kind.${k}`)}
          </button>
        ))}
      </div>
      <div className="chips lb-scopes">
        {SCOPES.map((s) => (
          <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)}>
            {t(`social.scope.${s}`)}
          </button>
        ))}
      </div>
      {kind === 'boss' && <p className="screen-sub">{t('social.bossHint')}</p>}
      <div className="lb-list">
        {!data && <p className="screen-sub">{t('social.loading')}</p>}
        {data && scope !== 'clan' && data.rows.filter((r) => r.profile.id !== userId).length === 0 && (
          <p className="screen-sub">{t(scope === 'friends' ? 'social.emptyFriends' : 'social.emptyAll')}</p>
        )}
        {data?.rows.map((r) => row(r))}
      </div>
      {data?.me && !data.rows.some((r) => r.profile.id === userId) && (
        <div className="lb-me">{row(data.me, true)}</div>
      )}
      {open && <PlayerCardSheet userId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
