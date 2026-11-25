import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { unitArtUrl } from '@/assets/art';
import { currentStage, IDLE_CAP_MS, pendingIdle } from '@/game';
import { formatDuration, useNow } from '../hooks';
import './screens.css';

/** Локации лагеря и этап плана, на котором каждая станет рабочей. */
const LOCATIONS = [
  { id: 'campaign', color: 'var(--mgla)', stage: 3 },
  { id: 'tower', color: 'var(--gold)', stage: 7 },
  { id: 'arena', color: 'var(--red)', stage: 7 },
  { id: 'dungeon', color: '#7fe7ff', stage: 6 },
  { id: 'summon', color: 'var(--mgla)', stage: 5 },
  { id: 'shop', color: 'var(--f-abyss)', stage: 5 },
  { id: 'quests', color: 'var(--f-forge)', stage: 7 },
] as const;

export default function CampScreen() {
  const t = useT();
  const go = useGame((s) => s.go);
  const openPlaceholder = useGame((s) => s.openPlaceholder);
  const save = useGame((s) => s.save)!;
  const cur = currentStage(save);
  const now = useNow(5000);
  const idle = pendingIdle(save, now);
  const setIdleOpen = useGame((s) => s.setIdleOpen);
  const tap = () => {
    platform().haptics.impact('light');
    platform().audio.play('tap');
  };
  return (
    <>
      <section className="camp-hero">
        <h2>{t('camp.greeting')}</h2>
        <p>{t('camp.subtitle')}</p>
        <img className="camp-hero__art" src={unitArtUrl('knight')} alt="" />
      </section>
      <section className="idle-bar">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="22" r="18" fill="#f0c860" opacity=".2" />
          <path d="M7 32 L7 18 L33 18 L33 32 Z" fill="#7a5230" stroke="#0a0710" strokeWidth="2" />
          <path d="M6 18 Q20 4 34 18 Z" fill="#a8692e" stroke="#0a0710" strokeWidth="2" />
          <path d="M7 24 L33 24 M18 18 L18 32 M22 18 L22 32" stroke="#e8c060" strokeWidth="2.4" />
        </svg>
        <div>
          <b>{t('idle.bar')}</b>
          <span>
            {idle.ms >= IDLE_CAP_MS ? t('idle.full') : t('idle.barText', { time: formatDuration(idle.ms) })}
          </span>
          <div className="pbar">
            <i style={{ width: `${(idle.ms / IDLE_CAP_MS) * 100}%` }} />
          </div>
        </div>
        <button type="button" className="btn btn--gold" onClick={() => setIdleOpen(true)}>
          {t('idle.collect').split(' ')[0]}
        </button>
      </section>
      <div className="loc-grid">
        <button
          type="button"
          className="loc loc-wide"
          style={{ ['--c' as string]: 'var(--gold)' }}
          onClick={() => {
            tap();
            go('campaign');
          }}
        >
          <img src={unitArtUrl('mglaboss')} alt="" />
          <span>
            <b style={{ display: 'block' }}>{t('camp.campaignGo')}</b>
            {t('camp.campaignHint', { stage: cur.id, name: cur.name })}
          </span>
        </button>
        {LOCATIONS.map((l) => (
          <button
            key={l.id}
            type="button"
            className="loc"
            style={{ ['--c' as string]: l.color }}
            onClick={() => {
              tap();
              if (l.id === 'campaign') go('campaign');
              else if (l.id === 'summon') go('summon');
              else if (l.id === 'shop') go('shop');
              else openPlaceholder(`camp.locations.${l.id}.title`, l.stage);
            }}
          >
            <i />
            <small>{t(`camp.locations.${l.id}.place`)}</small>
            <b>{t(`camp.locations.${l.id}.title`)}</b>
            <span>{t(`camp.locations.${l.id}.desc`)}</span>
          </button>
        ))}
      </div>
    </>
  );
}
