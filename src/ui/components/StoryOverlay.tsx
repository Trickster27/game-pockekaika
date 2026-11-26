import { useEffect, useMemo, useRef, useState } from 'react';
import { STORY, enemyDef, heroDef, type StorySpeaker } from '@/content';
import { useI18n, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { markStorySeen } from '@/state/story';
import { platform } from '@/state/services';
import { unitArtUrl } from '@/assets/art';
import './story.css';

/** Кто говорит: имя, портрет и сторона (союзники слева, противники справа). */
function speaker(who: StorySpeaker, locale: string): { name: string; art?: string; side: 'l' | 'r' | 'n' } {
  const en = locale === 'en';
  switch (who) {
    case 'narrator':
      return { name: '', side: 'n' };
    case 'warden':
      return { name: en ? 'Warden' : 'Хранитель', art: 'knight', side: 'l' };
    case 'colossus':
      return { name: enemyDef('colossus').name, art: 'mglaboss', side: 'r' };
    case 'void_herald': {
      try {
        const d = enemyDef('void_herald');
        return { name: d.name, art: d.art, side: 'r' };
      } catch {
        return { name: en ? 'Herald' : 'Глашатай', art: 'star_devourer', side: 'r' };
      }
    }
    case 'abbess':
    case 'emberlord':
    case 'eclipse_queen':
    case 'storm_king':
    case 'star_devourer': {
      const d = enemyDef(who);
      return { name: d.name, art: d.art, side: 'r' };
    }
    default: {
      const d = heroDef(who);
      return { name: d.name, art: d.art, side: 'l' };
    }
  }
}

const BG: Record<string, string> = {
  mist: 'radial-gradient(120% 70% at 50% 30%, #3a2a5c, #120c1c 70%)',
  cathedral: 'radial-gradient(120% 70% at 50% 20%, #1f5a6a, #08161c 70%)',
  forge: 'radial-gradient(120% 70% at 50% 80%, #8a2a14, #1c0a08 70%)',
  dusk: 'radial-gradient(60% 40% at 50% 25%, #ffd36b33, transparent 60%), radial-gradient(120% 70% at 50% 30%, #3a2458, #0c0818 70%)',
  sky: 'radial-gradient(120% 70% at 50% 20%, #6a9ad0, #1a2a4a 75%)',
  rift: 'radial-gradient(120% 70% at 50% 40%, #2a1a5a, #05030c 70%)',
};

export function StoryOverlay() {
  const t = useT();
  const locale = useI18n((s) => s.locale);
  const req = useGame((s) => s.story);
  const playStory = useGame((s) => s.playStory);
  const scene = useMemo(() => STORY.find((s) => s.id === req?.id), [req?.id]);
  const [i, setI] = useState(-1); // -1 — заставка с названием
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const line = scene && i >= 0 ? scene.lines[i] : undefined;
  const text = line ? (locale === 'en' ? line.en : line.ru) : '';

  // Заставка → первая реплика.
  useEffect(() => {
    if (!scene) return;
    const id = setTimeout(() => {
      setI(0);
      setShown(0);
    }, 1600);
    return () => clearTimeout(id);
  }, [scene]);

  // Печать текста по буквам.
  useEffect(() => {
    if (!line) return;
    timer.current = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          if (timer.current) clearInterval(timer.current);
          return n;
        }
        return n + 2;
      });
    }, 22);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [line, text]);

  if (!req || !scene) return null;

  const close = () => {
    if (!req.replay) markStorySeen(scene.id);
    playStory(null);
    setI(-1);
    setShown(0);
    req.then?.();
  };
  const tap = () => {
    if (i < 0) {
      setI(0);
      setShown(0);
      return;
    }
    if (shown < text.length) {
      setShown(text.length);
      return;
    }
    platform().audio.play('tap');
    if (i + 1 >= scene.lines.length) return close();
    setI(i + 1);
    setShown(0);
  };

  // Кто на сцене слева и справа: последние говорившие с каждой стороны.
  const upto = scene.lines.slice(0, Math.max(0, i) + 1);
  const left = [...upto].reverse().find((l) => speaker(l.who, locale).side === 'l');
  const right = [...upto].reverse().find((l) => speaker(l.who, locale).side === 'r');
  const cur = line ? speaker(line.who, locale) : null;

  return (
    <div className="story" style={{ background: BG[scene.scene] ?? BG.mist }} onClick={tap}>
      <div className="story__vignette" />
      <button
        type="button"
        className="story__skip"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
      >
        {t('story.skip')} ›
      </button>

      {i < 0 ? (
        <div className="story__title">
          <small>{t('story.chapter', { n: scene.chapter })}</small>
          <h2>{locale === 'en' ? scene.title.en : scene.title.ru}</h2>
        </div>
      ) : (
        <>
          <div className="story__stage">
            {left && (
              <img
                key={`l-${left.who}`}
                className={`story__por story__por--l${line?.who === left.who ? ' is-on' : ''}`}
                src={unitArtUrl(speaker(left.who, locale).art!)}
                alt=""
              />
            )}
            {right && (
              <img
                key={`r-${right.who}`}
                className={`story__por story__por--r${line?.who === right.who ? ' is-on' : ''}`}
                src={unitArtUrl(speaker(right.who, locale).art!)}
                alt=""
              />
            )}
          </div>
          <div
            className={`story__box${cur?.side === 'n' ? ' is-narr' : ''}${cur?.side === 'r' ? ' is-foe' : ''}`}
          >
            {cur && cur.side !== 'n' && <b className="story__name">{cur.name}</b>}
            <p>
              {text.slice(0, shown)}
              <span className="story__rest">{text.slice(shown)}</span>
            </p>
            <div className="story__foot">
              <span>
                {i + 1}/{scene.lines.length}
              </span>
              {shown >= text.length && <i className="story__next">▼</i>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
