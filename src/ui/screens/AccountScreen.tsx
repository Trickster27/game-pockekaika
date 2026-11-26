import { useState } from 'react';
import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { errorText, rename, signIn, signOut, signUp, syncNow, useOnline } from '@/state/online';
import { unitArtUrl } from '@/assets/art';
import { formatDuration, useNow } from '../hooks';
import './screens.css';
import './heroes.css';
import './online.css';

export default function AccountScreen() {
  const t = useT();
  const o = useOnline();
  const now = useNow(30_000);
  const showToast = useGame((s) => s.showToast);
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newNick, setNewNick] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="acc">
      <h2 className="screen-title">{t('online.account')}</h2>
      {o.kind === 'demo' && <p className="demo-note">{t('online.demo')}</p>}
      {!o.userId ? (
        <section className="card form">
          <p className="screen-sub" style={{ margin: 0 }}>
            {t('online.why')}
          </p>
          <div className="chips">
            <button type="button" aria-pressed={mode === 'up'} onClick={() => setMode('up')}>
              {t('online.signUp')}
            </button>
            <button type="button" aria-pressed={mode === 'in'} onClick={() => setMode('in')}>
              {t('online.signIn')}
            </button>
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => (mode === 'up' ? signUp(email, password, nick) : signIn(email, password)));
            }}
          >
            <label className="field" htmlFor="acc-email">
              {t('online.email')}
              <input
                id="acc-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="field" htmlFor="acc-pass">
              {t('online.password')}
              <input
                id="acc-pass"
                type="password"
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {mode === 'up' && (
              <label className="field" htmlFor="acc-nick">
                {t('online.nickname')}
                <input
                  id="acc-nick"
                  type="text"
                  autoComplete="nickname"
                  maxLength={20}
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  required
                />
              </label>
            )}
            {err && <p className="err">{err}</p>}
            <button type="submit" className="btn btn--gold" disabled={busy}>
              {mode === 'up' ? t('online.doSignUp') : t('online.doSignIn')}
            </button>
          </form>
        </section>
      ) : (
        <>
          {o.profile && (
            <section className="card prof">
              <span className="ava">
                <img src={unitArtUrl(o.profile.avatar)} alt="" />
              </span>
              <div>
                <b>{o.profile.nickname}</b>
                <span>
                  {t('online.lvl', { n: o.profile.level })} · {t('online.power', { n: o.profile.power })}
                </span>
              </div>
            </section>
          )}
          {o.profile && (
            <section className="card form">
              <span className="field">{t('online.friendCode')}</span>
              <div className="code">
                <b>{o.profile.friendCode}</b>
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(o.profile!.friendCode);
                      showToast(t('online.copied'));
                    } catch {
                      /* код виден на экране */
                    }
                  }}
                >
                  {t('online.copy')}
                </button>
              </div>
              <label className="field" htmlFor="acc-rename">
                {t('online.rename')}
                <input
                  id="acc-rename"
                  type="text"
                  maxLength={20}
                  value={newNick}
                  placeholder={o.profile.nickname}
                  onChange={(e) => setNewNick(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn"
                disabled={busy || !newNick.trim()}
                onClick={() =>
                  void run(async () => {
                    await rename(newNick);
                    setNewNick('');
                  })
                }
              >
                {t('online.save')}
              </button>
              {err && <p className="err">{err}</p>}
            </section>
          )}
          <section className="card form">
            <b>{t('online.sync')}</b>
            <span className="screen-sub" style={{ margin: 0 }}>
              {o.status === 'syncing'
                ? t('online.syncing')
                : o.status === 'error'
                  ? t('online.syncErr', { err: o.error ?? '' })
                  : o.lastSync
                    ? t('online.syncOk', {
                        time:
                          now - o.lastSync < 60_000
                            ? t('online.justNow')
                            : t('time.ago', { time: formatDuration(now - o.lastSync) }),
                      })
                    : ''}
            </span>
            <button
              type="button"
              className="btn btn--gold"
              disabled={o.status === 'syncing'}
              onClick={() => void syncNow()}
            >
              {t('online.syncNow')}
            </button>
            <button type="button" className="btn btn--danger" onClick={() => void run(signOut)}>
              {t('online.signOut')}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
