import { useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n';
import { useGame } from '@/state/store';
import { platform } from '@/state/services';
import type { StageUnit } from '@/render/pixi/BattleStage';
import { IconBack } from '../components/icons';
import './screens.css';

const UNITS: StageUnit[] = [
  { key: 'wraith', side: 'enemy', x: 68, y: 170, scale: 0.85 },
  { key: 'mglaboss', side: 'enemy', x: 180, y: 180, scale: 1 },
  { key: 'wraith', side: 'enemy', x: 292, y: 170, scale: 0.85 },
  { key: 'hound', side: 'enemy', x: 118, y: 250, scale: 0.95 },
  { key: 'hound', side: 'enemy', x: 242, y: 250, scale: 0.95 },
  { key: 'knight', side: 'ally', x: 118, y: 404, scale: 1 },
  { key: 'dwarf', side: 'ally', x: 242, y: 404, scale: 1.05 },
  { key: 'elf', side: 'ally', x: 58, y: 500, scale: 0.95 },
  { key: 'necro', side: 'ally', x: 180, y: 503, scale: 0.95 },
  { key: 'demon', side: 'ally', x: 302, y: 500, scale: 0.95 },
];

/** Проверка рендера: PixiJS в браузере и WebView, тапы, хаптика, звук. Полноценный бой — этап 3. */
export default function BattleTestScreen() {
  const t = useT();
  const go = useGame((s) => s.go);
  const host = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let handle: { destroy(): void } | null = null;
    // Pixi грузится только здесь: в основной бандл он не попадает.
    void import('@/render/pixi/BattleStage').then(async ({ createBattleStage }) => {
      if (cancelled || !host.current) return;
      const h = await createBattleStage(host.current, {
        units: UNITS,
        onFps: setFps,
        onHit: (crit) => {
          platform().audio.play(crit ? 'crit' : 'hit');
          platform().haptics.impact(crit ? 'heavy' : 'light');
        },
      });
      if (cancelled) h.destroy();
      else handle = h;
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, []);

  return (
    <div className="bt">
      <div className="bt__top">
        <button className="icon-btn" type="button" aria-label={t('nav.back')} onClick={() => go('camp')}>
          <IconBack />
        </button>
        <h2>{t('battle.testTitle')}</h2>
        <span className="bt__fps">{t('battle.fps', { fps })}</span>
      </div>
      <div className="bt__stage" ref={host} />
      <div className="bt__hint">{t('battle.tapEnemy')}</div>
    </div>
  );
}
