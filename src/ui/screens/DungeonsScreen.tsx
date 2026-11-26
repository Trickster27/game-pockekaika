import { useState } from 'react';
import {
  DUNGEONS,
  DUNGEON_LEVELS,
  SETS,
  dungeonEnemyLevel,
  dungeonEnergy,
  enemyDef,
  type DungeonId,
} from '@/content';
import { isDungeonLevelUnlocked, teamPower } from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { canSweepDungeon, startDungeon, sweepDungeon } from '@/state/actions';
import { SweepButtons } from '../components/SummaryModal';
import { platform } from '@/state/services';
import { unitStillUrl } from '@/assets/art';
import { IconEnergy } from '../components/icons';
import { MaterialIcon } from '../components/MaterialIcon';
import type { MaterialId } from '@/save/schema';
import './screens.css';
import './heroes.css';
import './campaign.css';

const COLORS: Record<DungeonId, string> = {
  crypt: '#4fd6e0',
  starcave: '#a37cff',
  forgevault: '#ff7a2a',
  skyspire: '#7fb8ff',
};

export default function DungeonsScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const [id, setId] = useState<DungeonId>('crypt');
  const d = DUNGEONS.find((x) => x.id === id)!;
  const maxDone = save.dungeons[id] ?? 0;
  const [level, setLevel] = useState(Math.min(DUNGEON_LEVELS, maxDone + 1));
  const pick = (nid: DungeonId) => {
    setId(nid);
    setLevel(Math.min(DUNGEON_LEVELS, (save.dungeons[nid] ?? 0) + 1));
  };
  const unlocked = isDungeonLevelUnlocked(save, id, level);
  return (
    <>
      <h2 className="screen-title">{t('dungeons.title')}</h2>
      <p className="screen-sub">{t('dungeons.subtitle')}</p>
      <div className="dg-cards">
        {DUNGEONS.map((x) => (
          <button
            key={x.id}
            type="button"
            className="dg"
            aria-pressed={x.id === id}
            style={{ ['--c' as string]: COLORS[x.id] }}
            onClick={() => pick(x.id)}
          >
            <b>{x.name}</b>
            <span>{x.desc}</span>
            <span>
              {t('dungeons.cleared')}: {save.dungeons[x.id] ?? 0}/{DUNGEON_LEVELS}
            </span>
          </button>
        ))}
      </div>
      <section className="stage-panel" style={{ position: 'static', marginTop: 12 }}>
        <small>{d.name}</small>
        <div className="dlevels">
          {Array.from({ length: DUNGEON_LEVELS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={n === level}
              className={n <= maxDone ? 'done' : undefined}
              disabled={!isDungeonLevelUnlocked(save, id, n)}
              onClick={() => setLevel(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="foes">
          {[...d.minions, d.boss].map((e) => (
            <span key={e} className={`foe${e === d.boss ? ' foe--boss' : ''}`} title={enemyDef(e).name}>
              <img src={unitStillUrl(enemyDef(e).art)} alt="" />
              {t('ui.lvl', { n: dungeonEnemyLevel(level) })}
            </span>
          ))}
        </div>
        <div className="pw">
          {t('dungeons.drops')}:{' '}
          {d.gearSets
            ? t('dungeons.gearDrop', {
                sets: SETS.filter((s) => d.gearSets!.includes(s.id))
                  .map((s) => s.name)
                  .join(', '),
              })
            : Object.keys(d.materials ?? {})
                .map((m) => t(`labels.material.${m}`))
                .join(', ')}
        </div>
        {d.materials && (
          <div className="rw-inline">
            {Object.keys(d.materials).map((m) => (
              <span key={m}>
                <MaterialIcon id={m as MaterialId} />
                {t(`labels.material.${m}`)}
              </span>
            ))}
          </div>
        )}
        <div className="pw">
          {t('campaign.power')} <b>{formatNumber(teamPower(save))}</b>
        </div>
        <button
          type="button"
          className="btn btn--gold"
          disabled={!unlocked}
          onClick={() => {
            platform().haptics.impact('medium');
            startDungeon(id, level);
          }}
        >
          {t('dungeons.fight')} · <IconEnergy /> {dungeonEnergy(level)}
        </button>
        {canSweepDungeon(id, level) && (
          <SweepButtons
            hint={t('sweep.dhint')}
            cost={dungeonEnergy(level)}
            onSweep={(n) => sweepDungeon(id, level, n)}
          />
        )}
      </section>
    </>
  );
}
