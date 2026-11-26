import { useState } from 'react';
import { isOnline, type Profile } from '@/online';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import {
  acceptFriend,
  errorText,
  findPlayers,
  openChat,
  removeFriend,
  requestFriend,
  useOnline,
} from '@/state/online';
import { unitArtUrl } from '@/assets/art';
import { formatDuration, useNow } from '../hooks';
import './screens.css';
import './heroes.css';
import './online.css';

function Ava({ p, unread }: { p: Profile; unread?: number }) {
  return (
    <span className={`ava${isOnline(p) ? ' on' : ''}`}>
      <img src={unitArtUrl(p.avatar)} alt="" />
      {unread ? <span className="unread ub">{unread}</span> : null}
    </span>
  );
}

export default function FriendsScreen() {
  const t = useT();
  const o = useOnline();
  const now = useNow(30_000);
  const go = useGame((s) => s.go);
  const showToast = useGame((s) => s.showToast);
  const incoming = o.friends.filter((f) => f.status === 'incoming');
  const [tab, setTab] = useState<'friends' | 'requests' | 'find'>(incoming.length ? 'requests' : 'friends');
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Profile[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const safe = async (fn: () => Promise<void>, ok?: string) => {
    try {
      await fn();
      if (ok) showToast(ok);
    } catch (e) {
      showToast(errorText(e));
    }
  };

  if (!o.userId)
    return (
      <div className="ph">
        <h2 className="screen-title">{t('online.friends')}</h2>
        <p>{t('online.needLogin')}</p>
        <button type="button" className="btn btn--gold" onClick={() => go('account')}>
          {t('online.account')}
        </button>
      </div>
    );

  const friends = o.friends
    .filter((f) => f.status === 'accepted')
    .sort(
      (a, b) =>
        Number(isOnline(b.profile)) - Number(isOnline(a.profile)) ||
        (o.unread[b.profile.id] ?? 0) - (o.unread[a.profile.id] ?? 0),
    );
  const outgoing = o.friends.filter((f) => f.status === 'outgoing');
  const seen = (p: Profile) =>
    isOnline(p, now) ? (
      <>
        <i className="on-dot" />
        {t('online.online')}
      </>
    ) : (
      t('online.offline', { time: t('time.ago', { time: formatDuration(now - p.lastSeen) }) })
    );

  return (
    <div className="acc">
      <h2 className="screen-title">{t('online.friends')}</h2>
      {o.kind === 'demo' && <p className="demo-note">{t('online.demo')}</p>}
      <div className="chips">
        <button type="button" aria-pressed={tab === 'friends'} onClick={() => setTab('friends')}>
          {t('online.tabFriends')} ({friends.length})
        </button>
        <button type="button" aria-pressed={tab === 'requests'} onClick={() => setTab('requests')}>
          {t('online.tabRequests')}
          {incoming.length ? ` • ${incoming.length}` : ''}
        </button>
        <button type="button" aria-pressed={tab === 'find'} onClick={() => setTab('find')}>
          {t('online.tabFind')}
        </button>
      </div>

      {tab === 'friends' && (
        <div className="fr-list">
          {friends.length === 0 && <p className="screen-sub">{t('online.noFriends')}</p>}
          {friends.map((f) => (
            <div className="fr" key={f.friendshipId}>
              <Ava p={f.profile} unread={o.unread[f.profile.id]} />
              <div>
                <b>{f.profile.nickname}</b>
                <span>
                  {t('online.lvl', { n: f.profile.level })} ·{' '}
                  {t('online.power', { n: formatNumber(f.profile.power) })} · {seen(f.profile)}
                </span>
              </div>
              <div className="acts2">
                <button type="button" className="btn btn--gold" onClick={() => void openChat(f.profile.id)}>
                  {t('online.write')}
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={t('online.remove')}
                  onClick={() => {
                    if (confirm !== f.friendshipId) {
                      setConfirm(f.friendshipId);
                      showToast(t('online.removeConfirm'));
                      return;
                    }
                    void safe(() => removeFriend(f.friendshipId));
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'requests' && (
        <div className="fr-list">
          {incoming.length + outgoing.length === 0 && <p className="screen-sub">{t('online.noRequests')}</p>}
          {incoming.map((f) => (
            <div className="fr" key={f.friendshipId}>
              <Ava p={f.profile} />
              <div>
                <b>{f.profile.nickname}</b>
                <span>{t('online.incoming')}</span>
              </div>
              <div className="acts2">
                <button
                  type="button"
                  className="btn btn--gold"
                  onClick={() => void safe(() => acceptFriend(f.friendshipId))}
                >
                  {t('online.accept')}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void safe(() => removeFriend(f.friendshipId))}
                >
                  {t('online.decline')}
                </button>
              </div>
            </div>
          ))}
          {outgoing.map((f) => (
            <div className="fr" key={f.friendshipId}>
              <Ava p={f.profile} />
              <div>
                <b>{f.profile.nickname}</b>
                <span>{t('online.outgoing')}</span>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => void safe(() => removeFriend(f.friendshipId))}
              >
                {t('online.cancel')}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'find' && (
        <>
          <form
            className="chat-input"
            style={{ padding: 0, border: 0, background: 'none' }}
            onSubmit={(e) => {
              e.preventDefault();
              void safe(async () => setFound(await findPlayers(q)));
            }}
          >
            <input
              aria-label={t('online.findHint')}
              placeholder={t('online.findHint')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="btn btn--gold">
              {t('online.search')}
            </button>
          </form>
          <div className="fr-list">
            {found && found.length === 0 && <p className="screen-sub">{t('online.nobody')}</p>}
            {found?.map((p) => {
              const rel = o.friends.find((f) => f.profile.id === p.id);
              return (
                <div className="fr" key={p.id}>
                  <Ava p={p} />
                  <div>
                    <b>{p.nickname}</b>
                    <span>
                      {t('online.lvl', { n: p.level })} · {t('online.power', { n: formatNumber(p.power) })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--gold"
                    disabled={!!rel}
                    onClick={() => void safe(() => requestFriend(p.id), t('online.added'))}
                  >
                    {rel ? (rel.status === 'accepted' ? '✓' : t('online.outgoing')) : t('online.add')}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
