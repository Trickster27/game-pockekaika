import { useEffect, useLayoutEffect, useState } from 'react';
import { advanceTutorial, finishTutorial, TUTORIAL_REWARD } from '@/game';
import { useT } from '@/i18n';
import { useGame, type ScreenId } from '@/state/store';
import { platform } from '@/state/services';
import type { SaveData } from '@/save/schema';
import { unitArtUrl } from '@/assets/art';
import './tutorial.css';

/**
 * Обучение первых минут. Наставница ведёт по шагам; нужная кнопка подсвечена,
 * остальной экран затемнён и не нажимается. Шаг засчитывается настоящим действием
 * игрока (нажатием на подсвеченное), уже сделанное пропускается само.
 * Если подсвечиваемого элемента нет на экране, подсказка не блокирует игру.
 */
interface Step {
  id: string;
  /** На каких экранах показывать шаг. */
  screens: ScreenId[];
  /** CSS-селектор подсвечиваемого элемента. Без него — подсказка с кнопкой «Дальше». */
  target?: string;
  /** Шаг уже не нужен (игрок сделал это сам). */
  skipIf?: (s: SaveData) => boolean;
  /** Не затемнять экран (бой). */
  soft?: boolean;
  /** Где показать подсказку относительно цели. */
  place?: 'above' | 'below';
}

const STEPS: Step[] = [
  { id: 'welcome', screens: ['camp'] },
  {
    id: 'campaign',
    screens: ['camp'],
    target: '.campmap [aria-label="Кампания"]',
    skipIf: (s) => s.stats.battlesWon > 0,
  },
  {
    id: 'stage',
    screens: ['campaign'],
    target: '[aria-label^="1-1"]',
    skipIf: (s) => s.stats.battlesWon > 0,
  },
  {
    id: 'fight',
    screens: ['campaign'],
    target: '.stage-panel .btn--gold',
    place: 'above',
    skipIf: (s) => s.stats.battlesWon > 0,
  },
  { id: 'battle', screens: ['battle'], soft: true, skipIf: (s) => s.stats.battlesWon > 0 },
  {
    id: 'toSummon',
    screens: ['camp', 'campaign', 'heroes', 'team', 'bag'],
    target: '[data-tut="nav-summon"]',
    place: 'above',
    skipIf: (s) => s.summon.total > 0,
  },
  {
    id: 'summon',
    screens: ['summon'],
    target: '[data-tut="summon-scroll"]',
    place: 'above',
    skipIf: (s) => s.summon.total > 0 || s.materials.scroll < 1,
  },
  {
    id: 'toHeroes',
    screens: ['summon', 'camp', 'campaign', 'team', 'bag'],
    target: '[data-tut="nav-heroes"]',
    place: 'above',
  },
  { id: 'hero', screens: ['heroes'], target: '.hgrid .htile' },
  {
    id: 'tome',
    screens: ['heroes'],
    target: '[data-tut="hero-tomax"]',
    skipIf: (s) => s.materials.xpTome < 1,
  },
  {
    id: 'toCamp',
    screens: ['heroes', 'team', 'summon', 'bag'],
    target: '[data-tut="nav-camp"]',
    place: 'above',
  },
  { id: 'idle', screens: ['camp'], target: '[data-tut="idle-open"]' },
  { id: 'idleClaim', screens: ['camp'], target: '[data-tut="idle-claim"]', place: 'above' },
  { id: 'quests', screens: ['camp'], target: '.campmap [aria-label="Задания"]', place: 'above' },
  { id: 'done', screens: ['quests', 'camp'] },
];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function Tutorial() {
  const t = useT();
  const tut = useGame((s) => s.save?.tutorial);
  const save = useGame((s) => s.save);
  const screen = useGame((s) => s.screen);
  const updateSave = useGame((s) => s.updateSave);
  const [box, setBox] = useState<Box | null>(null);
  const [blocked, setBlocked] = useState(false);

  const idx = tut && !tut.done ? Math.min(tut.step, STEPS.length - 1) : -1;
  const step = idx >= 0 ? STEPS[idx]! : null;
  const active = !!step && step.screens.includes(screen);

  // Уже сделанные шаги пропускаем.
  useEffect(() => {
    if (!step || !save || !step.skipIf?.(save)) return;
    updateSave((s) => advanceTutorial(s, idx + 1));
  }, [step, save, idx, updateSave]);

  // Следим за положением цели: экран может прокручиваться и перестраиваться.
  useLayoutEffect(() => {
    if (!active) return;
    let raf = 0;
    let scrolledFor: string | undefined;
    const measure = () => {
      const el = step?.target ? document.querySelector(step.target) : null;
      // Открыто окно или анимация (призыв, итог боя, нижняя панель), а цель не в нём — подсказка ждёт.
      const modals = [...document.querySelectorAll('.sr, .overlay, .sheet-bg')];
      setBlocked(modals.length > 0 && !modals.some((m) => el && m.contains(el)));
      const r = el?.getBoundingClientRect();
      // Цель за краем экрана или под нижним меню — один раз прокручиваем к ней.
      if (el && r && scrolledFor !== step?.id && !el.closest('.nav')) {
        const nav = document.querySelector('.nav')?.getBoundingClientRect().top ?? innerHeight;
        if (r.bottom > nav || r.top < 0) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        scrolledFor = step?.id;
      }
      setBox((prev) => {
        if (!r || r.width === 0) return null;
        const next = { x: r.left, y: r.top, w: r.width, h: r.height };
        return prev && Math.abs(prev.x - next.x) + Math.abs(prev.y - next.y) + Math.abs(prev.w - next.w) < 1
          ? prev
          : next;
      });
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [active, step]);

  // Нажатие на подсвеченный элемент засчитывает шаг (само нажатие проходит дальше).
  useEffect(() => {
    if (!active || !step?.target) return;
    const onClick = (e: MouseEvent) => {
      const el = document.querySelector(step.target!);
      if (el && e.target instanceof Node && el.contains(e.target))
        updateSave((s) => advanceTutorial(s, idx + 1));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, step, idx, updateSave]);

  if (!step || !active || blocked) return null;
  const last = step.id === 'done';
  const next = () => {
    platform().audio.play('tap');
    if (last) {
      updateSave((s) => finishTutorial(s, true));
      useGame.getState().showToast(t('tutorial.rewardToast', { n: TUTORIAL_REWARD.shards ?? 0 }));
      platform().haptics.notify('success');
    } else updateSave((s) => advanceTutorial(s, idx + 1));
  };
  const skip = () => updateSave((s) => finishTutorial(s, false));

  const pad = 6;
  const shown = step.target ? box : null;
  const hole = shown
    ? { x: shown.x - pad, y: shown.y - pad, w: shown.w + pad * 2, h: shown.h + pad * 2 }
    : null;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const placeAbove = hole ? (step.place ? step.place === 'above' : hole.y > vh / 2) : false;
  const dim = !step.soft && !!hole;

  return (
    <div className={`tut${step.soft ? ' is-soft' : ''}`} aria-live="polite">
      {dim && hole && (
        <>
          <i className="tut-dim" style={{ left: 0, top: 0, right: 0, height: Math.max(0, hole.y) }} />
          <i className="tut-dim" style={{ left: 0, top: hole.y + hole.h, right: 0, bottom: 0 }} />
          <i
            className="tut-dim"
            style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }}
          />
          <i className="tut-dim" style={{ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} />
          <i className="tut-ring" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
        </>
      )}
      {!hole && !step.soft && <i className="tut-dim tut-dim--full" />}
      <div
        className={`tut-bubble${placeAbove ? ' is-above' : ''}${!hole ? ' is-center' : ''}`}
        style={hole ? (placeAbove ? { bottom: vh - hole.y + 12 } : { top: hole.y + hole.h + 12 }) : undefined}
      >
        <img src={unitArtUrl('selesta')} alt="" />
        <div>
          <b>{t('tutorial.mentor')}</b>
          <p>{t(`tutorial.steps.${step.id}`)}</p>
          <div className="tut-acts">
            <button type="button" className="tut-skip" onClick={skip}>
              {t('tutorial.skip')}
            </button>
            {(!step.target || !hole) && (
              <button type="button" className="btn btn--gold" onClick={next}>
                {last ? t('tutorial.finish') : t('tutorial.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
