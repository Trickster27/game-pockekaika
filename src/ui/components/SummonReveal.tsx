import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { heroDef } from '@/content';
import { RARITY_ORDER, type Rarity } from '@/core/types';
import { useT } from '@/i18n';
import { platform } from '@/state/services';
import type { OwnedHero } from '@/save/schema';
import { unitArtUrl } from '@/assets/art';
import { ELEMENT_COLOR, FACTION_COLOR, RARITY_COLOR } from '../colors';
import { Stars } from './HeroTile';
import './summonfx.css';

/**
 * Призыв в три такта, как в лучших играх жанра:
 * 1) портал заряжается, и цвет его света заранее выдаёт лучшую редкость (у легендарки — тряска и вспышка);
 * 2) карты лежат рубашкой вверх, кромка светится цветом редкости — можно открывать по одной или все сразу;
 * 3) эпический и легендарный герой получают отдельный показ крупным планом.
 * «Пропустить» доступно всегда; при «уменьшении движения» анимации короче и без тряски.
 */
const RANK = (r: Rarity) => RARITY_ORDER.indexOf(r);
const PORTAL_MS: Record<Rarity, number> = { common: 1100, rare: 1200, epic: 1500, legendary: 2100 };
const reduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function SummonReveal(props: {
  heroes: OwnedHero[];
  newIds: Set<string>;
  onClose: () => void;
  onAgain: () => void;
}) {
  const t = useT();
  const p = platform();
  const best = useMemo(
    () =>
      props.heroes
        .map((h) => heroDef(h.heroId).rarity)
        .reduce((a, r) => (RANK(r) > RANK(a) ? r : a), 'common' as Rarity),
    [props.heroes],
  );
  // «Новый!» — только на первой копии героя, которого раньше не было.
  const firstNew = useMemo(() => {
    const seen = new Set<string>();
    return props.heroes.map((h) => {
      if (!props.newIds.has(h.heroId) || seen.has(h.heroId)) return false;
      seen.add(h.heroId);
      return true;
    });
  }, [props.heroes, props.newIds]);
  const [phase, setPhase] = useState<'portal' | 'cards'>('portal');
  const [flipped, setFlipped] = useState<boolean[]>(() => props.heroes.map(() => false));
  const [spot, setSpot] = useState<number | null>(null);
  const autoRef = useRef(false);
  const done = flipped.every(Boolean) && spot === null;

  // Такт 1: портал. Звук и вибрация нарастают к редкости.
  useEffect(() => {
    if (phase !== 'portal') return;
    p.haptics.impact(RANK(best) >= 2 ? 'heavy' : 'medium');
    const id = setTimeout(() => setPhase('cards'), reduced() ? 500 : PORTAL_MS[best]);
    return () => clearTimeout(id);
  }, [phase, best, p]);

  const flip = useCallback(
    (i: number, withSpot = true) => {
      setFlipped((f) => (f[i] ? f : f.map((x, k) => (k === i ? true : x))));
      const r = heroDef(props.heroes[i]!.heroId).rarity;
      if (RANK(r) >= 2 && withSpot) {
        setSpot(i);
        p.audio.play(r === 'legendary' ? 'victory' : 'reward');
        p.haptics.notify('success');
      } else p.audio.play('tap');
    },
    [props.heroes, p],
  );

  // Такт 2: по одному кадру открываем карты, пока не дошли до эпика/легендарки.
  useEffect(() => {
    if (phase !== 'cards' || spot !== null || !autoRef.current) return;
    const next = flipped.findIndex((x) => !x);
    if (next < 0) {
      autoRef.current = false;
      return;
    }
    const id = setTimeout(() => flip(next), reduced() ? 60 : 160);
    return () => clearTimeout(id);
  }, [phase, flipped, spot, flip]);

  // Одиночный призыв открывается сам.
  useEffect(() => {
    if (phase === 'cards' && props.heroes.length === 1 && !flipped[0]) {
      const id = setTimeout(() => flip(0), 250);
      return () => clearTimeout(id);
    }
  }, [phase, props.heroes.length, flipped, flip]);

  const openAll = () => {
    autoRef.current = true;
    const next = flipped.findIndex((x) => !x);
    if (next >= 0) flip(next);
  };
  const skip = () => {
    autoRef.current = false;
    setSpot(null);
    setFlipped(props.heroes.map(() => true));
    setPhase('cards');
  };

  if (phase === 'portal')
    return (
      <div
        className={`sr sr--portal sr--${best}`}
        style={{ ['--pc' as string]: RARITY_COLOR[best] }}
        onClick={() => setPhase('cards')}
        role="presentation"
      >
        <div className="sr-portal">
          <i className="sr-ring r1" />
          <i className="sr-ring r2" />
          <i className="sr-ring r3" />
          <i className="sr-core" />
          <i className="sr-pillar" />
          {Array.from({ length: 14 }, (_, k) => (
            <i key={k} className="sr-spark" style={{ ['--k' as string]: k }} />
          ))}
        </div>
        <p className="sr-hint">{t('summon.fx.charging')}</p>
        <button type="button" className="sr-skip chip" onClick={skip}>
          {t('summon.fx.skip')}
        </button>
      </div>
    );

  const sp = spot !== null ? props.heroes[spot]! : null;
  const sd = sp ? heroDef(sp.heroId) : null;
  return (
    <div className={`sr sr--cards${props.heroes.length === 1 ? ' is-one' : ''}`}>
      <div className="sr-grid">
        {props.heroes.map((h, i) => {
          const d = heroDef(h.heroId);
          return (
            <button
              key={h.uid}
              type="button"
              className={`sr-card${flipped[i] ? ' is-open' : ''} r-${d.rarity}`}
              style={{
                ['--rc' as string]: RARITY_COLOR[d.rarity],
                ['--fc' as string]: FACTION_COLOR[d.faction],
                animationDelay: `${i * 60}ms`,
              }}
              onClick={() => !flipped[i] && flip(i)}
              aria-label={flipped[i] ? d.name : t('summon.fx.tapCard')}
            >
              <span className="sr-card__inner">
                <span className="sr-card__back">
                  <i />
                </span>
                <span className="sr-card__face">
                  <img src={unitArtUrl(d.art)} alt="" />
                  <b>{d.name}</b>
                  <Stars n={h.stars} />
                  {firstNew[i] && <em className="sr-new">{t('summon.new')}</em>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="sr-btns">
        {!done ? (
          <>
            <button type="button" className="btn" onClick={skip}>
              {t('summon.fx.skip')}
            </button>
            <button type="button" className="btn btn--gold" onClick={openAll}>
              {t('summon.fx.openAll')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={props.onClose}>
              {t('summon.done')}
            </button>
            <button type="button" className="btn btn--gold" onClick={props.onAgain}>
              {t('summon.again')}
            </button>
          </>
        )}
      </div>

      {sp && sd && (
        <div
          className={`sr-spot r-${sd.rarity}`}
          style={{
            ['--rc' as string]: RARITY_COLOR[sd.rarity],
            ['--ec' as string]: ELEMENT_COLOR[sd.element],
          }}
          onClick={() => setSpot(null)}
          role="presentation"
        >
          <i className="sr-rays" />
          <span className="sr-spot__rar">{t(`labels.rarity.${sd.rarity}`)}</span>
          <img src={unitArtUrl(sd.art)} alt={sd.name} />
          <h2>{sd.name}</h2>
          <p>{sd.title}</p>
          <div className="tags">
            <span className="tag" style={{ color: ELEMENT_COLOR[sd.element] }}>
              {t(`labels.element.${sd.element}`)}
            </span>
            <span className="tag">{t(`labels.role.${sd.role}`)}</span>
            <span className="tag" style={{ color: FACTION_COLOR[sd.faction] }}>
              {t(`labels.factionShort.${sd.faction}`)}
            </span>
          </div>
          {spot !== null && firstNew[spot] && <em className="sr-new big">{t('summon.new')}</em>}
          <small>{t('summon.fx.tapContinue')}</small>
        </div>
      )}
    </div>
  );
}
