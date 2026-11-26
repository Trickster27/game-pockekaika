import { useState } from 'react';
import { CampUpgrade } from '../components/CampUpgrade';
import { useT } from '@/i18n';
import { useGame, type ScreenId } from '@/state/store';
import { platform } from '@/state/services';
import { unitArtUrl } from '@/assets/art';
import campMap from '@/assets/art/camp.svg?url';
import { heroDef } from '@/content';
import { campLevel, currentStage, IDLE_CAP_MS, pendingIdle, teamHeroes } from '@/game';
import { formatDuration, useNow } from '../hooks';
import { useBadges } from '../badges';
import './screens.css';
import './camp.css';

/** Постройки на карте: прямоугольник в координатах карты (360×480, верх карты = 130). */
const BUILDINGS: { id: string; screen: ScreenId; box: [number, number, number, number] }[] = [
  { id: 'campaign', screen: 'campaign', box: [30, 190, 142, 345] },
  { id: 'tower', screen: 'tower', box: [250, 130, 334, 360] },
  { id: 'summon', screen: 'summon', box: [20, 346, 112, 480] },
  { id: 'arena', screen: 'arena', box: [236, 392, 348, 482] },
  { id: 'dungeon', screen: 'dungeons', box: [26, 482, 134, 576] },
  { id: 'shop', screen: 'shop', box: [142, 484, 238, 584] },
  { id: 'quests', screen: 'quests', box: [254, 484, 338, 584] },
  { id: 'clan', screen: 'clan', box: [146, 240, 250, 336] },
];
const MAP_W = 360,
  MAP_TOP = 130,
  MAP_H = 480;
const pct = (box: [number, number, number, number]) => ({
  left: `${(box[0] / MAP_W) * 100}%`,
  top: `${((box[1] - MAP_TOP) / MAP_H) * 100}%`,
  width: `${((box[2] - box[0]) / MAP_W) * 100}%`,
  height: `${((box[3] - box[1]) / MAP_H) * 100}%`,
});
const HERO_SPOTS: [number, number, number][] = [
  [146, 446, 0.36],
  [210, 452, 0.38],
  [118, 454, 0.34],
];

export default function CampScreen() {
  const t = useT();
  const go = useGame((s) => s.go);
  const save = useGame((s) => s.save)!;
  const setIdleOpen = useGame((s) => s.setIdleOpen);
  const cur = currentStage(save);
  const now = useNow(5000);
  const idle = pendingIdle(save, now);
  const team = teamHeroes(save).slice(0, 3);
  const b = useBadges();
  const [campOpen, setCampOpen] = useState(false);
  const badge: Record<string, boolean> = {
    quests: !!b?.quests,
    summon: !!b?.summon,
    clan: !!b?.clan,
    arena: !!b?.arena,
  };

  const open = (s: ScreenId) => {
    platform().haptics.impact('light');
    platform().audio.play('tap');
    go(s);
  };
  return (
    <>
      <section className="idle-bar">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="22" r="18" fill="#f0c860" opacity=".2" />
          <path d="M7 32 L7 18 L33 18 L33 32 Z" fill="#7a5230" stroke="#0a0710" strokeWidth="2" />
          <path d="M6 18 Q20 4 34 18 Z" fill="#a8692e" stroke="#0a0710" strokeWidth="2" />
          <path d="M7 24 L33 24 M18 18 L18 32 M22 18 L22 32" stroke="#e8c060" strokeWidth="2.4" />
        </svg>
        <div>
          <button type="button" className="camp-lvl-btn" onClick={() => setCampOpen(true)}>
            ⬆ {t('campUp.button', { n: campLevel(save).level })}
            {b?.campUp && <i className="dot" />}
          </button>
          <b>{t('idle.bar')}</b>
          <span>
            {idle.ms >= IDLE_CAP_MS ? t('idle.full') : t('idle.barText', { time: formatDuration(idle.ms) })}
          </span>
          <div className="pbar">
            <i style={{ width: `${(idle.ms / IDLE_CAP_MS) * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          className="btn btn--gold"
          data-tut="idle-open"
          onClick={() => setIdleOpen(true)}
        >
          {t('idle.collect').split(' ')[0]}
        </button>
      </section>

      <div className="campmap">
        <img className="campmap__bg" src={campMap} alt="" />
        {team.map((h, i) => {
          const [x, y, s] = HERO_SPOTS[i]!;
          const d = heroDef(h.heroId);
          return (
            <img
              key={h.uid}
              className="campmap__hero"
              src={unitArtUrl(d.art)}
              alt=""
              style={{
                left: `${((x - 60 * s) / MAP_W) * 100}%`,
                top: `${((y - 130 * s - MAP_TOP) / MAP_H) * 100}%`,
                width: `${((120 * s) / MAP_W) * 100}%`,
              }}
            />
          );
        })}
        <button
          type="button"
          className="campmap__b campmap__b--camp"
          style={pct([100, 372, 260, 470])}
          onClick={() => setCampOpen(true)}
          aria-label={t('campUp.title', { n: campLevel(save).level })}
        >
          {b?.campUp && <i className="dot" />}
          <span className="plq">
            {t('nav.camp')} · {campLevel(save).level}
          </span>
        </button>
        {BUILDINGS.map((b) => (
          <button
            key={b.id}
            type="button"
            className="campmap__b"
            style={pct(b.box)}
            onClick={() => open(b.screen)}
            aria-label={t(`camp.locations.${b.id}.title`)}
          >
            {badge[b.id] && <i className="dot" />}
            <span className="plq">{t(`camp.locations.${b.id}.title`)}</span>
          </button>
        ))}
      </div>

      {campOpen && <CampUpgrade onClose={() => setCampOpen(false)} />}
      <button type="button" className="go-card" onClick={() => open('campaign')}>
        <img src={unitArtUrl('mglaboss')} alt="" />
        <span>
          <b>{t('camp.campaignGo')}</b>
          {t('camp.campaignHint', { stage: cur.id, name: cur.name })}
        </span>
        <span className="go-card__arrow">›</span>
      </button>
    </>
  );
}
