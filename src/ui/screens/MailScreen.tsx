import { useState } from 'react';
import { claimAllMail, claimMail, deleteReadMail, readMail } from '@/game';
import { intlLocale, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { RewardChips } from '../components/RewardChips';
import './screens.css';
import './mail.css';

export default function MailScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [open, setOpen] = useState<string | null>(null);
  const items = [...save.mail.items].sort((a, b) => b.at - a.at);
  const withReward = items.filter((m) => m.reward && !m.claimed).length;
  const tr = (k: string, p?: Record<string, string | number>) => {
    const params = { ...p } as Record<string, string | number>;
    if (typeof params.league === 'string') params.league = t(`ui.league.${params.league}`);
    return t(k, params);
  };

  const claim = (id: string) => {
    updateSave((s) => {
      claimMail(s, id);
    });
    platform().audio.play('reward');
    platform().haptics.notify('success');
    showToast(t('mail.claimed'));
  };

  return (
    <>
      <h2 className="screen-title">{t('mail.title')}</h2>
      <div className="mail-tools">
        <button
          type="button"
          className="btn btn--gold"
          disabled={withReward === 0}
          onClick={() => {
            updateSave((s) => {
              claimAllMail(s);
            });
            platform().audio.play('reward');
            showToast(t('mail.claimedAll'));
          }}
        >
          {t('mail.claimAll')} {withReward > 0 && `(${withReward})`}
        </button>
        <button type="button" className="btn" onClick={() => updateSave((s) => deleteReadMail(s))}>
          🗑 {t('mail.clean')}
        </button>
      </div>
      {items.length === 0 && <p className="screen-sub">{t('mail.empty')}</p>}
      <div className="mail-list">
        {items.map((m) => {
          const isOpen = open === m.id;
          return (
            <article key={m.id} className={`mail${m.read ? '' : ' is-new'}${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="mail__head"
                onClick={() => {
                  setOpen(isOpen ? null : m.id);
                  if (!m.read) updateSave((s) => readMail(s, m.id));
                }}
              >
                <span className="mail__seal">{m.reward && !m.claimed ? '🎁' : '✉'}</span>
                <span className="mail__t">
                  <b>{tr(m.title, m.params)}</b>
                  <small>{new Date(m.at).toLocaleDateString(intlLocale())}</small>
                </span>
                {!m.read && <i className="dot" />}
              </button>
              {isOpen && (
                <div className="mail__body">
                  <p>{tr(m.body, m.params)}</p>
                  {m.reward && (
                    <div className="mail__rw">
                      <RewardChips r={m.reward} />
                      {m.claimed ? (
                        <span className="mail__done">✓ {t('mail.done')}</span>
                      ) : (
                        <button type="button" className="btn btn--gold" onClick={() => claim(m.id)}>
                          {t('mail.claim')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
