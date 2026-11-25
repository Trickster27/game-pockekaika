import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import { unitArtUrl } from '@/assets/art';
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
      <div className="loc-grid">
        <button
          type="button"
          className="loc loc-wide"
          style={{ ['--c' as string]: 'var(--gold)' }}
          onClick={() => {
            tap();
            go('battleTest');
          }}
        >
          <img src={unitArtUrl('mglaboss')} alt="" />
          <span>
            <b style={{ display: 'block' }}>{t('camp.battleTest')}</b>
            {t('camp.battleTestHint')}
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
              openPlaceholder(`camp.locations.${l.id}.title`, l.stage);
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
