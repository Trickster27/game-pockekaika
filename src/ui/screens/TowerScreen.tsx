import { enemyDef } from '@/content';
import { towerLevel, towerReward, towerWaves } from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { startTower } from '@/state/actions';
import { platform } from '@/state/services';
import './screens.css';
import './modes.css';

export default function TowerScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const next = save.tower.floor + 1;
  // Следующий этаж сверху, дальше — ближайшие этажи и последние пройденные.
  const floors = [
    ...Array.from({ length: 10 }, (_, i) => next + i),
    ...Array.from({ length: 3 }, (_, i) => next - 1 - i).filter((f) => f >= 1),
  ];
  return (
    <>
      <section className="tower-hero">
        <div>
          <b>{t('tower.floor', { n: next })}</b>
          <span>{t('tower.subtitle')}</span>
          <br />
          <span>{t('tower.best', { n: save.tower.floor })}</span>
        </div>
        <svg viewBox="0 0 80 120" aria-hidden="true">
          <g stroke="#0a0710" strokeWidth="2.6" strokeLinejoin="round">
            <path d="M18 118 L26 40 L54 40 L62 118 Z" fill="#3a3f5c" />
            <path d="M18 118 L26 40 L40 40 L40 118 Z" fill="#4c5376" />
            <rect x="35" y="60" width="10" height="13" fill="#ffd36b" />
            <rect x="35" y="88" width="10" height="13" fill="#ffd36b" />
            <path d="M24 40 L56 40 L52 30 L28 30 Z" fill="#2c3048" />
            <path d="M40 2 L30 20 L40 30 L50 20 Z" fill="#f0c860" />
          </g>
        </svg>
      </section>
      <div className="floors">
        {floors.map((f) => {
          const waves = towerWaves(f);
          const boss = waves.flat().find((e) => e.boss);
          const r = towerReward(f);
          const cls = ['floor', f === next && 'is-next', f < next && 'is-done', f % 10 === 0 && 'is-chest']
            .filter(Boolean)
            .join(' ');
          return (
            <div key={f} className={cls}>
              <b>{f}</b>
              <div>
                <span>
                  {t('tower.enemies', { n: towerLevel(f) })}
                  {boss ? ` · ${t('tower.boss')}: ${enemyDef(boss.id).name}` : ''}
                </span>
                <br />
                <span>
                  {t('tower.reward')}: {formatNumber(r.gold ?? 0)} {t('rewards.gold').toLowerCase()}
                  {r.shards ? ` · ${r.shards} ◆` : ''}
                  {r.materials ? ` · ${t('tower.chest', { n: f })}` : ''}
                </span>
              </div>
              {f === next && (
                <button
                  type="button"
                  className="btn btn--gold"
                  onClick={() => {
                    platform().haptics.impact('medium');
                    startTower(f);
                  }}
                >
                  {t('dungeons.fight')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
