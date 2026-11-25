import { useEffect, useRef, useState } from 'react';
import { isOnline, MAX_MESSAGE } from '@/online';
import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { closeChat, errorText, sendChat, useOnline } from '@/state/online';
import { IconBack } from '../components/icons';
import './screens.css';
import './online.css';

const time = (at: number) => new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export default function ChatScreen() {
  const t = useT();
  const o = useOnline();
  const go = useGame((s) => s.go);
  const showToast = useGame((s) => s.showToast);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const friend = o.friends.find((f) => f.profile.id === o.chatWith)?.profile;

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [o.chat.length]);

  const back = () => {
    closeChat();
    go('friends');
  };

  return (
    <div className="chat">
      <div className="chat-head">
        <button type="button" className="icon-btn" aria-label={t('nav.back')} onClick={back}>
          <IconBack />
        </button>
        <div>
          <b>{friend?.nickname ?? '…'}</b>
          <span>{friend ? (isOnline(friend) ? t('online.online') : '') : ''}</span>
        </div>
      </div>
      <div className="chat-log" ref={log} aria-live="polite">
        {o.chat.length === 0 && (
          <p className="screen-sub" style={{ textAlign: 'center' }}>
            {t('online.chatEmpty')}
          </p>
        )}
        {o.chat.map((m) => (
          <div key={m.id} className={`bubble ${m.from === o.userId ? 'me' : 'them'}`}>
            {m.body}
            <small>{time(m.at)}</small>
          </div>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim() || busy) return;
          setBusy(true);
          try {
            await sendChat(text);
            setText('');
          } catch (err) {
            showToast(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          aria-label={t('online.placeholder')}
          placeholder={t('online.placeholder')}
          maxLength={MAX_MESSAGE}
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="send"
        />
        <button type="submit" className="btn btn--gold" disabled={busy || !text.trim()}>
          {t('online.send')}
        </button>
      </form>
    </div>
  );
}
