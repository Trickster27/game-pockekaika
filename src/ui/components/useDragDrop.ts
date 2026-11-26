import { useEffect, useRef, useState } from 'react';

/**
 * Перетаскивание пальцем и мышью без библиотек.
 *
 * - Мышь и «жёсткие» источники (ячейки отряда) берутся сразу, как только указатель сдвинулся на 6 px.
 * - Источники в прокручиваемом списке берутся долгим нажатием (280 мс), чтобы обычный свайп листал список.
 * - Цель ищется по атрибуту data-drop под пальцем; у края экрана список сам прокручивается.
 * - Клик, который браузер шлёт после отпускания, гасится — перетаскивание не превращается в тап.
 */
export interface DragState<S> {
  src: S;
  x: number;
  y: number;
  over: string | null;
}

interface Pending<S> {
  src: S;
  id: number;
  x0: number;
  y0: number;
  hold: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  started: boolean;
}

const MOVE_PX = 6;
const HOLD_MS = 280;
const EDGE = 70;

export function useDragDrop<S>(opts: {
  onStart?: (src: S) => void;
  onDrop: (src: S, target: string) => void;
  /** Контейнер, который прокручивается у края (по умолчанию — ближайший прокручиваемый предок). */
  scrollParent?: () => HTMLElement | null;
}) {
  const [drag, setDrag] = useState<DragState<S> | null>(null);
  const pend = useRef<Pending<S> | null>(null);
  const dragRef = useRef<DragState<S> | null>(null);
  const suppressUntil = useRef(0);
  const scrollVel = useRef(0);
  const raf = useRef(0);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  /** Запуск перетаскивания: его вызывает и таймер долгого нажатия из source(). */
  const beginRef = useRef<(x: number, y: number) => void>(() => {});

  useEffect(() => {
    const update = (d: DragState<S> | null) => {
      dragRef.current = d;
      setDrag(d);
    };
    const targetAt = (x: number, y: number) =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]')?.dataset.drop ?? null;
    const scroller = () =>
      optsRef.current.scrollParent?.() ??
      document.querySelector<HTMLElement>('.app__main') ??
      (document.scrollingElement as HTMLElement | null);
    const stopScroll = () => {
      scrollVel.current = 0;
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    const tick = () => {
      const el = scroller();
      const d = dragRef.current;
      if (!el || !d || scrollVel.current === 0) {
        raf.current = 0;
        return;
      }
      el.scrollTop += scrollVel.current;
      // Под пальцем проехал другой элемент — пересчитать цель.
      const over = targetAt(d.x, d.y);
      if (over !== d.over) update({ ...d, over });
      raf.current = requestAnimationFrame(tick);
    };
    const finish = (drop: boolean) => {
      const p = pend.current;
      if (p?.timer) clearTimeout(p.timer);
      pend.current = null;
      stopScroll();
      const d = dragRef.current;
      if (d) {
        suppressUntil.current = performance.now() + 400;
        if (drop && d.over) optsRef.current.onDrop(d.src, d.over);
      }
      update(null);
    };
    const begin = (x: number, y: number) => {
      const p = pend.current;
      if (!p || p.started) return;
      p.started = true;
      if (p.timer) clearTimeout(p.timer);
      optsRef.current.onStart?.(p.src);
      update({ src: p.src, x, y, over: targetAt(x, y) });
    };
    beginRef.current = begin;

    const move = (e: PointerEvent) => {
      const p = pend.current;
      if (!p || e.pointerId !== p.id) return;
      if (!p.started) {
        if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < MOVE_PX) return;
        // Долгое нажатие ещё не сработало, а палец поехал — это прокрутка, не перетаскивание.
        if (p.hold) {
          if (p.timer) clearTimeout(p.timer);
          pend.current = null;
          return;
        }
        begin(e.clientX, e.clientY);
      }
      const d = dragRef.current;
      if (!d) return;
      update({ ...d, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY) });
      // Автопрокрутка у верхнего и нижнего края.
      const r = scroller()?.getBoundingClientRect();
      const top = Math.max(r?.top ?? 0, 0);
      const bottom = Math.min(r?.bottom ?? innerHeight, innerHeight);
      const v =
        e.clientY < top + EDGE
          ? -Math.ceil(((top + EDGE - e.clientY) / EDGE) * 14)
          : e.clientY > bottom - EDGE
            ? Math.ceil(((e.clientY - (bottom - EDGE)) / EDGE) * 14)
            : 0;
      scrollVel.current = v;
      if (v && !raf.current) raf.current = requestAnimationFrame(tick);
    };
    const up = (e: PointerEvent) => {
      if (pend.current && e.pointerId === pend.current.id) finish(true);
    };
    const cancel = (e: PointerEvent) => {
      if (pend.current && e.pointerId === pend.current.id) finish(false);
    };
    // Пока тащим, палец не должен листать страницу (touch-action уже не поменять посреди жеста).
    const touch = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current) finish(false);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', cancel);
    addEventListener('touchmove', touch, { passive: false });
    addEventListener('keydown', key);
    return () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', cancel);
      removeEventListener('touchmove', touch);
      removeEventListener('keydown', key);
      stopScroll();
      const p = pend.current;
      if (p?.timer) clearTimeout(p.timer);
    };
  }, []);

  /** Обработчики для источника. hold — брать долгим нажатием (для пальца в прокручиваемом списке). */
  const source = (src: S, hold = false) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || pend.current) return;
      const touchHold = hold && e.pointerType !== 'mouse';
      const p: Pending<S> = {
        src,
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        hold: touchHold,
        timer: null,
        started: false,
      };
      pend.current = p;
      if (touchHold) p.timer = setTimeout(() => beginRef.current(p.x0, p.y0), HOLD_MS);
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (performance.now() < suppressUntil.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    onContextMenu: (e: React.MouseEvent) => {
      // Долгое нажатие на телефоне не должно открывать меню картинки.
      if (hold) e.preventDefault();
    },
  });

  return { drag, source };
}
