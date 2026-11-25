import { useMemo, useState } from 'react';
import { CHAPTERS, enemyDef, type StageDef } from '@/content';
import { chapterStars, currentStage, isStageUnlocked, stagePower, teamPower } from '@/game';
import { formatNumber, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { startCampaignStage } from '@/state/actions';
import { platform } from '@/state/services';
import { unitArtUrl } from '@/assets/art';
import { IconEnergy, IconGold, IconShard } from '../components/icons';
import { RewardIcon } from '../components/RewardIcon';
import './screens.css';
import './campaign.css';

const CHAPTER_COLOR = ['#a37cff', '#4fd6e0', '#ff7a2a'];

const Star = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2 L14.6 9 L22 9 L16 13.5 L18.3 21 L12 16.5 L5.7 21 L8 13.5 L2 9 L9.4 9 Z"
      fill={on ? '#f0c860' : '#2a2236'}
      stroke="#0a0710"
      strokeWidth="1.8"
    />
  </svg>
);

export default function CampaignScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const cur = currentStage(save);
  const [chapter, setChapter] = useState(cur.chapter);
  const [selId, setSelId] = useState<string>(cur.id);
  const ch = CHAPTERS[chapter - 1]!;
  const color = CHAPTER_COLOR[chapter - 1]!;
  const sel = ch.stages.find((s) => s.id === selId) ?? null;
  const tp = teamPower(save);

  const pickChapter = (n: number) => {
    setChapter(n);
    const first = CHAPTERS[n - 1]!.stages;
    const target =
      first.find((s) => s.id === cur.id) ??
      [...first].reverse().find((s) => isStageUnlocked(save, s.id)) ??
      first[0]!;
    setSelId(target.id);
  };

  return (
    <>
      <div className="chap-tabs">
        {CHAPTERS.map((c, i) => {
          const unlocked = isStageUnlocked(save, c.stages[0]!.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={chapter === c.id}
              disabled={!unlocked}
              style={{ ['--c' as string]: CHAPTER_COLOR[i] }}
              onClick={() => pickChapter(c.id)}
            >
              <b>{t('campaign.chapter', { n: c.id })}</b>
              {unlocked ? t('campaign.stars', { n: chapterStars(save, c.id), max: 30 }) : '🔒'}
            </button>
          );
        })}
      </div>
      <section className="chap-head" style={{ ['--c' as string]: color }}>
        <h2>{ch.name}</h2>
        <p>{ch.desc}</p>
      </section>
      <div className="path">
        {ch.stages.map((s) => (
          <StageNode
            key={s.id}
            stage={s}
            color={color}
            selected={s.id === selId}
            current={s.id === cur.id}
            onPick={() => setSelId(s.id)}
          />
        ))}
      </div>
      {sel && <StagePanel stage={sel} teamPow={tp} />}
    </>
  );
}

function StageNode(props: {
  stage: StageDef;
  color: string;
  selected: boolean;
  current: boolean;
  onPick: () => void;
}) {
  const save = useGame((s) => s.save)!;
  const { stage } = props;
  const unlocked = isStageUnlocked(save, stage.id);
  const stars = save.campaign.stars[stage.id] ?? 0;
  const cls = [
    'node',
    stage.boss && 'node--boss',
    !unlocked && 'node--locked',
    props.current && 'node--cur',
    props.selected && 'node--sel',
  ]
    .filter(Boolean)
    .join(' ');
  const bossArt = stage.boss ? stage.waves.at(-1)!.find((e) => e.boss)!.id : null;
  return (
    <div className="node-row">
      <button
        type="button"
        className={cls}
        style={{ ['--c' as string]: props.color }}
        aria-label={`${stage.id} ${stage.name}`}
        onClick={() => {
          platform().audio.play('tap');
          props.onPick();
        }}
      >
        {bossArt ? <img src={unitArtUrl(enemyDef(bossArt).art)} alt="" /> : stage.index}
        {!unlocked && (
          <svg className="node__lock" viewBox="0 0 24 24" aria-hidden="true">
            <rect
              x="5"
              y="10"
              width="14"
              height="11"
              rx="2"
              fill="#8a8094"
              stroke="#0a0710"
              strokeWidth="1.5"
            />
            <path d="M8 10 V7 a4 4 0 0 1 8 0 V10" fill="none" stroke="#8a8094" strokeWidth="2.4" />
          </svg>
        )}
        {unlocked && (
          <span className="node__stars">
            {[1, 2, 3].map((n) => (
              <Star key={n} on={stars >= n} />
            ))}
          </span>
        )}
      </button>
    </div>
  );
}

function StagePanel({ stage, teamPow }: { stage: StageDef; teamPow: number }) {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const go = useGame((s) => s.go);
  const showToast = useGame((s) => s.showToast);
  const unlocked = isStageUnlocked(save, stage.id);
  const need = stagePower(stage);
  const first = !save.campaign.stars[stage.id];
  const foes = useMemo(() => {
    const m = new Map<string, { id: string; level: number; boss: boolean }>();
    for (const w of stage.waves)
      for (const e of w) if (!m.has(e.id)) m.set(e.id, { id: e.id, level: e.level, boss: !!e.boss });
    return [...m.values()];
  }, [stage]);
  return (
    <section className="stage-panel">
      <div>
        <small>
          {stage.id} · {t('campaign.wave', { n: stage.waves.length })}
          {stage.boss ? ` · ${t('campaign.boss')}` : ''}
        </small>
        <h3>{stage.name}</h3>
      </div>
      <div className="foes">
        {foes.map((f) => {
          const d = enemyDef(f.id);
          return (
            <span className={`foe${f.boss ? ' foe--boss' : ''}`} key={f.id} title={d.name}>
              <img src={unitArtUrl(d.art)} alt={d.name} />
              {f.level} ур.
            </span>
          );
        })}
      </div>
      <div className="pw">
        {t('campaign.power')} <b className={teamPow >= need ? 'ok' : 'low'}>{formatNumber(teamPow)}</b> ·{' '}
        {t('campaign.needPower', { n: formatNumber(need) })}
      </div>
      <div className="rw-inline">
        <span>
          <IconGold />
          {formatNumber(stage.rewards.gold)}
        </span>
        <span>
          <RewardIcon icon="xp" />
          {formatNumber(stage.rewards.heroXp)}
        </span>
        {first && (
          <span title={t('campaign.firstClear')}>
            <IconShard />+{stage.firstClear.shards}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
        <button type="button" className="btn" onClick={() => go('team')}>
          {t('campaign.team')}
        </button>
        <button
          type="button"
          className="btn btn--gold"
          disabled={!unlocked}
          onClick={() => {
            if (!unlocked) return showToast(t('campaign.stageLocked'));
            platform().haptics.impact('medium');
            startCampaignStage(stage.id);
          }}
        >
          {t('campaign.fight')} · <IconEnergy /> {stage.energy}
        </button>
      </div>
    </section>
  );
}
